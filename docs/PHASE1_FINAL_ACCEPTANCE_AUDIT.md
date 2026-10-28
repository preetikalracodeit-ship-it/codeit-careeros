# CODEIT CareerOS Campus Career & Placement Hub - Final Acceptance Audit

**Audit date:** 2026-10-28  
**Branch / baseline:** `main` at `fc95099` plus uncommitted Phase 1-4 implementation changes  
**Scope:** College/TPO readiness (Phase 1), improvement plans (Phase 2), companies/jobs/drives (Phase 3), and placement analytics/reports (Phase 4)  
**Verdict:** **CONDITIONAL - local implementation and automated verification pass; staging/production approval is not granted.** MySQL 8 migration parity for V5, a real staging deployment, email delivery, imported-student credential activation, browser/manual accessibility checks, and product/privacy-owner sign-off remain open.

This audit follows the current user-provided Campus Career & Placement Hub brief. The repository's existing requirements matrix records a scope conflict with the checked-in developer PDF, which labels College/TPO as a later phase. The current brief was used as this task's scope; the authoritative product document still needs reconciliation before release.

## Requirement matrix

`PASS` means the behavior was exercised in this environment by an automated test or a reproducible local command. `PARTIAL` means implemented but dependent on an unexecuted environment or policy gate. `BLOCKED` means the evidence cannot be produced locally.

| Requirement area | Expected behavior | Evidence | Status |
|---|---|---|---|
| Phase 1 - tenancy and academic structure | Institution, academic hierarchy, enrollment, server-derived tenant scope, cross-tenant isolation | V4 schema; `CollegeScope`, `CollegeAccessService`, scoped repositories; `CollegeIntegrationTest.crossTenant_andDepartmentScope_areEnforced`; forged enrollment/department/section IDs denied. | PASS (H2) |
| Phase 1 - roles, staff and invitations | Platform admin separated from college roles; scoped staff, memberships, invitations, field visibility, authorization | `Role.PROFESSOR`; staff designations; SHA-256 invitation tokens, 48-hour expiry, single use, pessimistic acceptance locking; platform-admin membership management restricted to college administrators; faculty section scope. | PASS (H2) |
| Phase 1 - CSV import/export | Validated preview/commit, duplicate/relationship checks, row feedback, safe export | `StudentCsvService`, `CsvImportRowProcessor`; file/type/header/quote validation, row cap, 24-hour file-hash block, preview cleanup, formula neutralization, CV contents excluded. | PASS (H2) |
| Phase 1 - student 360 and dashboard | Scoped student search/list/detail, filters, readiness profile, field-level privacy; real cohort metrics and comparisons | `StudentService`, `/api/v1/college/students`, `/api/v1/college/dashboard`; foreign IDs return 404; sensitive fields withheld by current policy; historical trend explicitly unavailable rather than fabricated. | PASS (H2) |
| Phase 1 - reports and audit | Scoped CSV/PDF reports, role checks, auditability, privacy | `CollegeCsvReportService`, `CollegeReportService`; five CSV types and scoped PDFs; append-only `audit_events`; audit details omit passwords, tokens, invitation secrets, full CVs and free-form PII. | PASS (H2) |
| Phase 2 - improvement plans | Generate plans only from assessed skill gaps below target; manual plans; task ownership/dates/status; student self-service | `ImprovementPlanService`, `CollegeImprovementPlanController`, `StudentImprovementPlanController`; missing assessment evidence returns a bad request rather than inventing a gap; student task updates are audited. | PASS (H2) |
| Phase 2 - plan authorization | All college staff can view in scope; `COLLEGE_ADMIN`/`TPO`/`HOD` create/edit; `FACULTY` read-only; students update only their own task status | `CollegeScope` permission helpers; `CollegePhase234IntegrationTest.improvementPlans_areScopedAndEvidenceGated`; faculty create returns 403; foreign-tenant plan returns 404. | PASS (H2) |
| Phase 3 - companies, jobs and drives | Institution-scoped company/job/drive management, hierarchy-aware drive visibility, eligibility targets, dates, readiness threshold | `PlacementService`, `CollegePlacementController`; drive targets are resolved and compared with the staff member's academic scope; mismatched department/program, program/batch and out-of-range graduation-year targets are rejected; drive PUT clears removed optional targets. | PASS (H2) |
| Phase 3 - applications, stages and offers | Student registration/withdrawal, eligibility checks, staff overrides with reason, stage history, offers, acceptance/decline/joining | `PlacementService`, `StudentPlacementController`; duplicate registration returns 409; ineligible registration is rejected without override; overrides are audited; offers and joining outcomes are modeled separately; non-joined offer updates clear stale joining dates; withdrawal withdraws a non-joined offer. | PASS (H2) |
| Phase 3 - placement authorization | `COLLEGE_ADMIN`/`TPO` manage; `HOD` views scoped placement data; `FACULTY` has no placement access; company contacts and free-form company notes hidden from `HOD`/`FACULTY` | Permission checks in `CollegeScope` and `PlacementService`; `CollegePhase234IntegrationTest` asserts cross-tenant 404, HOD mutation 403, and contact/notes redaction. | PASS (H2) |
| Phase 4 - analytics and exports | Documented denominators, distinct-student offer/joining metrics, department/company/stage breakdowns, scoped CSV export | `PlacementAnalyticsService`; eligible graduating students are active students in graduating batches; offers, accepted offers and joined students use distinct students; CSV export is capped at 10,000 data rows, formula-neutralized, audited, and excludes CV contents. | PASS (H2) |
| Secure migrations and recovery | Additive versioned migrations, backup/recovery plan, MySQL compatibility | Flyway V1-V5; `MigrationScriptTest` applies V1-V5 on H2; `MigrationMySqlIntegrationTest` is skipped without MySQL credentials. | BLOCKED (MySQL) |
| Local regression | Automated backend and frontend gates | Full `mvn clean verify`; `CollegeIntegrationTest`; `CollegePhase234IntegrationTest`; frontend lint/build. | PASS (local) |
| Staging/production acceptance | Actual staging deployment, runtime configuration, email, browser checks, backup/restore rehearsal | No staging credentials/environment were available or used. No deployment was performed. | BLOCKED |

## Local/test evidence (executed)

- **Backend:** `mvn -B clean verify` - **333 tests, 0 failures, 0 errors, 2 skipped**, `BUILD SUCCESS` with Temurin JDK 21. The two skipped tests are the MySQL-only migration tests.
- **Phase 1 college integration:** `CollegeIntegrationTest` - **9 tests, 0 failures, 0 errors**. Covers invitation single-use/expiry, cross-tenant and department scope, forged IDs, CSV abuse/formula neutralization, scoped search/dashboard/PDF reports, audit creation, existing-account password linking, bootstrap membership guard, and platform-admin institution/administrator management.
- **Phase 2-4 integration:** `CollegePhase234IntegrationTest` - **3 tests, 0 failures, 0 errors**. Covers placement tenant/department scope, hierarchy-aware drive visibility, forged drive IDs, invalid eligibility relationships and graduation-year values, HOD read-only behavior, student eligibility and duplicate registration, audited overrides, stage/offer/joining flow, stale joining-date cleanup, student withdrawal of a non-joined offer, analytics denominators, CSV formula neutralization, improvement-plan scope, evidence-gated generation, and audit creation.
- **Migrations:** `MigrationScriptTest` - **3 tests, 0 failures, 0 errors**. Flyway applies V1-V5 on H2, including the additive Phase 2-4 schema.
- **Frontend:** `npm run lint` passed with no warnings. `npm run build` passed and generated **45 routes**, including `/college/plans`, `/college/placement`, `/college/placement/analytics`, `/college/placement/drives/[id]`, `/student/improvement-plan`, and `/student/placements`.
- **Dependencies:** production dependency audit remains clean after moving the `shadcn` CLI to `devDependencies`; the dev-only tooling chain retains low-severity findings and does not ship in production.
- **Repository hygiene:** no commit, push, deployment, or image publication was performed. `git diff --check` reports only line-ending conversion warnings, not whitespace errors.

## Staging/production evidence (not executed)

- MySQL 8 migration and schema parity for V5.
- Real staging deployment with production-like proxy, environment variables, storage and database.
- Invitation email delivery and imported-student credential activation/recovery.
- Browser, responsive and accessibility checks for the new college/student pages.
- Backup and restore rehearsal against a production-sized database.
- CI execution on the repository host.
- Product/privacy-owner approval of field visibility and retention for placement and improvement-plan data.

## Security and tenant isolation

- Institution and academic scope are derived from the authenticated user's active membership; request parameters cannot widen scope.
- Platform `ADMIN` is not a college role and has no implicit access to `/api/v1/college/**`; this is asserted in the integration suites.
- Lists, details, counts, dashboards, reports, exports and document downloads apply institution predicates; foreign identifiers return not-found.
- Placement drive visibility is hierarchy-aware: department, program and batch targets are resolved and compared against the staff member's academic scope. `HOD` cannot open a drive outside their department.
- Student self-service paths resolve the student profile from the authenticated principal, never from a client-supplied profile or enrollment ID.
- Invitations use a SHA-256 token hash, 48-hour expiry, single use, pessimistic acceptance locking, masked public email, and no plaintext password. Existing accounts must prove their password before linking.
- Platform administrators can edit institution profile and suspend/reactivate college administrators, but cannot manage non-administrator staff through that endpoint and cannot remove the last active administrator. The membership listing is server-filtered to college administrators.
- Student PII/CV visibility is currently denied by field-level policy; this is conservative and requires product/privacy approval before widening.
- Imported new student accounts receive a random unusable password; there is no credential delivery or activation flow yet.
- Audit actions for improvement plans, placement management, student placement actions and placement exports are durable and append-only. Audit details omit secrets, full CVs and unnecessary PII.

## CSV and reporting

- Preview and commit are separate; staging rows are short-lived and cleaned up on commit and by a scheduled purge.
- File extension, MIME type, size, row count, header uniqueness, quoting and academic relationships are validated.
- Duplicate accounts are avoided; same-file hash is blocked for 24 hours.
- Formula-leading values are neutralized in student and placement exports; CV contents are never included in CSV exports.
- Student exports and placement analytics exports are capped at 10,000 data rows and are audited.
- Placement analytics uses documented denominators and reports unavailable historical trends as unavailable rather than fabricating history.

## Database and deployment sequence

No production database was changed and no migration was run outside H2.

1. Take a verified MySQL backup and record the current commit and `flyway_schema_history` version.
2. Run the MySQL 8 migration job on a disposable copy of the production schema (`MigrationMySqlIntegrationTest` with `MYSQL_TEST_URL`, `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD`).
3. Confirm Hibernate `validate` succeeds and compare the schema with V1 for drift, including the V5 improvement-plan and placement tables.
4. Deploy the application with `JPA_DDL_AUTO=validate` and `FLYWAY_ENABLED=true`.
5. Verify `/api/v1/meta/version`, health, login, invitation acceptance, one scoped student import/export, one scoped improvement plan, one scoped placement drive/application/offer flow, one placement analytics export, and cross-college denial with synthetic data.
6. Roll back the application if needed; migrations are additive. Do not edit applied migrations or run `flyway clean`.

## Remaining risks and release actions

1. **MySQL parity is unverified.** H2 migration tests prove ordering and data preservation, not exact MySQL type/index parity for V4 or V5.
2. **No staging evidence.** Deployment, runtime configuration, proxy routing, email and backup/restore remain unverified.
3. **Invitation email is not configured.** The API reports `emailDelivered=false`; activation links must currently be delivered manually.
4. **Imported student credentials are unusable.** An approved activation/password-reset delivery path is required before calling imported onboarding operational.
5. **Field visibility and retention policy need owner approval.** Current defaults withhold sensitive student fields; placement/improvement-plan retention is not yet approved.
6. **Sole-administrator recovery is manual.** If the only college administrator is unreachable, platform admin cannot suspend them; the operator must use a controlled recovery procedure.
7. **Product/phase mapping conflict.** The checked-in developer PDF and the current Phase 1-4 brief still need reconciliation.
8. **CI has not run on the repository host.** The workflow exists but no CI run evidence is available here.
9. **New pages need browser/manual checks.** Automated lint/build and backend integration pass, but responsive layout, keyboard navigation and screen-reader behavior for the new college/student placement pages were not manually exercised.

## Verdict

**CONDITIONAL.**

Local implementation, backend regression, tenant-isolation, invitation, CSV, reporting, Phase 2-4 integration and frontend build gates pass. Staging/production approval requires the MySQL V5 migration, a real staging deployment, credential-delivery/activation decisions, browser/manual accessibility checks, and product/privacy-owner sign-off listed above. No commit, push, deployment, or publication is authorized by this audit.
