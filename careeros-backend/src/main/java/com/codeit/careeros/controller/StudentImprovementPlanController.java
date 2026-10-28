package com.codeit.careeros.controller;

import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.improvement.dto.ImprovementDtos;
import com.codeit.careeros.improvement.service.ImprovementPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Student Improvement Plans", description = "The student's own improvement plans")
@RestController
@RequestMapping("/api/v1/students/me/improvement-plans")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentImprovementPlanController {

    private final ImprovementPlanService improvementPlanService;

    @Operation(summary = "List the authenticated student's improvement plans")
    @GetMapping
    public ApiResponse<ImprovementDtos.ImprovementPlanListResponse> list() {
        return ApiResponse.success(improvementPlanService.myPlans());
    }

    @Operation(summary = "Update the status of one of the student's own tasks")
    @PatchMapping("/tasks/{taskId}")
    public ApiResponse<ImprovementDtos.ImprovementPlanResponse> updateTask(
            @PathVariable Long taskId,
            @RequestBody ImprovementDtos.TaskUpdateRequest request) {
        return ApiResponse.success("Task updated",
                improvementPlanService.updateMyTask(taskId, request));
    }
}
