package com.codeit.careeros.controller;

import com.codeit.careeros.college.dto.DashboardDtos;
import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.service.CollegeAccessService;
import com.codeit.careeros.college.service.CollegeReportService;
import com.codeit.careeros.college.service.DashboardService;
import com.codeit.careeros.common.ApiResponse;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "College Dashboard", description = "Scoped institution analytics and cohort reports")
@RestController
@RequestMapping("/api/v1/college")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PROFESSOR')")
public class CollegeDashboardController {

    private final CollegeAccessService collegeAccessService;
    private final DashboardService dashboardService;
    private final CollegeReportService collegeReportService;

    @Operation(summary = "Scoped institution dashboard with metric definitions")
    @GetMapping("/dashboard")
    public ApiResponse<DashboardDtos.CollegeDashboardResponse> dashboard(
            @RequestParam(required = false) Long academicYearId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long programId,
            @RequestParam(required = false) Long batchId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) EnrollmentStatus status) {
        return ApiResponse.success(dashboardService.dashboard(
                collegeAccessService.currentScope(),
                new StudentDtos.StudentFilter(
                        null, academicYearId, departmentId, programId, batchId, sectionId, status)));
    }

    @Operation(summary = "Download the scoped cohort report as PDF")
    @GetMapping("/reports/cohort.pdf")
    public ResponseEntity<Resource> cohortReport(
            @RequestParam(required = false) Long academicYearId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long programId,
            @RequestParam(required = false) Long batchId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) EnrollmentStatus status) {
        byte[] pdf = collegeReportService.cohortPdf(
                collegeAccessService.currentScope(),
                new StudentDtos.StudentFilter(
                        null, academicYearId, departmentId, programId, batchId, sectionId, status));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(collegeReportService.cohortFilename()).build().toString())
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(pdf.length)
                .body(new ByteArrayResource(pdf));
    }
}
