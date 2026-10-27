package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.DashboardDtos;
import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.common.enums.AttemptStatus;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.dto.insight.SkillGapResponse;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.service.CareerInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * College dashboard and cohort analytics. Every number is computed from live
 * enrollment, assessment and framework data for the caller's institution and
 * academic scope. No history is fabricated: a trend is reported as unavailable
 * until a real historical snapshot store exists.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final StudentService studentService;
    private final CareerInsightService careerInsightService;
    private final AssessmentAttemptRepository assessmentAttemptRepository;

    @Transactional(readOnly = true)
    public DashboardDtos.CollegeDashboardResponse dashboard(CollegeScope scope,
                                                            StudentDtos.StudentFilter filter) {
        if (filter != null && filter.assessmentDateFrom() != null && filter.assessmentDateTo() != null
                && filter.assessmentDateFrom().isAfter(filter.assessmentDateTo())) {
            throw com.codeit.careeros.exception.BusinessException.badRequest(
                    "Assessment submission start date must be on or before end date");
        }
        if (filter != null && LocalDate.MAX.equals(filter.assessmentDateTo())) {
            throw com.codeit.careeros.exception.BusinessException.badRequest(
                    "Assessment submission end date is out of range");
        }
        StudentDtos.StudentFilter cohortFilter = filter == null ? null : new StudentDtos.StudentFilter(
                filter.search(), filter.academicYearId(), filter.departmentId(), filter.programId(),
                filter.batchId(), filter.sectionId(), filter.status(),
                filter.assessmentDateFrom() == null && filter.assessmentDateTo() == null
                        ? filter.assessmentCompleted() : null,
                null, null, null);
        List<StudentEnrollment> enrollments = studentService.allInScope(scope, cohortFilter);
        Instant assessmentFrom = dateBoundary(filter == null ? null : filter.assessmentDateFrom(), scope);
        Instant assessmentToExclusive = dateBoundary(filter == null || filter.assessmentDateTo() == null
                ? null : filter.assessmentDateTo().plusDays(1), scope);

        int total = enrollments.size();
        int active = 0;
        int participants = 0;
        int notAssessed = 0;
        int readinessEvaluated = 0;
        int band0 = 0;
        int band25 = 0;
        int band50 = 0;
        int band75 = 0;

        Map<Long, GapAggregate> gaps = new LinkedHashMap<>();
        Map<Long, DepartmentAggregate> departments = new LinkedHashMap<>();
        Map<Long, BatchAggregate> batches = new LinkedHashMap<>();

        for (StudentEnrollment enrollment : enrollments) {
            boolean isActive = enrollment.getStatus() == EnrollmentStatus.ACTIVE;
            if (isActive) {
                active++;
            }
            ReadinessResponse readiness = careerInsightService
                    .readinessFor(enrollment.getStudentProfile().getUser().getId());
            Long userId = enrollment.getStudentProfile().getUser().getId();
            var submittedAttempts = assessmentAttemptRepository.findByUserIdAndStatusOrderByStartedAtDesc(
                    userId, AttemptStatus.SUBMITTED);
            boolean hasAttempts = hasSubmittedAttempt(submittedAttempts, assessmentFrom, assessmentToExclusive);
            if (isActive && hasAttempts) {
                participants++;
            }
            if (isActive && !hasAttempts) {
                notAssessed++;
            }
            boolean evaluated = isActive && Boolean.TRUE.equals(readiness.hasTarget())
                    && hasSubmittedAttemptForTargetCareer(submittedAttempts,
                        enrollment.getStudentProfile().getTargetCareer() == null
                                ? null : enrollment.getStudentProfile().getTargetCareer().getId(),
                        assessmentFrom, assessmentToExclusive)
                    && readiness.readinessPercent() != null;
            if (evaluated) {
                readinessEvaluated++;
                int percent = readiness.readinessPercent();
                if (percent < 25) {
                    band0++;
                } else if (percent < 50) {
                    band25++;
                } else if (percent < 75) {
                    band50++;
                } else {
                    band75++;
                }
                for (SkillGapResponse gap : readiness.gaps()) {
                    if (!gap.assessed() || gap.skillId() == null) {
                        continue;
                    }
                    GapAggregate aggregate = gaps.computeIfAbsent(gap.skillId(),
                            id -> new GapAggregate(id, gap.skillName()));
                    aggregate.assessed++;
                    if (!gap.metTarget()) {
                        aggregate.belowTarget++;
                    }
                }
            }

            var department = enrollment.getDepartment();
            DepartmentAggregate aggregate = departments.computeIfAbsent(department.getId(),
                    id -> new DepartmentAggregate(id, department.getName()));
            aggregate.enrolled++;
            if (isActive) {
                aggregate.active++;
            }
            if (isActive && hasAttempts) {
                aggregate.participants++;
            }
            if (evaluated) {
                aggregate.evaluated++;
                aggregate.readinessSum += readiness.readinessPercent();
            }

            var batch = enrollment.getBatch();
            BatchAggregate batchAggregate = batches.computeIfAbsent(batch.getId(),
                    id -> new BatchAggregate(id, department.getName(), batch.getProgram().getName(),
                            batch.getLabel()));
            batchAggregate.enrolled++;
            if (isActive) batchAggregate.active++;
            if (isActive && hasAttempts) batchAggregate.participants++;
        }

        List<DashboardDtos.CommonGap> commonGaps = gaps.values().stream()
                .filter(g -> g.assessed > 0)
                .map(g -> new DashboardDtos.CommonGap(
                        String.valueOf(g.skillId), g.skillName, g.belowTarget, g.assessed,
                        Math.round((g.belowTarget * 100.0f) / g.assessed)))
                .sorted(Comparator.comparingInt(DashboardDtos.CommonGap::studentsBelowTarget).reversed()
                        .thenComparing(DashboardDtos.CommonGap::skillName))
                .limit(10)
                .toList();

        List<DashboardDtos.DepartmentComparison> comparisons = departments.values().stream()
                .map(d -> new DashboardDtos.DepartmentComparison(
                        d.id, d.name, d.enrolled, d.active, d.participants, d.evaluated,
                        d.evaluated == 0 ? null : Math.round((float) d.readinessSum / d.evaluated)))
                .sorted(Comparator.comparing(DashboardDtos.DepartmentComparison::departmentName))
                .toList();

        List<DashboardDtos.BatchComparison> batchComparisons = batches.values().stream()
                .map(batch -> new DashboardDtos.BatchComparison(
                        batch.id, batch.departmentName, batch.programName, batch.label,
                        batch.enrolled, batch.active, batch.participants,
                        batch.active == 0 ? null : Math.round(batch.participants * 100.0f / batch.active)))
                .sorted(Comparator.comparing(DashboardDtos.BatchComparison::departmentName)
                        .thenComparing(DashboardDtos.BatchComparison::programName)
                        .thenComparing(DashboardDtos.BatchComparison::batchLabel))
                .toList();

        Integer completion = active == 0 ? null : Math.round((participants * 100.0f) / active);

        return new DashboardDtos.CollegeDashboardResponse(
                scope.institutionName(),
                new DashboardDtos.DashboardFilters(
                        filter == null ? null : filter.academicYearId(),
                        filter == null ? null : filter.departmentId(),
                        filter == null ? null : filter.programId(),
                        filter == null ? null : filter.batchId(),
                        filter == null ? null : filter.sectionId(),
                        filter == null || filter.status() == null ? null : filter.status().name(),
                        filter == null ? null : filter.assessmentCompleted(),
                        filter == null ? null : filter.assessmentDateFrom(),
                        filter == null ? null : filter.assessmentDateTo()),
                definitions(),
                total,
                active,
                participants,
                notAssessed,
                completion,
                readinessEvaluated,
                active - readinessEvaluated,
                List.of(
                        new DashboardDtos.ReadinessBand("0-24%", band0),
                        new DashboardDtos.ReadinessBand("25-49%", band25),
                        new DashboardDtos.ReadinessBand("50-74%", band50),
                        new DashboardDtos.ReadinessBand("75-100%", band75)),
                commonGaps,
                comparisons,
                batchComparisons,
                false,
                "No historical readiness snapshots are stored yet, so a trend cannot be shown without fabricating data.",
                Instant.now());
    }

    private static boolean hasSubmittedAttempt(List<com.codeit.careeros.assessment.AssessmentAttempt> attempts,
                                               Instant from, Instant toExclusive) {
        return attempts.stream()
                .map(attempt -> attempt.getSubmittedAt())
                .filter(java.util.Objects::nonNull)
                .anyMatch(submittedAt -> (from == null || !submittedAt.isBefore(from))
                        && (toExclusive == null || submittedAt.isBefore(toExclusive)));
    }

    private static boolean hasSubmittedAttemptForTargetCareer(
                                                        List<com.codeit.careeros.assessment.AssessmentAttempt> attempts,
                                                        Long careerId, Instant from, Instant toExclusive) {
        if (careerId == null) return false;
        return attempts.stream()
                .filter(attempt -> attempt.getAssessment() != null
                        && attempt.getAssessment().getCareer() != null
                        && careerId.equals(attempt.getAssessment().getCareer().getId()))
                .map(attempt -> attempt.getSubmittedAt())
                .filter(java.util.Objects::nonNull)
                .anyMatch(submittedAt -> (from == null || !submittedAt.isBefore(from))
                        && (toExclusive == null || submittedAt.isBefore(toExclusive)));
    }

    private static Instant dateBoundary(LocalDate date, CollegeScope scope) {
        return date == null ? null : date.atStartOfDay(scope.institutionZone()).toInstant();
    }

    private static List<DashboardDtos.MetricDefinition> definitions() {
        List<DashboardDtos.MetricDefinition> definitions = new ArrayList<>();
        definitions.add(new DashboardDtos.MetricDefinition(
                "totalEnrolled", "All student enrollments matching the selected filters."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "activeStudents", "Enrollments whose status is ACTIVE."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "assessmentParticipants", "Active students with at least one submitted assessment attempt."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "studentsNotAssessed", "Active students with no submitted assessment attempt."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "assessmentCompletionPercent", "Active students with a submitted attempt divided by all active students."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "readinessEvaluated", "Active students with a target career and at least one submitted assessment for that career."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "readinessDistribution", "Evaluated students grouped by readiness percentage band."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "commonGaps", "Skills where assessed students scored below the live career framework target."));
        return List.copyOf(definitions);
    }

    private static final class GapAggregate {
        private final Long skillId;
        private final String skillName;
        private int assessed;
        private int belowTarget;

        private GapAggregate(Long skillId, String skillName) {
            this.skillId = skillId;
            this.skillName = skillName;
        }
    }

    private static final class DepartmentAggregate {
        private final Long id;
        private final String name;
        private int enrolled;
        private int active;
        private int participants;
        private int evaluated;
        private long readinessSum;

        private DepartmentAggregate(Long id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    private static final class BatchAggregate {
        private final Long id;
        private final String departmentName;
        private final String programName;
        private final String label;
        private int enrolled;
        private int active;
        private int participants;

        private BatchAggregate(Long id, String departmentName, String programName, String label) {
            this.id = id;
            this.departmentName = departmentName;
            this.programName = programName;
            this.label = label;
        }
    }
}
