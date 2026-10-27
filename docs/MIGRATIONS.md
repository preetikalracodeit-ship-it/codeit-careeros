# CareerOS — Versioned Database Migrations

> Status: implemented locally on 2026-10-27, **not committed, not applied to any
> production database**. Flyway is the only supported way to change the schema.

## 1. Why this exists

Before this change the schema was created by Hibernate (`ddl-auto=update` on
first boot) and then validated (`ddl-auto=validate`). That made an empty
database bootstrap possible but left no reviewable, versioned history and no
safe way to ship additive changes. The audit also found no durable table for
consent evidence or audit events.

Flyway now owns the schema. Hibernate is restricted to `validate` in dev and
prod. Tests keep using Hibernate `create-drop` on H2 for speed, with separate
migration tests.

## 2. Layout

```
careeros-backend/src/main/resources/db/migration/
  V1__baseline_existing_schema.sql    # schema as it exists before Flyway
  V2__durable_consent_records.sql     # consent_records
  V3__audit_events.sql                # audit_events
  V4__college_tenant_model.sql        # additive institution and college tables
```

- Files are immutable once applied. Fix mistakes with a new versioned migration.
- No `DROP`, `TRUNCATE`, data rewrite, or `flyway clean` is allowed.
  `clean-disabled: true` is set in `application.yml`.
- Every migration must be additive or forward-fixable. Destructive changes
  need an approved backup/restore plan first.

## 3. How the two database states are handled

Flyway config (`application.yml`):

```yaml
spring.flyway:
  enabled: ${FLYWAY_ENABLED:true}
  locations: classpath:db/migration
  baseline-on-migrate: true
  baseline-version: 1
  baseline-description: "Pre-Flyway CareerOS schema"
  validate-on-migrate: true
  clean-disabled: true
```

| Database state | What happens |
|---|---|
| Brand-new empty database | V1 through V4 run in order. The schema matches the entity model. |
| Existing pre-Flyway database with tables and data | Flyway sees a non-empty schema with no history, inserts a **baseline** row for V1 (it does **not** execute V1), then runs V2 through V4. Existing ids, rows, and relationships are untouched. |
| Existing database with Flyway history | Only pending versions run. Checksums are validated. |
| Migration checksum mismatch | Startup fails. Do not edit an applied file; restore the original checksum or add a new forward migration. |

The baseline row is `type=BASELINE`, so it is visibly distinct from an
executed script.

### Important baseline caveat

V1 was generated from the current JPA entity model. An existing production
schema created by older Hibernate versions may have harmless drift (for
example, a manually altered `semester` column). Flyway will **not** compare
V1 with that schema because it baselines instead of executing V1. Hibernate
`validate` still runs at startup and will fail loudly if a mapped column is
missing or has an incompatible type.

Before the first production start:

1. Take a verified backup (`docs/BACKUP_RESTORE.md`).
2. Compare the production schema with V1 (or run the MySQL validation test
   against a schema copy).
3. If drift exists, write a **forward** migration that reconciles it. Do not
   edit V1 and do not let Hibernate “fix” production.

## 4. Application configuration

- `application-prod.yml`: `ddl-auto: ${JPA_DDL_AUTO:validate}`. Compose sets
  `JPA_DDL_AUTO=validate` explicitly; Hibernate never creates or updates
  production tables.
- `application-dev.yml`: changed from `update` to `validate`. A dev database
  is initialized by Flyway. If an old dev database is too far out of sync, drop
  and recreate it (local data only).
- `application-test.yml`: `spring.flyway.enabled=false`; the main test suite
  uses H2 `create-drop`. Migration correctness has dedicated tests.
- `deploy-prod.sh`: forces `JPA_DDL_AUTO=validate` and sets
  `FLYWAY_ENABLED=true`; after the health check it prints the latest
  successful Flyway version from `flyway_schema_history`.

## 5. Verification

### 5.1 Local (no external services)

`MigrationScriptTest` runs Flyway against H2 in MySQL mode:

- **fresh database**: V1+V2+V3+V4 execute and create every expected table, column,
  index, and unique key;
- **upgrade simulation**: V1 is executed manually to represent a pre-Flyway
  schema, a legacy user row is inserted, then Flyway baselines at V1, applies
  V2+V3+V4, and the test asserts the user row survives and the history is
  `1:BASELINE, 2:SQL, 3:SQL, 4:SQL`;
- **constraints**: duplicate `(user_id, consent_type, policy_version)` is
  rejected, a consent row for a missing user fails the foreign key, and a new
  policy version is allowed alongside the old one.

H2 is not MySQL. It proves ordering, syntax portability, and data preservation,
not exact MySQL type parity.

### 5.2 CI (real MySQL 8)

`.github/workflows/ci.yml` job `migration-mysql` starts a disposable MySQL 8
service and runs:

```bash
mvn -B -Dtest=MigrationMySqlIntegrationTest test
```

The test context points at the CI database, Flyway applies V1–V4, and
Hibernate validates every mapped entity/column/constraint. This is the
authoritative MySQL check. It is skipped locally unless `MYSQL_TEST_URL`,
`MYSQL_TEST_USER`, and `MYSQL_TEST_PASSWORD` are set.

**Never point the MySQL test at a database containing real data.**

### 5.3 What is not verified yet

- CI has not executed on the repository host.
- No production schema copy has been compared with V1.
- Docker/Compose startup was not tested locally (Docker unavailable).

## 6. Rollback and forward recovery

There are no down-migrations. This is intentional: reverse-engineering a
schema change can destroy data.

- **Before deploy:** verified MySQL backup; record the current commit and
  `flyway_schema_history` version.
- **Application rollback:** deploy the previous application version. Additive
  migrations are backward-compatible with the previous release. Do not delete
  new columns/tables.
- **Failed migration before commit:** fix forward with a new migration and run
  `flyway repair` only if the history row is wrong. Flyway's `clean` is
  disabled.
- **Data-corrupting migration:** stop the application, restore the verified
  backup, redeploy the previous version, then redesign the migration. Do not
  edit an applied migration file.
- **Partial failure inside a migration:** MySQL DDL is not transactional. The
  failed version is recorded as failed and later versions do not run. Inspect
  the schema, decide whether to complete the partial change with a new
  migration or restore, then repair the history under change control.

## 7. Rules for future migrations

1. One reviewable change per version; descriptive name.
2. Preserve existing primary keys and foreign-key relationships; backfill
   before adding `NOT NULL`.
3. Add indexes for new access paths; verify with `EXPLAIN` on representative
   data.
4. Never infer institutional membership from email domains. Do not deploy the
   V4 tenant schema until the role matrix and tenant model are approved (see
   `CAREEROS_COLLEGE_ROLE_MATRIX.md`).
5. Never include customer data, secrets, or environment-specific values in a
   migration.
6. Test fresh initialization **and** upgrade from the current schema.
7. Do not run a production migration without explicit approval and a verified
   recovery path.
