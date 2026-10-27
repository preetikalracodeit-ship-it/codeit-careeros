package com.codeit.careeros.college.dto;

import java.time.Instant;
import java.util.List;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record MetricDefinition(String metric, String definition) {
    }

    public record ReadinessBand(String band, int students) {
    }

    public record CommonGap(String skillId, String skillName, int studentsBelowTarget, int assessedStudents, int percentBelowTarget) {
    }

    public record DepartmentComparison(
            Long departmentId,
            String departmentName,
            int enrolled,
            int active,
            int assessmentParticipants,
            int readinessEvaluated,
            Integer averageReadinessPercent) {
    }

    public record DashboardFilters(
            Long academicYearId,
            Long departmentId,
            Long programId,
            Long batchId,
            Long sectionId,
            String enrollmentStatus) {
    }

    public record CollegeDashboardResponse(
            String institutionName,
            DashboardFilters filters,
            List<MetricDefinition> definitions,
            int totalEnrolled,
            int activeStudents,
            int assessmentParticipants,
            Integer assessmentCompletionPercent,
            int readinessEvaluated,
            int readinessUnavailable,
            List<ReadinessBand> readinessDistribution,
            List<CommonGap> commonGaps,
            List<DepartmentComparison> departmentComparisons,
            boolean trendAvailable,
            String trendUnavailableReason,
            Instant generatedAt) {
    }
}
