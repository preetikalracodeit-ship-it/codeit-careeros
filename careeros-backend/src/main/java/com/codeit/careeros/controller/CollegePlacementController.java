package com.codeit.careeros.controller;

import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.service.CollegeAccessService;
import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.placement.dto.PlacementDtos;
import com.codeit.careeros.placement.enums.DriveStatus;
import com.codeit.careeros.placement.enums.JobStatus;
import com.codeit.careeros.placement.service.PlacementAnalyticsService;
import com.codeit.careeros.placement.service.PlacementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "College Placement", description = "Companies, jobs, placement drives, applications and offers")
@RestController
@RequestMapping("/api/v1/college/placement")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PROFESSOR')")
public class CollegePlacementController {

    private final CollegeAccessService collegeAccessService;
    private final PlacementService placementService;
    private final PlacementAnalyticsService placementAnalyticsService;

    // ---- companies ----

    @Operation(summary = "List companies inside the caller's institution")
    @GetMapping("/companies")
    public ApiResponse<List<PlacementDtos.CompanyResponse>> companies() {
        return ApiResponse.success(placementService.listCompanies(collegeAccessService.currentScope()));
    }

    @Operation(summary = "Create a company")
    @PostMapping("/companies")
    public ApiResponse<PlacementDtos.CompanyResponse> createCompany(
            @RequestBody PlacementDtos.CompanyRequest request) {
        return ApiResponse.success("Company created",
                placementService.createCompany(collegeAccessService.currentScope(), request));
    }

    @Operation(summary = "Update a company")
    @PutMapping("/companies/{id}")
    public ApiResponse<PlacementDtos.CompanyResponse> updateCompany(
            @PathVariable Long id,
            @RequestBody PlacementDtos.CompanyRequest request) {
        return ApiResponse.success("Company updated",
                placementService.updateCompany(collegeAccessService.currentScope(), id, request));
    }

    // ---- jobs ----

    @Operation(summary = "List job openings")
    @GetMapping("/jobs")
    public ApiResponse<List<PlacementDtos.JobResponse>> jobs(
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) JobStatus status) {
        return ApiResponse.success(placementService.listJobs(
                collegeAccessService.currentScope(), companyId, status));
    }

    @Operation(summary = "Create a job opening")
    @PostMapping("/jobs")
    public ApiResponse<PlacementDtos.JobResponse> createJob(
            @RequestBody PlacementDtos.JobRequest request) {
        return ApiResponse.success("Job opening created",
                placementService.createJob(collegeAccessService.currentScope(), request));
    }

    @Operation(summary = "Update a job opening")
    @PutMapping("/jobs/{id}")
    public ApiResponse<PlacementDtos.JobResponse> updateJob(
            @PathVariable Long id,
            @RequestBody PlacementDtos.JobRequest request) {
        return ApiResponse.success("Job opening updated",
                placementService.updateJob(collegeAccessService.currentScope(), id, request));
    }

    // ---- drives ----

    @Operation(summary = "List placement drives")
    @GetMapping("/drives")
    public ApiResponse<List<PlacementDtos.DriveResponse>> drives(
            @RequestParam(required = false) DriveStatus status) {
        return ApiResponse.success(placementService.listDrives(
                collegeAccessService.currentScope(), status));
    }

    @Operation(summary = "Read a drive with eligible students and applications")
    @GetMapping("/drives/{id}")
    public ApiResponse<PlacementDtos.DriveDetailResponse> drive(@PathVariable Long id) {
        return ApiResponse.success(placementService.driveDetail(
                collegeAccessService.currentScope(), id));
    }

    @Operation(summary = "Create a placement drive")
    @PostMapping("/drives")
    public ApiResponse<PlacementDtos.DriveResponse> createDrive(
            @RequestBody PlacementDtos.DriveRequest request) {
        return ApiResponse.success("Placement drive created",
                placementService.createDrive(collegeAccessService.currentScope(), request));
    }

    @Operation(summary = "Update a placement drive")
    @PutMapping("/drives/{id}")
    public ApiResponse<PlacementDtos.DriveResponse> updateDrive(
            @PathVariable Long id,
            @RequestBody PlacementDtos.DriveRequest request) {
        return ApiResponse.success("Placement drive updated",
                placementService.updateDrive(collegeAccessService.currentScope(), id, request));
    }

    @Operation(summary = "Eligible students for a drive")
    @GetMapping("/drives/{id}/eligible-students")
    public ApiResponse<List<PlacementDtos.EligibleStudentResponse>> eligibleStudents(@PathVariable Long id) {
        return ApiResponse.success(placementService.eligibleStudents(
                collegeAccessService.currentScope(), id));
    }

    @Operation(summary = "Register a student for a drive, with an audited eligibility override when authorized")
    @PostMapping("/drives/{id}/applications")
    public ApiResponse<PlacementDtos.ApplicationResponse> createApplication(
            @PathVariable Long id,
            @RequestBody PlacementDtos.ApplicationCreateRequest request) {
        return ApiResponse.success("Application registered",
                placementService.createApplication(collegeAccessService.currentScope(), id, request));
    }

    @Operation(summary = "Advance or correct an application stage")
    @PatchMapping("/applications/{id}")
    public ApiResponse<PlacementDtos.ApplicationResponse> updateApplication(
            @PathVariable Long id,
            @RequestBody PlacementDtos.ApplicationStageUpdateRequest request) {
        return ApiResponse.success("Application updated",
                placementService.updateApplication(collegeAccessService.currentScope(), id, request));
    }

    @Operation(summary = "Record an offer for an application")
    @PostMapping("/applications/{id}/offer")
    public ApiResponse<PlacementDtos.OfferResponse> createOffer(
            @PathVariable Long id,
            @RequestBody PlacementDtos.OfferRequest request) {
        return ApiResponse.success("Offer recorded",
                placementService.createOffer(collegeAccessService.currentScope(), id, request));
    }

    @Operation(summary = "Update offer acceptance or joining outcome")
    @PatchMapping("/offers/{id}")
    public ApiResponse<PlacementDtos.OfferResponse> updateOffer(
            @PathVariable Long id,
            @RequestBody PlacementDtos.OfferUpdateRequest request) {
        return ApiResponse.success("Offer updated",
                placementService.updateOffer(collegeAccessService.currentScope(), id, request));
    }

    // ---- analytics ----

    @Operation(summary = "Placement analytics with documented denominators")
    @GetMapping("/analytics")
    public ApiResponse<PlacementDtos.PlacementAnalyticsResponse> analytics(
            @RequestParam(required = false) Long academicYearId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long programId,
            @RequestParam(required = false) Long batchId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) EnrollmentStatus status,
            @RequestParam(required = false) Boolean assessmentCompleted,
            @RequestParam(required = false) java.time.LocalDate assessmentDateFrom,
            @RequestParam(required = false) java.time.LocalDate assessmentDateTo) {
        return ApiResponse.success(placementAnalyticsService.analytics(
                collegeAccessService.currentScope(),
                filter(academicYearId, departmentId, programId, batchId, sectionId, status,
                        assessmentCompleted, assessmentDateFrom, assessmentDateTo)));
    }

    @Operation(summary = "Export placement analytics as CSV")
    @GetMapping("/analytics/export.csv")
    public ResponseEntity<Resource> export(
            @RequestParam String type,
            @RequestParam(required = false) Long academicYearId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long programId,
            @RequestParam(required = false) Long batchId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) EnrollmentStatus status,
            @RequestParam(required = false) Boolean assessmentCompleted,
            @RequestParam(required = false) java.time.LocalDate assessmentDateFrom,
            @RequestParam(required = false) java.time.LocalDate assessmentDateTo) {
        var export = placementAnalyticsService.export(
                collegeAccessService.currentScope(),
                filter(academicYearId, departmentId, programId, batchId, sectionId, status,
                        assessmentCompleted, assessmentDateFrom, assessmentDateTo),
                type);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(export.filename()).build().toString())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .contentLength(export.bytes().length)
                .body(new ByteArrayResource(export.bytes()));
    }

    private static StudentDtos.StudentFilter filter(Long academicYearId, Long departmentId,
                                                    Long programId, Long batchId, Long sectionId,
                                                    EnrollmentStatus status, Boolean assessmentCompleted,
                                                    java.time.LocalDate from, java.time.LocalDate to) {
        return new StudentDtos.StudentFilter(null, academicYearId, departmentId, programId,
                batchId, sectionId, status, assessmentCompleted, null, from, to);
    }
}
