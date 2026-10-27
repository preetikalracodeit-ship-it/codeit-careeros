-- ============================================================================
-- V3 — Minimum durable audit trail for privileged (platform-admin) actions.
--
-- Additive only: one new table. No existing table or row is modified.
--
-- * actor_user_id is intentionally NOT a foreign key: audit history must
--   survive account lifecycle changes and must not block them.
-- * No request bodies, passwords, tokens, CV content, or student PII are
--   stored. Only the actor id/role, HTTP method + matched route, request path,
--   outcome, status and correlation id.
-- * Retention is not enforced yet; no approved retention period exists.
-- ============================================================================

CREATE TABLE audit_events (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    actor_user_id BIGINT,
    actor_role    VARCHAR(20),
    action        VARCHAR(140) NOT NULL,
    target_path   VARCHAR(255) NOT NULL,
    outcome       VARCHAR(20) NOT NULL,
    http_status   INTEGER,
    request_id    VARCHAR(64),
    created_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_audit_created_at ON audit_events (created_at);
CREATE INDEX idx_audit_actor ON audit_events (actor_user_id);
CREATE INDEX idx_audit_action ON audit_events (action);
