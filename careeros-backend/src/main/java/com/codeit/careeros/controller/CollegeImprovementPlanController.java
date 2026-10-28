package com.codeit.careeros.controller;

import com.codeit.careeros.college.service.CollegeAccessService;
import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.improvement.dto.ImprovementDtos;
import com.codeit.careeros.improvement.enums.PlanStatus;
import com.codeit.careeros.improvement.service.ImprovementPlanService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "College Improvement Plans", description = "Evidence-based student improvement plans")
@RestController
@RequestMapping("/api/v1/college/improvement-plans")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PROFESSOR')")
public class CollegeImprovementPlanController {

    private final CollegeAccessService collegeAccessService;
    private final ImprovementPlanService improvementPlanService;

    @Operation(summary = "List plans inside the caller's institution and academic scope")
    @GetMapping
    public ApiResponse<ImprovementDtos.ImprovementPlanListResponse> list(
            @RequestParam(required = false) Long studentEnrollmentId,
            @RequestParam(required = false) PlanStatus status,
            @RequestParam(required = false) String search) {
        return ApiResponse.success(improvementPlanService.list(
                collegeAccessService.currentScope(), studentEnrollmentId, status, search));
    }

    @Operation(summary = "Read one plan")
    @GetMapping("/{id}")
    public ApiResponse<ImprovementDtos.ImprovementPlanResponse> detail(@PathVariable Long id) {
        return ApiResponse.success(improvementPlanService.detail(
                collegeAccessService.currentScope(), id));
    }

    @Operation(summary = "Generate a plan from assessed skill gaps")
    @PostMapping("/generate")
    public ApiResponse<ImprovementDtos.ImprovementPlanResponse> generate(
            @RequestBody ImprovementDtos.PlanGenerateRequest request) {
        return ApiResponse.success("Improvement plan generated",
                improvementPlanService.generate(collegeAccessService.currentScope(), request));
    }

    @Operation(summary = "Create a manual improvement plan")
    @PostMapping
    public ApiResponse<ImprovementDtos.ImprovementPlanResponse> create(
            @RequestBody ImprovementDtos.PlanCreateRequest request) {
        return ApiResponse.success("Improvement plan created",
                improvementPlanService.create(collegeAccessService.currentScope(), request));
    }

    @Operation(summary = "Update plan metadata or status")
    @PutMapping("/{id}")
    public ApiResponse<ImprovementDtos.ImprovementPlanResponse> update(
            @PathVariable Long id,
            @RequestBody ImprovementDtos.PlanUpdateRequest request) {
        return ApiResponse.success("Improvement plan updated",
                improvementPlanService.update(collegeAccessService.currentScope(), id, request));
    }

    @Operation(summary = "Add a task to a plan")
    @PostMapping("/{id}/tasks")
    public ApiResponse<ImprovementDtos.ImprovementPlanResponse> addTask(
            @PathVariable Long id,
            @RequestBody ImprovementDtos.PlanTaskRequest request) {
        return ApiResponse.success("Improvement task added",
                improvementPlanService.addTask(collegeAccessService.currentScope(), id, request));
    }

    @Operation(summary = "Update a task")
    @PatchMapping("/{id}/tasks/{taskId}")
    public ApiResponse<ImprovementDtos.ImprovementPlanResponse> updateTask(
            @PathVariable Long id,
            @PathVariable Long taskId,
            @RequestBody ImprovementDtos.TaskUpdateRequest request) {
        return ApiResponse.success("Improvement task updated",
                improvementPlanService.updateTask(collegeAccessService.currentScope(), id, taskId, request));
    }
}
