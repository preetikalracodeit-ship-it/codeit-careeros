package com.codeit.careeros.college.dto;

import com.codeit.careeros.college.enums.MembershipStatus;
import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.college.enums.StaffDesignation;

import java.time.Instant;
import java.util.List;

public final class StaffDtos {

    private StaffDtos() {
    }

    public record InvitationCreateRequest(
            String email,
            StaffDesignation designation,
            ScopeType scopeType,
            Long scopeId) {
    }

    public record InvitationAcceptRequest(
            String fullName,
            String password,
            Boolean termsAccepted) {
    }

    public record MembershipUpdateRequest(
            StaffDesignation designation,
            ScopeType scopeType,
            Long scopeId,
            MembershipStatus status) {
    }

    public record StaffInvitationResponse(
            Long id,
            String email,
            StaffDesignation designation,
            ScopeType scopeType,
            Long scopeId,
            String scopeLabel,
            String status,
            Instant expiresAt,
            Instant acceptedAt,
            Instant revokedAt,
            Instant createdAt) {
    }

    public record CreatedInvitationResponse(
            StaffInvitationResponse invitation,
            String activationPath,
            boolean emailDelivered,
            String deliveryMessage) {
    }

    public record PublicInvitationResponse(
            String institutionName,
            String maskedEmail,
            StaffDesignation designation,
            ScopeType scopeType,
            String scopeLabel,
            Instant expiresAt,
            String status) {
    }

    public record MembershipResponse(
            Long id,
            Long userId,
            String fullName,
            String email,
            StaffDesignation designation,
            ScopeType scopeType,
            Long scopeId,
            String scopeLabel,
            MembershipStatus status,
            Instant acceptedAt,
            Instant createdAt) {
    }

    public record CollegeMeResponse(
            Long userId,
            String email,
            String fullName,
            Long institutionId,
            String institutionName,
            StaffDesignation designation,
            ScopeType scopeType,
            Long scopeId,
            String scopeLabel,
            List<String> permissions) {
    }
}
