-- ============================================================================
-- V1 — Baseline of the schema that already exists in deployed CareerOS
-- databases.
--
-- IMPORTANT
--   * This file describes the *current* entity model. It is used to
--     initialise a brand-new database (fresh install) and as the Flyway
--     baseline marker for databases created before Flyway existed.
--   * Flyway is configured with baseline-on-migrate=true and
--     baseline-version=1. On an existing non-empty database V1 is marked as
--     applied (not executed) and only V2+ run. Existing rows, ids and
--     relationships are therefore never touched.
--   * Every statement is additive. There is no DROP, TRUNCATE, or data
--     rewrite in this file.
--   * If the deployed schema ever differs from this baseline, fix it with a
--     forward migration (V3...) rather than editing V1.
-- ============================================================================

CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    email         VARCHAR(190) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    role          ENUM('ADMIN','STUDENT') NOT NULL,
    status        ENUM('ACTIVE','INACTIVE','LOCKED') NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE INDEX idx_users_role ON users (role);

CREATE TABLE careers (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    name             VARCHAR(140)  NOT NULL,
    description      VARCHAR(1000),
    category         ENUM('BUSINESS','CLOUD_DEVOPS','CYBERSECURITY','DATA_AI','OTHER','QUALITY_ASSURANCE','SOFTWARE_DEVELOPMENT') NOT NULL,
    difficulty_level ENUM('ADVANCED','BEGINNER','INTERMEDIATE') NOT NULL,
    published        BIT           NOT NULL,
    created_at       DATETIME(6)   NOT NULL,
    updated_at       DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_careers_name UNIQUE (name)
);

CREATE INDEX idx_careers_category ON careers (category);

CREATE TABLE skills (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(120) NOT NULL,
    category    ENUM('AI_ML','CLOUD','CYBERSECURITY','DATA','DATABASES','DEVOPS','FRAMEWORKS','OTHER','PROGRAMMING_LANGUAGES','SOFT_SKILLS','TESTING') NOT NULL,
    description VARCHAR(300),
    active      BIT          NOT NULL,
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_skills_name UNIQUE (name)
);

CREATE INDEX idx_skills_category ON skills (category);

CREATE TABLE career_skills (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    career_id      BIGINT      NOT NULL,
    skill_id       BIGINT      NOT NULL,
    weight_percent INTEGER     NOT NULL,
    required_level ENUM('ADVANCED','BASIC','BEGINNER','EXPERT','INTERMEDIATE') NOT NULL,
    target_percent INTEGER     NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_career_skills_career_skill UNIQUE (career_id, skill_id),
    CONSTRAINT fk_career_skills_career FOREIGN KEY (career_id) REFERENCES careers (id),
    CONSTRAINT fk_career_skills_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
);

CREATE TABLE student_profiles (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    user_id           BIGINT       NOT NULL,
    student_id        VARCHAR(40)  NOT NULL,
    full_name         VARCHAR(120) NOT NULL,
    mobile            VARCHAR(20),
    date_of_birth     DATE,
    college           VARCHAR(150),
    degree            VARCHAR(100),
    branch            VARCHAR(100),
    graduation_year   INTEGER,
    semester          INTEGER,
    location          VARCHAR(150),
    github_url        VARCHAR(250),
    linkedin_url      VARCHAR(250),
    portfolio_url     VARCHAR(250),
    profile_photo_url VARCHAR(300),
    target_career_id  BIGINT,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_student_profiles_user UNIQUE (user_id),
    CONSTRAINT uk_student_profiles_student_id UNIQUE (student_id),
    CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_student_profiles_target_career FOREIGN KEY (target_career_id) REFERENCES careers (id)
);

CREATE TABLE assessment_tests (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    career_id        BIGINT       NOT NULL,
    title            VARCHAR(150) NOT NULL,
    description      VARCHAR(500),
    duration_minutes INTEGER      NOT NULL,
    published        BIT          NOT NULL,
    created_at       DATETIME(6)  NOT NULL,
    updated_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_assessment_tests_career FOREIGN KEY (career_id) REFERENCES careers (id)
);

CREATE INDEX idx_assessments_career ON assessment_tests (career_id);

CREATE TABLE assessment_questions (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    assessment_id BIGINT        NOT NULL,
    skill_id      BIGINT        NOT NULL,
    question_text VARCHAR(1000) NOT NULL,
    question_type ENUM('MCQ')   NOT NULL,
    difficulty    ENUM('ADVANCED','BEGINNER','INTERMEDIATE') NOT NULL,
    explanation   VARCHAR(600),
    display_order INTEGER       NOT NULL,
    active        BIT           NOT NULL,
    created_at    DATETIME(6)   NOT NULL,
    updated_at    DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_assessment_questions_assessment FOREIGN KEY (assessment_id) REFERENCES assessment_tests (id),
    CONSTRAINT fk_assessment_questions_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
);

CREATE INDEX idx_questions_assessment ON assessment_questions (assessment_id);
CREATE INDEX idx_questions_skill ON assessment_questions (skill_id);

CREATE TABLE question_options (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    question_id   BIGINT       NOT NULL,
    option_text   VARCHAR(500) NOT NULL,
    correct       BIT          NOT NULL,
    display_order INTEGER      NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_question_options_question FOREIGN KEY (question_id) REFERENCES assessment_questions (id)
);

CREATE INDEX idx_options_question ON question_options (question_id);

CREATE TABLE assessment_attempts (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    attempt_code    VARCHAR(40) NOT NULL,
    user_id         BIGINT      NOT NULL,
    assessment_id   BIGINT      NOT NULL,
    status          ENUM('EXPIRED','IN_PROGRESS','SUBMITTED') NOT NULL,
    started_at      DATETIME(6) NOT NULL,
    expires_at      DATETIME(6) NOT NULL,
    submitted_at    DATETIME(6),
    total_questions INTEGER     NOT NULL,
    answered_count  INTEGER     NOT NULL,
    overall_score   INTEGER,
    created_at      DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_assessment_attempts_code UNIQUE (attempt_code),
    CONSTRAINT fk_assessment_attempts_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_assessment_attempts_assessment FOREIGN KEY (assessment_id) REFERENCES assessment_tests (id)
);

CREATE INDEX idx_attempts_user ON assessment_attempts (user_id);
CREATE INDEX idx_attempts_assessment ON assessment_attempts (assessment_id);

CREATE TABLE assessment_attempt_questions (
    id            BIGINT  NOT NULL AUTO_INCREMENT,
    attempt_id    BIGINT  NOT NULL,
    question_id   BIGINT  NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_attempt_questions_attempt_question UNIQUE (attempt_id, question_id),
    CONSTRAINT fk_attempt_questions_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts (id) ON DELETE CASCADE,
    CONSTRAINT fk_attempt_questions_question FOREIGN KEY (question_id) REFERENCES assessment_questions (id)
);

CREATE INDEX idx_attempt_questions_attempt ON assessment_attempt_questions (attempt_id);
CREATE INDEX idx_attempt_questions_question ON assessment_attempt_questions (question_id);

CREATE TABLE assessment_answers (
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    attempt_id         BIGINT      NOT NULL,
    question_id        BIGINT      NOT NULL,
    selected_option_id BIGINT,
    created_at         DATETIME(6) NOT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_answers_attempt_question UNIQUE (attempt_id, question_id),
    CONSTRAINT fk_assessment_answers_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts (id),
    CONSTRAINT fk_assessment_answers_question FOREIGN KEY (question_id) REFERENCES assessment_questions (id),
    CONSTRAINT fk_assessment_answers_option FOREIGN KEY (selected_option_id) REFERENCES question_options (id)
);

CREATE TABLE skill_scores (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    attempt_id     BIGINT      NOT NULL,
    skill_id       BIGINT      NOT NULL,
    score_percent  INTEGER     NOT NULL,
    correct_count  INTEGER     NOT NULL,
    question_count INTEGER     NOT NULL,
    weight_percent INTEGER     NOT NULL,
    target_percent INTEGER     NOT NULL,
    level          ENUM('DEVELOPING','GOOD','NEEDS_IMPROVEMENT','PRIORITY_GAP','STRONG') NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_skill_scores_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts (id),
    CONSTRAINT fk_skill_scores_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
);

CREATE INDEX idx_skill_scores_attempt ON skill_scores (attempt_id);

CREATE TABLE cv_documents (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    user_id           BIGINT       NOT NULL,
    storage_key       VARCHAR(400) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type      VARCHAR(120),
    file_size         BIGINT       NOT NULL,
    status            ENUM('FAILED','PARSED','UPLOADED') NOT NULL,
    parse_error       VARCHAR(500),
    candidate_name    VARCHAR(120),
    candidate_email   VARCHAR(190),
    candidate_phone   VARCHAR(40),
    extracted_text    LONGTEXT,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_cv_documents_user UNIQUE (user_id),
    CONSTRAINT fk_cv_documents_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE linkedin_profiles (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_id         BIGINT       NOT NULL,
    profile_url     VARCHAR(500) NOT NULL,
    headline        VARCHAR(220),
    about           TEXT,
    role_title      VARCHAR(180),
    experience_text TEXT,
    skills_text     TEXT,
    education_text  TEXT,
    created_at      DATETIME(6)  NOT NULL,
    updated_at      DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_linkedin_profiles_user UNIQUE (user_id),
    CONSTRAINT fk_linkedin_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE projects (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    career_id       BIGINT        NOT NULL,
    title           VARCHAR(180)  NOT NULL,
    description     VARCHAR(2000),
    difficulty      ENUM('ADVANCED','BEGINNER','INTERMEDIATE') NOT NULL,
    estimated_weeks INTEGER       NOT NULL,
    display_order   INTEGER       NOT NULL,
    published       BIT           NOT NULL,
    created_at      DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_projects_career FOREIGN KEY (career_id) REFERENCES careers (id)
);

CREATE TABLE project_skills (
    id         BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    skill_id   BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_project_skills_project_skill UNIQUE (project_id, skill_id),
    CONSTRAINT fk_project_skills_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_project_skills_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
);

CREATE TABLE project_progress (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    project_id BIGINT      NOT NULL,
    status     ENUM('COMPLETED','IN_PROGRESS','NOT_STARTED') NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_project_progress_user_project UNIQUE (user_id, project_id),
    CONSTRAINT fk_project_progress_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_project_progress_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE roadmap_phases (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    career_id     BIGINT       NOT NULL,
    title         VARCHAR(140) NOT NULL,
    description   VARCHAR(1000),
    display_order INTEGER      NOT NULL,
    duration_days INTEGER      NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_roadmap_phases_career FOREIGN KEY (career_id) REFERENCES careers (id)
);

CREATE TABLE roadmap_items (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    phase_id       BIGINT       NOT NULL,
    skill_id       BIGINT,
    title          VARCHAR(180) NOT NULL,
    description    VARCHAR(1000),
    learning_goal  VARCHAR(500),
    display_order  INTEGER      NOT NULL,
    estimated_hours INTEGER     NOT NULL,
    created_at     DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_roadmap_items_phase FOREIGN KEY (phase_id) REFERENCES roadmap_phases (id),
    CONSTRAINT fk_roadmap_items_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
);

CREATE TABLE roadmap_item_progress (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT      NOT NULL,
    roadmap_item_id BIGINT      NOT NULL,
    status          ENUM('COMPLETED','IN_PROGRESS','NOT_STARTED') NOT NULL,
    updated_at      DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_roadmap_progress_user_item UNIQUE (user_id, roadmap_item_id),
    CONSTRAINT fk_roadmap_item_progress_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_roadmap_item_progress_item FOREIGN KEY (roadmap_item_id) REFERENCES roadmap_items (id)
);

CREATE TABLE refresh_tokens (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT      NOT NULL,
    token_hash      VARCHAR(64) NOT NULL,
    expires_at      DATETIME(6) NOT NULL,
    revoked         BIT         NOT NULL,
    replaced_by_id  BIGINT,
    created_at      DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

CREATE TABLE ai_chat_sessions (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    user_id    BIGINT       NOT NULL,
    title      VARCHAR(190) NOT NULL,
    created_at DATETIME(6)  NOT NULL,
    updated_at DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ai_chat_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_ai_sessions_user ON ai_chat_sessions (user_id);

CREATE TABLE ai_chat_messages (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    session_id BIGINT      NOT NULL,
    role       ENUM('ASSISTANT','USER') NOT NULL,
    content    TEXT        NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ai_chat_messages_session FOREIGN KEY (session_id) REFERENCES ai_chat_sessions (id)
);

CREATE INDEX idx_ai_messages_session ON ai_chat_messages (session_id);
