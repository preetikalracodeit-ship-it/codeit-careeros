package com.codeit.careeros.service;

import com.codeit.careeros.cv.CvDocument;
import com.codeit.careeros.dto.cv.CvAnalysisResponse;
import com.codeit.careeros.dto.cv.CvCompletenessResponse;
import com.codeit.careeros.dto.cv.CvSectionResponse;
import com.codeit.careeros.dto.cv.DetectedSkillResponse;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.dto.insight.SkillGapResponse;
import com.codeit.careeros.repository.CvDocumentRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.security.SecurityUtils;
import com.codeit.careeros.skill.Skill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sprint 5 CV analysis. Detected skills come from matching the extracted CV
 * text against the live CareerOS skill master; the matching/missing/gap
 * view reuses the Sprint 3 readiness gaps ({@link CareerInsightService})
 * directly — there is deliberately no second gap calculation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CvAnalysisService {

    private final CvDocumentRepository cvDocumentRepository;
    private final SkillRepository skillRepository;
    private final CareerInsightService careerInsightService;

    /** Full analysis of the current student's CV (empty payload when none uploaded). */
    @Transactional(readOnly = true)
    public CvAnalysisResponse analyze() {
        return analyzeFor(SecurityUtils.currentUserId());
    }

    /** CV analysis of a specific student. Caller must authorize the student. */
    @Transactional(readOnly = true)
    public CvAnalysisResponse analyzeFor(Long userId) {
        CvDocument document = cvDocumentRepository.findByUserId(userId).orElse(null);
        if (document == null || document.getExtractedText() == null) {
            return new CvAnalysisResponse(false, false, null, null, null,
                    List.of(), List.of(), List.of(),
                    new CvCompletenessResponse(0, 0, 0, List.of(), List.of()),
                    List.of(), 0, 0);
        }

        String text = document.getExtractedText();
        String normalized = normalize(text);
        Map<Long, DetectedSkillResponse> detected = new LinkedHashMap<>();
        for (Skill skill : skillRepository.findAllByOrderByNameAsc()) {
            if (!skill.isActive()) {
                continue;
            }
            if (mentions(normalized, skill.getName())) {
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

        CvCompletenessResponse completeness = completenessOf(text);
        List<CvSectionResponse> sections = sectionsOf(text);
        int ats = atsScoreOf(text);
        int frameworkSize = matched.size() + missing.size();
        int alignment = frameworkSize == 0 ? 0
                : Math.round((matched.size() * 100.0f) / frameworkSize);
        int overall = readiness.hasTarget() && frameworkSize > 0
                ? Math.round(completeness.scorePercent() * 0.5f + alignment * 0.3f + ats * 0.2f)
                : Math.round(completeness.scorePercent() * 0.6f + ats * 0.4f);
        log.info("CV analysis for student {}: {} detected skills, {}/{} framework matched",
                userId, detected.size(), matched.size(), matched.size() + missing.size());
        return new CvAnalysisResponse(
                true,
                readiness.hasTarget(),
                readiness.targetCareerId(),
                readiness.targetCareerName(),
                CvService.toResponse(document),
                List.copyOf(detected.values()),
                matched,
                missing,
                completeness,
                sections,
                ats,
                overall);
    }

    /**
     * Matches a master skill name against normalized CV text. Real CVs write
     * the same skill many ways ("HTML5, CSS3", "HTML / CSS", "SpringBoot",
     * "NodeJS", "REST API", "Jenkins" for "CI/CD (Jenkins)", "Git" for
     * "Git & GitHub"), so matching is deliberately recall-friendly — but
     * always on whole-word boundaries, so "JavaScript" never implies "Java",
     * "interaction" never implies "React" and "laws" never implies "AWS".
     *
     * <p>A skill matches when ANY of these holds:
     * <ol>
     *   <li>The full normalized name occurs as a whole word/phrase.</li>
     *   <li>The glued form occurs ("SpringBoot", "ReactNative", "NodeJS").</li>
     *   <li>A known abbreviation/variant occurs ("HTML5" via "html",
     *       "MySQL" for "SQL", "K8s", "NLP", ...).</li>
     *   <li>For names with {@code &}, {@code /} or parentheses, ANY
     *       alternative part matches ("Git" alone matches "Git & GitHub",
     *       "Jenkins" alone matches "CI/CD (Jenkins)").</li>
     *   <li>Otherwise every significant token matches, or one long
     *       distinctive token does ("Selenium" alone matches
     *       "Selenium WebDriver"). Generic qualifiers ("Administration",
     *       "Fundamentals", "Testing", "Design", ...) never match alone.</li>
     * </ol>
     */
    static boolean mentions(String normalizedText, String skillName) {
        if (skillName == null) {
            return false;
        }
        String normalizedSkill = normalize(skillName);
        if (normalizedSkill.isEmpty()) {
            return false;
        }
        // 1. Full name as a whole word/phrase.
        if (containsWord(normalizedText, normalizedSkill)) {
            return true;
        }
        // 2. Glued form covers "SpringBoot", "ReactNative", "PowerBI", "NodeJS".
        String compactSkill = normalizedSkill.replaceAll("[^a-z0-9]+", "");
        if (compactSkill.length() >= 6
                && normalizedText.replaceAll("[^a-z0-9]+", "").contains(compactSkill)) {
            return true;
        }
        // 3. Known abbreviations / variants ("MySQL" for "SQL", "K8s", "NLP" ...).
        for (String alias : aliasesFor(normalizedSkill)) {
            if (!alias.isEmpty() && containsWord(normalizedText, alias)) {
                return true;
            }
        }
        // 4. Alternative parts ("HTML" or "CSS" for "HTML/CSS", "Git" for
        // "Git & GitHub", "Jenkins" for "CI/CD (Jenkins)").
        List<String> segments = segmentsOf(skillName);
        if (segments.size() > 1) {
            for (String segment : segments) {
                if (segmentMatches(normalizedText, segment)) {
                    return true;
                }
            }
            return false;
        }
        // 5. Plain multi-word name: every significant token, or one long
        // distinctive token ("Selenium" for "Selenium WebDriver").
        return segmentMatches(normalizedText, normalizedSkill);
    }

    /**
     * Tokens so generic they only count inside the full phrase ("cloud" alone
     * must not match "Cloud Security" from "Cloud Practitioner course").
     */
    private static final java.util.Set<String> NEEDS_PHRASE = java.util.Set.of("cloud", "database");

    /** A segment matches when every significant token is present, or one long distinctive token is. */
    private static boolean segmentMatches(String normalizedText, String normalizedSegment) {
        List<String> tokens = new ArrayList<>();
        for (String token : normalizedSegment.split("[. ]+")) {
            if (token.length() >= 2 && !STOPWORDS.contains(token)) {
                tokens.add(token);
            }
        }
        if (tokens.isEmpty()) {
            return false;
        }
        if (tokens.size() == 1 && NEEDS_PHRASE.contains(tokens.get(0))) {
            return containsWord(normalizedText, normalizedSegment);
        }
        boolean allPresent = true;
        for (String token : tokens) {
            if (containsWord(normalizedText, token)) {
                if (token.length() >= 8) {
                    return true;
                }
            } else {
                allPresent = false;
            }
        }
        return allPresent;
    }

    /**
     * Splits a raw skill name into alternative parts: parenthesized groups
     * become their own alternatives ("CI/CD (Jenkins)" → Jenkins, CI, CD),
     * then the remainder splits on {@code &} and {@code /} ("HTML/CSS" →
     * HTML, CSS). Plain names yield a single segment.
     */
    private static List<String> segmentsOf(String skillName) {
        List<String> segments = new ArrayList<>();
        Matcher parens = Pattern.compile("\\(([^()]*)\\)").matcher(skillName);
        StringBuffer rest = new StringBuffer();
        while (parens.find()) {
            for (String part : parens.group(1).split("[&/]+")) {
                String normalized = normalize(part);
                if (!normalized.isEmpty()) {
                    segments.add(normalized);
                }
            }
            parens.appendReplacement(rest, " ");
        }
        parens.appendTail(rest);
        for (String part : rest.toString().split("[&/]+")) {
            String normalized = normalize(part);
            if (!normalized.isEmpty()) {
                segments.add(normalized);
            }
        }
        return segments;
    }

    /** Whole-word search that also works for symbols ("C++", "C#", "Node.js"). */
    private static boolean containsWord(String haystack, String needle) {
        return Pattern.compile("(^|[^a-z0-9+#.])" + Pattern.quote(needle) + "([^a-z0-9+#.]|$)")
                .matcher(haystack).find();
    }

    /**
     * Generic qualifiers that must never match a skill alone: "Linux" matches
     * "Linux Administration", but "Administration", "Testing" or "Design"
     * alone match nothing.
     */
    private static final java.util.Set<String> STOPWORDS = java.util.Set.of(
            "administration", "administrator", "fundamentals", "fundamental",
            "operations", "operation", "testing", "design", "designer",
            "analysis", "analyst", "analytics", "engineering", "engineer",
            "development", "developer", "management", "manager",
            "language", "languages", "processing", "learning",
            "system", "systems", "application", "applications",
            "rest", "data", "power", "deep", "natural", "security");

    /**
     * Abbreviations and common variants per normalized skill name.
     * Keys AND values use {@link #normalize} spacing (letter/digit pairs are
     * split: "K8s" is "k 8 s", "J2EE" is "j 2 ee").
     */
    private static final Map<String, List<String>> SKILL_ALIASES = Map.ofEntries(
            Map.entry("javascript", List.of("js", "es 6")),
            Map.entry("typescript", List.of("ts")),
            Map.entry("python", List.of("py")),
            Map.entry("sql", List.of("mysql", "postgresql", "postgres", "sqlite", "pl sql", "t sql")),
            Map.entry("react", List.of("reactjs", "react.js")),
            Map.entry("node.js", List.of("nodejs", "node")),
            Map.entry("machine learning", List.of("ml")),
            Map.entry("deep learning", List.of("dl")),
            Map.entry("natural language processing", List.of("nlp")),
            Map.entry("generative ai", List.of("genai", "ai")),
            Map.entry("kubernetes", List.of("k 8 s")),
            Map.entry("mongodb", List.of("mongo")),
            Map.entry("rest apis", List.of("rest api", "restful")),
            Map.entry("microservices", List.of("microservice")),
            Map.entry("java", List.of("core java", "j 2 ee")),
            Map.entry("aws", List.of("amazon web services")),
            Map.entry("ci cd jenkins", List.of("cicd")),
            Map.entry("api testing", List.of("postman")),
            Map.entry("penetration testing", List.of("pentest", "pen test")),
            Map.entry("data visualization", List.of("tableau")),
            Map.entry("database administration", List.of("database administrator")));

    private static List<String> aliasesFor(String normalizedSkill) {
        List<String> aliases = SKILL_ALIASES.get(normalizedSkill);
        return aliases == null ? List.of() : aliases;
    }

    static String normalize(String value) {
        if (value == null) {
            return "";
        }
        // Split letter<->digit so versions never glue tokens: "HTML5" becomes
        // "html 5", letting the "html" / "css" word matchers work.
        String split = value.toLowerCase(Locale.ROOT)
                .replaceAll("(?<=[a-z])(?=\\d)|(?<=\\d)(?=[a-z])", " ");
        return split.replaceAll("[^a-z0-9+#.]+", " ").strip();
    }

    /**
     * Generic CV quality checks from section signals in the text — not
     * career-specific rules, just whether a recruiter can find the basics.
     * Every check is evidence-based (heading or strong content match).
     */
    static CvCompletenessResponse completenessOf(String text) {
        List<String> strengths = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();

        SectionHit education = detectEducation(text);
        SectionHit experience = detectExperience(text);
        SectionHit projects = detectProjects(text);
        SectionHit skills = detectSkills(text);
        SectionHit certifications = detectCertifications(text);
        boolean hasEmail = EMAIL_PATTERN.matcher(text == null ? "" : text).find();

        check(education.present(),
                "Education section found", "Add an Education section with your degree, college and year.",
                strengths, suggestions);
        check(experience.present(),
                "Experience section found", "Add an Experience or Internship section with what you built and delivered.",
                strengths, suggestions);
        check(projects.present(),
                "Projects section found", "Add a Projects section — recruiters look for proof of applied skills.",
                strengths, suggestions);
        check(skills.present(),
                "Skills section found", "Add a Skills section listing the tools and technologies you know.",
                strengths, suggestions);
        check(certifications.present(),
                "Certifications or courses found", "Add Certifications or Courses to stand out from other applicants.",
                strengths, suggestions);
        check(hasEmail,
                "Contact email found", "Add a contact email so recruiters can reach you.",
                strengths, suggestions);
        check(text != null && text.strip().length() >= 500,
                "Good detail level", "Add more detail — strong CVs describe outcomes, not just duties.",
                strengths, suggestions);

        int total = strengths.size() + suggestions.size();
        int passed = strengths.size();
        int score = total == 0 ? 0 : Math.round((passed * 100.0f) / total);
        return new CvCompletenessResponse(score, total, passed, strengths, suggestions);
    }

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE);
    private static final Pattern PHONE_PATTERN = Pattern.compile("(\\+?\\d[\\d\\s\\-().]{7,}\\d)");

    /**
     * Per-section breakdown reusing the same evidence-based signals as
     * {@link #completenessOf}. Contact additionally requires a phone number;
     * structure requires enough detail plus at least three core sections.
     * Each row carries the verbatim evidence snippet behind its verdict.
     */
    static List<CvSectionResponse> sectionsOf(String text) {
        String safe = text == null ? "" : text;
        String emailEvidence = emailEvidence(safe);
        String phoneEvidence = phoneEvidence(safe);
        boolean hasEmail = emailEvidence != null;
        boolean hasPhone = phoneEvidence != null;
        SectionHit skills = detectSkills(safe);
        SectionHit experience = detectExperience(safe);
        SectionHit education = detectEducation(safe);
        SectionHit projects = detectProjects(safe);
        SectionHit certifications = detectCertifications(safe);
        SectionHit summary = detectSummary(safe);
        int coreSections = (skills.present() ? 1 : 0) + (experience.present() ? 1 : 0) + (education.present() ? 1 : 0)
                + (projects.present() ? 1 : 0) + (summary.present() ? 1 : 0);
        boolean structured = safe.strip().length() >= 500 && coreSections >= 3;
        String structureEvidence = structured
                ? coreSections + " of 5 core sections present, " + safe.strip().length() + " characters of detail"
                : coreSections + " of 5 core sections present";

        List<CvSectionResponse> sections = new ArrayList<>();
        sections.add(new CvSectionResponse("contact", "Contact Information", hasEmail && hasPhone,
                hasEmail && hasPhone ? "Email and phone found — recruiters can reach you."
                        : !hasEmail && !hasPhone ? "Add a contact email and phone number at the top of your CV."
                        : !hasEmail ? "Add a contact email so recruiters can reach you."
                        : "Add a phone number so recruiters can reach you.",
                hasEmail && hasPhone ? emailEvidence + " · " + phoneEvidence
                        : hasEmail ? emailEvidence : hasPhone ? phoneEvidence : ""));
        sections.add(new CvSectionResponse("summary", "Professional Summary", summary.present(),
                summary.present() ? "Summary section found — it frames who you are in seconds."
                        : "Add a 2–3 line professional summary: who you are, key skills, what you want next.",
                summary.evidence()));
        sections.add(new CvSectionResponse("skills", "Skills", skills.present(),
                skills.present() ? "Skills section found and matched against the CareerOS skill catalog."
                        : "Add a Skills section listing the tools and technologies you know.",
                skills.evidence()));
        sections.add(new CvSectionResponse("experience", "Experience", experience.present(),
                experience.present() ? "Experience section found — describe outcomes, not just duties."
                        : "Add an Experience or Internship section with what you built and delivered.",
                experience.evidence()));
        sections.add(new CvSectionResponse("education", "Education", education.present(),
                education.present() ? "Education section found with degree and college details."
                        : "Add an Education section with your degree, college and year.",
                education.evidence()));
        sections.add(new CvSectionResponse("projects", "Projects", projects.present(),
                projects.present() ? "Projects section found — recruiters look for proof of applied skills."
                        : "Add a Projects section — recruiters look for proof of applied skills.",
                projects.evidence()));
        sections.add(new CvSectionResponse("certifications", "Certifications", certifications.present(),
                certifications.present() ? "Certifications or courses found."
                        : "Add Certifications or Courses to stand out from other applicants.",
                certifications.evidence()));
        sections.add(new CvSectionResponse("structure", "Resume Structure", structured,
                structured ? "Good detail level with clear sections a recruiter can skim."
                        : "Add more detail across at least three sections — strong CVs describe outcomes.",
                structureEvidence));
        return sections;
    }

    /**
     * ATS (machine-readability) score: share of six real parse signals
     * passed — contact email and phone present as text, standard
     * skill/experience/education headings, and an extractable text layer of
     * at least 300 characters (scanned images without text fail this).
     */
    /**
     * A phone number counts only with 10–15 digits. The raw pattern also
     * matches year ranges like "2020 - 2024", which must not mark the
     * contact section as present.
     */
    static boolean hasPhoneNumber(String text) {
        return phoneEvidence(text) != null;
    }

    /** Verbatim phone match (10–15 digits) or null. */
    static String phoneEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = PHONE_PATTERN.matcher(text);
        while (matcher.find()) {
            String raw = matcher.group(1);
            String digits = raw.replaceAll("\\D", "");
            if (digits.length() >= 10 && digits.length() <= 15) {
                return truncateEvidence(raw.replaceAll("\\s+", " ").strip());
            }
        }
        return null;
    }

    /** Verbatim email match or null. */
    static String emailEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = EMAIL_PATTERN.matcher(text);
        if (matcher.find()) {
            return truncateEvidence(matcher.group().strip());
        }
        return null;
    }

    static int atsScoreOf(String text) {
        String safe = text == null ? "" : text;
        int passed = 0;
        if (EMAIL_PATTERN.matcher(safe).find()) {
            passed++;
        }
        if (hasPhoneNumber(safe)) {
            passed++;
        }
        if (detectSkills(safe).present()) {
            passed++;
        }
        if (detectExperience(safe).present()) {
            passed++;
        }
        if (detectEducation(safe).present()) {
            passed++;
        }
        if (safe.strip().length() >= 300) {
            passed++;
        }
        return Math.round((passed * 100.0f) / 6);
    }

    private static void check(boolean passed, String strength, String suggestion,
                              List<String> strengths, List<String> suggestions) {
        if (passed) {
            strengths.add(strength);
        } else {
            suggestions.add(suggestion);
        }
    }

    // ------------------------------------------------------------------
    // Evidence-based section detection.
    //
    // Two tiers per section, in order:
    //   1. Explicit heading — a heading line, or an inline "Heading:" / "Heading |"
    //      marker anywhere (covers tables, merged lines and DOC exports where
    //      Tika puts heading + content on one line, e.g. "Skills: Python...
    //      Experience: ...").
    //   2. Strong content fallback — role + dates, degree + institution, tech
    //      mentions, built/deployed project language, certified/course language.
    //      This catches CVs that describe experience/education without using a
    //      textbook heading ("Career", "What I built", degree lines only).
    //
    // Heading matching is deliberately strict about *shape* (line start, short
    // heading-like line, or colon/pipe marker) so body sentences like
    // "hands-on internship experience building APIs" never count, while
    // "Professional Experience", "Work Experience", "Core Competencies" and
    // "Academic Background" always do.
    // ------------------------------------------------------------------

    /** Heading verdict plus the verbatim snippet behind it. */
    record SectionHit(boolean present, String evidence) {
        static SectionHit miss() {
            return new SectionHit(false, "");
        }
    }

    private static final List<String> SKILLS_HEADINGS = List.of(
            "skills", "skill", "technical skills", "technical expertise", "technical proficiencies",
            "technologies", "technology", "tech stack", "tech skills", "core competencies",
            "key skills", "competencies", "expertise", "proficiencies", "proficiency",
            "capabilities", "tools and technologies", "tools", "technical");

    private static final List<String> EXPERIENCE_HEADINGS = List.of(
            "work experience", "professional experience", "professional background",
            "employment history", "employment", "work history", "career history",
            "experience", "internship", "internships", "intern", "trainee",
            "apprenticeship", "freelance experience", "freelance");

    private static final List<String> EDUCATION_HEADINGS = List.of(
            "education", "educational qualifications", "educational qualification",
            "educational background", "academic background", "academic qualifications",
            "academic", "academics", "qualifications", "qualification",
            "degrees", "degree", "university", "college", "school",
            "institute", "institution", "graduation", "post graduation");

    private static final List<String> PROJECTS_HEADINGS = List.of(
            "personal projects", "academic projects", "key projects", "major projects",
            "side projects", "selected projects", "projects", "project",
            "portfolio", "case studies", "case study");

    private static final List<String> CERTIFICATIONS_HEADINGS = List.of(
            "certifications", "certification", "certificates", "certificate",
            "certified", "courses", "course", "credentials", "credential",
            "licenses", "license", "training", "trainings", "workshops", "workshop");

    private static final List<String> SUMMARY_HEADINGS = List.of(
            "professional summary", "career summary", "career objective", "career profile",
            "professional profile", "personal statement", "about me", "summary",
            "objective", "profile", "about", "overview", "introduction");

    static SectionHit detectSkills(String text) {
        String heading = headingEvidence(text, SKILLS_HEADINGS);
        if (heading != null) {
            return new SectionHit(true, heading);
        }
        String content = skillsContentEvidence(text);
        if (content != null) {
            return new SectionHit(true, content);
        }
        return SectionHit.miss();
    }

    static SectionHit detectExperience(String text) {
        String heading = headingEvidence(text, EXPERIENCE_HEADINGS);
        if (heading != null) {
            return new SectionHit(true, heading);
        }
        String content = experienceContentEvidence(text);
        if (content != null) {
            return new SectionHit(true, content);
        }
        return SectionHit.miss();
    }

    static SectionHit detectEducation(String text) {
        String heading = headingEvidence(text, EDUCATION_HEADINGS);
        if (heading != null) {
            return new SectionHit(true, heading);
        }
        String content = educationContentEvidence(text);
        if (content != null) {
            return new SectionHit(true, content);
        }
        return SectionHit.miss();
    }

    static SectionHit detectProjects(String text) {
        String heading = headingEvidence(text, PROJECTS_HEADINGS);
        if (heading != null) {
            return new SectionHit(true, heading);
        }
        String content = projectsContentEvidence(text);
        if (content != null) {
            return new SectionHit(true, content);
        }
        return SectionHit.miss();
    }

    static SectionHit detectCertifications(String text) {
        String heading = headingEvidence(text, CERTIFICATIONS_HEADINGS);
        if (heading != null) {
            return new SectionHit(true, heading);
        }
        String content = certificationsContentEvidence(text);
        if (content != null) {
            return new SectionHit(true, content);
        }
        return SectionHit.miss();
    }

    static SectionHit detectSummary(String text) {
        String heading = headingEvidence(text, SUMMARY_HEADINGS);
        if (heading != null) {
            return new SectionHit(true, heading);
        }
        String content = summaryContentEvidence(text);
        if (content != null) {
            return new SectionHit(true, content);
        }
        return SectionHit.miss();
    }

    /**
     * Heading search across line breaks, tables and merged lines.
     *
     * <p>A phrase counts when ANY holds:
     * <ol>
     *   <li>The cleaned line <em>starts</em> with the phrase (covers
     *       "Experience: ...", "Work Experience — ...", "Professional
     *       Experience Software Engineer ..." merged by Tika).</li>
     *   <li>The line is heading-shaped (≤ 60 chars, ≤ 6 words) and
     *       <em>contains</em> the phrase ("Professional Experience",
     *       "Core Competencies"). Body sentences are longer, so
     *       "hands-on internship experience building APIs" stays negative.</li>
     *   <li>An inline {@code Heading:} / {@code Heading |} marker appears
     *       anywhere ("Skills: Python. Experience: analyst intern").</li>
     * </ol>
     */
    static String headingEvidence(String text, List<String> phrases) {
        if (text == null || text.isBlank() || phrases == null || phrases.isEmpty()) {
            return null;
        }
        List<String> ordered = new ArrayList<>(phrases);
        ordered.sort((a, b) -> Integer.compare(b.length(), a.length()));
        String[] lines = text.split("\\R");
        for (String rawLine : lines) {
            String stripped = rawLine.strip();
            if (stripped.isEmpty()) {
                continue;
            }
            String cleaned = stripped.replaceAll("^[^\\p{L}\\p{N}]+", "");
            if (cleaned.isEmpty()) {
                continue;
            }
            String lowerLine = cleaned.toLowerCase(Locale.ROOT);
            int words = cleaned.split("\\s+").length;
            for (String phrase : ordered) {
                String pl = phrase.toLowerCase(Locale.ROOT);
                if (startsWithPhrase(lowerLine, pl)) {
                    return truncateEvidence(cleaned);
                }
                if (cleaned.length() <= 60 && words <= 6 && containsPhrase(lowerLine, pl)) {
                    return truncateEvidence(cleaned);
                }
            }
        }
        // Inline "Heading:" / "Heading |" anywhere (tables, DOC exports).
        for (String phrase : ordered) {
            Pattern inline = Pattern.compile("(?i)\\b" + Pattern.quote(phrase) + "\\s*[:|]\\s*\\S");
            Matcher m = inline.matcher(text);
            if (m.find()) {
                int start = Math.max(0, m.start() - 10);
                int end = Math.min(text.length(), m.end() + 70);
                String snippet = text.substring(start, end).replaceAll("\\s+", " ").strip();
                return truncateEvidence(snippet);
            }
        }
        return null;
    }

    /** Line starts with the phrase, allowing a plural s/es and requiring a boundary. */
    private static boolean startsWithPhrase(String lowerLine, String phraseLower) {
        // Exact or prefix + boundary: "skill" matches "skills:" / "skills -" but not "skilled".
        if (lowerLine.equals(phraseLower)) {
            return true;
        }
        if (lowerLine.startsWith(phraseLower)) {
            String rest = lowerLine.substring(phraseLower.length());
            if (rest.isEmpty() || !rest.matches("^[a-z].*")) {
                return true;
            }
            // Plural tolerance: "project" vs "projects", "experience" vs "experiences".
            if ((rest.startsWith("s") || rest.startsWith("es"))
                    && (rest.length() == 1 || rest.length() == 2 || !rest.substring(rest.startsWith("es") ? 2 : 1).matches("^[a-z].*"))) {
                return true;
            }
        }
        return false;
    }

    /** Whole-phrase match with plural tolerance ("skill" finds "Skills"). */
    private static boolean containsPhrase(String lowerLine, String phraseLower) {
        return Pattern.compile("\\b" + Pattern.quote(phraseLower) + "(s|es)?\\b")
                .matcher(lowerLine).find();
    }

    // ---- Content fallbacks (no heading needed) ----

    private static final Pattern YEARS_EXPERIENCE = Pattern.compile(
            "(?i)\\b\\d+\\+?\\s+years?\\s+(?:of\\s+)?(?:work\\s+|professional\\s+)?experience\\b");
    private static final Pattern WORKED_AT = Pattern.compile(
            "(?i)\\b(worked|working)\\s+(at|on|as|with|for)\\b|\\bintern(?:ship)?\\s+at\\b|\\bemployed\\b");
    private static final Pattern DATE_RANGE = Pattern.compile(
            "(?i)\\b(19|20)\\d{2}\\s*[-–—]\\s*(present|current|now|(19|20)\\d{2})\\b"
                    + "|\\b(19|20)\\d{2}\\s+to\\s+(present|current|(19|20)\\d{2})\\b"
                    + "|\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+\\d{4}\\s*[-–—]\\s*(present|current|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?[a-z]*\\s*\\d{4})");
    private static final Pattern ROLE_WORD = Pattern.compile(
            "(?i)\\b(engineer|developer|analyst|designer|manager|consultant|intern|trainee|assistant|associate|specialist|executive|administrator|architect|tester|lead|founder|freelancer)\\b");

    static String experienceContentEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher m = YEARS_EXPERIENCE.matcher(text);
        if (m.find()) {
            return truncateEvidence(matchedLine(text, m.start()));
        }
        Matcher w = WORKED_AT.matcher(text);
        if (w.find()) {
            return truncateEvidence(matchedLine(text, w.start()));
        }
        // Role title + employment date range anywhere = real job entry
        // (a bare "internship experience" sentence has no dates, so it stays negative).
        if (ROLE_WORD.matcher(text).find() && DATE_RANGE.matcher(text).find()) {
            Matcher d = DATE_RANGE.matcher(text);
            d.find();
            return truncateEvidence(matchedLine(text, d.start()));
        }
        return null;
    }

    private static final Pattern DEGREE_PATTERN = Pattern.compile(
            "(?i)\\b(b\\.?\\s?tech|m\\.?\\s?tech|b\\.?\\s?e\\b|bca|mca|bsc|msc|b\\.?sc|m\\.?sc|mba|ph\\.?d|bachelor'?s?|master'?s?|diploma|hsc|ssc|class\\s+xii|\\b10th\\b|\\b12th\\b)\\b");
    private static final Pattern INSTITUTION_PATTERN = Pattern.compile(
            "(?i)\\b(university|college|school|institute|institution)\\b");
    private static final Pattern GRADE_PATTERN = Pattern.compile(
            "(?i)\\b(cgpa|gpa|percentage)\\b\\s*[:\\-]?\\s*\\d|\\bgraduat(?:ed|ion)\\b");

    static String educationContentEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher degree = DEGREE_PATTERN.matcher(text);
        if (degree.find()) {
            return truncateEvidence(matchedLine(text, degree.start()));
        }
        // Institution + graduation year (e.g. "ABC College 2024") without a heading.
        if (INSTITUTION_PATTERN.matcher(text).find()
                && Pattern.compile("\\b(19|20)\\d{2}\\b").matcher(text).find()) {
            Matcher inst = INSTITUTION_PATTERN.matcher(text);
            inst.find();
            return truncateEvidence(matchedLine(text, inst.start()));
        }
        Matcher grade = GRADE_PATTERN.matcher(text);
        if (grade.find()) {
            return truncateEvidence(matchedLine(text, grade.start()));
        }
        return null;
    }

    private static final java.util.Set<String> TECH_LEXICON = java.util.Set.of(
            "java", "python", "sql", "git", "html", "css", "javascript", "typescript",
            "react", "angular", "vue", "node", "spring", "django", "flask",
            "docker", "kubernetes", "aws", "azure", "mysql", "postgres", "mongodb",
            "linux", "jenkins", "terraform", "selenium", "postman", "figma",
            "tableau", "excel", "pandas", "numpy", "tensorflow", "pytorch",
            "c++", "c#", "golang", "kotlin", "swift", "php", "ruby", "rust");

    static String skillsContentEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String normalized = normalize(text);
        List<String> found = new ArrayList<>();
        for (String term : TECH_LEXICON) {
            if (containsWord(normalized, normalize(term))) {
                found.add(term);
                if (found.size() >= 2) {
                    break;
                }
            }
        }
        if (found.size() >= 2) {
            return "mentions " + String.join(", ", found);
        }
        if (Pattern.compile("(?i)\\bproficient\\s+in\\b|\\btech(?:nical)?\\s+stack\\b").matcher(text).find()) {
            Matcher m = Pattern.compile("(?i)\\bproficient\\s+in\\b|\\btech(?:nical)?\\s+stack\\b").matcher(text);
            m.find();
            return truncateEvidence(matchedLine(text, m.start()));
        }
        return null;
    }

    private static final Pattern PROJECT_BUILT = Pattern.compile(
            "(?i)\\b(built|developed|created|designed|implemented|launched|deployed|engineered)\\b.{0,60}\\b(app|website|web\\s?app|system|platform|project|api|dashboard|portal|tool|application|solution|prototype|model)\\b");
    private static final Pattern PROJECT_MARKER = Pattern.compile(
            "(?i)github\\.com|\\blive\\s+demo\\b|\\btech\\s+stack\\b|\\bside\\s+project\\b");

    static String projectsContentEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher m = PROJECT_BUILT.matcher(text);
        if (m.find()) {
            return truncateEvidence(matchedLine(text, m.start()));
        }
        Matcher k = PROJECT_MARKER.matcher(text);
        if (k.find()) {
            return truncateEvidence(matchedLine(text, k.start()));
        }
        return null;
    }

    private static final Pattern CERT_CONTENT = Pattern.compile(
            "(?i)\\bcertified\\b|\\bcredential\\b|\\blicen[sc]e[ds]?\\b"
                    + "|\\bcoursera\\b|\\budemy\\b|\\budacity\\b|\\bedx\\b|\\bnptel\\b"
                    + "|\\bcompleted\\b.{0,40}\\bcourse\\b|\\bcourse\\b.{0,40}\\bcomplet"
                    + "|\\baws\\s+certified\\b|\\bmicrosoft\\s+certified\\b|\\bgoogle\\s+certified\\b"
                    + "|\\boracle\\s+certified\\b|\\bpmp\\b");

    static String certificationsContentEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher m = CERT_CONTENT.matcher(text);
        if (m.find()) {
            return truncateEvidence(matchedLine(text, m.start()));
        }
        return null;
    }

    static String summaryContentEvidence(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String head = text.strip().substring(0, Math.min(1200, text.strip().length()));
        if (Pattern.compile("(?i)\\bcareer\\s+objective\\b|\\bprofessional\\s+summary\\b").matcher(head).find()) {
            Matcher m = Pattern.compile("(?i)\\bcareer\\s+objective\\b|\\bprofessional\\s+summary\\b").matcher(head);
            m.find();
            return truncateEvidence(matchedLine(text, m.start()));
        }
        boolean hasRole = Pattern.compile(
                "(?i)\\b(developer|engineer|student|graduate|professional|analyst|designer|manager|specialist)\\b")
                .matcher(head).find();
        boolean hasTrait = Pattern.compile(
                "(?i)\\b(motivated|passionate|seeking|aspiring|experienced|dedicated|driven|enthusiastic|dynamic|detail-oriented|results-driven|with\\s+\\d+\\+?\\s+years?)\\b")
                .matcher(head).find();
        if (hasRole && hasTrait) {
            String firstPara = head.split("\\R\\R|\\R")[0];
            if (firstPara.strip().length() >= 60) {
                return truncateEvidence(firstPara);
            }
            return truncateEvidence(head.split("\\R")[0]);
        }
        return null;
    }

    /** Line containing the char offset (for content-match evidence). */
    private static String matchedLine(String text, int offset) {
        int lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
        int lineEnd = text.indexOf('\n', offset);
        if (lineEnd < 0) {
            lineEnd = text.length();
        }
        String line = text.substring(Math.max(0, lineStart), Math.min(text.length(), lineEnd))
                .replaceAll("\\s+", " ").strip();
        if (line.isEmpty()) {
            line = text.substring(Math.max(0, offset - 40), Math.min(text.length(), offset + 80))
                    .replaceAll("\\s+", " ").strip();
        }
        return line;
    }

    static String truncateEvidence(String snippet) {
        if (snippet == null) {
            return "";
        }
        String cleaned = snippet.replaceAll("\\s+", " ").strip();
        if (cleaned.length() <= 160) {
            return cleaned;
        }
        return cleaned.substring(0, 157).strip() + "…";
    }

    /**
     * Legacy keyword entry-point kept for compatibility: maps the old keyword
     * sets onto the new evidence-based detectors so any external caller keeps
     * working.
     */
    @Deprecated
    private static boolean containsSection(String fullText, String... keywords) {
        if (fullText == null || fullText.isBlank()) {
            return false;
        }
        List<String> kws = List.of(keywords);
        if (kws.contains("skill") || kws.contains("technical") || kws.contains("tools")) {
            return detectSkills(fullText).present();
        }
        if (kws.contains("experience") || kws.contains("employment") || kws.contains("internship")) {
            return detectExperience(fullText).present();
        }
        if (kws.contains("education") || kws.contains("qualification") || kws.contains("degree")) {
            return detectEducation(fullText).present();
        }
        if (kws.contains("project")) {
            return detectProjects(fullText).present();
        }
        if (kws.contains("certification") || kws.contains("certificate") || kws.contains("course")) {
            return detectCertifications(fullText).present();
        }
        return headingEvidence(fullText, kws) != null;
    }
}
