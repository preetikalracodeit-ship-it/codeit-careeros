# CODEIT CareerOS — Technical Discovery

> **Audit record with a post-audit remediation addendum.** This file records what existed at the audit baseline and what was observed on the live site. The audit itself did not implement, migrate, deploy, or change application behavior. Later stabilization changes are uncommitted and are summarized in [CAREEROS_AUDIT_SUMMARY.md](CAREEROS_AUDIT_SUMMARY.md); the baseline findings retain their historical evidence value.

> **Current working tree (2026-10-27, later state):** Next.js `16.4.3`; backend `mvn -B verify` = 320 tests, 0 failures, 0 errors, 2 skipped (both real-MySQL tests); frontend lint/build pass; `npm audit --audit-level=high` = 0 vulnerabilities. Flyway V1–V3, durable consent records, platform-admin audit events, immediate deactivation invalidation, and CI jobs for MySQL migration and OWASP Dependency-Check are present locally. The CI workflow has not run on the repository host, the local SCA could not reach NVD, and the live deployment has **not** been re-verified or redeployed. Baseline findings below retain their historical evidence value; see the summary for current status.

## 0. Audit metadata

| Item | Value |
|---|---|
| Audit window | 2026-10-26 to 2026-10-27 |
| Repository | `H:\Careeros` |
| Branch | `main` |
| Audit baseline commit | `72f9a8d` — 2026-10-16 12:33:47 +0530; this is the code the tests and review were run against |
| Final repository HEAD | `1e00bdb` — 2026-10-26 16:57:57 +0530; adds privacy/terms pages and footer links after the initial review |
| Baseline subject | Google Sign-In runtime fallback: public GET /auth/config plus frontend fallback and deploy logging |
| Live site checked | `https://careeros.codeitinfotech.com` |
| Backend | Spring Boot 3.5.4, Java 21, MySQL 8, Maven |
| Frontend | Next.js 16.3.5 at audit baseline; 16.4.3 in the current uncommitted working tree; React 19.2.8, JavaScript/JSX |
| Audit method | Repository inspection, code-path review, existing automated tests, production build, `npm audit`, and unauthenticated public HTTP checks |
| Change policy | The audit itself changed no application code, schema, production data, migration, deployment, or secret; subsequent remediation is uncommitted and listed in the audit summary |

**Evidence limits**

- No production login was performed and no student, staff, or admin credentials were used.
- No staging environment was available, so authenticated live workflows could not be exercised end to end.
- No server/container access was available, so the deployed backend commit and nginx configuration could not be read directly.
- No penetration test, fuzzing, load test, or browser automation suite was run.
- The available product PDF is not the same requirement set as the audit brief. The conflict is documented in section 2.
- The repository received unrelated privacy-policy/terms/footer commits during the audit. They were rechecked; they do not change the Phase 1 gap analysis, but they add a legal/consent finding and are not deployed live (`/legal/privacy` and `/legal/terms` return 404).

---

## 1. Executive technical assessment

The repository is a working, reasonably structured **student career-readiness product** with a Spring Boot API, MySQL persistence, and a Next.js frontend. The existing student flows are substantially implemented and have meaningful backend integration tests: registration/login, profile, career selection, assessments, scoring, readiness, roadmap, projects, CV analysis, LinkedIn analysis, progress, reports/PDF, and an AI assistant with an offline fallback. Admin content management for careers, skills, assessments, questions, and competency frameworks is also implemented.

The repository is **not** a college/TPO platform. It has:

- two roles only, `STUDENT` and `ADMIN`;
- no canonical college/institution, department, program, batch, section, or academic-year model;
- no `PROFESSOR` or TPO/HOD/faculty/college-administrator authorization model;
- no college-scoped student queries, dashboards, reports, CSV import/export, mock-interview module, tenant isolation, or audit-log table;
- no database migration mechanism after first deployment.

There is also a **live deployment inconsistency**: the frontend bundle contains the newer Google Sign-In/config code, but the live backend returns `401` for `GET /api/v1/auth/config` and `404` for `POST /api/v1/auth/google`. The repository code would permit the config route and expose the Google route. This means the live backend is older than the frontend or is routed to a stale backend. Google Sign-In is therefore broken on the live site even though it exists in the repository.

Under the brief's expanded **college/TPO Phase 1**, the platform is effectively at the foundation stage. Under the repository PDF's narrower Phase 1, the student core is strong, but admin report access, admin roadmap/project management, persisted readiness/report/audit records, and a clean CI/release gate are still incomplete.

---

## 2. Scope and documentation conflict

### 2.1 Available documentation

The only product/developer specification found is:

- `docs/CODEIT_CareerOS_Developer_Documentation.pdf`

No separate v1.0 specification dated 13 October 2026 was found in the repository.

The PDF describes:

- **Phase 1 — Core CareerOS:** student registration/login, profile/education, career selection, skill assessment, results, gap analysis, readiness score, roadmap, CV upload/analysis, LinkedIn analysis, project recommendations, progress tracking, AI assistant, PDF report; and admin login, student/career/skill/category/question/assessment/competency/roadmap/project/AI configuration/report access/dashboard.
- **Phase 2:** progress tracking, mock interviews, AI project mentor, daily tasks, advanced assessments, college dashboard, OJT management, internship management.
- **Phase 3:** employer portal, recruitment, job matching, campus hiring, college multi-tenancy, employer search, candidate shortlisting.

The PDF also says the first version does not need full college functionality and that multi-tenancy should be implemented when college deployment begins. Its example technology stack mentions PostgreSQL, while this repository uses MySQL.

### 2.2 Conflict with the audit brief

The audit brief treats college/TPO functionality, staff roles, CSV student import, college dashboards, mock interviews, and college-level isolation as **Phase 1**. The repository PDF explicitly defers the College/TPO portal and multi-tenancy to later phases.

This audit follows the brief as the controlling scope because the brief is the current request. However, the conflict is a first-order finding:

- The codebase is not "missing Phase 1" because the team ignored a college Phase 1; the repository's own Phase 1 was a student/admin product.
- The brief's Phase 1 is a **new product phase** over the existing student core, not a completion of the PDF's Phase 1.
- The Phase 1 label must be re-baselined and signed off before implementation. Building college dashboards against an unresolved definition will create rework.

### 2.3 Decision on the stack

This audit preserves the existing architecture:

- MySQL remains the database; a PostgreSQL migration is not recommended merely because the PDF's example stack says PostgreSQL.
- Spring Boot remains the backend.
- Next.js remains the frontend.
- Existing auth, deployment, and UI patterns remain unless a specific issue justifies change.

The required changes are additive: canonical institution/academic data, scoped staff authorization, import/export, college read models, auditability, and migration discipline.

---

## 3. Architecture

### 3.1 Runtime shape

```text
Browser
  │  HTTPS
  ▼
nginx / TLS termination (host-level, not in repository)
  │
  ▼
Next.js frontend :3000
  │  /api/* same-origin rewrite (API_PROXY_URL)
  ▼
Spring Boot API :8080  ──────►  MySQL 8 :3306
  │                              (private Compose network)
  ├── CV storage: AWS S3 (private) or persisted local volume
  ├── profile photos: local/persisted volume
  ├── AI: OpenAI-compatible provider or Gemini; offline fallback
  └── Google ID token verification: Google tokeninfo endpoint
```

The browser normally calls the frontend's own `/api/*` path; Next rewrites that to the backend. CORS is configured for explicit origins. The backend container maps port `8080` in Compose, but a public probe from the audit machine timed out, indicating a host firewall or equivalent control. The mapping is still a defense-in-depth weakness because Compose itself does not keep the API internal.

### 3.2 Stack and versions

| Layer | Version / choice | Evidence |
|---|---|---|
| Java | 21 | `careeros-backend/pom.xml` |
| Spring Boot | 3.5.4 | `pom.xml` parent |
| Spring AI | 1.1.0 | `pom.xml` properties |
| JWT | JJWT 0.12.6 | `pom.xml` |
| Database | MySQL 8 | `application-prod.yml`, `docker-compose.prod.yml` |
| Test DB | H2 in MySQL mode | `application-test.yml` |
| Frontend | Next.js 16.3.5 baseline; 16.4.3 current working tree | `careeros-frontend/package.json` |
| UI runtime | React 19.2.8 | `package.json` |
| Production Node image | `node:22-alpine` | `careeros-frontend/Dockerfile` |
| PDF generation | OpenPDF (`com.lowagie`) | `ReportService.java` |

### 3.3 Repository map

```text
H:\Careeros
├── careeros-backend\                 Spring Boot API
│   ├── src\main\java\com\codeit\careeros\
│   │   ├── admin\                   platform admin controllers/services
│   │   ├── ai\                      assistant, tools, chat persistence, fallback
│   │   ├── assessment\              assessment entities
│   │   ├── career\                  career/skill entities
│   │   ├── config\                  security, bootstrap, seed catalogs
│   │   ├── controller\              student/public API controllers
│   │   ├── cv\                      local/S3 storage
│   │   ├── dto\                     request/response records
│   │   ├── entity\                  user/profile/refresh token
│   │   ├── exception\               API error handling
│   │   ├── linkedin\                LinkedIn profile entity
│   │   ├── mapper\                  profile mapping
│   │   ├── project\                 project entities
│   │   ├── repository\              Spring Data repositories
│   │   ├── roadmap\                 roadmap entities
│   │   ├── security\                JWT filter/service, rate limiter
│   │   └── service\                 business logic
│   └── src\test\java\...            278 backend tests
├── careeros-frontend\                Next.js app
│   ├── app\                          route groups and pages
│   ├── components\                   UI shell and shared components
│   ├── lib\                          API/auth/format helpers
│   ├── proxy.js                      route-guard middleware
│   └── next.config.mjs               headers and API rewrite
├── docs\                             backup, production, PDF
├── docker-compose.prod.yml           MySQL + backend + frontend
├── deploy-prod.sh                    one-command production deploy
└── .env.example                      environment contract (placeholders)
```

There is no separate `v1.0` specification, no `.github` CI directory, no migration directory, and no staging composition in the repository.

---

## 4. Backend technical inventory

### 4.1 API surface

The API is rooted at `/api/v1`.

| Area | Main routes | Access model |
|---|---|---|
| Auth | `/auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/config` | Public for register/login/google/refresh/config; authenticated for me/logout |
| Student profile | `/students/me`, `/students/me/photo` | Authenticated; current user only |
| Career selection | `/students/me/career` | Authenticated; current user only |
| Careers/skills/meta | `/careers`, `/skills`, `/meta` | Careers/meta public GET; skills authenticated |
| Assessments | `/assessments/...` | Authenticated with per-attempt ownership |
| Readiness/attempts | `/students/me/attempts`, `/students/me/readiness` | Authenticated; current user only |
| Roadmap | `/roadmaps/...` | Authenticated with per-item ownership |
| Projects | `/projects/...` | Authenticated with per-item ownership |
| CV | `/cvs/...` | Authenticated; current user only; PDF/DOC/DOCX upload |
| LinkedIn | `/linkedin/...` | Authenticated; current user only; manual URL/analysis |
| Progress | `/progress` | `STUDENT` |
| Reports | `/reports/...`, `/reports/{type}/download` | `STUDENT`; current user only |
| AI | `/ai/status`, `/ai/chat/sessions`, `/ai/chat/...` | `STUDENT`; per-session ownership |
| Settings | `/settings/...` | Authenticated; current user only |
| Admin | `/admin/...` | `ADMIN` via `SecurityConfig` |

Controller count: 23 controllers. The public API also exposes `/actuator/health` internally; Swagger/OpenAPI is enabled in dev/test and disabled in prod.

### 4.2 Authorization and ownership

The backend is the security authority:

- `SecurityConfig` disables CSRF, uses stateless sessions, permits only the listed public routes, requires `ADMIN` for `/api/v1/admin/**`, and authenticates everything else.
- `@PreAuthorize("hasRole('STUDENT')")` is explicit on reports, progress, and AI chat controllers.
- Other student controllers resolve the current user from the security context and query by user ID. There is no request-supplied student ID in the normal student flows.
- Ownership tests exist for attempts, reports, CVs, LinkedIn, roadmap items, project items, and AI sessions. The suite includes a test that one student cannot access another student's attempt; report tests likewise use a second student.

No direct IDOR was found in the reviewed student owner-scoped flows. That is not a claim that no IDOR exists anywhere; no fuzzing or adversarial testing was performed. More importantly, **college-level IDOR cannot be assessed because there is no college-scoped data model or staff authorization layer.**

### 4.3 Roles and account creation

`Role.java` contains exactly:

```java
STUDENT,
ADMIN
```

Registration creates a `STUDENT` and a linked `StudentProfile`. Google login creates a `STUDENT` automatically if the verified email is new. Admin bootstrap creates an `ADMIN` only when the user table is empty (prod) or when configured in dev/test. There is no staff invitation, no `PROFESSOR` role, no TPO/HOD/faculty/college-admin role, and no way to assign a staff member to an institution.

`UserStatus` has `ACTIVE`, `INACTIVE`, and `LOCKED`, but no admin endpoint or UI manages those states. The status enum therefore exists without a lifecycle feature.

### 4.4 Authentication lifecycle

- Access token: JWT, 15-minute default expiration, issuer and signature verified, secret must be at least 32 bytes.
- Refresh token: opaque, 7-day default, SHA-256 hash stored, rotation on refresh, reuse detection revokes the session family.
- Rate limiting: in-memory sliding window on POST login/register/refresh/google, per client IP, 60/minute default, disabled in tests.
- Password storage: BCrypt.
- Google: server-side ID token verification via Google's tokeninfo endpoint, audience/issuer/expiry/email-verified checks, then normal CareerOS tokens.
- Missing: email verification, forgot-password/reset, MFA, staff invite tokens, session/device management beyond revoke-all, and staff account lifecycle.

### 4.5 Data model (current)

There are 23 mapped tables:

| Group | Tables |
|---|---|
| Identity | `users`, `refresh_tokens`, `student_profiles` |
| Career/skill master | `skills`, `careers`, `career_skills` |
| Assessments | `assessment_tests`, `assessment_questions`, `question_options`, `assessment_attempts`, `assessment_attempt_questions`, `assessment_answers`, `skill_scores` |
| Roadmap | `roadmap_phases`, `roadmap_items`, `roadmap_item_progress` |
| Projects | `projects`, `project_skills`, `project_progress` |
| CV/LinkedIn | `cv_documents`, `linkedin_profiles` |
| AI | `ai_chat_sessions`, `ai_chat_messages` |

Key facts:

- `student_profiles.college` is a free-text `VARCHAR(150)`; `degree` and `branch` are free text; `graduation_year` and `semester` are integers.
- There is no `institution_id`, `tenant_id`, `department_id`, `program_id`, `batch_id`, or `section_id`.
- The only unique academic identity is `student_profiles.student_id` and the user's email.
- There is no enrollment table, no institution/staff membership table, no invitation table, no import-job table, no audit-event table, no mock-interview table, and no placement record.
- There is no persisted `career_readiness_scores` table, `reports` table, or `progress_tracking` table even though the PDF's data-model section lists them. Readiness, progress, and PDFs are computed live.

### 4.6 Student profile and admin projection

The admin student list reads `student_profiles` directly and maps fields including:

- full name, email, mobile, date of birth, college, degree, branch, graduation/semester, location, GitHub, LinkedIn, portfolio, target career, timestamps.

The list is platform-wide and paginated (`page`, `size` only; no search, department, batch, or status filter). The frontend search/career filter applies only to the 12 records already fetched for the current page. The backend has no query support for the whole student population.

### 4.7 Readiness and reports

Readiness is a weighted skill-gap calculation over the target career's competency framework and the student's latest assessed skill scores. It is not a composite of assessment, CV, LinkedIn, projects, and roadmap. It is computed on demand and not stored as a historical snapshot.

Reports are owner-scoped to the authenticated student. PDF generation is real OpenPDF output based on live data, with a whitelist of report types. There is no staff/report-admin access endpoint and no persisted report-generation record.

### 4.8 CV, LinkedIn, and profile media

- CV upload accepts PDF/DOC/DOCX, max 5 MB, with a server-generated storage key.
- S3 objects are private and streamed through the backend; local storage is a persisted volume in the fallback deployment.
- CV analysis is heuristic text extraction/matching, not an LLM-based evaluation.
- LinkedIn analysis is manual URL/content analysis; the app does not scrape LinkedIn.
- Profile photos are stored locally and served only through owner-scoped endpoints.
- There is no malware scanning, no explicit content-disarm, and no retention policy.

### 4.9 AI assistant

- Supports an OpenAI-compatible provider and Gemini through Spring AI.
- Tool allowlist reads only the current student's profile, readiness, gaps, roadmap, projects, CV analysis, and LinkedIn analysis.
- Raw CV text is not passed through the assistant tools; profile name/college/degree/branch and analysis summaries can be sent to the external provider.
- Chat history is persisted in MySQL; sessions are owner-scoped.
- Offline fallback exists and is tested.
- Real-provider behavior on the live deployment was not verified. An invalid-key test does prove provider errors are handled without leaking the key in user-facing output.

### 4.10 Error handling and logging

- `GlobalExceptionHandler` returns structured `ApiResponse` errors and appropriate HTTP statuses.
- AI provider errors are sanitized, and logs redact common secret patterns.
- Application logs record some admin actions, auth events, and AI failures.
- There is **no durable audit log**: no actor ID + action + entity + before/after + IP + request ID record in the database. Logs are not a substitute for a compliance audit trail.

---

## 5. Frontend technical inventory

### 5.1 Routes

The production build contains 30 static pages plus dynamic routes:

- Public: `/`, `/login`, `/register`, `/legal/privacy`, `/legal/terms`.
- Student: dashboard, profile, careers, assessment, assessment attempt, roadmap, projects, CV, LinkedIn, progress, reports, AI, settings.
- Admin: dashboard, students, careers, skills, assessments, assessment detail, roadmaps, projects, reports, AI, settings.
- Catch-all section pages for unimplemented sections.

There are no college, TPO, professor, department, batch, import, audit, or mock-interview routes.

### 5.2 Route guard

`proxy.js` reads a non-HttpOnly `careeros_token` cookie, decodes the JWT payload, and redirects by role. It does **not** verify the signature or expiry. This is a UX guard, not a security boundary. The backend still validates the bearer token on every API call, so the current student product does not rely on this guard for data protection. Any future college workspace must not treat this guard as tenant authorization.

### 5.3 Token storage and browser security

- Access and refresh tokens are stored in `localStorage`.
- The access token is duplicated into a JavaScript-readable, `SameSite=Lax`, non-HttpOnly cookie for the route guard.
- The cookie's `max-age` is seven days even though the access token expires in 15 minutes.
- Security headers are present: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- There is no Content-Security-Policy.
- `X-Powered-By: Next.js` is exposed.

### 5.4 Admin UI gaps

- The admin dashboard still marks assessment, roadmap, and report counts as locked placeholders with sprint labels, even though those modules exist and the backend exposes counts.
- The branch chart is computed from the 10 most recently fetched students, not the full population.
- The admin reports page explicitly says student reports remain private; it is an overview, not report access.
- Roadmaps and projects pages are explicitly read-only; PDF Phase 1 calls for management.

### 5.5 Legal pages and consent (post-audit commit)

The repository now contains static Privacy Policy and Terms of Service pages:

- `app/legal/privacy/page.jsx` and `app/legal/terms/page.jsx`
- `components/legal/privacy-part-1.js`, `privacy-part-2.js`, `terms-part-1.js`, and `terms-part-2.js`
- footer links from the repository home page (`app/page.js`)

They are a useful notice, but they are **not operational compliance**:

- The contact details are placeholders: `admin@your-college.edu` and `https://careeros.your-college.edu`.
- The privacy policy claims access/correction/deletion/portability rights, retention, and institutional sharing, but there is no request workflow, deletion path, retention job, or consent record in the code.
- The registration checkbox text (“Terms” and “Privacy Policy”) is rendered as plain spans, not links (`app/register/page.jsx:216-222`).
- The Google sign-up button is a separate path and does not require the checkbox. Consent can therefore be bypassed.
- The policy says "By accessing or using the Service, you consent" (implied consent); it does not describe an AI-specific consent, data-processing contact, or opt-out.
- The live site does not serve these pages yet: `/legal/privacy` and `/legal/terms` return 404.

This should be treated as a partial privacy-notice improvement, not as completed consent/retention compliance.

---

## 6. Database, schema, and migrations

There is no migration tool and no `db/migration` directory.

- Dev/test use Hibernate `ddl-auto` (dev likely `update`; test `create-drop`).
- Production defaults to `validate`.
- `deploy-prod.sh` bootstraps an empty database once with `ddl-auto=update`, waits for health, then switches back to `validate` and records `.prod-db-initialized`.
- Existing data never receives automatic schema changes. A code comment in `StudentProfile` even documents a manual `ALTER TABLE` for a past column change.

This is a material problem for Phase 1: a multi-table institution/role/import/audit model cannot be rolled out safely with a one-time bootstrap rule. A versioned migration mechanism and a migration runbook are required before any college schema change.

---

## 7. Deployment and production topology

### 7.1 What is present

- `docker-compose.prod.yml`: MySQL 8, backend, frontend on a private Compose network.
- Backend and frontend images run as non-root users.
- Secrets are environment-based; `.env.example` contains placeholders only.
- `deploy-prod.sh` creates `backend.env`, generates JWT/DB/admin secrets on first run, configures CORS and storage, builds and starts the stack, and polls `/actuator/health`.
- MySQL is not published to the host; backend is published as `8080:8080`; frontend as `3000:3000`.
- Prod disables Swagger and exposes only health without details.
- Storage falls back to a persisted local volume when no S3 bucket is configured.

### 7.2 What is missing or weak

- No CI pipeline and no automated deployment gate.
- No staging environment or synthetic data set.
- No deployed-version/commit endpoint or deploy manifest.
- No migration mechanism after first bootstrap.
- No automated backup job or tested restore drill; `docs/BACKUP_RESTORE.md` is a manual runbook.
- No structured application metrics, tracing, error tracking, or alerting.
- No CSP.
- Backend port is mapped on all interfaces at the Compose level. A public audit probe timed out, but the configuration still relies on an external firewall, not network design.
- The live backend is demonstrably older than the live frontend (see below).

---

## 8. Live website observations

These checks were unauthenticated and public. No credentials or private data were used.

| Check | Result |
|---|---|
| `GET https://careeros.codeitinfotech.com/` | `200`, nginx/1.24.0, Next.js HTML |
| `GET /login` | `200`; page loads; frontend bundle contains Google Identity code and a public Google client ID |
| `GET /api/v1/careers` | `200`; published careers returned |
| `GET /api/v1/auth/config` | **`401 UNAUTHORIZED`** — repository expects `200` public config |
| `POST /api/v1/auth/google` with `{}` | **`404 NOT_FOUND`** — repository has this route; live backend does not |
| `POST /api/v1/auth/login` with `{}` | `400 VALIDATION_ERROR` — live login route exists and validates input |
| `GET /legal/privacy` | **`404`** — legal page exists in HEAD but is not deployed |
| `GET /legal/terms` | **`404`** — legal page exists in HEAD but is not deployed |
| `GET /actuator/health` through the site | Frontend 404 (not rewritten); backend health not public through the site |
| `http://careeros.codeitinfotech.com:8080/actuator/health` | Connection timed out |
| `https://careeros.codeitinfotech.com:8080/...` | Connection timed out |
| HSTS / security headers | HSTS, nosniff, DENY, Referrer-Policy, Permissions-Policy present; no CSP |
| Backend API direct from public internet | Not reachable in this test |

**Interpretation**

- The live frontend contains the Oct-16 Google code but not the newer legal pages. The live backend is older still: it does not expose the Oct-16 Google routes. This is a multi-version deployment drift, not a single stale container.
- Google Sign-In is broken live: the button can render from the baked client ID, but the credential POST hits a 404.
- Email/password login still exists live, but a successful login was not attempted.
- The live site cannot be treated as a faithful deployment of either commit `72f9a8d` or HEAD until deployment parity is established.

---

## 9. Verified vs assumed

| Claim | Status | Evidence |
|---|---|---|
| Student email/password auth works | **Verified by automated tests** | 320-test current suite (278 at audit baseline; 2 skipped real-MySQL tests); auth integration tests |
| Student profile CRUD works | Verified by tests | profile integration tests |
| Assessment start/submit/scoring/ownership | Verified by tests | assessment integration tests |
| Readiness weighted calculation | Verified by tests and code review | `CareerInsightService`, test suite |
| Roadmap/project progress and ownership | Verified by tests | roadmap/project integration tests |
| CV upload/analysis/ownership | Verified by tests | CV integration tests |
| LinkedIn manual analysis | Verified by tests | LinkedIn integration tests |
| Student PDF reports | Verified by tests | report integration tests |
| AI assistant behavior with stub/offline fallback | Verified by tests | AI tests; live provider not verified |
| Admin master-data CRUD | Verified by backend tests | admin integration tests |
| Google Sign-In works live | **Disproved** | public 404 on `/auth/google`; 401 on `/auth/config` |
| College/TPO features exist | **Disproved** | no routes, tables, roles, or code paths |
| CSV import/export exists | **Disproved** | no matching implementation; only CSV strings in question content |
| Audit log exists | **Disproved** | no audit entity/table; only application logs |
| Mock interviews exist | **Disproved** | no module, route, or table |
| Tenant isolation exists | **Disproved** | no institution/tenant key or scoped query |
| Privacy Policy and Terms pages exist in the repository | **Verified** | `app/legal/*` and `components/legal/*`; build includes both routes |
| Privacy Policy and Terms are live | **Disproved** | public `GET /legal/privacy` and `/legal/terms` return 404 |
| Operational consent/retention/deletion exists | **Partial** | Durable append-only consent evidence now exists; there is still no retention job, DSAR/export, or deletion path |
| Backend is production-ready for college PII | **Not established** | missing tenant model, staff roles, tenant audit, export controls; backend SCA not yet run |
| All tests pass | **Partially verified** | Baseline: 1 of 278 failed; current working tree: 320 tests, 0 failures, 0 errors, 2 skipped (MySQL gates, not run locally) |

---

## 10. Phase 1 technical implications

If the brief's college/TPO Phase 1 is approved, the minimum architecture work is:

1. **Canonical institution/academic model** — institution, department, program, batch, section, academic year, enrollment, with additive migration and backfill of existing free-text college data.
2. **Scoped staff identity** — `PROFESSOR` authenticated role plus institution membership/designation (TPO, HOD, faculty, college administrator) and server-derived scope. `ADMIN` must not be reused as a workaround.
3. **Invite-only onboarding** — hashed one-time invite tokens, expiry, email delivery, activation, revocation, and audit.
4. **Student import** — CSV template, validation, duplicate policy, account linking, partial-success errors, scoped permissions, retention.
5. **College read models** — scoped student search/360, assessment/readiness aggregates, skill-gap aggregation, dashboard filters and drill-down.
6. **Reports and exports** — authorized staff report access, CSV exports with formula-injection defenses, field-level permissions, export audit.
7. **Mock interviews** — clarify scheduling/outcome tracking versus AI simulation; either way, the current code has no module.
8. **Privacy and consent** — correct the placeholder legal contacts, link the registration terms/privacy text, require consent for Google sign-up too, record consent server-side where required, and implement the access/deletion/retention rights the policy describes.
9. **Operational hardening** — migrations, CI, backup/restore test, monitoring, deployment parity, CSP/token hardening, dependency remediation.
10. **Isolation tests** — at least two institutions, forged IDs, cross-college denied access, export scoping, audit events.

None of these should be built as a separate app or by duplicating the existing student services. The college workspace should reuse the existing CareerOS read models through new staff-authorized service methods.

---

## 11. Evidence index

Primary code and documentation references:

- `careeros-backend/src/main/java/com/codeit/careeros/common/enums/Role.java`
- `careeros-backend/src/main/java/com/codeit/careeros/entity/User.java`
- `careeros-backend/src/main/java/com/codeit/careeros/entity/StudentProfile.java`
- `careeros-backend/src/main/java/com/codeit/careeros/mapper/StudentProfileMapper.java`
- `careeros-backend/src/main/java/com/codeit/careeros/admin/AdminStudentService.java`
- `careeros-backend/src/main/java/com/codeit/careeros/admin/AdminStatsService.java`
- `careeros-backend/src/main/java/com/codeit/careeros/config/SecurityConfig.java`
- `careeros-backend/src/main/java/com/codeit/careeros/service/AuthService.java`
- `careeros-backend/src/main/java/com/codeit/careeros/service/CareerInsightService.java`
- `careeros-backend/src/main/java/com/codeit/careeros/service/ReportService.java`
- `careeros-backend/src/main/java/com/codeit/careeros/controller/ReportController.java`
- `careeros-backend/src/main/java/com/codeit/careeros/security/AuthRateLimitFilter.java`
- `careeros-backend/src/main/java/com/codeit/careeros/ai/CareerAssistantTools.java`
- `careeros-backend/src/main/resources/application.yml`
- `careeros-backend/src/main/resources/application-prod.yml`
- `careeros-backend/src/test/resources/application-test.yml`
- `careeros-frontend/package.json`
- `careeros-frontend/proxy.js`
- `careeros-frontend/lib/auth.js`
- `careeros-frontend/next.config.mjs`
- `careeros-frontend/components/auth/google-signin.jsx`
- `careeros-frontend/app/admin/dashboard/page.jsx`
- `careeros-frontend/app/admin/students/page.jsx`
- `careeros-frontend/app/admin/reports/page.jsx`
- `careeros-frontend/app/admin/roadmaps/page.jsx`
- `careeros-frontend/app/admin/projects/page.jsx`
- `careeros-frontend/app/legal/privacy/page.jsx`
- `careeros-frontend/app/legal/terms/page.jsx`
- `careeros-frontend/components/legal/privacy-part-1.js`
- `careeros-frontend/components/legal/privacy-part-2.js`
- `careeros-frontend/components/legal/terms-part-1.js`
- `careeros-frontend/components/legal/terms-part-2.js`
- `careeros-frontend/app/register/page.jsx`
- `docker-compose.prod.yml`
- `deploy-prod.sh`
- `docs/BACKUP_RESTORE.md`
- `docs/PRODUCTION.md`
- `docs/CODEIT_CareerOS_Developer_Documentation.pdf`

Related audit documents:

- [Requirements gap matrix](CAREEROS_REQUIREMENTS_GAP_MATRIX.md)
- [Security and production audit](CAREEROS_SECURITY_AND_PRODUCTION_AUDIT.md)
- [Implementation roadmap](CAREEROS_IMPLEMENTATION_ROADMAP.md)
- [Audit summary](CAREEROS_AUDIT_SUMMARY.md)
