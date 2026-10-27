package com.codeit.careeros.college.dto;

import com.codeit.careeros.college.enums.InstitutionStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class AcademicDtos {

    private AcademicDtos() {
    }

    public record InstitutionRequest(
            String code,
            String name,
            String timezone,
            String contactEmail,
            InstitutionStatus status) {
    }

    public record InstitutionResponse(
            Long id,
            String code,
            String name,
            InstitutionStatus status,
            String timezone,
            String contactEmail,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record DepartmentRequest(String code, String name, InstitutionStatus status) {
    }

    public record DepartmentResponse(
            Long id, Long institutionId, String code, String name,
            InstitutionStatus status, Instant createdAt) {
    }

    public record ProgramRequest(
            Long departmentId, String code, String name, String degreeType,
            Integer durationYears, InstitutionStatus status) {
    }

    public record ProgramResponse(
            Long id, Long institutionId, Long departmentId, String departmentName,
            String code, String name, String degreeType, Integer durationYears,
            InstitutionStatus status, Instant createdAt) {
    }

    public record AcademicYearRequest(
            String label, LocalDate startDate, LocalDate endDate, Boolean active) {
    }

    public record AcademicYearResponse(
            Long id, Long institutionId, String label, LocalDate startDate,
            LocalDate endDate, boolean active, Instant createdAt) {
    }

    public record BatchRequest(
            Long programId, Long academicYearId, String label,
            Integer graduationYear, InstitutionStatus status) {
    }

    public record BatchResponse(
            Long id, Long institutionId, Long programId, String programName,
            Long departmentId, String departmentName, Long academicYearId,
            String academicYearLabel, String label, Integer graduationYear,
            InstitutionStatus status, Instant createdAt) {
    }

    public record SectionRequest(Long batchId, String name, InstitutionStatus status) {
    }

    public record SectionResponse(
            Long id, Long batchId, String batchLabel, Long programId, String programName,
            String name, InstitutionStatus status, Instant createdAt) {
    }

    public record AcademicStructureResponse(
            InstitutionResponse institution,
            List<DepartmentResponse> departments,
            List<ProgramResponse> programs,
            List<AcademicYearResponse> academicYears,
            List<BatchResponse> batches,
            List<SectionResponse> sections) {
    }
}
