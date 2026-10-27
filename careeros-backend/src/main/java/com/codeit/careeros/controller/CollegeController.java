package com.codeit.careeros.controller;

import com.codeit.careeros.college.dto.AcademicDtos;
import com.codeit.careeros.college.dto.StaffDtos;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.service.AcademicStructureService;
import com.codeit.careeros.college.service.CollegeAccessService;
import com.codeit.careeros.college.service.StaffService;
import com.codeit.careeros.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "College", description = "Institution-scoped academic structure and staff")
@RestController
@RequestMapping("/api/v1/college")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PROFESSOR')")
public class CollegeController {

    private final CollegeAccessService collegeAccessService;
    private final AcademicStructureService academicStructureService;
    private final StaffService staffService;

    @Operation(summary = "The caller's server-derived institution membership and permissions")
    @GetMapping("/me")
    public ApiResponse<StaffDtos.CollegeMeResponse> me() {
        return ApiResponse.success(staffService.me(collegeAccessService.currentScope()));
    }

    // ---- academic structure ----

    @Operation(summary = "Academic structure visible to the caller's scope")
    @GetMapping("/structure")
    public ApiResponse<AcademicDtos.AcademicStructureResponse> structure() {
        return ApiResponse.success(
                academicStructureService.structure(collegeAccessService.currentScope()));
    }

    @Operation(summary = "Update the institution's own profile")
    @PutMapping("/institution")
    public ApiResponse<AcademicDtos.InstitutionResponse> updateInstitution(
            @RequestBody AcademicDtos.InstitutionRequest request) {
        return ApiResponse.success("Institution updated",
                academicStructureService.updateInstitution(collegeAccessService.currentScope(), request));
    }

    @PostMapping("/departments")
    public ApiResponse<AcademicDtos.DepartmentResponse> createDepartment(
            @RequestBody AcademicDtos.DepartmentRequest request) {
        return ApiResponse.success("Department created",
                academicStructureService.createDepartment(collegeAccessService.currentScope(), request));
    }

    @PutMapping("/departments/{id}")
    public ApiResponse<AcademicDtos.DepartmentResponse> updateDepartment(
            @PathVariable Long id, @RequestBody AcademicDtos.DepartmentRequest request) {
        return ApiResponse.success("Department updated",
                academicStructureService.updateDepartment(collegeAccessService.currentScope(), id, request));
    }

    @PostMapping("/programs")
    public ApiResponse<AcademicDtos.ProgramResponse> createProgram(
            @RequestBody AcademicDtos.ProgramRequest request) {
        return ApiResponse.success("Program created",
                academicStructureService.createProgram(collegeAccessService.currentScope(), request));
    }

    @PutMapping("/programs/{id}")
    public ApiResponse<AcademicDtos.ProgramResponse> updateProgram(
            @PathVariable Long id, @RequestBody AcademicDtos.ProgramRequest request) {
        return ApiResponse.success("Program updated",
                academicStructureService.updateProgram(collegeAccessService.currentScope(), id, request));
    }

    @PostMapping("/academic-years")
    public ApiResponse<AcademicDtos.AcademicYearResponse> createAcademicYear(
            @RequestBody AcademicDtos.AcademicYearRequest request) {
        return ApiResponse.success("Academic year created",
                academicStructureService.createAcademicYear(collegeAccessService.currentScope(), request));
    }

    @PutMapping("/academic-years/{id}")
    public ApiResponse<AcademicDtos.AcademicYearResponse> updateAcademicYear(
            @PathVariable Long id, @RequestBody AcademicDtos.AcademicYearRequest request) {
        return ApiResponse.success("Academic year updated",
                academicStructureService.updateAcademicYear(collegeAccessService.currentScope(), id, request));
    }

    @PostMapping("/batches")
    public ApiResponse<AcademicDtos.BatchResponse> createBatch(
            @RequestBody AcademicDtos.BatchRequest request) {
        return ApiResponse.success("Batch created",
                academicStructureService.createBatch(collegeAccessService.currentScope(), request));
    }

    @PutMapping("/batches/{id}")
    public ApiResponse<AcademicDtos.BatchResponse> updateBatch(
            @PathVariable Long id, @RequestBody AcademicDtos.BatchRequest request) {
        return ApiResponse.success("Batch updated",
                academicStructureService.updateBatch(collegeAccessService.currentScope(), id, request));
    }

    @PostMapping("/sections")
    public ApiResponse<AcademicDtos.SectionResponse> createSection(
            @RequestBody AcademicDtos.SectionRequest request) {
        return ApiResponse.success("Section created",
                academicStructureService.createSection(collegeAccessService.currentScope(), request));
    }

    @PutMapping("/sections/{id}")
    public ApiResponse<AcademicDtos.SectionResponse> updateSection(
            @PathVariable Long id, @RequestBody AcademicDtos.SectionRequest request) {
        return ApiResponse.success("Section updated",
                academicStructureService.updateSection(collegeAccessService.currentScope(), id, request));
    }

    // ---- staff ----

    @GetMapping("/staff/invitations")
    public ApiResponse<List<StaffDtos.StaffInvitationResponse>> invitations() {
        return ApiResponse.success(staffService.listInvitations(collegeAccessService.currentScope()));
    }

    @PostMapping("/staff/invitations")
    public ApiResponse<StaffDtos.CreatedInvitationResponse> invite(
            @RequestBody StaffDtos.InvitationCreateRequest request) {
        return ApiResponse.success("Invitation created",
                staffService.createInvitation(collegeAccessService.currentScope(), request));
    }

    @PostMapping("/staff/invitations/{id}/revoke")
    public ApiResponse<Void> revoke(@PathVariable Long id) {
        staffService.revokeInvitation(collegeAccessService.currentScope(), id);
        return ApiResponse.success("Invitation revoked", null);
    }

    @GetMapping("/staff/members")
    public ApiResponse<List<StaffDtos.MembershipResponse>> members() {
        return ApiResponse.success(staffService.listMemberships(collegeAccessService.currentScope()));
    }

    @PatchMapping("/staff/members/{id}")
    public ApiResponse<StaffDtos.MembershipResponse> updateMember(
            @PathVariable Long id, @RequestBody StaffDtos.MembershipUpdateRequest request) {
        return ApiResponse.success("Membership updated",
                staffService.updateMembership(collegeAccessService.currentScope(), id, request));
    }
}
