package com.codeit.careeros.college.dto;

import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.dto.cv.CvAnalysisResponse;
import com.codeit.careeros.dto.insight.AttemptHistoryItem;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.dto.linkedin.LinkedInAnalysisResponse;
import com.codeit.careeros.dto.project.ProjectListResponse;
import com.codeit.careeros.dto.roadmap.RoadmapResponse;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class StudentDtos {

    private StudentDtos() {
    }

    public record CollegeStudentProfileResponse(
            Long id,
            String studentId,
            String fullName,
            String email,
            String mobile,
            LocalDate dateOfBirth,
            String college,
            String degree,
            String branch,
            Integer graduationYear,
            Integer semester,
            String location,
            String githubUrl,
            String linkedinUrl,
            String portfolioUrl,
            Long targetCareerId,
            String targetCareerName,
            Instant createdAt) {
    }

    public record EnrollmentResponse(
            Long id,
            Long institutionId,
            String institutionName,
            Long departmentId,
            String departmentName,
            Long programId,
            String programName,
            Long batchId,
            String batchLabel,
            Long sectionId,
            String sectionName,
            Long academicYearId,
            String academicYearLabel,
            String rollNumber,
            EnrollmentStatus status,
            LocalDate startDate,
            LocalDate endDate) {
    }

    public record CollegeStudentListItem(
            Long id,
            String studentId,
            String fullName,
            String email,
            String rollNumber,
            Long departmentId,
            String departmentName,
            Long programId,
            String programName,
            Long batchId,
            String batchLabel,
            Long sectionId,
            String sectionName,
            String academicYearLabel,
            EnrollmentStatus status,
            String targetCareerName,
            Integer readinessPercent,
            boolean assessmentCompleted) {
    }

    public record Student360Permissions(
            boolean canViewSensitiveProfile,
            boolean canViewCvAnalysis,
            boolean canViewReports,
            boolean canExport) {
    }

    public record CollegeStudentDetailResponse(
            CollegeStudentProfileResponse profile,
            EnrollmentResponse enrollment,
            ReadinessResponse readiness,
            List<AttemptHistoryItem> assessmentHistory,
            RoadmapResponse roadmap,
            ProjectListResponse projects,
            CvAnalysisResponse cvAnalysis,
            LinkedInAnalysisResponse linkedInAnalysis,
            Student360Permissions permissions,
            Instant generatedAt) {
    }

    public record StudentStatusUpdateRequest(EnrollmentStatus status, String reason) {
    }

    public record StudentFilter(
            String search,
            Long academicYearId,
            Long departmentId,
            Long programId,
            Long batchId,
            Long sectionId,
            EnrollmentStatus status,
            Boolean assessmentCompleted,
            Boolean readinessEvaluated,
            java.time.LocalDate assessmentDateFrom,
            java.time.LocalDate assessmentDateTo) {
    }

    public record StudentPageResponse(
            List<CollegeStudentListItem> items,
            long totalElements,
            int page,
            int size,
            int totalPages) {
    }

    public record EnrollmentStatusResponse(
            Long enrollmentId, EnrollmentStatus status, Instant updatedAt) {
    }
}
