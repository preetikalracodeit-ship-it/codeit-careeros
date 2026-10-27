package com.codeit.careeros.service;

import com.codeit.careeros.assessment.AssessmentAttempt;
import com.codeit.careeros.assessment.SkillScore;
import com.codeit.careeros.career.CareerSkill;
import com.codeit.careeros.common.enums.AttemptStatus;
import com.codeit.careeros.common.enums.ProgressStatus;
import com.codeit.careeros.dto.roadmap.RoadmapItemResponse;
import com.codeit.careeros.dto.roadmap.RoadmapPhaseResponse;
import com.codeit.careeros.dto.roadmap.RoadmapResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.CareerSkillRepository;
import com.codeit.careeros.repository.RoadmapItemProgressRepository;
import com.codeit.careeros.repository.RoadmapItemRepository;
import com.codeit.careeros.repository.RoadmapPhaseRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.roadmap.RoadmapItem;
import com.codeit.careeros.roadmap.RoadmapItemProgress;
import com.codeit.careeros.roadmap.RoadmapPhase;
import com.codeit.careeros.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Sprint 4 personalized roadmap (docs section 18): the phase/step structure
 * of the student's target career from {@code roadmap_phases}/
 * {@code roadmap_items}, enriched per step with the student's live skill gap
 * (latest submitted score vs the career framework target) and the student's
 * own item progress. No career-specific rules are hardcoded; everything
 * structural comes from the database.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoadmapService {

    private final StudentProfileRepository studentProfileRepository;
    private final RoadmapPhaseRepository phaseRepository;
    private final RoadmapItemRepository itemRepository;
    private final RoadmapItemProgressRepository progressRepository;
    private final CareerSkillRepository careerSkillRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final SkillScoreRepository skillScoreRepository;
    private final UserRepository userRepository;

    /** Personalized roadmap of the current student for their target career. */
    @Transactional(readOnly = true)
    public RoadmapResponse myRoadmap() {
        return roadmapFor(SecurityUtils.currentUserId());
    }

    /** Roadmap of a specific student. Caller must authorize the student. */
    @Transactional(readOnly = true)
    public RoadmapResponse roadmapFor(Long userId) {
        StudentProfile profile = studentProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null || profile.getTargetCareer() == null) {
            return new RoadmapResponse(null, null, false, 0, 0, 0, 0, List.of());
        }
        Long careerId = profile.getTargetCareer().getId();
        String careerName = profile.getTargetCareer().getName();

        Map<Long, CareerSkill> framework = careerSkillRepository
                .findByCareerIdOrderByWeightPercentDesc(careerId).stream()
                .collect(Collectors.toMap(cs -> cs.getSkill().getId(), Function.identity()));
        Map<Long, SkillScore> latestBySkill = latestScoresBySkill(userId, careerId);
        Map<Long, ProgressStatus> statusByItem = progressRepository
                .findByUserIdAndRoadmapItemPhaseCareerId(userId, careerId).stream()
                .collect(Collectors.toMap(
                        p -> p.getRoadmapItem().getId(), RoadmapItemProgress::getStatus,
                        (first, second) -> first));

        List<RoadmapPhaseResponse> phases = new ArrayList<>();
        int total = 0;
        int completed = 0;
        int inProgress = 0;
        for (RoadmapPhase phase : phaseRepository.findByCareerIdOrderByDisplayOrderAsc(careerId)) {
            List<RoadmapItemResponse> items = new ArrayList<>();
            int phaseCompleted = 0;
            for (RoadmapItem item : itemRepository.findByPhaseIdOrderByDisplayOrderAsc(phase.getId())) {
                ProgressStatus status = statusByItem.getOrDefault(item.getId(), ProgressStatus.NOT_STARTED);
                total++;
                if (status == ProgressStatus.COMPLETED) {
                    completed++;
                    phaseCompleted++;
                } else if (status == ProgressStatus.IN_PROGRESS) {
                    inProgress++;
                }
                items.add(toItemResponse(item, framework, latestBySkill, status));
            }
            phases.add(new RoadmapPhaseResponse(
                    phase.getId(), phase.getTitle(), phase.getDescription(),
                    phase.getDisplayOrder(), phase.getDurationDays(),
                    items.size(), phaseCompleted, items));
        }

        int progressPercent = total == 0 ? 0 : Math.round((completed * 100.0f) / total);
        log.info("Roadmap for student {} on career {}: {}/{} items completed",
                profile.getStudentId(), careerId, completed, total);
        return new RoadmapResponse(
                careerId, careerName, true, progressPercent, total, completed, inProgress, phases);
    }

    /** Marks a roadmap item NOT_STARTED / IN_PROGRESS / COMPLETED for the current student. */
    @Transactional
    public RoadmapItemResponse updateItemStatus(Long itemId, String statusRaw) {
        Long userId = SecurityUtils.currentUserId();
        ProgressStatus status = parseStatus(statusRaw);
        RoadmapItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> BusinessException.notFound("Roadmap item not found: " + itemId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("User not found: " + userId));

        RoadmapItemProgress progress = progressRepository
                .findByUserIdAndRoadmapItemId(userId, itemId)
                .orElseGet(() -> RoadmapItemProgress.builder().user(user).roadmapItem(item).build());
        progress.setStatus(status);
        progressRepository.save(progress);

        Long careerId = item.getPhase().getCareer().getId();
        Map<Long, CareerSkill> framework = careerSkillRepository
                .findByCareerIdOrderByWeightPercentDesc(careerId).stream()
                .collect(Collectors.toMap(cs -> cs.getSkill().getId(), Function.identity()));
        log.info("Student {} set roadmap item {} to {}", userId, itemId, status);
        return toItemResponse(item, framework, latestScoresBySkill(userId, careerId), status);
    }

    private RoadmapItemResponse toItemResponse(
            RoadmapItem item,
            Map<Long, CareerSkill> framework,
            Map<Long, SkillScore> latestBySkill,
            ProgressStatus status) {
        Long skillId = null;
        String skillName = null;
        String skillCategory = null;
        Integer targetPercent = null;
        Integer scorePercent = null;
        Integer gapPercent = null;
        boolean assessed = false;
        if (item.getSkill() != null) {
            skillId = item.getSkill().getId();
            skillName = item.getSkill().getName();
            skillCategory = item.getSkill().getCategory().name();
            CareerSkill mapping = framework.get(skillId);
            targetPercent = mapping != null ? mapping.getTargetPercent() : null;
            SkillScore score = latestBySkill.get(skillId);
            if (score != null) {
                assessed = true;
                scorePercent = score.getScorePercent();
                gapPercent = targetPercent == null ? null : scorePercent - targetPercent;
            }
        }
        return new RoadmapItemResponse(
                item.getId(), item.getTitle(), item.getDescription(), item.getLearningGoal(),
                item.getEstimatedHours(), item.getDisplayOrder(),
                skillId, skillName, skillCategory, targetPercent,
                scorePercent, gapPercent, assessed, status.name());
    }

    /**
     * Latest submitted score per skill for the student's attempts on the
     * given career (same read-only rule as the Sprint 3 gap analysis:
     * newest submitted attempt wins per skill).
     */
    private Map<Long, SkillScore> latestScoresBySkill(Long userId, Long careerId) {
        List<AssessmentAttempt> submitted = attemptRepository
                .findByUserIdAndStatusOrderByStartedAtDesc(userId, AttemptStatus.SUBMITTED).stream()
                .filter(attempt -> attempt.getAssessment() != null
                        && attempt.getAssessment().getCareer() != null
                        && careerId.equals(attempt.getAssessment().getCareer().getId()))
                .toList();
        Map<Long, SkillScore> latestBySkill = new LinkedHashMap<>();
        for (AssessmentAttempt attempt : submitted) {
            for (SkillScore score : skillScoreRepository.findByAttemptIdOrderByWeightPercentDesc(attempt.getId())) {
                latestBySkill.putIfAbsent(score.getSkill().getId(), score);
            }
        }
        return latestBySkill;
    }

    static ProgressStatus parseStatus(String statusRaw) {
        if (statusRaw == null) {
            throw BusinessException.badRequest("Status is required (NOT_STARTED, IN_PROGRESS or COMPLETED)");
        }
        try {
            return ProgressStatus.valueOf(statusRaw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("Unknown status: " + statusRaw
                    + " (expected NOT_STARTED, IN_PROGRESS or COMPLETED)");
        }
    }
}
