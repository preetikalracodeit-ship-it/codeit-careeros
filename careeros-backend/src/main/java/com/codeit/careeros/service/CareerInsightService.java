package com.codeit.careeros.service;

import com.codeit.careeros.assessment.AssessmentAttempt;
import com.codeit.careeros.assessment.SkillScore;
import com.codeit.careeros.career.CareerSkill;
import com.codeit.careeros.common.enums.AttemptStatus;
import com.codeit.careeros.common.enums.ResultLevel;
import com.codeit.careeros.dto.insight.AttemptHistoryItem;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.dto.insight.SkillGapResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.CareerSkillRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sprint 3 student insights (docs sections 15-17): assessment history,
 * career gap analysis and career readiness.
 * Read-only over Sprint 1/2 tables ({@code career_skills} framework plus
 * submitted {@code assessment_attempts}/{@code skill_scores}); no schema
 * changes, no writes, no hardcoded careers/skills/weights/thresholds.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CareerInsightService {

    private final StudentProfileRepository studentProfileRepository;
    private final CareerSkillRepository careerSkillRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final SkillScoreRepository skillScoreRepository;

    /** Submitted attempts of the current student, newest first, optionally for one assessment. */
    @Transactional(readOnly = true)
    public List<AttemptHistoryItem> myHistory(Long assessmentId) {
        return historyFor(SecurityUtils.currentUserId(), assessmentId);
    }

    /** Submitted attempts of a specific student, newest first. Caller must authorize the student. */
    @Transactional(readOnly = true)
    public List<AttemptHistoryItem> historyFor(Long userId, Long assessmentId) {
        return attemptRepository.findByUserIdAndStatusOrderByStartedAtDesc(userId, AttemptStatus.SUBMITTED).stream()
                .filter(attempt -> assessmentId == null
                        || attempt.getAssessment().getId().equals(assessmentId))
                .map(CareerInsightService::toHistoryItem)
                .toList();
    }

    /**
     * Readiness of the current student for their target career.
     * Per framework skill, the latest submitted score wins; gaps compare that
     * score against the live framework target. Students without a target
     * career get an empty payload ({@code hasTarget=false}) instead of an error
     * so the dashboard can render its career-selection empty state.
     */
    @Transactional(readOnly = true)
    public ReadinessResponse myReadiness() {
        return readinessFor(SecurityUtils.currentUserId());
    }

    /**
     * Readiness of a specific student. Callers (college staff) must verify
     * that the student belongs to their institution and scope first.
     */
    @Transactional(readOnly = true)
    public ReadinessResponse readinessFor(Long userId) {
        StudentProfile profile = studentProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null || profile.getTargetCareer() == null) {
            return new ReadinessResponse(null, null, false, 0, null, 0, 0, 0, 0, null,
                    List.of(), List.of(), List.of());
        }

        Long careerId = profile.getTargetCareer().getId();
        String careerName = profile.getTargetCareer().getName();
        List<CareerSkill> framework = careerSkillRepository.findByCareerIdOrderByWeightPercentDesc(careerId);

        List<AssessmentAttempt> submitted = attemptRepository
                .findByUserIdAndStatusOrderByStartedAtDesc(userId, AttemptStatus.SUBMITTED).stream()
                .filter(attempt -> attempt.getAssessment() != null
                        && attempt.getAssessment().getCareer() != null
                        && careerId.equals(attempt.getAssessment().getCareer().getId()))
                .toList();

        Map<Long, SkillScore> latestBySkill = new LinkedHashMap<>();
        Map<Long, Long> attemptBySkill = new LinkedHashMap<>();
        for (AssessmentAttempt attempt : submitted) {
            for (SkillScore score : skillScoreRepository.findByAttemptIdOrderByWeightPercentDesc(attempt.getId())) {
                Long skillId = score.getSkill().getId();
                if (!latestBySkill.containsKey(skillId)) {
                    latestBySkill.put(skillId, score);
                    attemptBySkill.put(skillId, attempt.getId());
                }
            }
        }

        List<SkillGapResponse> gaps = new ArrayList<>();
        for (CareerSkill mapping : framework) {
            Long skillId = mapping.getSkill().getId();
            SkillScore score = latestBySkill.get(skillId);
            if (score == null) {
                gaps.add(new SkillGapResponse(
                        skillId,
                        mapping.getSkill().getName(),
                        mapping.getSkill().getCategory().name(),
                        mapping.getWeightPercent(),
                        mapping.getRequiredLevel().name(),
                        mapping.getTargetPercent(),
                        null, null, null, null,
                        false, false, null, null));
            } else {
                int scorePercent = score.getScorePercent();
                gaps.add(new SkillGapResponse(
                        skillId,
                        mapping.getSkill().getName(),
                        mapping.getSkill().getCategory().name(),
                        mapping.getWeightPercent(),
                        mapping.getRequiredLevel().name(),
                        mapping.getTargetPercent(),
                        scorePercent,
                        score.getCorrectCount(),
                        score.getQuestionCount(),
                        scorePercent - mapping.getTargetPercent(),
                        scorePercent >= mapping.getTargetPercent(),
                        true,
                        ResultLevel.fromScore(scorePercent).name(),
                        attemptBySkill.get(skillId)));
            }
        }

        long assessed = gaps.stream().filter(SkillGapResponse::assessed).count();
        long met = gaps.stream().filter(g -> g.assessed() && g.metTarget()).count();

        List<SkillGapResponse> strengths = gaps.stream()
                .filter(g -> g.assessed() && g.metTarget())
                .sorted(Comparator.comparingInt(SkillGapResponse::scorePercent).reversed())
                .limit(3)
                .toList();
        List<SkillGapResponse> improvements = gaps.stream()
                .filter(g -> !g.metTarget())
                .sorted(Comparator.comparingInt(g -> g.gapPercent() == null ? Integer.MIN_VALUE : g.gapPercent()))
                .limit(3)
                .toList();

        AttemptHistoryItem latest = submitted.isEmpty() ? null : toHistoryItem(submitted.get(0));

        int readiness = readinessPercent(gaps);
        log.info("Readiness for student {} on career {}: {}% ({} of {} skills assessed)",
                profile.getStudentId(), careerId, readiness, assessed, gaps.size());
        return new ReadinessResponse(
                careerId,
                careerName,
                true,
                readiness,
                ResultLevel.fromScore(readiness).name(),
                gaps.size(),
                (int) assessed,
                (int) met,
                submitted.size(),
                latest,
                strengths,
                improvements,
                gaps);
    }

    static AttemptHistoryItem toHistoryItem(AssessmentAttempt attempt) {
        return new AttemptHistoryItem(
                attempt.getId(),
                attempt.getAssessment().getId(),
                attempt.getAssessment().getTitle(),
                attempt.getAssessment().getCareer().getId(),
                attempt.getAssessment().getCareer().getName(),
                attempt.getStatus().name(),
                attempt.getOverallScore(),
                attempt.getTotalQuestions(),
                attempt.getAnsweredCount(),
                attempt.getStartedAt(),
                attempt.getSubmittedAt());
    }

    /**
     * Weight-aware share of required competency achieved, from database values
     * only: {@code 100 * sum(weight * min(score, target)) / sum(weight * target)}.
     * Skills without a positive target carry no requirement and are skipped;
     * with no weighted requirement, readiness falls back to the mean assessed
     * score (0 when nothing is assessed yet).
     */
    static int readinessPercent(List<SkillGapResponse> gaps) {
        long weightedTarget = 0;
        long weightedScore = 0;
        for (SkillGapResponse gap : gaps) {
            int weight = gap.weightPercent() == null ? 0 : gap.weightPercent();
            int target = gap.targetPercent() == null ? 0 : gap.targetPercent();
            if (target <= 0) {
                continue;
            }
            weightedTarget += (long) weight * target;
            if (gap.assessed() && gap.scorePercent() != null) {
                weightedScore += (long) weight * Math.min(gap.scorePercent(), target);
            }
        }
        if (weightedTarget > 0) {
            return Math.round((weightedScore * 100.0f) / weightedTarget);
        }
        return Math.round((float) gaps.stream()
                .filter(SkillGapResponse::assessed)
                .mapToInt(g -> g.scorePercent() == null ? 0 : g.scorePercent())
                .average()
                .orElse(0));
    }
}
