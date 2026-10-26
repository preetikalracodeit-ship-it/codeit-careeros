# CODEIT CareerOS — Audit Summary

> **Audit-only deliverable.** No feature was implemented, no schema was changed, no production data was touched, and no deployment was performed. This report records evidence and a release recommendation.

## Audit basis

| Item | Value |
|---|---|
| Audit date | 2026-10-26 |
| Repository | `H:\Careeros` |
| Branch | `main` |
| Latest commit | `72f9a8d51205604b12591e21f0c8ae3ae1861c23` (2026-10-16) |
| Live site | `https://careeros.codeitinfotech.com` |
| Method | Code review, existing automated tests, production build, `npm audit`, unauthenticated live HTTP checks |
| Credentials / private data used | None |
| Scope conflict | The audit brief's college/TPO Phase 1 differs from the repository PDF's Phase 1; both are reported |

**Scope conflict:** the brief treats college/TPO functionality, staff roles, CSV import, college dashboards, mock interviews, and tenant isolation as Phase 1. The repository PDF explicitly defers the College/TPO portal, multi-tenancy, and mock interviews to Phase 2/3. This audit follows the brief as the controlling request, but flags that the repository was built against a narrower Phase 1. The Phase 1 label must be re-baselined before implementation.

---

## A. Current Website Status

| Check | Observed result |
|---|---|
| Landing page | `200`; nginx/1.24.0 in front of Next.js |
| `/login` | `200`; page loads; frontend bundle contains Google Identity code and a public Google client ID |
| Public careers API | `GET /api/v1/careers` = `200`; published careers returned |
| Email/password login route | `POST /api/v1/auth/login` with invalid body = `400` validation error; route exists |
| Public auth config | `GET /api/v1/auth/config` = **`401`**; repository expects public `200` |
| Google sign-in route | `POST /api/v1/auth/google` with `{}` = **`404`**; repository has the route |
| Health through the public site | `/actuator/health` is not exposed through the frontend; returns the frontend 404 |
| Backend port `8080` from public internet | Connection timed out in this test |
| TLS/security headers | HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` present; no CSP |
| Authenticated student/admin flows | Not tested live; no credentials were used |

**Live status conclusion:** the student site is up and public content/API reads work. **Google Sign-In is broken live** because the live backend does not expose the newer config/Google routes. The live frontend and backend are not from the same effective build, so the site cannot be treated as a faithful deployment of commit `72f9a8d` until deployment parity is established. Email/password login appears present but was not exercised with a real account.

---

## B. Completed Requirements

### B.1 Under the brief's college/TPO Phase 1

**0 of 49 functional requirements are complete and verified.** The existing application is a student career-readiness product, not a college/TPO platform. No institution model, staff role, CSV import, TPO dashboard, college report, mock interview, audit log, or tenant boundary exists.

### B.2 Under the repository PDF's narrower Phase 1

The student/admin core is substantially implemented. **18 of 31 baseline rows are complete and verified**, with 1 implemented but unverified, 6 partial, 3 missing, and 3 deferred/out of scope. Completed and verified areas:

- email/password registration and login;
- student profile and education fields;
- career selection;
- skill assessment, submission, scoring, and attempt history;
- assessment results;
- career gap analysis;
- weighted career readiness calculation;
- career roadmap generation and item progress;
- CV upload, private storage, text analysis, and replacement;
- LinkedIn manual profile/URL analysis (no scraping);
- project recommendations and progress;
- consolidated progress view;
- student-facing career-readiness PDF reports;
- admin login and admin-only authorization;
- career management;
- skill management;
- assessment and question management;
- competency framework management.

These are real, tested capabilities. The audit does not dismiss them; they are simply not the brief's Phase 1 college scope.

---

## C. Partially Completed Requirements

### C.1 Brief Phase 1 — 7 of 49 functional rows partial

| Area | What exists | What is missing |
|---|---|---|
| Student academic mapping | Free-text college, degree, branch, graduation year, semester on the profile | Canonical institution/department/program/batch/section and enrollment linkage |
| Platform admin vs college staff | `ADMIN` role and admin authorization | `PROFESSOR`, TPO/HOD/faculty/college-admin designations and scoped memberships |
| Student list | Platform-wide paginated admin list | Institution scope; server-side search/filter; current frontend filters only the 12 loaded records |
| Student 360 | Admin can inspect basic profile fields | Assessments, readiness, gaps, CV, LinkedIn, roadmap, projects, and field-level privacy |
| Total/active students | Global role count | College-scoped count; active/graduated status; active-status management |
| Assessment completion | Global submitted-attempt count | Unique students, cohort denominators, trend |
| Report persistence/access | Live PDF generation for the student | Staff access, persisted report/generation record, filters/snapshot |

### C.2 Production/security gates — 7 of 15 partial

- Backend tests: 278 run, 1 failure, no CI.
- Deployment parity: live frontend newer than live backend; no version marker.
- Token/CSP: security headers present, but tokens in `localStorage`/JS-readable cookie and no CSP.
- Backup/restore: manual runbook only; no automation/drill evidence.
- Monitoring: health endpoint and logs only.
- Rate limiting: basic in-memory per-IP limiter; `X-Forwarded-For` trust and unbounded key map.
- Documentation: `PRODUCTION.md` is useful; `README.md` is stale about admin capabilities.

### C.3 Other partial/limited capabilities

- **Google Sign-In:** code exists in the repository, but the live backend returns 404 for the route. Not usable live.
- **AI assistant:** strongly tested with stubs/offline fallback; real-provider behavior and consent were not verified.
- **Skill-category management:** categories are a fixed enum; no admin category CRUD.
- **AI configuration:** read-only status page; configuration is environment-driven.
- **Admin dashboard:** global counts, locked cards, branch chart from 10 students; not a college dashboard.
- **Readiness:** weighted assessment calculation; not a multi-component score and not persisted historically.

---

## D. Missing Requirements

### D.1 College/TPO functional scope — 42 of 49 missing

- Canonical institutions, departments, programs, batches, sections, academic years.
- Student enrollment and roll-number model.
- `PROFESSOR` role; TPO/HOD/faculty/college-administrator memberships and scopes.
- Invite-only staff onboarding, activation, deactivation, role changes.
- Server-derived institution scoping and cross-college isolation tests.
- CSV student import, template/validation, duplicates, partial-success errors, account linking, import audit/retention.
- College-scoped student list/search/filter and full student 360.
- Staff assessment/readiness/CV/LinkedIn/roadmap/project views.
- Student edit/deactivate/status management and field-level privacy.
- TPO readiness distribution, skill-gap aggregation, cohort comparisons, trends, filters, drill-down.
- College/TPO reports and authorized staff report access.
- CSV exports, export field permissions, export audit, formula-injection controls.
- Mock interview module (scheduling/outcomes/feedback or AI simulation, as scoped).
- Durable audit log and audit coverage.
- Privacy/consent/retention/deletion.

### D.2 PDF Phase 1 gaps

Even under the narrower PDF Phase 1, these are still missing or incomplete:

- admin report access;
- admin roadmap management (current UI/API is read-only);
- admin project management (current UI/API is read-only);
- durable `audit_logs`;
- persisted `career_readiness_scores`/`reports`/`progress_tracking` records as described in the PDF data model;
- a green backend suite and CI gate.

### D.3 Operational gaps

- No versioned migrations; first deploy uses `ddl-auto=update`, then `validate`.
- No CI pipeline, staging environment, or deployed-commit verification.
- No automated backups or restore drill.
- No metrics/tracing/error tracking/alerting.
- No email verification, password reset, or MFA.
- No malware scanning/quarantine for uploads.
- No data-retention or subject-access/deletion workflow.

---

## E. Critical Security or Production Blockers

1. **No tenant or staff authorization model (Phase 1 P0 design blocker).** There is no institution, enrollment, membership, `PROFESSOR`, or TPO scope. Building a TPO list/report/export on the current global admin service would create cross-college PII exposure. Current absence of the feature is not a mitigation; it is the reason the feature cannot be built safely yet.
2. **Critical frontend RCE advisories in `next@16.3.5`.** Direct production dependency; fixed in `16.4.3`. Advisories include unauthenticated RCE paths in image optimization/`use cache`/`next/og`; the app uses `next/image`. This is a release blocker.
3. **Live deployment drift and broken Google Sign-In.** Live frontend has newer Google code; live backend returns 401 for `/auth/config` and 404 for `/auth/google`. The deployed backend is stale or nginx routes `/api` to the wrong upstream.
4. **No durable audit trail or export/report access audit.** Application logs are not a compliance audit. Staff report/CV/export access cannot be reconstructed.
5. **No versioned migrations.** A college schema with institutions, memberships, imports, and audit cannot be rolled out safely with the current one-time `ddl-auto=update` bootstrap.
6. **Backend test suite is red and CI is absent.** 278 tests, 1 failure; no automated gate. A failing suite cannot be a release gate.
7. **Token storage and browser hardening.** Access/refresh tokens are in `localStorage`; the access token is duplicated into a JS-readable non-HttpOnly cookie; the route guard decodes without signature/expiry; no CSP. XSS becomes account takeover.
8. **Global admin PII exposure without field-level policy.** Admin can see mobile, DOB, college, and personal URLs platform-wide. There is no least-privilege staff role or field-visibility matrix.

**Not current blockers but required before college rollout:** email verification/reset/MFA, upload malware scanning, AI consent/retention, backup automation/restore test, monitoring/alerting, staging, backend port isolation, privacy/retention.

---

## F. Recommended Next Task

**Do not start TPO screens, CSV import, or exports yet.** Run **Gate 0 + Phase 0 stabilization**:

1. Sign off the Phase 1 scope and the role/field-visibility matrix.
2. Patch Next.js to `16.4.3+`, fix the stale Gemini test, and make CI green.
3. Repair/redeploy the backend so live `/auth/config` and `/auth/google` match the tested frontend; add a deployed-commit marker and post-deploy smoke checks.
4. Approve the tenant data model and migration mechanism.
5. Then implement **Phase 1A**: canonical institutions/academic structure, `PROFESSOR` + scoped memberships, invite-only onboarding, server-derived scope, audit foundation, and two-institution isolation tests.

The first college code should be the tenant foundation, not a dashboard. This order prevents a global-admin workaround from becoming the foundation of the college product.

---

## G. Test Results

### Backend

Command (JDK 21 + Maven 3.9.9, H2 test profile):

```text
mvn -B test
```

Result:

```text
Tests run: 278, Failures: 1, Errors: 0, Skipped: 0
Time elapsed: 4:46 min
BUILD FAILURE
```

Failure:

```text
AiChatGeminiAutoConfigTest.gemini_effectiveKeyAndModel:59
expected: "gemini-2.0-flash"
 but was: "gemini-2.5-flash"
```

Interpretation: the application default is `gemini-2.5-flash` (and the deploy script warns that `gemini-2.0-flash` was shut down). The test expectation is stale. The suite was **not** altered to force a pass. This is a real release-gate failure and a test-maintenance defect, not evidence that the Gemini feature itself is broken.

### Frontend

| Command | Result |
|---|---|
| `npm ci` | 794 packages installed; 12 vulnerabilities reported (3 moderate, 8 high, 1 critical) |
| `npm run lint` | Exit 0; no findings |
| `npm run build` | Success; Next.js 16.3.5; 28 static pages plus dynamic routes |
| `npm audit --omit=dev` | Still reports 12 vulnerabilities; direct critical `next`, direct high `shadcn` |

Relevant critical advisory: `next@16.3.5` is in the affected range; `npm audit` proposes `16.4.3`.

### Live checks

| Check | Result |
|---|---|
| `GET /` | `200` |
| `GET /login` | `200` |
| `GET /api/v1/careers` | `200` |
| `GET /api/v1/auth/config` | `401` |
| `POST /api/v1/auth/google` | `404` |
| `POST /api/v1/auth/login` with invalid body | `400` validation error |
| `GET /actuator/health` through site | `404` (frontend) |
| Public backend `:8080` | Connection timed out |
| HSTS/security headers | Present; no CSP |
| `/auth/config` expected public route | Not working live |

### Not run

- Authenticated E2E/browser tests.
- Load/stress/soak tests.
- DAST/fuzzing or manual exploitation.
- Maven dependency vulnerability scan.
- Container/image scan.
- Backup restore drill.
- Real Google credential exchange.
- Real AI provider verification.

No production data was read or changed.

---

## H. Changed Files

Only five audit documents were added:

- [CAREEROS_TECHNICAL_DISCOVERY.md](CAREEROS_TECHNICAL_DISCOVERY.md)
- [CAREEROS_REQUIREMENTS_GAP_MATRIX.md](CAREEROS_REQUIREMENTS_GAP_MATRIX.md)
- [CAREEROS_SECURITY_AND_PRODUCTION_AUDIT.md](CAREEROS_SECURITY_AND_PRODUCTION_AUDIT.md)
- [CAREEROS_IMPLEMENTATION_ROADMAP.md](CAREEROS_IMPLEMENTATION_ROADMAP.md)
- [CAREEROS_AUDIT_SUMMARY.md](CAREEROS_AUDIT_SUMMARY.md)

No application code, schema, migration, production data, deployment configuration, or secret was changed. `node_modules`, `.next`, and `target` are generated/ignored and are not part of the change set.

---

## I. Release Verdict

### Requested brief Phase 1 (college/TPO): **NO-GO**

Reasons:

- **0 of 49** functional college/TPO requirements are complete and verified.
- No tenant model or staff authorization exists; the critical path is unbuilt.
- No CSV import, TPO dashboard, college reports/exports, mock interviews, or audit log.
- The existing student/admin product cannot be presented as a college platform without a substantial new Phase 1.

### Existing student/admin product: **CONDITIONAL**

The live student product is up and the core flows are substantially tested, but it is **not release-ready** as a new production release until:

- `next` is upgraded and the frontend audit is clean;
- the backend test suite is green;
- the live backend is redeployed/verified against the tested frontend;
- CI and migration discipline are in place.

**Overall:** **NO-GO for the requested Phase 1 release.** Continue operating the existing student product only under a **conditional** status with an immediate dependency/security patch and deployment-parity fix. Do not add college staff or college student data until the tenant foundation and isolation tests exist.

---

## Bottom line

The team has built a credible **student career-readiness product**. It has not built the **college/TPO Phase 1** described in the brief. The next release should not be a dashboard; it should be a scope decision, a security/stabilization patch, and the tenant foundation.

Related documents:

- [Technical discovery](CAREEROS_TECHNICAL_DISCOVERY.md)
- [Requirements gap matrix](CAREEROS_REQUIREMENTS_GAP_MATRIX.md)
- [Security and production audit](CAREEROS_SECURITY_AND_PRODUCTION_AUDIT.md)
- [Implementation roadmap](CAREEROS_IMPLEMENTATION_ROADMAP.md)
