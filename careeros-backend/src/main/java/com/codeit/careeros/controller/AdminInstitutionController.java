package com.codeit.careeros.controller;

import com.codeit.careeros.college.dto.AcademicDtos;
import com.codeit.careeros.college.dto.StaffDtos;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.service.AcademicStructureService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Platform-administrator institution management. This role creates
 * institutions and can bootstrap the first college administrator. It never
 * gains implicit access to institution student data.
 */
@Tag(name = "Admin Institutions", description = "Platform institution provisioning")
@RestController
@RequestMapping("/api/v1/admin/institutions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminInstitutionController {

    private final AcademicStructureService academicStructureService;
    private final StaffService staffService;

    @Operation(summary = "Create an institution")
    @PostMapping
    public ApiResponse<AcademicDtos.InstitutionResponse> create(
            @RequestBody AcademicDtos.InstitutionRequest request) {
        return ApiResponse.success("Institution created",
                academicStructureService.createInstitution(request));
    }

    @Operation(summary = "List all institutions")
    @GetMapping
    public ApiResponse<List<AcademicDtos.InstitutionResponse>> list() {
        return ApiResponse.success(academicStructureService.listInstitutions());
    }

    @Operation(summary = "Activate or deactivate an institution")
    @PatchMapping("/{id}/status")
    public ApiResponse<AcademicDtos.InstitutionResponse> status(
            @PathVariable Long id, @RequestParam InstitutionStatus status) {
        return ApiResponse.success("Institution status updated",
                academicStructureService.updateInstitutionStatus(id, status));
    }

    @Operation(summary = "Bootstrap the institution's first college administrator",
            description = "Allowed only while the institution has no active college administrator. "
                    + "The one-time activation link is returned only to the platform administrator; "
                    + "email delivery is not configured.")
    @PostMapping("/{id}/invitations")
    public ApiResponse<StaffDtos.CreatedInvitationResponse> bootstrapInvitation(
            @PathVariable Long id, @RequestBody StaffDtos.InvitationCreateRequest request) {
        return ApiResponse.success("Bootstrap invitation created",
                staffService.createBootstrapInvitation(id, request));
    }
}
