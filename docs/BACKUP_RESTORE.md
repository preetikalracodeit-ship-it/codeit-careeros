# MySQL Backup, Restore & Migration — CODEIT CareerOS

Sprint 8 rule, repeated: **never delete or reset production data.**
`application-prod.yml` uses `ddl-auto: validate` — the app will refuse to
start against an unexpected schema instead of altering your data.

## What to back up

- The whole `careeros` database (single `mysqldump` covers everything).
- Most critical tables: `users`, `student_profiles`, `refresh_tokens`,
  `assessment_attempts`, `assessment_answers`, `skill_scores`,
  `roadmap_item_progress`, `project_progress`, `cv_documents`,
  `linkedin_profiles`, `ai_chat_sessions`, `ai_chat_messages`.
- Master/catalog tables (re-seedable, but back up anyway): `skills`,
  `careers`, `career_skills`, `assessment_tests`, `assessment_questions`,
  `question_options`, `roadmap_phases`, `roadmap_items`, `projects`,
  `project_skills`.
- CV binaries live in **S3** (prod) — covered by bucket versioning/
  replication, not by mysqldump. Local dev files live under
  `./data/` (back up the folder if needed).

## Backup (run on the DB host)

```powershell
# PowerShell — timestamped full backup
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
mysqldump -h localhost -u root -p --single-transaction --routines `
  careeros > "careeros-backup-$stamp.sql"
```

```bash
# bash — same thing
stamp=$(date +%Y%m%d-%H%M)
mysqldump -h localhost -u root -p --single-transaction --routines \
  careeros > "careeros-backup-${stamp}.sql"
```

Automate daily via Task Scheduler (Windows) or cron (Linux), keep 14+
copies, and periodically restore one to a scratch database to prove it works.

## Restore

```powershell
mysql -h localhost -u root -p careeros < careeros-backup-20260101-0300.sql
```

Then start the backend with `SPRING_PROFILES_ACTIVE=prod` — `validate`
confirms the schema matches before serving traffic.

## Safe schema change process (Flyway)

Schema changes are **versioned migrations**, not hand-applied DDL. Full policy:
`docs/MIGRATIONS.md`.

1. Add a new `careeros-backend/src/main/resources/db/migration/V<n>__*.sql`.
   Never edit an already-applied migration; fix forward.
2. Test locally: `mvn -B -Dtest=MigrationScriptTest test` (fresh + upgrade +
   constraints on H2/MySQL mode). CI runs the same migrations and Hibernate
   validation against a disposable MySQL 8 (`MigrationMySqlIntegrationTest`).
3. **Back up production** (above). Record the current commit and
   `flyway_schema_history` version.
4. Review only additive/compatible changes. Destructive changes need a written
   data-migration and restore plan.
5. Deploy the backend. Flyway applies pending versions, then Hibernate
   `validate` confirms the schema. If either fails, the app stays down rather
   than corrupting data; restore the backup and fix forward.
6. Verify the latest successful version:
   `SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC;`

An existing pre-Flyway database is baselined at V1: V1 is recorded as
`BASELINE` and not executed, so existing data and ids are untouched. See
`docs/MIGRATIONS.md` for the drift caveat and forward-recovery steps.

## Docker Compose volumes

Production data lives in the `mysql-data` volume. Back up the database with
`mysqldump` (above, via `docker exec` against the `mysql` service), not by
copying volume files while MySQL runs:

```powershell
docker compose -f docker-compose.prod.yml exec mysql mysqldump -u root -p careeros > careeros-backup.sql
```
