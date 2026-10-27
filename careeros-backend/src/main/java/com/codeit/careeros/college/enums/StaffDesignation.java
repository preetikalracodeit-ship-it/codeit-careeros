package com.codeit.careeros.college.enums;

/**
 * Institution-scoped staff designations. These are deliberately separate from
 * the platform-wide {@code ADMIN} role: a college administrator is not a
 * CareerOS platform administrator.
 */
public enum StaffDesignation {
    COLLEGE_ADMIN,
    TPO,
    HOD,
    FACULTY
}
