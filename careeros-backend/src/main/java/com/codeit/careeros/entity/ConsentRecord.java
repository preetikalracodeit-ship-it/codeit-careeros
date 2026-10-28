package com.codeit.careeros.entity;

import com.codeit.careeros.common.enums.ConsentMethod;
import com.codeit.careeros.common.enums.ConsentType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Append-only evidence that an authenticated person explicitly accepted a
 * published policy version.
 *
 * <p>Deliberately immutable: every column is {@code updatable = false} and
 * the class exposes no setters. There is also no API that updates or deletes
 * consent evidence. A policy change creates a new row; the previous rows stay
 * intact as the historical record.
 *
 * <p>Only the minimum evidence is stored: who consented, to which type and
 * policy version, when, through which product flow, and a short description
 * of the user action. No IP address, user agent, password, OAuth token, email
 * content, or other sensitive data is kept here.
 */
@Entity
@Table(
        name = "consent_records",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_consent_user_type_version",
                columnNames = {"user_id", "consent_type", "policy_version"}),
        indexes = {
                @Index(name = "idx_consent_user", columnList = "user_id"),
                @Index(name = "idx_consent_version", columnList = "policy_version")})
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsentRecord {

    /** Evidence value for the explicit checkbox on the registration form. */
    public static final String EVIDENCE_REGISTRATION_CHECKBOX = "explicit_registration_checkbox";

    /** Evidence value for the explicit Google sign-up button click after the Terms/Privacy notice. */
    public static final String EVIDENCE_GOOGLE_SIGNUP_BUTTON = "explicit_google_signup_button";

    /** Evidence value for the authenticated re-consent endpoint. */
    public static final String EVIDENCE_AUTHENTICATED_CONSENT = "authenticated_consent_request";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "consent_type", nullable = false, length = 40, updatable = false)
    private ConsentType consentType;

    @Column(name = "policy_version", nullable = false, length = 40, updatable = false)
    private String policyVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private ConsentMethod method;

    /** Short, non-sensitive description of the user action (see constants). */
    @Column(nullable = false, length = 60, updatable = false)
    private String evidence;

    @Column(name = "accepted_at", nullable = false, updatable = false)
    private Instant acceptedAt;
}
