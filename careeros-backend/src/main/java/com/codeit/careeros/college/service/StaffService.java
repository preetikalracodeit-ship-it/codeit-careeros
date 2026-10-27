package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.StaffDtos;
import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.college.entity.InstitutionMembership;
import com.codeit.careeros.college.entity.StaffInvitation;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.enums.MembershipStatus;
import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.college.enums.StaffDesignation;
import com.codeit.careeros.college.repository.InstitutionMembershipRepository;
import com.codeit.careeros.college.repository.InstitutionRepository;
import com.codeit.careeros.college.repository.StaffInvitationRepository;
import com.codeit.careeros.common.enums.ConsentMethod;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.common.enums.UserStatus;
import com.codeit.careeros.dto.auth.AuthResponse;
import com.codeit.careeros.entity.ConsentRecord;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.TokenHash;
import com.codeit.careeros.service.AuthService;
import com.codeit.careeros.service.ConsentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Staff invitations and institution memberships.
 *
 * <p>Security properties:
 * <ul>
 *   <li>The invitation token is random, returned only to the creating
 *       administrator, and stored only as a SHA-256 hash.</li>
 *   <li>Public metadata masks the invited email and never reveals whether an
 *       account already exists.</li>
 *   <li>An existing account can only be linked by proving its password; the
 *       invitation email alone is never sufficient.</li>
 *   <li>Every mutation is audited without storing the token or password.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StaffService {

    private static final int TOKEN_BYTES = 32;
    private static final long INVITATION_HOURS = 48;

    private final StaffInvitationRepository invitationRepository;
    private final InstitutionMembershipRepository membershipRepository;
    private final InstitutionRepository institutionRepository;
    private final UserRepository userRepository;
    private final AcademicScopeService academicScopeService;
    private final AuditService auditService;
    private final AuthService authService;
    private final ConsentService consentService;
    private final PasswordEncoder passwordEncoder;

    private final SecureRandom secureRandom = new SecureRandom();

    // ---- invitations (college administrator) ----

    @Transactional
    public StaffDtos.CreatedInvitationResponse createInvitation(CollegeScope scope,
                                                                StaffDtos.InvitationCreateRequest request) {
        scope.requireManageStaff();
        String email = normalizeEmail(request.email());
        validateDesignationScope(scope.institutionId(), request.designation(),
                request.scopeType(), request.scopeId());

        if (invitationRepository.existsByInstitutionIdAndEmailIgnoreCaseAndAcceptedAtIsNullAndRevokedAtIsNull(
                scope.institutionId(), email)) {
            throw BusinessException.conflict("An active invitation already exists for this email");
        }
        ensureAccountCanBeInvited(email);

        Institution institution = institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        return issueInvitation(institution, email, request, scope.userId(), scope);
    }

    /**
     * Platform-admin bootstrap: only the first college administrator of an
     * institution can be invited this way. Subsequent staff invitations must
     * come from that institution's own college administrator.
     */
    @Transactional
    public StaffDtos.CreatedInvitationResponse createBootstrapInvitation(
            Long institutionId, StaffDtos.InvitationCreateRequest request) {
        Institution institution = institutionRepository.findById(institutionId)
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        if (request.designation() != StaffDesignation.COLLEGE_ADMIN
                || request.scopeType() != ScopeType.INSTITUTION
                || request.scopeId() != null) {
            throw BusinessException.badRequest(
                    "The bootstrap invitation must be an institution-wide college administrator");
        }
        if (membershipRepository.countByInstitutionIdAndDesignationAndStatus(
                institutionId, StaffDesignation.COLLEGE_ADMIN, MembershipStatus.ACTIVE) > 0) {
            throw BusinessException.conflict("This institution already has a college administrator");
        }
        String email = normalizeEmail(request.email());
        if (invitationRepository.existsByInstitutionIdAndEmailIgnoreCaseAndAcceptedAtIsNullAndRevokedAtIsNull(
                institutionId, email)) {
            throw BusinessException.conflict("An active invitation already exists for this email");
        }
        ensureAccountCanBeInvited(email);
        return issueInvitation(institution, email, request, null, null);
    }

    /**
     * An invitation must never be a route around the one-active-membership
     * rule. Platform-admin bootstrap uses the same check as college-issued
     * invitations so an existing staff account cannot acquire a second
     * institution through a bootstrap link.
     */
    private void ensureAccountCanBeInvited(String email) {
        userRepository.findByEmail(email).ifPresent(existing -> {
            if (existing.getRole() == Role.ADMIN) {
                throw BusinessException.conflict("This account cannot be invited as college staff");
            }
            if (membershipRepository.findByUserIdAndStatus(existing.getId(), MembershipStatus.ACTIVE).isPresent()) {
                throw BusinessException.conflict("This account already has an active institution membership");
            }
        });
    }

    private StaffDtos.CreatedInvitationResponse issueInvitation(
            Institution institution, String email, StaffDtos.InvitationCreateRequest request,
            Long createdByUserId, CollegeScope scope) {
        String rawToken = newToken();
        StaffInvitation invitation = StaffInvitation.builder()
                .institution(institution)
                .email(email)
                .designation(request.designation())
                .scopeType(request.scopeType())
                .scopeId(request.scopeId())
                .tokenHash(TokenHash.sha256(rawToken))
                .expiresAt(Instant.now().plus(INVITATION_HOURS, ChronoUnit.HOURS))
                .createdBy(createdByUserId == null ? null
                        : userRepository.getReferenceById(createdByUserId))
                .build();
        invitation = invitationRepository.save(invitation);

        auditService.success("STAFF_INVITATION_CREATE", "STAFF_INVITATION",
                String.valueOf(invitation.getId()), institution.getId(), scope,
                "designation=" + invitation.getDesignation() + ",scope=" + invitation.getScopeType());

        String activationPath = "/accept-invitation?token=" + rawToken;
        return new StaffDtos.CreatedInvitationResponse(
                toResponse(institution.getId(), invitation),
                activationPath,
                false,
                "Email delivery is not configured. Share the one-time activation link directly with the invitee.");
    }

    @Transactional(readOnly = true)
    public List<StaffDtos.StaffInvitationResponse> listInvitations(CollegeScope scope) {        scope.requireManageStaff();
        return invitationRepository.findByInstitutionIdOrderByCreatedAtDesc(scope.institutionId()).stream()
                .map(invitation -> toResponse(scope.institutionId(), invitation))
                .toList();
    }

    @Transactional
    public void revokeInvitation(CollegeScope scope, Long invitationId) {
        scope.requireManageStaff();
        StaffInvitation invitation = invitationRepository
                .findByIdAndInstitutionId(invitationId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Invitation not found"));
        if (invitation.getAcceptedAt() != null) {
            throw BusinessException.conflict("This invitation has already been accepted");
        }
        if (invitation.getRevokedAt() == null) {
            invitation.setRevokedAt(Instant.now());
            invitationRepository.save(invitation);
            auditService.success("STAFF_INVITATION_REVOKE", "STAFF_INVITATION",
                    String.valueOf(invitationId), scope.institutionId(), scope, "revoked");
        }
    }

    // ---- public invitation acceptance ----

    @Transactional(readOnly = true)
    public StaffDtos.PublicInvitationResponse publicInvitation(String rawToken) {
        StaffInvitation invitation = requireInvitation(rawToken);
        return new StaffDtos.PublicInvitationResponse(
                invitation.getInstitution().getName(),
                maskEmail(invitation.getEmail()),
                invitation.getDesignation(),
                invitation.getScopeType(),
                academicScopeService.label(invitation.getInstitution().getId(),
                        invitation.getScopeType(), invitation.getScopeId()),
                invitation.getExpiresAt(),
                statusOf(invitation));
    }

    @Transactional
    public AuthResponse acceptInvitation(String rawToken, StaffDtos.InvitationAcceptRequest request) {
        StaffInvitation invitation = requireInvitationForUpdate(rawToken);
        if (invitation.getAcceptedAt() != null) {
            throw BusinessException.conflict("This invitation has already been used");
        }
        if (invitation.getRevokedAt() != null) {
            throw BusinessException.badRequest("This invitation is no longer valid");
        }
        if (invitation.getExpiresAt().isBefore(Instant.now())) {
            throw BusinessException.badRequest("This invitation has expired");
        }
        if (invitation.getInstitution().getStatus() != InstitutionStatus.ACTIVE) {
            throw BusinessException.forbidden("The institution is not active");
        }

        String email = invitation.getEmail();
        User user = userRepository.findByEmail(email).orElse(null);
        boolean newAccount = user == null;

        // Defence in depth: an invitation can reactivate a membership that was
        // previously deactivated, but it must never create a second active
        // institution membership for the same account.
        if (user != null && membershipRepository
                .findByUserIdAndStatus(user.getId(), MembershipStatus.ACTIVE).isPresent()) {
            throw BusinessException.conflict("This account already has an active institution membership");
        }

        if (newAccount) {
            user = createStaffAccount(email, request);
        } else {
            user = linkExistingAccount(user, request);
        }

        InstitutionMembership membership = membershipRepository
                .findByUserIdAndInstitutionId(user.getId(), invitation.getInstitution().getId())
                .orElse(null);
        if (membership == null) {
            membership = InstitutionMembership.builder()
                    .user(user)
                    .institution(invitation.getInstitution())
                    .designation(invitation.getDesignation())
                    .scopeType(invitation.getScopeType())
                    .scopeId(invitation.getScopeId())
                    .status(MembershipStatus.ACTIVE)
                    .acceptedAt(Instant.now())
                    .build();
        } else {
            membership.setDesignation(invitation.getDesignation());
            membership.setScopeType(invitation.getScopeType());
            membership.setScopeId(invitation.getScopeId());
            membership.setStatus(MembershipStatus.ACTIVE);
            membership.setAcceptedAt(Instant.now());
        }
        membershipRepository.save(membership);

        invitation.setAcceptedAt(Instant.now());
        invitationRepository.save(invitation);

        // The public flow has no authenticated actor; record the target only.
        auditService.success("STAFF_INVITATION_ACCEPT", "STAFF_INVITATION",
                String.valueOf(invitation.getId()), invitation.getInstitution().getId(), null,
                "newAccount=" + newAccount + ",designation=" + invitation.getDesignation());

        log.info("Staff invitation accepted institutionId={} userId={} newAccount={}",
                invitation.getInstitution().getId(), user.getId(), newAccount);
        return authService.issueSession(user);
    }

    private User createStaffAccount(String email, StaffDtos.InvitationAcceptRequest request) {
        String fullName = requireText(request.fullName(), "Full name", 120);
        requireStrongPassword(request.password());
        if (!Boolean.TRUE.equals(request.termsAccepted())) {
            throw BusinessException.badRequest(
                    "You must accept the Terms of Service and Privacy Policy to activate the account");
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .fullName(fullName)
                .role(Role.PROFESSOR)
                .status(UserStatus.ACTIVE)
                .build();
        user = userRepository.save(user);
        consentService.recordCurrentPolicy(user, ConsentMethod.PASSWORD_REGISTRATION,
                ConsentRecord.EVIDENCE_REGISTRATION_CHECKBOX);
        return user;
    }

    private User linkExistingAccount(User user, StaffDtos.InvitationAcceptRequest request) {
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw BusinessException.forbidden("This account is not active");
        }
        if (user.getRole() == Role.ADMIN) {
            throw BusinessException.forbidden("This account cannot be linked to an institution");
        }
        // Proving the password is mandatory: possession of the invitation
        // email must never be enough to take over an existing account.
        if (request.password() == null || request.password().isBlank()
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw BusinessException.badRequest("Invalid invitation credentials");
        }
        if (!consentService.isCurrent(user) && !Boolean.TRUE.equals(request.termsAccepted())) {
            throw BusinessException.badRequest(
                    "You must accept the current Terms of Service and Privacy Policy");
        }
        if (!consentService.isCurrent(user)) {
            consentService.recordCurrentPolicy(user, ConsentMethod.RECONSENT,
                    ConsentRecord.EVIDENCE_AUTHENTICATED_CONSENT);
        }
        if (user.getRole() != Role.PROFESSOR) {
            user.setRole(Role.PROFESSOR);
            user = userRepository.save(user);
        }
        if (request.fullName() != null && !request.fullName().isBlank()
                && (user.getFullName() == null || user.getFullName().isBlank())) {
            user.setFullName(requireText(request.fullName(), "Full name", 120));
            user = userRepository.save(user);
        }
        return user;
    }

    private StaffInvitation requireInvitation(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 200) {
            throw BusinessException.notFound("Invitation not found");
        }
        return invitationRepository.findByTokenHash(TokenHash.sha256(rawToken))
                .orElseThrow(() -> BusinessException.notFound("Invitation not found"));
    }

    private StaffInvitation requireInvitationForUpdate(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 200) {
            throw BusinessException.notFound("Invitation not found");
        }
        return invitationRepository.findByTokenHashForUpdate(TokenHash.sha256(rawToken))
                .orElseThrow(() -> BusinessException.notFound("Invitation not found"));
    }

    // ---- memberships ----

    @Transactional(readOnly = true)
    public List<StaffDtos.MembershipResponse> listMemberships(CollegeScope scope) {
        scope.requireManageStaff();
        return membershipRepository.findByInstitutionIdOrderByCreatedAtDesc(scope.institutionId()).stream()
                .map(membership -> toResponse(scope.institutionId(), membership))
                .toList();
    }

    @Transactional
    public StaffDtos.MembershipResponse updateMembership(CollegeScope scope, Long membershipId,
                                                         StaffDtos.MembershipUpdateRequest request) {
        scope.requireManageStaff();
        InstitutionMembership membership = membershipRepository
                .findByIdAndInstitutionId(membershipId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Membership not found"));

        StaffDesignation designation = request.designation() == null
                ? membership.getDesignation() : request.designation();
        ScopeType scopeType = request.scopeType() == null
                ? membership.getScopeType() : request.scopeType();
        Long scopeId = request.scopeType() == null ? membership.getScopeId() : request.scopeId();
        MembershipStatus status = request.status() == null
                ? membership.getStatus() : request.status();
        validateDesignationScope(scope.institutionId(), designation, scopeType, scopeId);

        boolean removingLastAdmin = membership.getDesignation() == StaffDesignation.COLLEGE_ADMIN
                && membership.getStatus() == MembershipStatus.ACTIVE
                && (designation != StaffDesignation.COLLEGE_ADMIN || status != MembershipStatus.ACTIVE);
        if (removingLastAdmin
                && membershipRepository.countByInstitutionIdAndDesignationAndStatus(
                        scope.institutionId(), StaffDesignation.COLLEGE_ADMIN, MembershipStatus.ACTIVE) <= 1) {
            throw BusinessException.conflict("The institution must keep at least one active college administrator");
        }

        membership.setDesignation(designation);
        membership.setScopeType(scopeType);
        membership.setScopeId(scopeId);
        membership.setStatus(status);
        membership = membershipRepository.save(membership);

        auditService.success("MEMBERSHIP_UPDATE", "MEMBERSHIP", String.valueOf(membershipId),
                scope.institutionId(), scope,
                "designation=" + designation + ",status=" + status + ",scope=" + scopeType);
        return toResponse(scope.institutionId(), membership);
    }

    @Transactional(readOnly = true)
    public StaffDtos.CollegeMeResponse me(CollegeScope scope) {
        return new StaffDtos.CollegeMeResponse(
                scope.userId(), scope.userEmail(), scope.userFullName(),
                scope.institutionId(), scope.institutionName(),
                scope.designation(), scope.scopeType(), scope.scopeId(),
                academicScopeService.label(scope.institutionId(), scope.scopeType(), scope.scopeId()),
                scope.permissions());
    }

    // ---- validation / mapping ----

    private void validateDesignationScope(Long institutionId, StaffDesignation designation,
                                          ScopeType scopeType, Long scopeId) {
        if (designation == null || scopeType == null) {
            throw BusinessException.badRequest("Designation and scope type are required");
        }
        academicScopeService.validateScope(institutionId, scopeType, scopeId);
        switch (designation) {
            case COLLEGE_ADMIN, TPO -> {
                if (scopeType != ScopeType.INSTITUTION) {
                    throw BusinessException.badRequest(
                            designation + " must have institution-wide scope");
                }
            }
            case HOD -> {
                if (scopeType != ScopeType.DEPARTMENT) {
                    throw BusinessException.badRequest("HOD must have department scope");
                }
            }
            case FACULTY -> {
                if (scopeType == ScopeType.INSTITUTION) {
                    throw BusinessException.badRequest(
                            "Faculty must be limited to a department, program, batch or section");
                }
            }
        }
    }

    private StaffDtos.StaffInvitationResponse toResponse(Long institutionId, StaffInvitation invitation) {
        return new StaffDtos.StaffInvitationResponse(
                invitation.getId(),
                invitation.getEmail(),
                invitation.getDesignation(),
                invitation.getScopeType(),
                invitation.getScopeId(),
                academicScopeService.label(institutionId, invitation.getScopeType(), invitation.getScopeId()),
                statusOf(invitation),
                invitation.getExpiresAt(),
                invitation.getAcceptedAt(),
                invitation.getRevokedAt(),
                invitation.getCreatedAt());
    }

    private StaffDtos.MembershipResponse toResponse(Long institutionId, InstitutionMembership membership) {
        return new StaffDtos.MembershipResponse(
                membership.getId(),
                membership.getUser().getId(),
                membership.getUser().getFullName(),
                membership.getUser().getEmail(),
                membership.getDesignation(),
                membership.getScopeType(),
                membership.getScopeId(),
                academicScopeService.label(institutionId, membership.getScopeType(), membership.getScopeId()),
                membership.getStatus(),
                membership.getAcceptedAt(),
                membership.getCreatedAt());
    }

    private static String statusOf(StaffInvitation invitation) {
        if (invitation.getAcceptedAt() != null) {
            return "ACCEPTED";
        }
        if (invitation.getRevokedAt() != null) {
            return "REVOKED";
        }
        if (invitation.getExpiresAt().isBefore(Instant.now())) {
            return "EXPIRED";
        }
        return "VALID";
    }

    private String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String normalizeEmail(String raw) {
        String email = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 190 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw BusinessException.badRequest("A valid email address is required");
        }
        return email;
    }

    private static String requireText(String raw, String label, int max) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            throw BusinessException.badRequest(label + " is required");
        }
        if (value.length() > max) {
            throw BusinessException.badRequest(label + " must be at most " + max + " characters");
        }
        return value;
    }

    private static void requireStrongPassword(String password) {
        if (password == null || password.length() < 8
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            throw BusinessException.badRequest(
                    "Password must be at least 8 characters and contain letters and digits");
        }
    }

    private static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        String local = email.substring(0, at);
        String domain = email.substring(at);
        String visible = local.substring(0, Math.min(1, local.length()));
        return visible + "***" + domain;
    }

    // Kept for readability of generated IDs in logs; never used as a secret.
    @SuppressWarnings("unused")
    private static String correlationId() {
        return UUID.randomUUID().toString();
    }
}
