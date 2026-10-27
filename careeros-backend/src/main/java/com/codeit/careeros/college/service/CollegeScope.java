package com.codeit.careeros.college.service;

import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.college.enums.StaffDesignation;
import com.codeit.careeros.exception.BusinessException;

import java.util.ArrayList;
import java.util.List;

/**
 * Immutable, server-derived authority for the current request. It is built
 * exclusively from an active InstitutionMembership row; request parameters
 * never create or widen it.
 */
public record CollegeScope(
        Long userId,
        String userEmail,
        String userFullName,
        Long institutionId,
        String institutionName,
        Long membershipId,
        StaffDesignation designation,
        ScopeType scopeType,
        Long scopeId,
        String institutionTimezone) {

    public java.time.ZoneId institutionZone() {
        try {
            return institutionTimezone == null || institutionTimezone.isBlank()
                    ? java.time.ZoneOffset.UTC : java.time.ZoneId.of(institutionTimezone);
        } catch (java.time.DateTimeException ignored) {
            return java.time.ZoneOffset.UTC;
        }
    }

    public boolean isInstitutionWide() {
        return scopeType == ScopeType.INSTITUTION;
    }

    public boolean canManageStructure() {
        return designation == StaffDesignation.COLLEGE_ADMIN;
    }

    public boolean canManageStaff() {
        return designation == StaffDesignation.COLLEGE_ADMIN;
    }

    public boolean canViewStudents() {
        return true;
    }

    public boolean canViewSensitiveProfile() {
        // Contact details and personal profile links stay hidden until the
        // institution's field visibility policy is explicitly approved.
        return false;
    }

    public boolean canViewCvAnalysis() {
        // CV/LinkedIn-derived data requires an explicit student-data policy.
        return false;
    }

    public boolean canExport() {
        return designation != StaffDesignation.FACULTY;
    }

    public boolean canGenerateReports() {
        return designation != StaffDesignation.FACULTY;
    }

    public boolean canImport() {
        return designation == StaffDesignation.COLLEGE_ADMIN
                || designation == StaffDesignation.TPO
                || designation == StaffDesignation.HOD;
    }

    /** Faculty can read students but cannot change enrollment status. */
    public boolean canManageStudents() {
        return designation != StaffDesignation.FACULTY;
    }

    public boolean canViewDashboard() {
        return true;
    }

    public boolean canViewReports() {
        return designation != StaffDesignation.FACULTY;
    }

    public void requireManageStructure() {
        if (!canManageStructure()) {
            throw BusinessException.forbidden("Only a college administrator can manage the academic structure");
        }
    }

    public void requireManageStaff() {
        if (!canManageStaff()) {
            throw BusinessException.forbidden("Only a college administrator can manage staff");
        }
    }

    public void requireManageStudents() {
        if (!canManageStudents()) {
            throw BusinessException.forbidden("Your role cannot change student enrollment status");
        }
    }

    public void requireImport() {
        if (!canImport()) {
            throw BusinessException.forbidden("Your role cannot import students");
        }
    }

    public void requireExport() {
        if (!canExport()) {
            throw BusinessException.forbidden("Your role cannot export student data");
        }
    }

    public void requireReports() {
        if (!canGenerateReports()) {
            throw BusinessException.forbidden("Your role cannot generate college reports");
        }
    }

    public void requireSensitiveProfile() {
        if (!canViewSensitiveProfile()) {
            throw BusinessException.forbidden("Your role cannot view this sensitive profile field");
        }
    }

    public void requireCvAnalysis() {
        if (!canViewCvAnalysis()) {
            throw BusinessException.forbidden("Your role cannot view CV analysis");
        }
    }

    public boolean allowsDepartment(Long departmentId) {
        return switch (scopeType) {
            case INSTITUTION -> true;
            case DEPARTMENT -> scopeId.equals(departmentId);
            case PROGRAM, BATCH, SECTION -> true;
        };
    }

    public boolean allowsProgram(Long programId) {
        return switch (scopeType) {
            case INSTITUTION, DEPARTMENT -> true;
            case PROGRAM -> scopeId.equals(programId);
            case BATCH, SECTION -> true;
        };
    }

    public boolean allowsBatch(Long batchId) {
        return switch (scopeType) {
            case INSTITUTION, DEPARTMENT, PROGRAM -> true;
            case BATCH -> scopeId.equals(batchId);
            case SECTION -> true;
        };
    }

    public boolean allowsSection(Long sectionId) {
        return switch (scopeType) {
            case INSTITUTION, DEPARTMENT, PROGRAM, BATCH -> true;
            case SECTION -> scopeId.equals(sectionId);
        };
    }

    public String scopeDescription() {
        return scopeType.name() + ":" + (scopeId == null ? institutionId : scopeId);
    }

    public List<String> permissions() {
        List<String> permissions = new ArrayList<>();
        permissions.add("VIEW_STUDENTS");
        permissions.add("VIEW_DASHBOARD");
        if (canViewSensitiveProfile()) {
            permissions.add("VIEW_SENSITIVE_PROFILE");
        }
        if (canViewCvAnalysis()) {
            permissions.add("VIEW_CV_ANALYSIS");
        }
        if (canExport()) {
            permissions.add("EXPORT_STUDENTS");
        }
        if (canGenerateReports()) {
            permissions.add("GENERATE_REPORTS");
            permissions.add("VIEW_REPORTS");
        }
        if (canImport()) {
            permissions.add("IMPORT_STUDENTS");
        }
        if (canManageStructure()) {
            permissions.add("MANAGE_STRUCTURE");
        }
        if (canManageStaff()) {
            permissions.add("MANAGE_STAFF");
        }
        if (canManageStudents()) {
            permissions.add("MANAGE_STUDENTS");
        }
        return List.copyOf(permissions);
    }
}
