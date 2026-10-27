# CODEIT CareerOS — Stabilization and Audit Report

> **Status as of 2026-10-27.** This report replaces the earlier audit-only header for the current working tree. The audit evidence below was gathered without production credentials or production data changes. Safe stabilization work was then implemented locally and is **not committed or deployed**.

## A. Executive verdict

### Existing student/admin product: **CONDITIONAL**

The existing product is materially healthier than the audit baseline: the backend suite is green, the frontend dependency audit is clean, the production build succeeds, and local public-route smoke checks pass. It is still **CONDITIONAL** because deployment parity, durable consent evidence, legal contacts, migration discipline, and several operational controls remain unproven or incomplete.

### Requested College/TPO Phase 1: **NO-GO**

No tenant foundation was implemented. The role/permission matrix, institution and membership model, migration/rollback strategy, and production schema verification were not approved or supplied. Inventing them would create the exact cross-college PII risk the audit identified. No college dashboard, CSV workflow, export, mock interview, or staff screen was built.

**Overall:** **CONDITIONAL for the existing student/admin product; NO-GO for the requested College/TPO Phase 1.** Do not present the current application as a college/TPO platform.

---

## B. Baseline

| Item | Value |
|---|---|
| Repository | `H:\Careeros` |
| Branch | `main` |
| Baseline commit | `1e00bdb38d596175b71668dd2521f61f4008ca2e` — 2026-10-26 16:57:57 +0530 — “Add navigation links for Privacy Policy and Terms of Service in footer” |
| Working tree at baseline | Five audit documents modified; no application changes |
| Backend | Spring Boot 3.5.4, Java 21, MySQL 8/H2 tests, Maven |
| Frontend | Next.js 16.3.5 at baseline; React 19.2.8; JavaScript/JSX |
| Prior backend result | 278 tests, 1 failure, `BUILD FAILURE` |
| Prior frontend audit | 12 vulnerabilities (1 critical, 8 high, 3 moderate) |
| Prior CI | None |
| Prior live observations | `/api/v1/auth/config` 401, `POST /api/v1/auth/google` 404, legal routes 404, public backend `:8080` timed out |
| Current environment | Node `v24.17.0`, npm `11.4.1`, JDK 21.0.12.1, Maven 3.9.9, Windows 11 |

No production data, secret, migration, or deployment was used or changed.

---

## C. Changes by category

### C.1 Dependency, test, and build stabilization (Phase 0A)

- Upgraded `next` and `eslint-config-next` from `16.3.5` to `16.4.3`.
- Raised the direct `shadcn` floor from `4.21.0` to `4.22.1`.
- `npm audit --audit-level=high` now reports **0 vulnerabilities**.
- Corrected the stale Gemini test expectation from `gemini-2.0-flash` to `gemini-2.5-flash` and added `AiPropertiesTest`.
- Added `.github/workflows/ci.yml`:
  - frontend `npm ci`, lint, production build, and high/critical audit;
  - backend `mvn -B verify`.
- CI has **not** been executed on GitHub because nothing was pushed.

### C.2 Deployment and API consistency (Phase 0B)

- Added Maven build-info generation and a public, non-sensitive `GET /api/v1/meta/version` returning service, version, build time, and optional commit.
- Added public liveness/readiness probes:
  - `/actuator/health/liveness` — process only;
  - `/actuator/health/readiness` — process plus database.
- Added a frontend `GET /health` route with service, status, and version.
- Added `RequestIdFilter`, `X-Request-Id` response headers, and MDC correlation logging.
- Added `scripts/smoke-deployment.sh` for frontend health, legal routes, auth config, build identity, protected-route denial, Google-route existence, and optional backend probes.
- Passed legal-contact and version build arguments through the frontend Docker image and Compose.
- Added runtime `APP_VERSION` to the frontend service so `/health` reports the deployed value rather than `unknown`.
- Added `APP_BUILD_COMMIT`, `APP_VERSION`, `PRIVACY_POLICY_VERSION`, and trusted-proxy configuration to `.env.example`.
- `deploy-prod.sh` now records the git-derived build identity when the operator has not supplied one, and prints it in the deployment summary.

### C.3 Auth and browser hardening (Phase 0C)

- Replaced the JavaScript-readable access-token cookie with a non-sensitive `careeros_role` routing hint.
- Kept legacy `careeros_token` reads during migration; the legacy cookie is removed on the next successful session save and on logout.
- `proxy.js` still treats the role cookie only as a UX hint; backend JWT authorization remains authoritative.
- Added `Content-Security-Policy-Report-Only`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and `poweredByHeader: false`.
- Hardened `AuthRateLimitFilter`:
  - trusts `X-Forwarded-For` only from configured proxy CIDRs;
  - uses the closest untrusted hop rather than the client-supplied left-most value;
  - bounds tracked clients with an overflow bucket and periodic purge;
  - fixes the `Map.of(..., "data", null)` `NullPointerException` on 429 responses.
- Added `AuthRateLimitFilterTest` covering direct spoofing, trusted proxies, proxy chains, and invalid CIDRs.
- CSP is report-only because the current Next.js rendering model uses inline bootstrap scripts/styles. It is not yet an enforcement boundary.
- Tokens remain in `localStorage`; moving to server-managed cookies/BFF is still recommended.

### C.4 Privacy and consent (Phase 0D)

- Added `termsAccepted` to registration and Google-login contracts.
- New email/password registrations require explicit `termsAccepted: true`.
- New Google identities require consent; **existing** Google accounts can still sign in without re-consenting.
- Added `app.privacy.policy-version`, default `2026-10-26`, and consent logging with user ID, method, and policy version.
- Registration now links the actual Terms and Privacy pages and sends consent only after the checkbox is accepted.
- Google signup is hidden until consent is checked; the sign-in page sends `termsAccepted: false`, which prevents new account creation through the sign-in path while preserving existing-user login.
- Replaced fake legal contact addresses with owner-supplied `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` and `NEXT_PUBLIC_LEGAL_WEBSITE` values. When absent, the pages explicitly say the contact is not configured rather than displaying an invented address.
- Consent evidence is currently **application-log only**. No durable consent table, retention job, deletion workflow, or subject-access workflow was added because the migration strategy and production schema are unresolved.

### C.5 College/TPO tenant foundation (Phase 1A)

**Not implemented.** No institution, department, program, batch, section, enrollment, staff membership, `PROFESSOR`, TPO/HOD/faculty/college-admin role, invite flow, tenant scope, or isolation test was added. No schema or migration was invented. The existing `ADMIN` role remains platform-wide and must not be reused as a college role.

---

## D. Testing evidence

### D.1 Backend

Command:

```text
mvn -B verify
```

Result on JDK 21 / Maven 3.9.9 / H2 test profile:

```text
Tests run: 298, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

This includes the full controller/service/repository suite, the new operational endpoint tests, rate-limit tests, consent/registration compatibility updates, and AI tests. No test was weakened or skipped to obtain a pass.

### D.2 Frontend

| Command | Result |
|---|---|
| `npm run lint` | Exit 0, no findings |
| `npm run build` | Success on Next.js 16.4.3; 30 routes generated |
| `npm audit --audit-level=high` | `found 0 vulnerabilities` |

The build includes static legal routes, dynamic `/health`, and the existing student/admin routes.

### D.3 Local standalone smoke

Backend was run with the `test` profile; the frontend was run from the production standalone build. Results:

```text
PASS  frontend health (200)
PASS  privacy policy route (200)
PASS  terms route (200)
PASS  public auth config (200)
PASS  public build identity (200)
PASS  protected endpoint remains protected (401)
PASS  Google sign-in route exists (400 validation)
PASS  backend liveness (200)
PASS  backend readiness (200)

Smoke result: 9 passed, 0 failed.
```

Additional local checks:

- legal pages contain no `your-college.edu` placeholder and show the explicit “not been configured” notice when contacts are absent;
- `Content-Security-Policy-Report-Only`, `Cross-Origin-Opener-Policy`, HSTS, and `X-Content-Type-Options` are present;
- `X-Powered-By` is absent;
- `/api/v1/meta/version` returns a non-empty version, build time, and commit;
- registration without consent returns `400` with “You must accept the Terms of Service and Privacy Policy to create an account.”

### D.4 Not verified

- Live/staging deployment parity or live authenticated flows.
- GitHub Actions execution (workflow is local only).
- Docker image build, Compose startup, or production migration.
- Real Google credential exchange and real AI-provider behavior.
- Backup restore drill, load/soak test, DAST/fuzzing, container scan, or Maven dependency vulnerability scan.
- Cross-instance rate limiting.

---

## E. Regression assessment

- **Backend:** full suite green; no schema change; no production data touched.
- **Frontend:** lint and production build pass; existing routes remain present.
- **API compatibility:** new clients must send `termsAccepted: true` to register; older registration clients now receive `400` by design. Google login accepts a missing/false consent flag for existing accounts and rejects new account creation. This is an intentional legal gate, not a silent break.
- **Sessions:** existing token-cookie sessions remain readable through the legacy path; the role cookie is written on the next login/session save. Logout clears both.
- **Security posture:** 429 responses no longer crash; rate-limit keys are bounded and spoof-resistant behind configured proxies. In-memory limiting is still not reliable across multiple backend instances.
- **Residual XSS risk:** access and refresh tokens remain in `localStorage`; the role cookie is only a routing hint and is not an authorization boundary.
- **Residual legal risk:** consent evidence is in logs, not a durable database record; legal contacts and retention/deletion policy remain owner decisions.
- **Deployment risk:** the backend remains published on host port `8080` in Compose, and deployment parity is unproven. Existing live drift was not repaired by local code changes.

---

## F. Deployment status

**Not deployed. No staging or production access was used.**

- The prior live inconsistencies remain presumed unresolved until a new deployment is verified: `/api/v1/auth/config` 401, `POST /api/v1/auth/google` 404, `/legal/privacy` 404, `/legal/terms` 404, and public backend `:8080` timeout.
- Docker is not available locally, so image and Compose startup were not exercised.
- The repository has no validated migration path; production uses `ddl-auto=validate` after a one-time bootstrap.
- `scripts/smoke-deployment.sh` is ready for an authorized staging/production run once a deployment exists.
- No commit, push, image publish, or deploy was performed.

---

## G. Remaining blockers

### College/TPO Phase 1

1. Approved role/permission matrix separating platform admin from institution-scoped staff.
2. Approved institution, department, program, batch, section, enrollment, and membership model.
3. Approved migration and rollback strategy, plus verification against a production schema copy.
4. Durable audit/consent evidence and retention/deletion policy.
5. Two-institution isolation, forged-ID, and field-visibility tests.
6. Staff onboarding, activation, deactivation, and role-change workflow.
7. College-scoped student/report/export authorization before any dashboard or CSV work.

### Existing product release

1. Real legal contacts and approved policy text.
2. Durable consent record and privacy rights/retention workflow.
3. Live deployment parity and deployed-commit verification.
4. Migration discipline and backup/restore evidence.
5. Monitoring/alerting, email verification/reset, MFA for staff/admin, upload malware scanning, and backend dependency scanning.
6. Cross-instance rate limiting or an edge limiter.
7. Server-managed session strategy or a BFF to remove tokens from `localStorage`.
8. CI execution on the repository host, not just a local workflow file.

---

## H. Files and migrations

### Main changed areas

- Backend auth/consent: `AuthService.java`, `AuthController.java`, `RegisterRequest.java`, `GoogleLoginRequest.java`.
- Backend security/ops: `AuthRateLimitFilter.java`, `RequestIdFilter.java`, `MetaController.java`, `application.yml`, `pom.xml`.
- Backend tests: new `AiPropertiesTest`, `OperationalEndpointsIntegrationTest`, `AuthRateLimitFilterTest`; consent compatibility updates across existing integration tests.
- Frontend auth/privacy: `lib/auth.js`, `proxy.js`, `app/register/page.jsx`, `components/auth/google-signin.jsx`, legal components.
- Frontend operations/security: `next.config.mjs`, `app/health/route.js`, `Dockerfile`.
- Deployment/configuration: `docker-compose.prod.yml`, `.env.example`, `deploy-prod.sh`, `.github/workflows/ci.yml`, `scripts/smoke-deployment.sh`.
- Documentation: the five `docs/CAREEROS_*.md` files and `docs/PRODUCTION.md`.

### Migrations

**No database migration was added.** No table, column, index, role, institution, membership, or consent record was created. Production schema changes remain blocked pending an approved migration strategy and schema verification.

### Commit state

All application, configuration, workflow, script, and documentation changes are **uncommitted** in the working tree. Nothing was committed, pushed, or deployed.

---

## I. Next step

1. Obtain owner approval for the exact role/permission matrix, institution/membership model, and migration/rollback plan. Do not start College/TPO UI before this.
2. Obtain the real legal contact and policy decisions; add durable consent/retention/deletion records with the approved migration.
3. Deploy the current stabilization branch to staging only after authorization, run `scripts/smoke-deployment.sh`, and compare `/api/v1/meta/version` plus `/health` against the tested commit.
4. Add backend dependency scanning and execute the new CI workflow on the repository host.
5. Then implement Phase 1A: canonical tenant structure, scoped staff memberships, invite-only onboarding, server-derived scope, audit foundation, and two-institution isolation tests.

Do not claim production readiness or College/TPO completion from local tests alone.
