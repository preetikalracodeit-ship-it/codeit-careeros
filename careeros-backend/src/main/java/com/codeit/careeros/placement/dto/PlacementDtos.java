package com.codeit.careeros.placement.dto;

import com.codeit.careeros.college.dto.DashboardDtos;
import com.codeit.careeros.placement.enums.ApplicationStage;
import com.codeit.careeros.placement.enums.CompanyStatus;
import com.codeit.careeros.placement.enums.DriveStatus;
import com.codeit.careeros.placement.enums.EmploymentType;
import com.codeit.careeros.placement.enums.JobStatus;
import com.codeit.careeros.placement.enums.OfferStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class PlacementDtos {

    private PlacementDtos() {
    }

    public record CompanyResponse(
            Long id,
            String name,
            String industry,
            String sector,
            String website,
            String contactName,
            String contactEmail,
            String contactPhone,
            CompanyStatus recruitmentStatus,
            String source,
            String notes,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CompanyRequest(
            String name,
            String industry,
            String sector,
            String website,
            String contactName,
            String contactEmail,
            String contactPhone,
            CompanyStatus recruitmentStatus,
            String source,
            String notes) {
    }

    public record JobResponse(
            Long id,
            Long companyId,
            String companyName,
            String title,
            String description,
            String requiredSkills,
            String location,
            EmploymentType employmentType,
            String eligibilityCriteria,
            BigDecimal salaryMin,
            BigDecimal salaryMax,
            String currency,
            LocalDate applicationDeadline,
            JobStatus status,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record JobRequest(
            Long companyId,
            String title,
            String description,
            String requiredSkills,
            String location,
            EmploymentType employmentType,
            String eligibilityCriteria,
            BigDecimal salaryMin,
            BigDecimal salaryMax,
            String currency,
            LocalDate applicationDeadline,
            JobStatus status) {
    }

    public record DriveResponse(
            Long id,
            Long companyId,
            String companyName,
            Long jobId,
            String jobTitle,
            String name,
            LocalDate registrationStart,
            LocalDate registrationEnd,
            LocalDate driveDate,
            String eligibilityCriteria,
            Long eligibleDepartmentId,
            String eligibleDepartmentName,
            Long eligibleProgramId,
            String eligibleProgramName,
            Long eligibleBatchId,
            String eligibleBatchLabel,
            Integer eligibleGraduationYear,
            Integer minimumReadinessPercent,
            DriveStatus status,
            long applicationCount,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record DriveRequest(
            Long companyId,
            Long jobId,
            String name,
            LocalDate registrationStart,
            LocalDate registrationEnd,
            LocalDate driveDate,
            String eligibilityCriteria,
            Long eligibleDepartmentId,
            Long eligibleProgramId,
            Long eligibleBatchId,
            Integer eligibleGraduationYear,
            Integer minimumReadinessPercent,
            DriveStatus status) {
    }

    public record StageEventResponse(
            Long id,
            ApplicationStage stage,
            String note,
            String recordedByName,
            Instant recordedAt) {
    }

    public record OfferResponse(
            Long id,
            Long applicationId,
            BigDecimal packageAmount,
            String currency,
            LocalDate offerDate,
            OfferStatus status,
            LocalDate joinedAt,
            String notes,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ApplicationResponse(
            Long id,
            Long driveId,
            String driveName,
            Long companyId,
            String companyName,
            Long jobId,
            String jobTitle,
            Long studentEnrollmentId,
            Long studentProfileId,
            String studentName,
            String studentId,
            String rollNumber,
            String departmentName,
            String programName,
            String batchLabel,
            ApplicationStage stage,
            boolean eligibilityOverride,
            String overrideReason,
            Instant appliedAt,
            Instant updatedAt,
            List<StageEventResponse> history,
            OfferResponse offer) {
    }

    public record EligibleStudentResponse(
            Long enrollmentId,
            Long studentProfileId,
            String studentId,
            String rollNumber,
            String fullName,
            String departmentName,
            String programName,
            String batchLabel,
            Integer graduationYear,
            Integer readinessPercent,
            boolean eligible,
            String reason,
            boolean alreadyApplied,
            Long applicationId) {
    }

    public record DriveDetailResponse(
            DriveResponse drive,
            List<EligibleStudentResponse> eligibleStudents,
            List<ApplicationResponse> applications) {
    }

    public record ApplicationCreateRequest(
            Long enrollmentId,
            Boolean override,
            String overrideReason) {
    }

    public record ApplicationStageUpdateRequest(
            ApplicationStage stage,
            String note) {
    }

    public record OfferRequest(
            BigDecimal packageAmount,
            String currency,
            LocalDate offerDate,
            LocalDate joinedAt,
            OfferStatus status,
            String notes) {
    }

    public record OfferUpdateRequest(
            BigDecimal packageAmount,
            String currency,
            LocalDate offerDate,
            OfferStatus status,
            LocalDate joinedAt,
            String notes) {
    }

    public record StudentDriveResponse(
            DriveResponse drive,
            boolean eligible,
            String eligibilityReason,
            boolean alreadyApplied,
            Long applicationId) {
    }

    public record StudentDriveListResponse(
            List<StudentDriveResponse> items,
            long total) {
    }

    public record StudentApplicationListResponse(
            List<ApplicationResponse> items,
            long total) {
    }

    public record StageCount(
            ApplicationStage stage,
            long applications) {
    }

    public record DepartmentOutcome(
            Long departmentId,
            String departmentName,
            int eligibleGraduatingStudents,
            int driveParticipants,
            int offers,
            int joined,
            Integer participationRate,
            Integer placementRate) {
    }

    public record CompanyOutcome(
            Long companyId,
            String companyName,
            long drives,
            long applications,
            long offers,
            long joined) {
    }

    public record PlacementAnalyticsResponse(
            String institutionName,
            String denominatorDefinition,
            List<DashboardDtos.MetricDefinition> definitions,
            int eligibleGraduatingStudents,
            int driveParticipants,
            int totalApplications,
            int activeApplications,
            int offersMade,
            int studentsWithOffer,
            int acceptedOffers,
            int joinedStudents,
            Integer participationRate,
            Integer offerRate,
            Integer placementRate,
            List<DepartmentOutcome> departmentOutcomes,
            List<CompanyOutcome> companyOutcomes,
            List<StageCount> stageCounts,
            Instant generatedAt) {
    }
}
