package com.codeit.careeros.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercises the versioned MySQL migrations on H2's MySQL compatibility mode.
 *
 * <p>H2 is not MySQL. These tests prove the migration scripts are ordered,
 * additive, syntactically valid, and preserve data when an existing
 * pre-Flyway schema is baselined. The exact MySQL type/constraint validation
 * is performed by MigrationMySqlIntegrationTest in CI (real MySQL 8).
 */
class MigrationScriptTest {

    private String newDatabaseUrl() {
        return "jdbc:h2:mem:mig_" + UUID.randomUUID().toString().replace("-", "")
                + ";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE";
    }

    private Connection connect(String url) throws SQLException {
        return DriverManager.getConnection(url, "sa", "");
    }

    @Test
    @DisplayName("Fresh database: all migrations run in order and create every expected table")
    void freshDatabase_appliesAllMigrations() throws Exception {
        String url = newDatabaseUrl();

        var result = Flyway.configure()
                .dataSource(url, "sa", "")
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .cleanDisabled(true)
                .load()
                .migrate();

        assertThat(result.migrationsExecuted).isEqualTo(5);
        assertThat(result.targetSchemaVersion).isEqualTo("5");

        try (Connection connection = connect(url)) {
            List<String> tables = tables(connection);
            assertThat(tables).contains(
                    "users", "student_profiles", "refresh_tokens",
                    "careers", "skills", "career_skills",
                    "assessment_tests", "assessment_questions", "question_options",
                    "assessment_attempts", "assessment_attempt_questions",
                    "assessment_answers", "skill_scores",
                    "projects", "project_skills", "project_progress",
                    "roadmap_phases", "roadmap_items", "roadmap_item_progress",
                    "cv_documents", "linkedin_profiles",
                    "ai_chat_sessions", "ai_chat_messages",
                    "consent_records", "audit_events",
                    "institutions", "departments", "programs", "academic_years",
                    "batches", "sections", "student_enrollments",
                    "institution_memberships", "staff_invitations",
                    "csv_import_jobs", "csv_import_rows",
                    "improvement_plans", "improvement_tasks",
                    "placement_companies", "job_openings", "placement_drives",
                    "placement_applications", "application_stage_events", "placement_offers");

            assertThat(columns(connection, "consent_records")).contains(
                    "id", "user_id", "consent_type", "policy_version",
                    "method", "evidence", "accepted_at");
            assertThat(columns(connection, "audit_events")).contains(
                    "id", "actor_user_id", "actor_role", "action", "target_path",
                    "outcome", "http_status", "request_id", "created_at",
                    "actor_email", "target_type", "target_id", "institution_id",
                    "scope_description", "details");
            assertThat(indexes(connection, "audit_events"))
                    .contains("idx_audit_created_at", "idx_audit_actor", "idx_audit_action",
                            "idx_audit_events_institution");
            assertThat(indexes(connection, "consent_records"))
                    .contains("idx_consent_user", "idx_consent_version")
                    .anyMatch(name -> name.startsWith("uk_consent_user_type_version"));
            assertThat(indexes(connection, "student_profiles"))
                    .anyMatch(name -> name.startsWith("uk_student_profiles_user"))
                    .anyMatch(name -> name.startsWith("uk_student_profiles_student_id"));
            assertThat(indexes(connection, "assessment_attempts"))
                    .contains("idx_attempts_user", "idx_attempts_assessment")
                    .anyMatch(name -> name.startsWith("uk_assessment_attempts_code"));

            // V4 widens the role column so college staff can be stored, while
            // existing ADMIN/STUDENT rows remain valid.
            statementInsertProfessor(connection);
        }
    }

    private void statementInsertProfessor(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at)
                    VALUES ('professor@example.com', 'hash', 'Professor', 'PROFESSOR', 'ACTIVE',
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """);
        }
    }

    @Test
    @DisplayName("Upgrade: an existing pre-Flyway database is baselined and only V2 through V4 run")
    void existingDatabase_isBaselinedAndUpgradedWithoutDataLoss() throws Exception {
        String url = newDatabaseUrl();

        // 1. Simulate the schema created by Hibernate before Flyway existed.
        try (Connection connection = connect(url)) {
            ScriptUtils.executeSqlScript(connection,
                    new ClassPathResource("db/migration/V1__baseline_existing_schema.sql"));
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate("""
                        INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at)
                        VALUES ('legacy@example.com', 'hash', 'Legacy Student', 'STUDENT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """);
            }
        }

        // 2. First Flyway run sees a non-empty schema without history and
        //    baselines at version 1, then applies V2, V3 and V4.
        var result = Flyway.configure()
                .dataSource(url, "sa", "")
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .cleanDisabled(true)
                .load()
                .migrate();

        assertThat(result.migrationsExecuted).isEqualTo(4);
        assertThat(result.targetSchemaVersion).isEqualTo("5");

        try (Connection connection = connect(url)) {
            assertThat(tables(connection)).contains("consent_records", "audit_events", "users", "student_profiles",
                    "institutions", "student_enrollments", "institution_memberships");

            try (Statement statement = connection.createStatement();
                 ResultSet rs = statement.executeQuery("SELECT COUNT(*) FROM users")) {
                rs.next();
                assertThat(rs.getInt(1)).isEqualTo(1);
            }

            // The baseline marker must not pretend that V1 was executed.
            try (Statement statement = connection.createStatement();
                 ResultSet rs = statement.executeQuery("""
                         SELECT version, type FROM flyway_schema_history
                         WHERE version IS NOT NULL ORDER BY installed_rank
                         """)) {
                List<String> history = new ArrayList<>();
                while (rs.next()) {
                    history.add(rs.getString(1) + ":" + rs.getString(2));
                }
                assertThat(history).containsExactly("1:BASELINE", "2:SQL", "3:SQL", "4:SQL", "5:SQL");
            }
        }
    }

    @Test
    @DisplayName("Consent records enforce uniqueness and the user foreign key")
    void consentConstraints_areEnforced() throws Exception {
        String url = newDatabaseUrl();
        Flyway.configure()
                .dataSource(url, "sa", "")
                .locations("classpath:db/migration")
                .baselineOnMigrate(true).baselineVersion("1").cleanDisabled(true)
                .load().migrate();

        try (Connection connection = connect(url); Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at)
                    VALUES ('constraints@example.com', 'hash', 'Constraints', 'STUDENT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """);
            statement.executeUpdate("""
                    INSERT INTO consent_records (user_id, consent_type, policy_version, method, evidence, accepted_at)
                    VALUES (1, 'TERMS_AND_PRIVACY', '2026-10-26', 'PASSWORD_REGISTRATION', 'explicit_registration_checkbox', CURRENT_TIMESTAMP)
                    """);

            // Duplicate (user, type, version) is rejected by the unique key.
            assertThatThrownBy(() -> statement.executeUpdate("""
                    INSERT INTO consent_records (user_id, consent_type, policy_version, method, evidence, accepted_at)
                    VALUES (1, 'TERMS_AND_PRIVACY', '2026-10-26', 'RECONSENT', 'authenticated_consent_request', CURRENT_TIMESTAMP)
                    """))
                    .isInstanceOf(SQLException.class);

            // A consent row cannot reference a non-existent account.
            assertThatThrownBy(() -> statement.executeUpdate("""
                    INSERT INTO consent_records (user_id, consent_type, policy_version, method, evidence, accepted_at)
                    VALUES (999999, 'TERMS_AND_PRIVACY', '2026-10-26', 'RECONSENT', 'authenticated_consent_request', CURRENT_TIMESTAMP)
                    """))
                    .isInstanceOf(SQLException.class);

            // A different policy version for the same user is allowed and the
            // previous evidence stays untouched.
            statement.executeUpdate("""
                    INSERT INTO consent_records (user_id, consent_type, policy_version, method, evidence, accepted_at)
                    VALUES (1, 'TERMS_AND_PRIVACY', '2027-01-01', 'RECONSENT', 'authenticated_consent_request', CURRENT_TIMESTAMP)
                    """);
            try (ResultSet rs = statement.executeQuery("SELECT COUNT(*) FROM consent_records")) {
                rs.next();
                assertThat(rs.getInt(1)).isEqualTo(2);
            }
        }
    }

    private List<String> tables(Connection connection) throws SQLException {
        List<String> names = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("""
                     SELECT table_name FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                     """)) {
            while (rs.next()) {
                names.add(rs.getString(1));
            }
        }
        return names;
    }

    private List<String> columns(Connection connection, String table) throws SQLException {
        List<String> names = new ArrayList<>();
        try (var ps = connection.prepareStatement("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ?
                """)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    names.add(rs.getString(1));
                }
            }
        }
        return names;
    }

    private List<String> indexes(Connection connection, String table) throws SQLException {
        List<String> names = new ArrayList<>();
        try (var ps = connection.prepareStatement("""
                SELECT DISTINCT index_name FROM information_schema.indexes
                WHERE table_schema = 'public' AND table_name = ?
                """)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    names.add(rs.getString(1));
                }
            }
        }
        return names;
    }
}
