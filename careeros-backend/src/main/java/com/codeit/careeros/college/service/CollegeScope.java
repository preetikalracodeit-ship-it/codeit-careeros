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

    /**
     * Improvement plans are visible to every staff member who can already see
     * the student. Faculty/mentors may read them; only college administrators,
     * TPOs and HODs may create or edit them.
     */
    public boolean canViewImprovementPlans() {
        return true;
    }

    public boolean canManageImprovementPlans() {
        return designation != StaffDesignation.FACULTY;
    }

    /**
     * Placement data is intentionally unavailable to faculty accounts in this
     * phase. HODs can read their department's placement activity; TPOs and
     * college administrators manage it.
     */
    public boolean canViewPlacement() {
        return designation != StaffDesignation.FACULTY;
    }

    public boolean canManageCompaniesAndJobs() {
        return designation == StaffDesignation.COLLEGE_ADMIN
                || designation == StaffDesignation.TPO;
    }

    public boolean canViewCompanyContacts() {
        return canManageCompaniesAndJobs();
    }

    public boolean canManageDrives() {
        return canManageCompaniesAndJobs();
    }

    public boolean canManageApplications() {
        return canManageCompaniesAndJobs();
    }

    public boolean canViewPlacementReports() {
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

    public void requireManageImprovementPlans() {
        if (!canManageImprovementPlans()) {
            throw BusinessException.forbidden("Your role cannot create or edit improvement plans");
        }
    }

    public void requirePlacementAccess() {
        if (!canViewPlacement()) {
            throw BusinessException.forbidden("Your role cannot view placement data");
        }
    }

    public void requireManageCompaniesAndJobs() {
        if (!canManageCompaniesAndJobs()) {
            throw BusinessException.forbidden("Only a college administrator or TPO can manage companies and jobs");
        }
    }

    public void requireManageDrives() {
        if (!canManageDrives()) {
            throw BusinessException.forbidden("Only a college administrator or TPO can manage placement drives");
        }
    }

    public void requireManageApplications() {
        if (!canManageApplications()) {
            throw BusinessException.forbidden("Only a college administrator or TPO can manage applications");
        }
    }

    public void requirePlacementReports() {
        if (!canViewPlacementReports()) {
            throw BusinessException.forbidden("Your role cannot generate placement reports");
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
        if (canViewImprovementPlans()) {
            permissions.add("VIEW_IMPROVEMENT_PLANS");
        }
        if (canManageImprovementPlans()) {
            permissions.add("MANAGE_IMPROVEMENT_PLANS");
        }
        if (canViewPlacement()) {
            permissions.add("VIEW_PLACEMENT");
        }
        if (canManageCompaniesAndJobs()) {
            permissions.add("MANAGE_COMPANIES");
            permissions.add("MANAGE_JOBS");
        }
        if (canViewCompanyContacts()) {
            permissions.add("VIEW_COMPANY_CONTACTS");
        }
        if (canManageDrives()) {
            permissions.add("MANAGE_DRIVES");
        }
        if (canManageApplications()) {
            permissions.add("MANAGE_APPLICATIONS");
        }
        if (canViewPlacementReports()) {
            permissions.add("VIEW_PLACEMENT_REPORTS");
        }
        return List.copyOf(permissions);
    }
}
