-- ============================================================================
-- V4 — College/TPO Phase 1 tenant model.
--
-- Additive only:
--   * new institution/academic/enrollment/staff/import tables
--   * audit_events gains nullable institution-scoped metadata columns so the
--     existing platform-admin trail and the new college trail are one history
--   * users.role is widened from ENUM('ADMIN','STUDENT') to VARCHAR(20) so the
--     new PROFESSOR value can be stored. The application still validates the
--     value through the Role enum; no existing row is rewritten.
--
-- No existing business data is copied, rewritten or deleted. Student identity
-- remains in users/student_profiles; student_enrollments is an additive
-- mapping and never replaces the student's own profile.
-- ============================================================================

ALTER TABLE users MODIFY COLUMN role VARCHAR(20) NOT NULL;

CREATE TABLE institutions (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    code          VARCHAR(40)  NOT NULL,
    name          VARCHAR(160) NOT NULL,
    status        VARCHAR(20)  NOT NULL,
    timezone      VARCHAR(60),
    contact_email VARCHAR(190),
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_institutions_code UNIQUE (code)
);

CREATE TABLE departments (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id BIGINT       NOT NULL,
    code           VARCHAR(40)  NOT NULL,
    name           VARCHAR(160) NOT NULL,
    status         VARCHAR(20)  NOT NULL,
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_departments_institution_code UNIQUE (institution_id, code),
    CONSTRAINT fk_departments_institution FOREIGN KEY (institution_id) REFERENCES institutions (id)
);

CREATE TABLE programs (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id BIGINT       NOT NULL,
    department_id  BIGINT       NOT NULL,
    code           VARCHAR(40)  NOT NULL,
    name           VARCHAR(160) NOT NULL,
    degree_type    VARCHAR(60),
    duration_years INTEGER,
    status         VARCHAR(20)  NOT NULL,
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_programs_institution_code UNIQUE (institution_id, code),
    CONSTRAINT fk_programs_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_programs_department FOREIGN KEY (department_id) REFERENCES departments (id)
);

CREATE TABLE academic_years (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    institution_id BIGINT      NOT NULL,
    label          VARCHAR(40) NOT NULL,
    start_date     DATE,
    end_date       DATE,
    active         BOOLEAN     NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_academic_years_institution_label UNIQUE (institution_id, label),
    CONSTRAINT fk_academic_years_institution FOREIGN KEY (institution_id) REFERENCES institutions (id)
);

CREATE TABLE batches (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    program_id       BIGINT      NOT NULL,
    academic_year_id BIGINT      NOT NULL,
    label            VARCHAR(40) NOT NULL,
    graduation_year  INTEGER,
    status           VARCHAR(20) NOT NULL,
    created_at       DATETIME(6) NOT NULL,
    updated_at       DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_batches_program_label UNIQUE (program_id, label),
    CONSTRAINT fk_batches_program FOREIGN KEY (program_id) REFERENCES programs (id),
    CONSTRAINT fk_batches_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id)
);

CREATE TABLE sections (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    batch_id   BIGINT      NOT NULL,
    name       VARCHAR(40) NOT NULL,
    status     VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_sections_batch_name UNIQUE (batch_id, name),
    CONSTRAINT fk_sections_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
);

CREATE TABLE student_enrollments (
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    student_profile_id BIGINT      NOT NULL,
    institution_id     BIGINT      NOT NULL,
    department_id      BIGINT      NOT NULL,
    program_id         BIGINT      NOT NULL,
    batch_id           BIGINT      NOT NULL,
    section_id         BIGINT,
    roll_number        VARCHAR(40) NOT NULL,
    status             VARCHAR(20) NOT NULL,
    start_date         DATE,
    end_date           DATE,
    created_at         DATETIME(6) NOT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_enrollments_institution_roll UNIQUE (institution_id, roll_number),
    CONSTRAINT uk_enrollments_profile UNIQUE (student_profile_id),
    CONSTRAINT fk_enrollments_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id),
    CONSTRAINT fk_enrollments_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_enrollments_department FOREIGN KEY (department_id) REFERENCES departments (id),
    CONSTRAINT fk_enrollments_program FOREIGN KEY (program_id) REFERENCES programs (id),
    CONSTRAINT fk_enrollments_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
    CONSTRAINT fk_enrollments_section FOREIGN KEY (section_id) REFERENCES sections (id)
);

CREATE TABLE institution_memberships (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    user_id        BIGINT      NOT NULL,
    institution_id BIGINT      NOT NULL,
    designation    VARCHAR(30) NOT NULL,
    status         VARCHAR(20) NOT NULL,
    scope_type     VARCHAR(20) NOT NULL,
    scope_id       BIGINT,
    accepted_at    DATETIME(6),
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_memberships_user_institution UNIQUE (user_id, institution_id),
    CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_memberships_institution FOREIGN KEY (institution_id) REFERENCES institutions (id)
);

CREATE TABLE staff_invitations (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id BIGINT       NOT NULL,
    email          VARCHAR(190) NOT NULL,
    designation    VARCHAR(30)  NOT NULL,
    scope_type     VARCHAR(20)  NOT NULL,
    scope_id       BIGINT,
    token_hash     VARCHAR(64)  NOT NULL,
    expires_at     DATETIME(6)  NOT NULL,
    accepted_at    DATETIME(6),
    revoked_at     DATETIME(6),
    created_by     BIGINT,
    created_at     DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_staff_invitations_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_staff_invitations_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_staff_invitations_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE csv_import_jobs (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id    BIGINT       NOT NULL,
    created_by        BIGINT       NOT NULL,
    status            VARCHAR(20)  NOT NULL,
    original_filename VARCHAR(255),
    file_hash         VARCHAR(64),
    total_rows        INTEGER      NOT NULL,
    created_rows      INTEGER      NOT NULL,
    linked_rows       INTEGER      NOT NULL,
    skipped_rows      INTEGER      NOT NULL,
    rejected_rows     INTEGER      NOT NULL,
    completed_at      DATETIME(6),
    created_at        DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_csv_import_jobs_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_csv_import_jobs_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE csv_import_rows (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    job_id               BIGINT       NOT NULL,
    row_number           INTEGER      NOT NULL,
    full_name            VARCHAR(120),
    email                VARCHAR(190),
    mobile               VARCHAR(20),
    roll_number          VARCHAR(40),
    department_code      VARCHAR(40),
    program_code         VARCHAR(40),
    batch_label          VARCHAR(40),
    section_name         VARCHAR(40),
    academic_year_label  VARCHAR(40),
    status               VARCHAR(20)  NOT NULL,
    message              VARCHAR(500),
    created_at           DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_csv_import_rows_job FOREIGN KEY (job_id) REFERENCES csv_import_jobs (id)
);

-- Shared append-only audit trail: college metadata is additive and nullable.
ALTER TABLE audit_events ADD COLUMN actor_email VARCHAR(190);
ALTER TABLE audit_events ADD COLUMN target_type VARCHAR(60);
ALTER TABLE audit_events ADD COLUMN target_id VARCHAR(80);
ALTER TABLE audit_events ADD COLUMN institution_id BIGINT;
ALTER TABLE audit_events ADD COLUMN scope_description VARCHAR(200);
ALTER TABLE audit_events ADD COLUMN details VARCHAR(1000);

CREATE INDEX idx_departments_institution ON departments (institution_id);
CREATE INDEX idx_programs_institution ON programs (institution_id);
CREATE INDEX idx_programs_department ON programs (department_id);
CREATE INDEX idx_academic_years_institution ON academic_years (institution_id);
CREATE INDEX idx_batches_program ON batches (program_id);
CREATE INDEX idx_batches_academic_year ON batches (academic_year_id);
CREATE INDEX idx_sections_batch ON sections (batch_id);
CREATE INDEX idx_enrollments_profile ON student_enrollments (student_profile_id);
CREATE INDEX idx_enrollments_institution ON student_enrollments (institution_id);
CREATE INDEX idx_enrollments_department ON student_enrollments (department_id);
CREATE INDEX idx_enrollments_program ON student_enrollments (program_id);
CREATE INDEX idx_enrollments_batch ON student_enrollments (batch_id);
CREATE INDEX idx_enrollments_section ON student_enrollments (section_id);
CREATE INDEX idx_enrollments_status ON student_enrollments (status);
CREATE INDEX idx_memberships_user ON institution_memberships (user_id);
CREATE INDEX idx_memberships_institution ON institution_memberships (institution_id);
CREATE INDEX idx_memberships_status ON institution_memberships (status);
CREATE INDEX idx_staff_invitations_institution ON staff_invitations (institution_id);
CREATE INDEX idx_staff_invitations_email ON staff_invitations (email);
CREATE INDEX idx_csv_import_jobs_institution ON csv_import_jobs (institution_id);
CREATE INDEX idx_csv_import_jobs_creator ON csv_import_jobs (created_by);
CREATE INDEX idx_csv_import_jobs_status ON csv_import_jobs (status);
CREATE INDEX idx_csv_import_jobs_hash ON csv_import_jobs (file_hash);
CREATE INDEX idx_csv_import_rows_job ON csv_import_rows (job_id);
CREATE INDEX idx_audit_events_institution ON audit_events (institution_id);
