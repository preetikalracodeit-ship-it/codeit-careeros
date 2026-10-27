package com.codeit.careeros.controller;

import com.codeit.careeros.college.dto.StaffDtos;
import com.codeit.careeros.college.service.StaffService;
import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.dto.auth.AuthResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public invitation endpoints. The token is the bearer secret; responses mask
 * the invited email and never reveal whether an account already exists.
 */
@Tag(name = "Staff Invitations", description = "Public staff invitation metadata and acceptance")
@RestController
@RequestMapping("/api/v1/invitations")
@RequiredArgsConstructor
public class PublicInvitationController {

    private final StaffService staffService;

    @Operation(summary = "Public metadata for an invitation token")
    @GetMapping("/{token}")
    public ApiResponse<StaffDtos.PublicInvitationResponse> metadata(@PathVariable String token) {
        return ApiResponse.success(staffService.publicInvitation(token));
    }

    @Operation(summary = "Accept an invitation and start a staff session")
    @PostMapping("/{token}/accept")
    public ApiResponse<AuthResponse> accept(@PathVariable String token,
                                            @RequestBody StaffDtos.InvitationAcceptRequest request) {
        return ApiResponse.success("Invitation accepted",
                staffService.acceptInvitation(token, request));
    }
}
