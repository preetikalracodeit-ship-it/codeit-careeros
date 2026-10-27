package com.codeit.careeros.admin;

import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.common.PageResponse;
import com.codeit.careeros.dto.student.StudentProfileResponse;
import com.codeit.careeros.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Tag(name = "Admin", description = "Admin-only endpoints")
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminStudentService adminStudentService;
    private final AdminStatsService adminStatsService;

    @Operation(summary = "List all student profiles (admin)")
    @GetMapping("/students")
    public ApiResponse<PageResponse<StudentProfileResponse>> listStudents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        return ApiResponse.success(adminStudentService.listStudents(page, size, search));
    }

    @Operation(summary = "Student count (admin)")
    @GetMapping("/students/count")
    public ApiResponse<Map<String, Long>> studentCount() {
        return ApiResponse.success(Map.of("count", adminStudentService.countStudents()));
    }

    @Operation(summary = "Dashboard statistics (admin)")
    @GetMapping("/stats")
    public ApiResponse<Map<String, Long>> stats() {
        return ApiResponse.success(adminStatsService.stats());
    }

    @Operation(summary = "Get the currently authenticated admin (admin)")
    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me() {
        var u = SecurityUtils.currentUser();
        return ApiResponse.success(Map.of(
                "id", u.getId(),
                "email", u.getEmail(),
                "fullName", u.getFullName(),
                "role", u.getRole().name()));
    }
}
