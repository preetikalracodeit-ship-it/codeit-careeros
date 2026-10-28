# CI Stabilization Work Report — 2026-10-28

## Executive summary

The backend and MySQL CI failures that were present at `e012277` have been fixed, committed, pushed, and confirmed in the hosted workflow.

- **Backend job:** now passes on `fc95099`.
- **MySQL migration job:** now passes on `fc95099`.
- **Frontend job:** passes.
- **Dependency scan (SCA):** still cancelled at its 30-minute timeout; this is the only job keeping the run from being fully green.

Two focused commits were pushed to `origin/main`:

| Commit | Summary |
|---|---|
| `f7b8091` | Isolate shared test data and quote the MySQL reserved word in `V4` |
| `fc95099` | Upload test reports on failure and cache NVD data for the SCA job |

Push: `e012277..fc95099 main -> main`  
Current HEAD: `fc950992be10ef45668b891f601e34321a1fd1e3`

No deployment was performed. The unrelated uncommitted Phase 1/College work was preserved.

---

## Starting point

- Main was at `e012277`.
- Latest failed run: https://github.com/preetikalracodeit-ship-it/codeit-careeros/actions/runs/40488571159
- Results at that commit:
  - Frontend: success
  - Backend: failure
  - MySQL migration: failure
  - Backend dependency scan: cancelled at 30 minutes
- The older guide run at `e7af1f6` (`40471921605`) described migration-discovery, missing-`users`-table, and FK-cleanup errors. Those were already addressed by `34bef00`; they were not the cause of the current failures.

---

## Root causes and fixes

### 1. MySQL migration failure — reserved word in `V4`

`V4__college_tenant_model.sql:183` used unquoted `row_number`, which is a reserved word in MySQL 8. H2 accepted it, so the H2 migration test passed while the MySQL job failed.

**Fix:** quote the identifier as `` `row_number` ``.

**Verification:**
- Disposable MySQL 8.0.43 on `127.0.0.1:3307`
- `MigrationMySqlIntegrationTest`: **2/2 passed**
- Flyway applied **4 migrations**
- Hibernate schema validation passed
- `MigrationScriptTest` (H2): **3/3 passed**, still **4 migrations**
- No migration count was lowered and `V1` was not edited.

The disposable MySQL server was stopped; port `3307` has no listener.

**Deployment caveat:** If any environment has a successful `V4` row in `flyway_schema_history`, do not deploy this edited file — the checksum has changed. Verify first:

```sql
SELECT version, checksum, success
FROM flyway_schema_history
WHERE version = '4';
```

If `success = 1`, use a forward migration or a controlled repair instead. The CI MySQL job uses a fresh database, so its success is valid.

### 2. Backend failure — shared H2 database and incomplete FK cleanup

The Spring test contexts share `jdbc:h2:mem:careerostest`. Several integration tests delete `careers` in `@BeforeEach` without first deleting rows that reference them.

First meaningful reverse-order failures:

- `ReportIntegrationTest.setUp:101` — `roadmap_phases.career_id` → `careers.id`
- `AssessmentExpiryIntegrationTest.setUp:113` — `student_profiles.target_career_id` → `careers.id`

The previous `34bef00` fix covered projects but not profiles or roadmaps. Alphabetical order masked the problem locally; reverse order exposed **25 errors across 7 test classes**. CI's default filesystem order is not guaranteed, which explains why a clean local alphabetical run was green while CI failed.

**Fix:**
- Added `careeros-backend/src/test/java/com/codeit/careeros/TestDataCleaner.java`.
- The cleaner deletes dependent assessment, roadmap, project, CV, LinkedIn, profile, career, and skill rows in foreign-key-safe order.
- It preserves users, consent records, audit events, and institution master data.
- Wired into 10 integration tests before their own setup.
- Foreign-key constraints remain enabled; no tests were skipped or disabled.

---

## Verification evidence

| Scope | Result |
|---|---|
| Clean `e012277` + fix, full `mvn -B verify` | **329 tests, 0 failures, 0 errors, 2 skipped — BUILD SUCCESS** (2:44) |
| Clean `e012277` + fix, reverse alphabetical | **329/0/0/2 — BUILD SUCCESS** (2:41) |
| Clean `e012277` before fix, reverse alphabetical | **329/0/25/2 — BUILD FAILURE** |
| Main working tree + fix, full `mvn -B verify` | **330/0/0/2 — BUILD SUCCESS** (3:27) |
| Focused MySQL migration test | **2/2 passed**, 4 migrations, BUILD SUCCESS (45.17s) |
| Main test compilation | BUILD SUCCESS |

Notes:

- The main working tree reports 330 because it includes the existing uncommitted Phase 1 test work. The CI-equivalent clean tree reports 329.
- The **2 skipped** in the H2 full suite are `MigrationMySqlIntegrationTest` when `MYSQL_TEST_URL` is absent. The focused MySQL run passes **2/2**; CI supplies the URL, so those tests run there.
- No tests were disabled; no schema validation was skipped; FK constraints were not disabled.

### Relevant local evidence logs

- `C:\Users\bhave\AppData\Local\Temp\opencode\careeros-ci-e012277\careeros-backend\target\reverse-order-tests.log`
- `...\reverse-order-after-cleaner.log`
- `...\full-verify-after-cleaner.log`
- `...\mysql-migration-e012277-fixed.log`
- `H:\Careeros\careeros-backend\target\full-verify-main.log`

---

## Changes delivered

### Commit `f7b8091` — test isolation and MySQL fix

- `careeros-backend/src/main/resources/db/migration/V4__college_tenant_model.sql`
- `careeros-backend/src/test/java/com/codeit/careeros/TestDataCleaner.java` (new)
- 10 integration tests wired to `TestDataCleaner`:
  - `assessment/AssessmentExpiryIntegrationTest.java`
  - `assessment/AssessmentFlowIntegrationTest.java`
  - `assessment/CareerAssessmentMappingIntegrationTest.java`
  - `assessment/AssessmentRandomizationIntegrationTest.java`
  - `cv/CvIntegrationTest.java`
  - `insight/CareerInsightIntegrationTest.java`
  - `linkedin/LinkedInIntegrationTest.java`
  - `progress/ProgressIntegrationTest.java`
  - `report/ReportIntegrationTest.java`
  - `roadmap/RoadmapProjectIntegrationTest.java`

`CvIntegrationTest` and `CareerAssessmentMappingIntegrationTest` already contained unrelated uncommitted Phase 1 edits. They were staged by blob so only the five `TestDataCleaner` lines were committed. Their pre-existing edits remain in the working tree.

### Commit `fc95099` — CI diagnostics and NVD cache

- Backend job uploads `careeros-backend/target/surefire-reports/` and Surefire dump files on failure (`if: always()`, 7-day retention).
- MySQL migration job uploads the same reports.
- SCA job caches `~/.m2/repository/org/owasp/dependency-check-data`.
- The scan, its CVSS threshold, and the 30-minute timeout were not changed.

The workflow YAML was validated with `js-yaml`. The cache path was verified against the dependency-check Maven plugin's actual default data directory.

---

## Hosted CI status

**Latest run:** https://github.com/preetikalracodeit-ship-it/codeit-careeros/actions/runs/40639434337

Run attempt 2, at `fc95099`:

| Job | Result |
|---|---|
| Frontend lint, build, dependency audit | **Success** |
| Backend tests and package | **Success** |
| MySQL migrations + Hibernate validate | **Success** |
| Backend dependency scan | **Cancelled** |

The overall run is **cancelled** only because of the SCA job.

### SCA details

- SCA job: https://github.com/preetikalracodeit-ship-it/codeit-careeros/actions/runs/40639434337/job/122668029842
- Started: `2026-10-28T06:26:32Z`
- Cancelled: `2026-10-28T06:56:59Z` (30-minute limit)
- `Cache NVD data`: completed
- `OWASP Dependency-Check`: **cancelled**
- SARIF upload: skipped
- Post-cache save: skipped, so no NVD cache was saved
- Dependency tree and report uploads: completed

The following runner messages are **not** the cause:

- `Terminate orphan process: pid (2442) (java)` — cleanup after the timed-out Java scan process.
- Node.js 20 deprecation warnings for `actions/*@v4` — the runner forces those actions onto Node 24; they still execute. Action upgrades can be handled separately.

No vulnerability conclusion can be claimed from the cancelled scan. The scan was not disabled and no findings were suppressed.

---

## Remaining blocker and proposed next step

The SCA job cannot save its NVD cache because every cold run is killed at 30 minutes. This creates a loop: no successful run means no cache, so the next run is cold again.

Recommended sequence:

1. Confirm the SCA log says `NVD API key: configured`. A numeric-only key is acceptable as a GitHub secret; verify it is the complete key.
2. Raise the SCA job timeout from 30 to 60 minutes for the first cold run. This should let the scan finish and save the NVD cache; later runs can be faster.
3. Rerun the SCA job and confirm the cache is saved.
4. If the log says `not configured`, fix the `NVD_API_KEY` repository secret first; a timeout increase alone will not fix a missing key.

The timeout change has **not** been made. It requires approval for another commit/push.

---

## Preserved work and blocked items

- The working tree still contains the extensive uncommitted Phase 1/College/auth/consent/frontend/docs work. It was not reset, cleaned, or included in the two CI commits.
- College/TPO remains blocked pending the written role-matrix and tenant-model approval. The V4 fix is a schema portability fix, not feature approval.
- Retention/deletion/DSAR and the full cookie/session migration remain policy- or design-blocked.
- No staging or production access was used; no deployment was performed.
- The disposable MySQL server is stopped.

---

## Next actions

1. Check the SCA log for `NVD API key: configured`.
2. Approve the one-line SCA timeout increase to 60 minutes and push it.
3. Monitor the next run: frontend/backend/MySQL should remain green; SCA should complete and save the cache.
4. Before any deployment, verify `flyway_schema_history` has no successful `V4`.
5. Optionally upgrade GitHub Actions majors to remove the Node 20 deprecation warnings; do this separately from the SCA timeout fix.

---

*This report was generated from the work completed in this session on 2026-10-28. It is currently uncommitted.*
