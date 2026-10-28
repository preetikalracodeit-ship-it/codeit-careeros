package com.codeit.careeros.improvement.dto;

import com.codeit.careeros.improvement.enums.PlanStatus;
import com.codeit.careeros.improvement.enums.TaskPriority;
import com.codeit.careeros.improvement.enums.TaskStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ImprovementDtos {

    private ImprovementDtos() {
    }

    public record ImprovementTaskResponse(
            Long id,
            String title,
            String description,
            Long skillId,
            String skillName,
            TaskPriority priority,
            TaskStatus status,
            LocalDate targetDate,
            Long ownerUserId,
            String ownerName,
            Integer baselineScore,
            Integer targetScore,
            String evidenceSource,
            boolean overdue,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ImprovementPlanResponse(
            Long id,
            Long studentEnrollmentId,
            Long studentProfileId,
            String studentName,
            String studentId,
            String rollNumber,
            String departmentName,
            String programName,
            String batchLabel,
            String title,
            String summary,
            PlanStatus status,
            String targetCareerName,
            Integer currentReadinessPercent,
            String createdByName,
            List<ImprovementTaskResponse> tasks,
            int completedTasks,
            int totalTasks,
            int progressPercent,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ImprovementPlanListResponse(
            List<ImprovementPlanResponse> items,
            long total) {
    }

    public record PlanTaskRequest(
            String title,
            String description,
            Long skillId,
            TaskPriority priority,
            LocalDate targetDate,
            Long ownerUserId,
            String ownerName,
            Integer baselineScore,
            Integer targetScore) {
    }

    public record PlanCreateRequest(
            Long enrollmentId,
            String title,
            String summary,
            List<PlanTaskRequest> tasks) {
    }

    public record PlanGenerateRequest(
            Long enrollmentId,
            Integer horizonDays) {
    }

    public record PlanUpdateRequest(
            String title,
            String summary,
            PlanStatus status) {
    }

    public record TaskUpdateRequest(
            TaskStatus status,
            LocalDate targetDate,
            String ownerName,
            String description) {
    }
}
