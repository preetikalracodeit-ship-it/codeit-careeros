-- ============================================================================
-- V5 — College Phase 2/3/4: improvement plans, placement management and
-- placement analytics support.
--
-- Additive only. No existing table or row is rewritten or deleted. Student
-- identity remains in users/student_profiles; these tables reference it.
-- ============================================================================

CREATE TABLE improvement_plans (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id     BIGINT       NOT NULL,
    student_profile_id BIGINT       NOT NULL,
    title              VARCHAR(200) NOT NULL,
    summary            VARCHAR(1000),
    status             VARCHAR(20)  NOT NULL,
    target_career_name VARCHAR(160),
    created_by         BIGINT,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_improvement_plans_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_improvement_plans_student FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id),
    CONSTRAINT fk_improvement_plans_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE improvement_tasks (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    plan_id         BIGINT       NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     VARCHAR(1000),
    skill_id        BIGINT,
    skill_name      VARCHAR(160),
    priority        VARCHAR(20)  NOT NULL,
    status          VARCHAR(30)  NOT NULL,
    target_date     DATE,
    owner_user_id   BIGINT,
    owner_name      VARCHAR(120),
    baseline_score  INTEGER,
    target_score    INTEGER,
    evidence_source VARCHAR(60),
    completed_at    DATETIME(6),
    created_at      DATETIME(6)  NOT NULL,
    updated_at      DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_improvement_tasks_plan FOREIGN KEY (plan_id) REFERENCES improvement_plans (id),
    CONSTRAINT fk_improvement_tasks_skill FOREIGN KEY (skill_id) REFERENCES skills (id),
    CONSTRAINT fk_improvement_tasks_owner FOREIGN KEY (owner_user_id) REFERENCES users (id)
);

CREATE TABLE placement_companies (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id     BIGINT       NOT NULL,
    name               VARCHAR(160) NOT NULL,
    industry           VARCHAR(120),
    sector             VARCHAR(120),
    website            VARCHAR(250),
    contact_name       VARCHAR(120),
    contact_email      VARCHAR(190),
    contact_phone      VARCHAR(30),
    recruitment_status VARCHAR(20)  NOT NULL,
    source             VARCHAR(120),
    notes              VARCHAR(1000),
    created_by         BIGINT,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_placement_companies_institution_name UNIQUE (institution_id, name),
    CONSTRAINT fk_placement_companies_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_placement_companies_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE job_openings (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id       BIGINT       NOT NULL,
    company_id           BIGINT       NOT NULL,
    title                VARCHAR(180) NOT NULL,
    description          TEXT,
    required_skills      VARCHAR(1000),
    location             VARCHAR(160),
    employment_type      VARCHAR(30),
    eligibility_criteria VARCHAR(2000),
    salary_min           DECIMAL(12,2),
    salary_max           DECIMAL(12,2),
    currency             VARCHAR(10),
    application_deadline DATE,
    status               VARCHAR(20)  NOT NULL,
    created_by           BIGINT,
    created_at           DATETIME(6)  NOT NULL,
    updated_at           DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_job_openings_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_job_openings_company FOREIGN KEY (company_id) REFERENCES placement_companies (id),
    CONSTRAINT fk_job_openings_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE placement_drives (
    id                        BIGINT       NOT NULL AUTO_INCREMENT,
    institution_id            BIGINT       NOT NULL,
    company_id                BIGINT       NOT NULL,
    job_id                    BIGINT       NOT NULL,
    name                      VARCHAR(180) NOT NULL,
    registration_start        DATE,
    registration_end          DATE,
    drive_date                DATE,
    eligibility_criteria      VARCHAR(2000),
    eligible_department_id    BIGINT,
    eligible_program_id       BIGINT,
    eligible_batch_id         BIGINT,
    eligible_graduation_year  INTEGER,
    minimum_readiness_percent INTEGER,
    status                    VARCHAR(30)  NOT NULL,
    created_by                BIGINT,
    created_at                DATETIME(6)  NOT NULL,
    updated_at                DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_placement_drives_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_placement_drives_company FOREIGN KEY (company_id) REFERENCES placement_companies (id),
    CONSTRAINT fk_placement_drives_job FOREIGN KEY (job_id) REFERENCES job_openings (id),
    CONSTRAINT fk_placement_drives_department FOREIGN KEY (eligible_department_id) REFERENCES departments (id),
    CONSTRAINT fk_placement_drives_program FOREIGN KEY (eligible_program_id) REFERENCES programs (id),
    CONSTRAINT fk_placement_drives_batch FOREIGN KEY (eligible_batch_id) REFERENCES batches (id),
    CONSTRAINT fk_placement_drives_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE placement_applications (
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    institution_id     BIGINT      NOT NULL,
    drive_id           BIGINT      NOT NULL,
    student_profile_id BIGINT      NOT NULL,
    stage              VARCHAR(30) NOT NULL,
    eligibility_override BOOLEAN   NOT NULL,
    override_reason    VARCHAR(500),
    override_by        BIGINT,
    applied_at         DATETIME(6) NOT NULL,
    created_at         DATETIME(6) NOT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_placement_applications_drive_student UNIQUE (drive_id, student_profile_id),
    CONSTRAINT fk_placement_applications_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_placement_applications_drive FOREIGN KEY (drive_id) REFERENCES placement_drives (id),
    CONSTRAINT fk_placement_applications_student FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id),
    CONSTRAINT fk_placement_applications_override_by FOREIGN KEY (override_by) REFERENCES users (id)
);

CREATE TABLE application_stage_events (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    application_id BIGINT      NOT NULL,
    stage          VARCHAR(30) NOT NULL,
    note           VARCHAR(500),
    recorded_by    BIGINT,
    recorded_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_application_stage_events_application FOREIGN KEY (application_id) REFERENCES placement_applications (id),
    CONSTRAINT fk_application_stage_events_recorder FOREIGN KEY (recorded_by) REFERENCES users (id)
);

CREATE TABLE placement_offers (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    institution_id BIGINT        NOT NULL,
    application_id BIGINT        NOT NULL,
    package_amount DECIMAL(12,2),
    currency       VARCHAR(10),
    offer_date     DATE,
    status         VARCHAR(20)   NOT NULL,
    joined_at      DATE,
    notes          VARCHAR(500),
    created_by     BIGINT,
    created_at     DATETIME(6)   NOT NULL,
    updated_at     DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_placement_offers_application UNIQUE (application_id),
    CONSTRAINT fk_placement_offers_institution FOREIGN KEY (institution_id) REFERENCES institutions (id),
    CONSTRAINT fk_placement_offers_application FOREIGN KEY (application_id) REFERENCES placement_applications (id),
    CONSTRAINT fk_placement_offers_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE INDEX idx_improvement_plans_institution ON improvement_plans (institution_id);
CREATE INDEX idx_improvement_plans_student ON improvement_plans (student_profile_id);
CREATE INDEX idx_improvement_plans_status ON improvement_plans (status);
CREATE INDEX idx_improvement_tasks_plan ON improvement_tasks (plan_id);
CREATE INDEX idx_improvement_tasks_status ON improvement_tasks (status);
CREATE INDEX idx_improvement_tasks_target_date ON improvement_tasks (target_date);
CREATE INDEX idx_placement_companies_institution ON placement_companies (institution_id);
CREATE INDEX idx_placement_companies_status ON placement_companies (recruitment_status);
CREATE INDEX idx_job_openings_institution ON job_openings (institution_id);
CREATE INDEX idx_job_openings_company ON job_openings (company_id);
CREATE INDEX idx_job_openings_status ON job_openings (status);
CREATE INDEX idx_placement_drives_institution ON placement_drives (institution_id);
CREATE INDEX idx_placement_drives_company ON placement_drives (company_id);
CREATE INDEX idx_placement_drives_job ON placement_drives (job_id);
CREATE INDEX idx_placement_drives_status ON placement_drives (status);
CREATE INDEX idx_placement_applications_institution ON placement_applications (institution_id);
CREATE INDEX idx_placement_applications_drive ON placement_applications (drive_id);
CREATE INDEX idx_placement_applications_student ON placement_applications (student_profile_id);
CREATE INDEX idx_placement_applications_stage ON placement_applications (stage);
CREATE INDEX idx_application_stage_events_application ON application_stage_events (application_id);
CREATE INDEX idx_placement_offers_institution ON placement_offers (institution_id);
CREATE INDEX idx_placement_offers_status ON placement_offers (status);
