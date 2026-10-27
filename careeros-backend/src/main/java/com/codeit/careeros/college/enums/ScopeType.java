package com.codeit.careeros.college.enums;

/**
 * The narrowest academic unit a staff membership is limited to. Scope is
 * always resolved on the server from the membership row, never from a request
 * parameter.
 */
public enum ScopeType {
    INSTITUTION,
    DEPARTMENT,
    PROGRAM,
    BATCH,
    SECTION
}
