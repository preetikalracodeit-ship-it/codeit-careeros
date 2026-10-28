package com.codeit.careeros.controller;

import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.placement.dto.PlacementDtos;
import com.codeit.careeros.placement.enums.OfferStatus;
import com.codeit.careeros.placement.service.PlacementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Student Placement", description = "The student's own placement drives and applications")
@RestController
@RequestMapping("/api/v1/students/me/placement")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentPlacementController {

    private final PlacementService placementService;

    @Operation(summary = "Drives visible to the authenticated student")
    @GetMapping("/drives")
    public ApiResponse<PlacementDtos.StudentDriveListResponse> drives() {
        return ApiResponse.success(placementService.myDrives());
    }

    @Operation(summary = "Register for an open drive")
    @PostMapping("/drives/{id}/register")
    public ApiResponse<PlacementDtos.ApplicationResponse> register(@PathVariable Long id) {
        return ApiResponse.success("Registered for the drive",
                placementService.registerForDrive(id));
    }

    @Operation(summary = "The authenticated student's applications")
    @GetMapping("/applications")
    public ApiResponse<PlacementDtos.StudentApplicationListResponse> applications() {
        return ApiResponse.success(placementService.myApplications());
    }

    @Operation(summary = "Withdraw an application")
    @PatchMapping("/applications/{id}/withdraw")
    public ApiResponse<PlacementDtos.ApplicationResponse> withdraw(@PathVariable Long id) {
        return ApiResponse.success("Application withdrawn",
                placementService.withdrawMyApplication(id));
    }

    @Operation(summary = "Accept or decline an offer")
    @PatchMapping("/offers/{id}/respond")
    public ApiResponse<PlacementDtos.OfferResponse> respond(
            @PathVariable Long id,
            @RequestParam OfferStatus status) {
        return ApiResponse.success("Offer response recorded",
                placementService.respondToOffer(id, status));
    }
}
