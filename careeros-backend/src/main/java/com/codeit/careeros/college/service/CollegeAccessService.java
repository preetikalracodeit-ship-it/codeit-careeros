package com.codeit.careeros.college.service;

import com.codeit.careeros.college.entity.InstitutionMembership;
import com.codeit.careeros.college.enums.MembershipStatus;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.repository.InstitutionMembershipRepository;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the caller's college authority on every request. There is exactly
 * one active membership per staff account in Phase 1, so no client-supplied
 * institution selector is accepted.
 */
@Service
@RequiredArgsConstructor
public class CollegeAccessService {

    private final InstitutionMembershipRepository membershipRepository;

    @Transactional(readOnly = true)
    public CollegeScope currentScope() {
        var principal = SecurityUtils.currentUser();
        if (principal.getRole() == Role.ADMIN) {
            throw BusinessException.forbidden(
                    "Platform administrators do not have implicit access to institution student data");
        }
        if (principal.getRole() != Role.PROFESSOR) {
            throw BusinessException.forbidden("College staff access requires a staff membership");
        }
        InstitutionMembership membership = membershipRepository
                .findByUserIdAndStatus(principal.getId(), MembershipStatus.ACTIVE)
                .orElseThrow(() -> BusinessException.forbidden("No active institution membership"));
        if (membership.getInstitution().getStatus() != InstitutionStatus.ACTIVE) {
            throw BusinessException.forbidden("The institution is inactive");
        }
        return toScope(membership);
    }

    public static CollegeScope toScope(InstitutionMembership membership) {
        return new CollegeScope(
                membership.getUser().getId(),
                membership.getUser().getEmail(),
                membership.getUser().getFullName(),
                membership.getInstitution().getId(),
                membership.getInstitution().getName(),
                membership.getId(),
                membership.getDesignation(),
                membership.getScopeType(),
                membership.getScopeId(),
                membership.getInstitution().getTimezone());
    }
}
