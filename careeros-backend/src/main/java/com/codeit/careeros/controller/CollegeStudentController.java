package com.codeit.careeros.controller;

import com.codeit.careeros.college.dto.ImportDtos;
import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.service.CollegeAccessService;
import com.codeit.careeros.college.service.CollegeReportService;
import com.codeit.careeros.college.service.StudentCsvService;
import com.codeit.careeros.college.service.StudentService;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "College Students", description = "Institution-scoped student management, 360, CSV")
@RestController
@RequestMapping("/api/v1/college/students")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PROFESSOR')")
public class CollegeStudentController {

    private final CollegeAccessService collegeAccessService;
    private final StudentService studentService;
    private final StudentCsvService studentCsvService;
    private final CollegeReportService collegeReportService;

    @Operation(summary = "Search and page students inside the caller's institution and scope")
    @GetMapping
    public ApiResponse<StudentDtos.StudentPageResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long academicYearId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long programId,
            @RequestParam(required = false) Long batchId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) EnrollmentStatus status,
            @RequestParam(required = false) Boolean assessmentCompleted,
            @RequestParam(required = false) Boolean readinessEvaluated,
            @RequestParam(required = false) java.time.LocalDate assessmentDateFrom,
            @RequestParam(required = false) java.time.LocalDate assessmentDateTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "fullName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return ApiResponse.success(studentService.list(
                collegeAccessService.currentScope(),
                filter(search, academicYearId, departmentId, programId, batchId, sectionId, status,
                        assessmentCompleted, readinessEvaluated, assessmentDateFrom, assessmentDateTo),
                page, size, sortBy, sortDir));
    }

    @Operation(summary = "Student 360 with field-level visibility enforced on the server")
    @GetMapping("/{id}")
    public ApiResponse<StudentDtos.CollegeStudentDetailResponse> detail(@PathVariable Long id) {
        return ApiResponse.success(
                studentService.detail(collegeAccessService.currentScope(), id));
    }

    @Operation(summary = "Change an enrollment status")
    @PatchMapping("/{id}/status")
    public ApiResponse<StudentDtos.EnrollmentStatusResponse> updateStatus(
            @PathVariable Long id,
            @RequestBody StudentDtos.StudentStatusUpdateRequest request) {
        return ApiResponse.success("Enrollment status updated",
                studentService.updateStatus(collegeAccessService.currentScope(), id, request));
    }

    @Operation(summary = "Export the scoped student list as CSV (max 10,000 rows)")
    @GetMapping("/export.csv")
    public ResponseEntity<Resource> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long academicYearId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long programId,
            @RequestParam(required = false) Long batchId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) EnrollmentStatus status,
            @RequestParam(required = false) java.time.LocalDate assessmentDateFrom,
            @RequestParam(required = false) java.time.LocalDate assessmentDateTo) {
        StudentCsvService.CsvExport export = studentCsvService.export(
                collegeAccessService.currentScope(),
                filter(search, academicYearId, departmentId, programId, batchId, sectionId, status,
                        null, null, assessmentDateFrom, assessmentDateTo));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(export.filename()).build().toString())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .contentLength(export.bytes().length)
                .body(new ByteArrayResource(export.bytes()));
    }

    @Operation(summary = "Preview a student CSV import (writes short-lived staging rows only)")
    @PostMapping("/import/preview")
    public ApiResponse<ImportDtos.ImportPreviewResponse> previewImport(
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.success(
                studentCsvService.preview(collegeAccessService.currentScope(), file));
    }

    @Operation(summary = "Commit a previously previewed import")
    @PostMapping("/import/{jobId}/commit")
    public ApiResponse<ImportDtos.ImportCommitResponse> commitImport(@PathVariable Long jobId) {
        return ApiResponse.success("Import committed",
                studentCsvService.commit(collegeAccessService.currentScope(), jobId));
    }

    @Operation(summary = "Download a Student 360 PDF")
    @GetMapping("/{id}/report.pdf")
    public ResponseEntity<Resource> studentReport(@PathVariable Long id) {
        byte[] pdf = collegeReportService.studentPdf(
                collegeAccessService.currentScope(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(collegeReportService.studentFilename(id)).build().toString())
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(pdf.length)
                .body(new ByteArrayResource(pdf));
    }

    private static StudentDtos.StudentFilter filter(String search, Long academicYearId,
                                                    Long departmentId, Long programId,
                                                    Long batchId, Long sectionId,
                                                    EnrollmentStatus status,
                                                    Boolean assessmentCompleted,
                                                    Boolean readinessEvaluated,
                                                    java.time.LocalDate assessmentDateFrom,
                                                    java.time.LocalDate assessmentDateTo) {
        return new StudentDtos.StudentFilter(
                search, academicYearId, departmentId, programId, batchId, sectionId, status,
                assessmentCompleted, readinessEvaluated, assessmentDateFrom, assessmentDateTo);
    }
}
