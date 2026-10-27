package com.codeit.careeros.service;

import com.codeit.careeros.dto.cv.DetectedSkillResponse;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.dto.insight.SkillGapResponse;
import com.codeit.careeros.dto.linkedin.LinkedInAnalysisResponse;
import com.codeit.careeros.dto.linkedin.LinkedInProfileRequest;
import com.codeit.careeros.dto.linkedin.LinkedInProfileResponse;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.linkedin.LinkedInProfile;
import com.codeit.careeros.repository.LinkedInProfileRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.SecurityUtils;
import com.codeit.careeros.skill.Skill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Sprint 6 LinkedIn analysis. LinkedIn offers no supported way to fetch a
 * personal profile and scraping violates its terms, so the student links
 * their public URL and imports the visible sections manually — everything
 * analysed is student-supplied, never fabricated. Gaps come from the
 * Sprint 3 readiness calculation and skill matching reuses the Sprint 5
 * master matcher; CV comparison joins the Sprint 5 analysis.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LinkedInService {

    private static final Pattern PROFILE_URL = Pattern.compile(
            "^https?://([a-z0-9-]+\\.)*linkedin\\.com/in/[A-Za-z0-9_.\\-/%]+/?$",
            Pattern.CASE_INSENSITIVE);

    private final LinkedInProfileRepository linkedInProfileRepository;
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final CareerInsightService careerInsightService;
    private final CvAnalysisService cvAnalysisService;

    /** Creates or replaces the current student's LinkedIn data. */
    @Transactional
    public LinkedInProfileResponse save(LinkedInProfileRequest request) {
        Long userId = SecurityUtils.currentUserId();
        String url = normalizeUrl(request.profileUrl());
        if (!PROFILE_URL.matcher(url).matches()) {
            throw BusinessException.badRequest("Please provide a valid personal LinkedIn profile URL "
                    + "(https://www.linkedin.com/in/your-name)");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("User not found: " + userId));

        LinkedInProfile profile = linkedInProfileRepository.findByUserId(userId)
                .orElseGet(() -> LinkedInProfile.builder().user(user).build());
        profile.setProfileUrl(url);
        profile.setHeadline(blankToNull(request.headline()));
        profile.setAbout(blankToNull(request.about()));
        profile.setCurrentRole(blankToNull(request.currentRole()));
        profile.setExperienceText(blankToNull(request.experienceText()));
        profile.setSkillsText(blankToNull(request.skillsText()));
        profile.setEducationText(blankToNull(request.educationText()));
        profile = linkedInProfileRepository.save(profile);

        log.info("Student {} saved LinkedIn profile {}", userId, url);
        return toResponse(profile);
    }

    /** Current student's LinkedIn data, or null when none was saved yet. */
    @Transactional(readOnly = true)
    public LinkedInProfileResponse myProfile() {
        return linkedInProfileRepository.findByUserId(SecurityUtils.currentUserId())
                .map(LinkedInService::toResponse)
                .orElse(null);
    }

    /** Full analysis of the current student's LinkedIn presence. */
    @Transactional(readOnly = true)
    public LinkedInAnalysisResponse analyze() {
        return analyzeFor(SecurityUtils.currentUserId());
    }

    /** LinkedIn analysis of a specific student. Caller must authorize the student. */
    @Transactional(readOnly = true)
    public LinkedInAnalysisResponse analyzeFor(Long userId) {
        LinkedInProfile profile = linkedInProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null) {
            return new LinkedInAnalysisResponse(false, false, null, null, null, 0,
                    List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                    0, List.of(), List.of());
        }

        String combined = String.join("\n",
                nonNull(profile.getHeadline()), nonNull(profile.getAbout()),
                nonNull(profile.getCurrentRole()), nonNull(profile.getExperienceText()),
                nonNull(profile.getSkillsText()), nonNull(profile.getEducationText()));
        String normalized = CvAnalysisService.normalize(combined);
        Map<Long, DetectedSkillResponse> detected = new LinkedHashMap<>();
        for (Skill skill : skillRepository.findAllByOrderByNameAsc()) {
            if (!skill.isActive()) {
                continue;
            }
            if (CvAnalysisService.mentions(normalized, skill.getName())) {
                detected.put(skill.getId(), new DetectedSkillResponse(
                        skill.getId(), skill.getName(), skill.getCategory().name()));
            }
        }

        ReadinessResponse readiness = careerInsightService.readinessFor(userId);
        List<SkillGapResponse> matched = new ArrayList<>();
        List<SkillGapResponse> missing = new ArrayList<>();
        if (readiness.hasTarget()) {
            for (SkillGapResponse gap : readiness.gaps()) {
                if (detected.containsKey(gap.skillId())) {
                    matched.add(gap);
                } else {
                    missing.add(gap);
                }
            }
        }
        int frameworkSize = matched.size() + missing.size();
        int alignment = frameworkSize == 0 ? 0
                : Math.round((matched.size() * 100.0f) / frameworkSize);

        List<DetectedSkillResponse> cvSkills = cvAnalysisService.analyzeFor(userId).detectedSkills();
        Map<Long, DetectedSkillResponse> cvById = new LinkedHashMap<>();
        for (DetectedSkillResponse skill : cvSkills) {
            cvById.put(skill.skillId(), skill);
        }
        List<DetectedSkillResponse> alsoOnCv = new ArrayList<>();
        List<DetectedSkillResponse> onlyOnLinkedIn = new ArrayList<>();
        for (DetectedSkillResponse skill : detected.values()) {
            if (cvById.containsKey(skill.skillId())) {
                alsoOnCv.add(skill);
            } else {
                onlyOnLinkedIn.add(skill);
            }
        }
        List<DetectedSkillResponse> onlyOnCv = cvById.values().stream()
                .filter(skill -> !detected.containsKey(skill.skillId()))
                .toList();

        List<String> strengths = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();
        check(nonNull(profile.getHeadline()).length() >= 10,
                "Headline present", "Write a headline naming your target role and 1–2 key skills.",
                strengths, suggestions);
        check(nonNull(profile.getAbout()).length() >= 150,
                "About section has substance", "Expand About to a short paragraph: who you are, what you build, what you want next.",
                strengths, suggestions);
        check(!nonNull(profile.getExperienceText()).isBlank(),
                "Experience listed", "Add Experience entries — recruiters filter on them.",
                strengths, suggestions);
        check(!nonNull(profile.getEducationText()).isBlank(),
                "Education listed", "Add your Education — many roles require it.",
                strengths, suggestions);
        check(detected.size() >= 3,
                detected.size() + " skills detected",
                "List at least 3 skills explicitly so they get detected and matched.",
                strengths, suggestions);
        if (readiness.hasTarget()) {
            if (missing.isEmpty() && frameworkSize > 0) {
                strengths.add("Every required " + readiness.targetCareerName() + " skill is on your profile");
            } else if (!missing.isEmpty()) {
                int shown = Math.min(3, missing.size());
                suggestions.add("Add these required skills to your profile: "
                        + missing.subList(0, shown).stream()
                                .map(SkillGapResponse::skillName)
                                .collect(java.util.stream.Collectors.joining(", "))
                        + (missing.size() > shown ? ", and " + (missing.size() - shown) + " more." : "."));
            }
        } else {
            suggestions.add("Choose a target career to compare your profile against what employers expect.");
        }
        for (DetectedSkillResponse skill : onlyOnCv.stream().limit(3).toList()) {
            suggestions.add(skill.skillName() + " is on your CV but missing here — add it to LinkedIn too.");
        }

        int total = strengths.size() + suggestions.size();
        int completeness = total == 0 ? 0 : Math.round((strengths.size() * 100.0f) / total);
        log.info("LinkedIn analysis for student {}: {} detected skills, alignment {}%",
                userId, detected.size(), alignment);
        return new LinkedInAnalysisResponse(
                true, readiness.hasTarget(), readiness.targetCareerId(), readiness.targetCareerName(),
                toResponse(profile), alignment, List.copyOf(detected.values()),
                matched, missing, alsoOnCv, onlyOnLinkedIn, onlyOnCv,
                completeness, strengths, suggestions);
    }

    private static String normalizeUrl(String raw) {
        String url = raw == null ? "" : raw.strip();
        if (!url.contains("://")) {
            url = "https://" + url;
        }
        return url;
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.strip();
    }

    private static String nonNull(String value) {
        return value == null ? "" : value;
    }

    private static void check(boolean passed, String strength, String suggestion,
                              List<String> strengths, List<String> suggestions) {
        if (passed) {
            strengths.add(strength);
        } else {
            suggestions.add(suggestion);
        }
    }

    static LinkedInProfileResponse toResponse(LinkedInProfile profile) {
        return new LinkedInProfileResponse(
                profile.getId(), profile.getProfileUrl(), profile.getHeadline(),
                profile.getAbout(), profile.getCurrentRole(), profile.getExperienceText(),
                profile.getSkillsText(), profile.getEducationText(), profile.getUpdatedAt());
    }
}
