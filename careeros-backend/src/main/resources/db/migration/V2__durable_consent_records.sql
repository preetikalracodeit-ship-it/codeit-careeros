-- ============================================================================
-- V2 — Durable consent evidence.
--
-- Additive only: one new table, no changes to existing tables or rows.
--
-- Design notes
--   * One row per (user, consent type, policy version). The unique constraint
--     makes retries idempotent at the database level.
--   * Append-only: the application never updates or deletes these rows.
--     A policy change inserts a new row and keeps the previous evidence.
--   * Only the minimum evidence is stored: account reference, consent type,
--     policy version, timestamp, product flow (method) and a short description
--     of the user action. No IP address, user agent, password, token, or other
--     sensitive data.
--   * Existing accounts are NOT backfilled. There is no truthful evidence for
--     them; inventing one would be worse than reporting consentRequired=true.
-- ============================================================================

CREATE TABLE consent_records (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    user_id        BIGINT      NOT NULL,
    consent_type   ENUM('TERMS_AND_PRIVACY') NOT NULL,
    policy_version VARCHAR(40) NOT NULL,
    method         ENUM('GOOGLE_REGISTRATION','PASSWORD_REGISTRATION','RECONSENT') NOT NULL,
    evidence       VARCHAR(60) NOT NULL,
    accepted_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_consent_user_type_version UNIQUE (user_id, consent_type, policy_version),
    CONSTRAINT fk_consent_records_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_consent_user ON consent_records (user_id);
CREATE INDEX idx_consent_version ON consent_records (policy_version);
