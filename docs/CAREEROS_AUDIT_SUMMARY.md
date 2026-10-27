# CODEIT CareerOS — Stabilization and Audit Report

> **Status as of 2026-10-27 (later state).** This report replaces the earlier
> audit-only header for the current working tree. The audit evidence was
> gathered without production credentials or production data changes. Safe
> stabilization work was then implemented locally and is **not committed or
> deployed**. See section D for exact test results and section F for what was
> not verified.

## A. Executive verdict

### Existing student/admin product: **CONDITIONAL**

The existing product is materially healthier than the audit baseline: the
backend suite is green, the frontend dependency audit is clean, the production
build succeeds, and local public-route smoke checks pass. Durable consent
evidence, versioned migrations, immediate deactivation of sessions, and a
minimum admin audit trail now exist locally.

It is still **CONDITIONAL**, not GO, because:

- the deployed commit and live environment are unverified;
- tokens remain JavaScript-readable (`localStorage`); the full HttpOnly session
  migration is planned but not implemented;
- retention/deletion, DSAR export, and legal policy are unapproved and
  unimplemented;
- CI (including the real MySQL migration job and dependency scan) has not run
  on the repository host;
- no production schema copy has been compared with the Flyway baseline;
- monitoring/alerting, email verification/reset, staff MFA, upload malware
  scanning, and cross-instance rate limiting remain missing.

Local tests are not proof of production readiness.

### Requested College/TPO Phase 1: **NO-GO**

No tenant foundation was implemented. The role/permission matrix, institution
and membership model, migration/rollback strategy, and production schema
verification were not approved or supplied. Inventing them would create the
exact cross-college PII risk the audit identified. A concrete matrix for
approval is now in `docs/CAREEROS_COLLEGE_ROLE_MATRIX.md`; it is **not** an
implementation authorisation.

---

## B. Repository state and scope

- Branch `main`; HEAD `4b69c6e` (reported as the previously pushed commit;
  the remote was not re-checked).
- The earlier Phase 0 work described as “uncommitted” in the first report was
  already in HEAD; the tree was clean at the start of this change.
- This change is **uncommitted**. Nothing was committed, pushed, tagged,
  deployed, or published. No production database was contacted.
- Scope respected: no College/TPO screens, imports/exports, analytics, mock
  interviews, billing, AI features, or unrelated UI changes.
- A concurrent, unapproved College/TPO implementation appeared in the same
  working tree during this change (a `college/` package, `Role.PROFESSOR`, a
  duplicate `audit_events` mapping, and one NUL-corrupted file). With the
  user's explicit decision it was **preserved outside the build path**, not
  deleted: see section H.4.

---

## C. What changed

### C.1 Durable consent (replaces log-only evidence)

- New append-only `consent_records` table (Flyway V2), one row per
  `(user, consent_type, policy_version)`, with a unique constraint and a
  foreign key to `users`.
- Stored fields: consent type (`TERMS_AND_PRIVACY`), policy version, method
  (`REGISTRATION`, `GOOGLE_SIGN_IN`, `RECONSENT`), non-PII evidence label, and
  accepted-at timestamp. No IP address or user agent is stored.
- Password registration still requires `termsAccepted: true`; successful
  authentication alone never creates a record.
- New Google identities require the same explicit consent. **Existing** Google
  users keep signing in without being forced to re-consent.
- Legacy accounts are not locked out. Authentication responses now carry
  `consentRequired` and `consentPolicyVersion`; the account is flagged until it
  accepts the current policy.
- New endpoints (authenticated):
  - `GET /api/v1/auth/consent` — caller's own status and latest evidence;
  - `POST /api/v1/auth/consent` — explicit `termsAccepted: true`, idempotent
    for the same policy version.
- A policy-version change creates a new row and preserves history. Repeating
  the same acceptance returns the original row/timestamp.
- Default published policy version: `2026-10-26`
  (`app.privacy.policy-version`).
- Tests: `ConsentIntegrationTest` (8) and `GoogleSignInConsentIntegrationTest`
  (4), plus compatibility updates in auth tests.

### C.2 Versioned migrations (Flyway)

- Added `flyway-core` + `flyway-mysql`; Flyway owns the schema.
- `V1__baseline_existing_schema.sql` is the full pre-Flyway schema generated
  from the actual entity DDL.
- `V2__durable_consent_records.sql` adds `consent_records`.
- `V3__audit_events.sql` adds `audit_events`.
- Configuration: `baseline-on-migrate=true`, `baseline-version=1`,
  `validate-on-migrate=true`, `clean-disabled=true`.
  - **Fresh database:** V1→V3 execute.
  - **Existing database:** Flyway records V1 as `BASELINE` (does not execute
    it) and applies only V2/V3, preserving rows and ids.
- Dev `ddl-auto` changed from `update` to `validate`; prod remains `validate`.
  The H2 test profile keeps `create-drop` and disables Flyway for speed.
- `deploy-prod.sh` now always forces `JPA_DDL_AUTO=validate`, sets
  `FLYWAY_ENABLED=true`, and prints the latest successful
  `flyway_schema_history` version after the health check. The old one-time
  `ddl-auto=update` bootstrap was removed.
- Tests: `MigrationScriptTest` (fresh execution, upgrade/baseline with a legacy
  user row, constraints/indexes) and `MigrationMySqlIntegrationTest` (real
  MySQL 8, gated by env vars; runs in CI). Full policy and recovery steps:
  `docs/MIGRATIONS.md`.

### C.3 Authentication hardening

- `JwtAuthFilter` now loads the account and rejects a valid access token whose
  user is not `ACTIVE`. Previously a deactivated account kept working until
  token expiry.
- `AuthService.refresh` rejects non-`ACTIVE` accounts and revokes all their
  outstanding refresh tokens (`401`).
- Google sign-in rejects a deactivated account (`403`).
- `AuthNoStoreFilter` adds `Cache-Control: no-store` and `Pragma: no-cache` to
  `/api/v1/auth/**`.
- `SecurityConfig` no longer permits all `POST /api/v1/auth/**`; only the
  anonymous entry points (`register`, `login`, `google`, `refresh`, `logout`,
  `config`) are public. `/auth/me` and `/auth/consent` require authentication.
- Not done: full HttpOnly cookie session migration. Rationale, residual XSS
  risk, and a phased plan are in `docs/AUTH_SESSION_HARDENING.md`.

### C.4 Audit trail (minimum foundation)

- New append-only `audit_events` table (Flyway V3).
- An MVC interceptor records every `/api/v1/admin/**` request with actor id,
  actor role, `METHOD route`, target path, outcome, HTTP status, request id, and
  timestamp.
- `RestAccessDeniedHandler` records denied admin attempts that never reach a
  controller (outcome `DENIED`, status `403`).
- Deliberately **not** stored: request/response bodies, query strings, tokens,
  passwords, CV text, or other PII values.
- No read API, dashboard, retention job, or tenant-scoped audit yet. Platform
  admin actions only.
- Tests: `AuditTrailIntegrationTest` (successful admin write, validation
  failure, denied student access, no request-body leakage).

### C.5 Backend dependency scanning and CI

- Added an optional Maven `sca` profile pinning OWASP Dependency-Check
  **12.2.2**; CVSS ≥ 7.0 (HIGH/CRITICAL) fails the build.
- 13.0.0 was rejected: it aborts with
  `NvdApiException: Invalid API key, length of 0` when no key is configured.
- The NVD key is optional and read only from `NVD_API_KEY`; it is never stored
  in the POM or reports. Suppressions require a CVE, justification, owner, and
  expiry (process in `docs/DEPENDENCY_SECURITY.md`).
- CI now has three jobs: frontend lint/build/audit, backend `mvn -B verify`,
  MySQL 8 migration validation (`MigrationMySqlIntegrationTest`), and
  Dependency-Check with SARIF upload + dependency-tree/report artifacts.
- `.github/workflows/ci.yml` has **not** executed on the repository host.

### C.6 Documentation and design (no implementation)

- `docs/MIGRATIONS.md` — Flyway strategy, baseline caveat, verification,
  forward recovery.
- `docs/AUTH_SESSION_HARDENING.md` — current token risk, implemented fixes,
  cookie/CSRF migration plan, rollback.
- `docs/DATA_RETENTION_AND_DELETION.md` — full data inventory, external copies,
  policy decisions required, proposed FK-safe deletion order (not implemented).
- `docs/CAREEROS_COLLEGE_ROLE_MATRIX.md` — concrete platform-vs-institution
  role matrix, field visibility, unresolved decisions, minimum data model gate.
- `docs/DEPENDENCY_SECURITY.md` — scanning scope, threshold, exception process.
- Updated `docs/PRODUCTION.md`, `docs/BACKUP_RESTORE.md`, the requirements gap
  matrix, and the roadmap status to match the new state.

---

## D. Verification

### D.1 Backend

- JDK 21 (Temurin 21.0.12.1+1) and Maven 3.9.9.
- Command: `mvn -B verify`.
- Exact full-suite result: **320 tests, 0 failures, 0 errors, 2 skipped**
  (both real-MySQL tests), `BUILD SUCCESS` (2:05 min, exit code 0). The
  skipped tests are the real-MySQL gates; they are not passes and are not
  counted as verified.
- Focused runs also passed for consent, Google consent, auth security, audit,
  and migration tests.
- `MigrationMySqlIntegrationTest` is **skipped locally** (no MySQL/Docker); it
  runs in CI when `MYSQL_TEST_URL`, `MYSQL_TEST_USER`, and
  `MYSQL_TEST_PASSWORD` are set.

### D.2 Frontend

- `npm run lint`: pass, no errors or warnings.
- `npm run build`: `Compiled successfully`, all existing routes generated.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- No frontend code was changed for durable consent; the UI would need a
  consent prompt for legacy accounts (see D.5).

### D.3 Smoke and public routes

The previous local smoke run passed 9/9 (frontend health, legal routes, public
auth config, build identity, protected endpoint 401, Google route validation,
backend liveness/readiness). It was not re-run after this change because no
server was started.

### D.4 Not verified

- GitHub Actions execution (including the MySQL job and SCA).
- Docker image build, Compose startup, or any production migration.
- A production schema copy compared with V1, and a backup/restore drill.
- Real Google credential exchange and real AI-provider behavior.
- Live authenticated flows, deployment parity, DAST/fuzzing, container scan,
  load/soak test, cross-instance rate limiting.
- The full OWASP Dependency-Check result. The plugin is pinned and the CI job
  is wired, but the local scan could not reach `api.nvd.nist.gov` (DNS
  resolution failed), so **no local vulnerability result is claimed**; CI is
  the authoritative run and has not executed here.

### D.5 Known residual risk after this change

- **Legacy consent UX:** the backend flags `consentRequired`, but no frontend
  prompt was added. Legacy users can keep using the product without accepting
  the current policy until a UI prompt is built. This is deliberate (no
  lockout) and must be closed before claiming complete consent operations.
- **Token storage:** XSS can still read access/refresh tokens.
- **Retention/deletion:** no automated erasure or export.
- **Migration drift:** an existing production schema may differ from V1; only
  `validate` catches missing/incompatible columns.
- **Audit breadth:** platform admin routes only; no institution scope.

---

## E. Regression and compatibility

- **Backend:** full suite green; schema changes are additive (V2/V3). No
  production data touched.
- **API compatibility:** registration still requires `termsAccepted: true`.
  `AuthResponse` gained two fields (`consentRequired`,
  `consentPolicyVersion`); additive for JSON clients. New authenticated
  `/auth/consent` endpoints. No existing route removed.
- **Startup:** a database that Hibernate created previously will be baselined
  at V1 and receive V2/V3. A dev database created with old `update` DDL should
  validate; if not, recreate it (local only).
- **Sessions:** deactivated accounts are now cut off immediately; this is an
  intentional security fix. Existing active sessions keep working.
- **Deployment:** `deploy-prod.sh` no longer bootstraps with `ddl-auto=update`;
  it validates and reports the Flyway version. This changes the first-deploy
  procedure (documented).
- **Frontend:** no functional change in this pass; build/lint remain the gate.

---

## F. Deployment status

**Not deployed. No staging or production access was used.**

- The prior live inconsistencies remain presumed unresolved until a new
  deployment is verified: `/api/v1/auth/config` 401, `POST
  /api/v1/auth/google` 404, `/legal/privacy` 404, `/legal/terms` 404, and public
  backend `:8080` timeout.
- Docker is not available locally, so image and Compose startup were not
  exercised.
- Flyway V1–V3 exist and are locally tested on H2; real MySQL validation is
  wired in CI but has not run here.
- `scripts/smoke-deployment.sh` is ready for an authorized staging/production
  run once a deployment exists.
- No commit, push, image publish, or deploy was performed.

---

## G. Remaining blockers

### Existing product release

1. Real legal contacts and approved policy text.
2. Frontend prompt/flow for legacy `consentRequired` accounts.
3. Approved retention schedule, deletion, and DSAR/export process.
4. Live deployment parity and deployed-commit verification.
5. Production schema-copy comparison with V1; backup/restore drill; MySQL CI
   run.
6. CI execution on the repository host, including SCA and MySQL jobs.
7. Monitoring/alerting, email verification/reset, staff MFA, upload malware
   scanning, and cross-instance rate limiting.
8. Server-managed session strategy/BFF to remove tokens from `localStorage`.

### College/TPO Phase 1

1. Approved role/permission matrix separating platform admin from
   institution-scoped staff (`CAREEROS_COLLEGE_ROLE_MATRIX.md`).
2. Approved institution, department, program, batch, section, enrollment, and
   membership model.
3. Approved migration and rollback strategy, plus verification against a
   production schema copy.
4. Nationwide scope/ownership decision (brief vs PDF) and pilot institution.
5. Two-institution isolation, forged-ID, and field-visibility tests.
6. Staff onboarding, activation, deactivation, and role-change workflow.
7. College-scoped student/report/export authorization before any dashboard or
   CSV work.

---

## H. Files and migrations

### H.1 Main changed areas

- Consent: `ConsentType`, `ConsentMethod`, `ConsentRecord`,
  `ConsentRecordRepository`, `ConsentService`, `ConsentStatusResponse`,
  `ConsentAcceptRequest`, `AuthService`, `AuthController`, `AuthResponse`,
  `RegisterRequest`, `GoogleLoginRequest`.
- Auth security: `JwtAuthFilter`, `AuthNoStoreFilter`, `SecurityConfig`,
  `AuthService`.
- Audit: `AuditEvent`, `AuditEventRepository`, `AuditService`,
  `AdminAuditInterceptor`, `WebMvcConfig`, `RestAccessDeniedHandler`.
- Migrations: `V1__baseline_existing_schema.sql`,
  `V2__durable_consent_records.sql`, `V3__audit_events.sql`.
- Build/CI: `pom.xml` (Flyway, `sca` profile),
  `dependency-check-suppressions.xml`, `.github/workflows/ci.yml`,
  `deploy-prod.sh`, `application.yml`, `application-dev.yml`,
  `application-test.yml`.
- Tests: `ConsentIntegrationTest`, `GoogleSignInConsentIntegrationTest`,
  `AuditTrailIntegrationTest`, `MigrationScriptTest`,
  `MigrationMySqlIntegrationTest`, plus auth test updates.
- Documentation: `MIGRATIONS.md`, `AUTH_SESSION_HARDENING.md`,
  `DATA_RETENTION_AND_DELETION.md`, `CAREEROS_COLLEGE_ROLE_MATRIX.md`,
  `DEPENDENCY_SECURITY.md`, and updates to `PRODUCTION.md`,
  `BACKUP_RESTORE.md`, the gap matrix, and the roadmap.

### H.2 Migrations

- V1 baseline, V2 consent, V3 audit. They are additive; no existing table is
  dropped or rewritten. Existing databases baseline V1 and run V2/V3.
- No institution/staff/tenant tables were added. Those remain blocked on the
  approved matrix and model.

### H.3 Commit state

All application, configuration, workflow, script, and documentation changes are
**uncommitted** in the working tree. Nothing was committed, pushed, or
deployed.

### H.4 Concurrent unapproved work preserved

A separate active process wrote an unapproved College/TPO package into the same
tree during this change. It conflicted with the “no tenant schema before
approval” instruction, broke compilation (a NUL-filled
`CsvImportRowRepository.java`), and mapped a second entity to `audit_events`.
With the user's explicit decision, the complete package and the `Role.java`
change were copied to:

```text
C:\Users\bhave\AppData\Local\Temp\opencode\concurrent-college-work-20261027-1153\
```

and removed from `src/main/java` so the approved work could compile and be
verified. Nothing was deleted: the folder contains the package, `Role.java`,
`Role.patch`, and a README with restore instructions. It is outside the
repository and not part of the build. Do not restore it without the approved
matrix and versioned migrations.

---

## I. Next step

1. Obtain written approval of the role matrix, field visibility, unresolved
   decisions, and tenant model. Do not start College/TPO UI before this.
2. Obtain the real legal contact, consent prompt decision, and
   retention/deletion policy; add the approved deletion/export workflow.
3. Run the CI workflow on the repository host; confirm the MySQL migration job
   and dependency scan pass on the tested commit.
4. Deploy to staging only after authorization; compare production/staging
   schema with V1; run `scripts/smoke-deployment.sh`; verify
   `/api/v1/meta/version` and `/health` against the tested commit.
5. Then implement Phase 1A: canonical tenant structure, scoped staff
   memberships, invite-only onboarding, server-derived scope, tenant audit, and
   two-institution isolation tests.

Do not claim production readiness or College/TPO completion from local tests
alone.
