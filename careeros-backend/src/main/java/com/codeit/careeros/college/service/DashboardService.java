package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.DashboardDtos;
import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.dto.insight.SkillGapResponse;
import com.codeit.careeros.service.CareerInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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

    @Transactional(readOnly = true)
    public DashboardDtos.CollegeDashboardResponse dashboard(CollegeScope scope,
                                                            StudentDtos.StudentFilter filter) {
        List<StudentEnrollment> enrollments = studentService.allInScope(scope, filter);

        int total = enrollments.size();
        int active = 0;
        int participants = 0;
        int readinessEvaluated = 0;
        int band0 = 0;
        int band25 = 0;
        int band50 = 0;
        int band75 = 0;

        Map<Long, GapAggregate> gaps = new LinkedHashMap<>();
        Map<Long, DepartmentAggregate> departments = new LinkedHashMap<>();

        for (StudentEnrollment enrollment : enrollments) {
            boolean isActive = enrollment.getStatus() == EnrollmentStatus.ACTIVE;
            if (isActive) {
                active++;
            }
            ReadinessResponse readiness = careerInsightService
                    .readinessFor(enrollment.getStudentProfile().getUser().getId());
            boolean hasAttempts = readiness.submittedAttempts() != null
                    && readiness.submittedAttempts() > 0;
            if (hasAttempts) {
                participants++;
            }
            boolean evaluated = Boolean.TRUE.equals(readiness.hasTarget())
                    && hasAttempts && readiness.readinessPercent() != null;
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
            if (hasAttempts) {
                aggregate.participants++;
            }
            if (evaluated) {
                aggregate.evaluated++;
                aggregate.readinessSum += readiness.readinessPercent();
            }
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

        Integer completion = total == 0 ? null : Math.round((participants * 100.0f) / total);

        return new DashboardDtos.CollegeDashboardResponse(
                scope.institutionName(),
                new DashboardDtos.DashboardFilters(
                        filter == null ? null : filter.academicYearId(),
                        filter == null ? null : filter.departmentId(),
                        filter == null ? null : filter.programId(),
                        filter == null ? null : filter.batchId(),
                        filter == null ? null : filter.sectionId(),
                        filter == null || filter.status() == null ? null : filter.status().name()),
                definitions(),
                total,
                active,
                participants,
                completion,
                readinessEvaluated,
                total - readinessEvaluated,
                List.of(
                        new DashboardDtos.ReadinessBand("0-24%", band0),
                        new DashboardDtos.ReadinessBand("25-49%", band25),
                        new DashboardDtos.ReadinessBand("50-74%", band50),
                        new DashboardDtos.ReadinessBand("75-100%", band75)),
                commonGaps,
                comparisons,
                false,
                "No historical readiness snapshots are stored yet, so a trend cannot be shown without fabricating data.",
                Instant.now());
    }

    private static List<DashboardDtos.MetricDefinition> definitions() {
        List<DashboardDtos.MetricDefinition> definitions = new ArrayList<>();
        definitions.add(new DashboardDtos.MetricDefinition(
                "totalEnrolled", "All student enrollments matching the selected filters."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "activeStudents", "Enrollments whose status is ACTIVE."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "assessmentParticipants", "Students with at least one submitted assessment attempt."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "assessmentCompletionPercent", "Assessment participants divided by total enrollments."));
        definitions.add(new DashboardDtos.MetricDefinition(
                "readinessEvaluated", "Students with a target career, a submitted attempt and a computable readiness score."));
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
}
