package com.codeit.careeros.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Append-only audit trail for privileged (platform-admin) actions.
 *
 * <p>Stores identifiers and routing metadata only: no request bodies, no
 * passwords, no tokens, no CV contents, no student PII values. The actor is
 * kept as an id + role without a foreign key so that a later account
 * lifecycle change cannot silently delete or block the audit history.
 */
@Entity
@Table(
        name = "audit_events",
        indexes = {
                @Index(name = "idx_audit_created_at", columnList = "created_at"),
                @Index(name = "idx_audit_actor", columnList = "actor_user_id"),
                @Index(name = "idx_audit_action", columnList = "action")})
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(name = "actor_role", length = 20)
    private String actorRole;

    /** e.g. {@code POST /api/v1/admin/skills}. */
    @Column(nullable = false, length = 140, updatable = false)
    private String action;

    /** Request path only; query strings and bodies are never stored. */
    @Column(name = "target_path", nullable = false, length = 255, updatable = false)
    private String targetPath;

    @Column(nullable = false, length = 20, updatable = false)
    private String outcome;

    @Column(name = "http_status", updatable = false)
    private Integer httpStatus;

    @Column(name = "request_id", length = 64, updatable = false)
    private String requestId;

    // ---- Institution-scoped (college) audit metadata ----------------------
    // These columns are nullable so the platform-admin audit writer and the
    // college audit writer can share one append-only trail.

    @Column(name = "actor_email", length = 190, updatable = false)
    private String actorEmail;

    @Column(name = "target_type", length = 60, updatable = false)
    private String targetType;

    @Column(name = "target_id", length = 80, updatable = false)
    private String targetId;

    @Column(name = "institution_id", updatable = false)
    private Long institutionId;

    @Column(name = "scope_description", length = 200, updatable = false)
    private String scopeDescription;

    @Column(length = 1000, updatable = false)
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
