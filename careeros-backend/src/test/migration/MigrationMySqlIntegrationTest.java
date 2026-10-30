package com.codeit.careeros.migration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs the real MySQL migrations and then asks Hibernate to validate the
 * entity model against the resulting schema.
 *
 * <p>This is the authoritative migration check; the H2-based
 * {@link MigrationScriptTest} only proves ordering, idempotence and data
 * preservation. It is skipped unless a disposable MySQL instance is provided:
 *
 * <pre>
 * MYSQL_TEST_URL=jdbc:mysql://127.0.0.1:3306/careeros_migration_test?...
 * MYSQL_TEST_USER=careeros
 * MYSQL_TEST_PASSWORD=...
 * </pre>
 *
 * <p>CI provides a throwaway MySQL 8 service container. Never point this at a
 * database containing real data: the test requires an empty schema.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=${MYSQL_TEST_URL}",
        "spring.datasource.username=${MYSQL_TEST_USER}",
        "spring.datasource.password=${MYSQL_TEST_PASSWORD}",
        "spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "app.bootstrap.admin-email=admin@migration.test",
        "app.bootstrap.admin-password=MigrationTest1"
})
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "MYSQL_TEST_URL", matches = ".+")
class MigrationMySqlIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void flywayThenHibernateValidationSucceedsOnFreshMySqlSchema() {
        // Context startup is the test: Flyway applies V1+V2+V3+V4+V5 and
        // Hibernate validates every mapped column, index and constraint
        // against MySQL.
    }

    @Test
    void baselineWasExecutedNotBaselined() {
        // If the CI database were accidentally non-empty, Flyway would mark V1
        // as BASELINE and skip it. That must fail this test rather than pass as
        // a fresh-schema verification.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT type FROM flyway_schema_history WHERE version = '1'",
                String.class)).isEqualTo("SQL");

        List<String> versions = jdbcTemplate.queryForList(
                "SELECT version FROM flyway_schema_history "
                        + "WHERE success = 1 AND version IS NOT NULL ORDER BY installed_rank",
                String.class);
        assertThat(versions).containsExactly("1", "2", "3", "4", "5");

        Integer auditTables = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'audit_events'",
                Integer.class);
        assertThat(auditTables).isEqualTo(1);
    }
}
