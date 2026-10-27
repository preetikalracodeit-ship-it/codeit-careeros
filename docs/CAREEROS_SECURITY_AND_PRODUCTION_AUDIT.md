# CODEIT CareerOS — Security and Production Audit

> **Audit record with a remediation addendum.** Findings below describe the audit baseline and remain the evidence of record. Safe remediation was later implemented locally and is **uncommitted and undeployed**; see [CAREEROS_AUDIT_SUMMARY.md](CAREEROS_AUDIT_SUMMARY.md). No exploit was run against production, no credentials were used, and no production data was changed.

> **Remediation snapshot (2026-10-27, later state):** `next` upgraded to `16.4.3` and npm audit is clean; backend suite is 320/0/0 with 2 skipped real-MySQL tests; frontend lint/build pass; CI workflow added with MySQL migration and OWASP Dependency-Check jobs, but not run on the host; build-version and health probes, request IDs, consent gates, role cookie, report-only CSP, COOP, and rate-limiter hardening are present. Flyway V1–V3, durable append-only consent, platform-admin audit events, and immediate invalidation of deactivated sessions were added locally. Still open: S1 tenant model, S3 live parity, S4 tenant/staff audit breadth and retention, S5 production migration verification, S7 localStorage token exposure, S13 published backend port, S20 privacy operations, S21 CI SCA execution (local scan blocked by NVD DNS), S23 frontend consent prompt/approved contacts/retention. No tenant schema or production migration was added.

## 0. Scope and method

### In scope

- Backend authorization, tenant isolation, and object ownership.
- Student/admin IDOR risk.
- CSV import/export safety and export permissions.
- Auditability and logging.
- Authentication/session handling.
- Secrets, uploads, AI data flow, and dependency posture.
- Deployment, migrations, backups, monitoring, and release readiness.
- Live deployment consistency where it could be checked without credentials.
- Late repository changes: privacy-policy/terms pages and footer links were added during the audit and rechecked. They are static notice pages, and the live routes return 404.

### Out of scope / not performed

- Authenticated live penetration testing.
- Load, stress, or soak testing.
- Fuzzing, SAST/DAST tooling, or manual exploitation.
- Backend dependency vulnerability scanning (no Maven SCA was configured or run).
- Server/container inspection, nginx configuration review, or database access.
- Verification of real student, staff, or admin data.
- A test of actual Google credential exchange, payment, email, or AI provider billing.

### Severity model

| Severity | Meaning in this audit |
|---|---|
| **Critical** | Release blocker or a design that would make cross-college PII exposure likely once Phase 1 is built. |
| **High** | Serious security/reliability issue requiring action before a production college release. |
| **Medium** | Material risk with compensating controls or limited exposure; fix in the Phase 1 hardening window. |
| **Low** | Hardening/defense-in-depth item. |

---

## 1. Risk register

| ID | Severity | Finding | Current evidence | Required action |
|---|---|---|---|---|
| S1 | **Critical (Phase 1 design blocker)** | No tenant/institution model or staff authorization. | `Role.java` has only `STUDENT, ADMIN`; no institution/department/enrollment/membership tables; admin list is global. | Build canonical institution/enrollment/membership model and server-derived scoping before any TPO endpoint. Add two-institution isolation tests. |
| S2 | **Critical** | `next@16.3.5` has multiple critical advisories, including unauthenticated RCE paths; direct production dependency. | `npm audit`: critical `next`, range `16.0.0–16.4.0`; fix `16.4.3`. App uses `next/image`. | Upgrade to `16.4.3` (or later patched), reinstall, run lint/build, re-audit. Do not deploy the current pin. |
| S3 | **High** | Live deployment is inconsistent across frontend, backend, and HEAD. | Public `GET /auth/config` = 401; `POST /auth/google` = 404; frontend bundle contains the Oct-16 Google code but `/legal/privacy` and `/legal/terms` return 404 even though they exist in HEAD. | Establish deployment parity, expose a commit/version identifier, redeploy backend and frontend, verify routes. |
| S4 | **High** | No durable audit trail for sensitive actions. | No audit table/entity; only application logs for some admin/auth/AI events. No actor/institution/before-after/request ID. | Add append-only audit events for staff/admin reads and writes, imports, exports, invitations, role changes, report/CV access. |
| S5 | **High** | No versioned migrations; prod schema changes are manual. | No `db/migration`; first deploy uses `ddl-auto=update`, then `validate`; a past column change is documented as a manual `ALTER TABLE`. | Introduce a migration mechanism and runbook; test forward migration and rollback on a copy. |
| S6 | **High** | Backend test suite is red and there is no CI gate. | 278 tests, 1 failure in `AiChatGeminiAutoConfigTest`; no `.github` pipeline. | Fix stale expectation, make `mvn test` green, add CI for backend tests + frontend lint/build + audit. |
| S7 | **High** | Tokens are XSS-exposed and the frontend route guard is unverified. | Access/refresh tokens in `localStorage`; access token duplicated into JS-readable `careeros_token` cookie; `proxy.js` decodes without signature/expiry; no CSP. | Add CSP; move toward HttpOnly/server-validated sessions or a BFF; at minimum never treat the proxy guard as authorization and reduce token lifetime/exposure. |
| S8 | **High (once staff exist)** | Admin can see platform-wide PII; no least-privilege staff model. | Admin DTO includes name, email, mobile, DOB, college, degree, branch, URLs; no staff roles or field policy. | Scope every staff query by institution; minimize fields by designation; audit access; do not expose DOB/mobile to all faculty. |
| S9 | **Medium** | Auth rate limiter trusts the first `X-Forwarded-For` and keeps an unbounded IP map. | `AuthRateLimitFilter.java:93-100`; in-memory map never evicts keys. | Trust only a configured proxy header; use the rightmost trusted IP or edge rate limiting; bound/expire the map; consider Redis if multi-instance. |
| S10 | **Medium (High for staff)** | No email verification, password reset, or MFA. | No mail sender/token flows; staff onboarding absent. | Add verified email, one-time reset tokens, and MFA for staff/admin before college rollout. |
| S11 | **Medium** | Uploads are allowlisted but not malware-scanned; parsing is heuristic. | CV: PDF/DOC/DOCX, 5 MB; profile photo local; no AV/content-disarm. | Add malware scanning/quarantine, magic-byte checks, parser timeouts, and retention. |
| S12 | **Medium** | Student profile data and chat content can leave the platform to AI providers without an AI-specific consent/data-processing record. | AI tools include name/college/degree/branch and analysis summaries; chat persisted in MySQL; only a general static privacy policy exists. | Add AI consent, provider/data-region disclosure, redaction/minimization, retention, and a no-AI option. |
| S13 | **Medium** | Backend port `8080` is published by Compose on all interfaces. | `docker-compose.prod.yml:38-39`; public probe timed out, but Compose does not enforce private-only. | Bind to `127.0.0.1` or remove the host mapping; keep backend internal; verify with an external scan. |
| S14 | **Medium** | Backups are documented but not automated/tested. | `docs/BACKUP_RESTORE.md`; no cron/job or restore drill evidence. | Schedule encrypted backups, test restore quarterly, record RPO/RTO. |
| S15 | **Medium** | Monitoring is health/logs only. | `/actuator/health` and app logs; no metrics/tracing/alerting/error tracking. | Add structured logs, request IDs, uptime/error alerts, DB/storage metrics, and a release marker. |
| S16 | **Medium** | Unnecessary production frontend dependency and broad advisory surface. | `shadcn` is in `dependencies` (CLI, not runtime); 12 frontend advisories, 8 high. | Move CLI/tooling to devDependencies; update transitives; keep audit clean. |
| S17 | **Medium** | Local storage fallback has no offsite redundancy; production docs prefer S3 but deploy can fall back silently. | `deploy-prod.sh:103-112` sets local storage when no bucket; local volume only. | Require explicit acknowledgement for local fallback; use S3/versioning or documented volume backups. |
| S18 | **Low/Medium** | First-run admin password is printed to the deploy console and not forced to rotate. | `deploy-prod.sh:261-265`; bootstrap says rotate immediately. | Force rotation on first login, avoid printing, store only a one-time secret. |
| S19 | **Low/Medium** | `X-Powered-By: Next.js` is exposed and CSP is absent. | Live headers; `next.config.mjs:4-13`. | Add CSP and disable `poweredByHeader`. |
| S20 | **Medium** | No privacy retention/deletion/export workflow. | Static privacy policy claims rights/retention; no request, deletion, retention, or audit code. | Define data map, retention, subject access/deletion, and audit. |
| S21 | **Medium** | No backend dependency/vulnerability process. | No SCA plugin; Spring Boot/Spring AI versions pinned but not routinely audited. | Add dependency scanning to CI and a patch cadence. |
| S22 | **Medium** | No staging environment or synthetic data set. | Repo has prod Compose plus local dev; no staging topology. | Add a staging environment with synthetic data and migration rehearsal. |
| S23 | **Medium** | Legal pages are static, partly placeholder, and consent can be bypassed. | `components/legal/privacy-part-2.js` uses `admin@your-college.edu` and `careeros.your-college.edu`; register text is not a link; `GoogleSignInButton` signup bypasses the checkbox; no server consent record; live legal routes return 404. | Replace placeholders with approved contacts; link and enforce the checkbox; require consent for Google signup; record consent; implement rights/deletion; deploy the pages. |

---

## 2. Authorization, IDOR, and tenant isolation

### 2.1 What is working

- Spring Security is stateless and validates JWT signature, issuer, expiry, and role.
- `/api/v1/admin/**` is protected by `hasRole("ADMIN")` (`SecurityConfig.java:59`).
- Reports, progress, and AI chat have explicit `STUDENT` method security.
- Student-owned resources are resolved from the authenticated user, not from a client-supplied owner ID:
  - assessment attempts and answers are checked against the current user;
  - report/CV/LinkedIn data is current-user scoped;
  - roadmap items and project progress are checked for ownership;
  - AI sessions are loaded by session ID **and** user ID, returning 404 for foreign sessions.
- Existing integration tests exercise:
  - another student's attempt is inaccessible;
  - a foreign report download is rejected;
  - a foreign CV is inaccessible;
  - a foreign AI session is inaccessible;
  - tampered/wrong-issuer JWT is rejected;
  - admin-only endpoints reject students.

**No direct IDOR was found in the reviewed student flows.** This is a code-review/test result, not a guarantee; no adversarial fuzzing was performed.

### 2.2 The missing tenant boundary

The platform has no tenant boundary at all:

- `student_profiles` has free-text `college`; there is no `institution_id`.
- `users` has no institution or membership.
- There is no staff role or staff-to-institution relation.
- Admin queries are global (`AdminStudentService.java:23-26`; `AdminStatsService.java:31-41`).
- There is no repository method that requires an institution filter because no institution exists.

This is **not currently a cross-college data leak**, because the college feature does not exist. It is a **critical Phase 1 design blocker**: adding a TPO list, report, or export on top of the current global admin service would create exactly the cross-college exposure the brief is meant to prevent.

### 2.3 Frontend route guard

`proxy.js`:

- reads a JWT from a JS-readable cookie;
- decodes the payload without verifying the signature;
- redirects by `role`;
- does not check expiry.

This is acceptable only as a UX guard. It must never be described as tenant authorization. A forged cookie can show a page, but backend calls should still fail. For staff pages, every data-bearing endpoint must derive scope from the server-side membership, not from the URL, query string, or cookie claim.

### 2.4 Required authorization pattern for Phase 1

1. Add a dedicated `PROFESSOR` authenticated role.
2. Add institution membership/designation/scope rows (TPO, HOD, faculty, college administrator).
3. Derive the active institution from the server-side membership on every request. Do not trust a client-provided institution ID.
4. Use repository methods such as `findByIdAndInstitutionId(...)`; return 404 for foreign IDs to avoid existence leaks.
5. Add method-level checks and tests for every staff route.
6. Keep platform `ADMIN` separate; any support access to college data must be explicit, time-bound, and audited.
7. Test with at least two institutions, two departments, two batches, and forged IDs.

### 2.5 Authorization test matrix (required)

| Test | Expected |
|---|---|
| Staff A lists students | Only institution A |
| Staff A requests student B by ID | 404 |
| Staff A exports institution B | 403/404, no file |
| TPO A invites staff into institution B | Denied |
| HOD A requests another department | 404/403 |
| Faculty A requests an unassigned mentee | 404/403 |
| Student token calls staff route | 403 |
| Staff token calls platform admin route | 403 |
| Expired/tampered JWT | 401 |
| Import row references another institution | Rejected and audited |
| Export includes unauthorized field | Field absent or request denied |
| Frontend guard bypassed | Backend still denies |
| Every denied/allowed sensitive action | Audit event recorded |

---

## 3. CSV import/export and spreadsheet safety

### 3.1 Current state

There is no CSV import or export implementation. The only CSV references in the repository are question-bank text (for example, a question about bulk-loading CSV). Therefore:

- there is no current CSV-injection surface;
- there is also no requirement coverage;
- **"no CSV" must not be reported as "CSV safe."**

### 3.2 Import controls required

- Institution-scoped permission (`student:import` or equivalent); never `ADMIN` as a shortcut.
- Strict template with required headers and a version.
- UTF-8 handling, BOM tolerance, file-size limit, row limit, and a timeout.
- Validate every row: email, mobile, institution/department/program/batch IDs, duplicate keys, required fields.
- Never trust institution/department IDs from the file beyond the actor's authorized scope.
- Transaction per batch; idempotency key; explicit duplicate policy (create/link/reject).
- Partial-success report with row numbers and reasons; downloadable error file restricted to the importer/authorized staff.
- Store import job metadata and audit events; do not retain the raw CSV longer than necessary.
- Rate-limit imports and scan uploads.
- Account invites: one-time hashed token, expiry, single use, no password in email, activation audit.

### 3.3 Export controls required

- Authorization is checked before query execution, not only in the UI.
- Scope is derived from the actor's membership, not from an `institutionId` query parameter.
- Field-level allowlist by designation; avoid exporting DOB/mobile to roles that do not need them.
- CSV formula-injection defense:
  - prefix cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return with a single quote or otherwise force text;
  - quote all fields and escape quotes/newlines;
  - emit `text/csv; charset=utf-8` and a safe `Content-Disposition` filename.
- Cap row counts, stream large exports, and prevent unbounded memory use.
- Audit export: actor, institution, filters, fields, row count, timestamp, request ID, result.
- Do not put exports in a public bucket; use a streamed response or a short-lived signed URL.
- Never bulk-export CV files by default; CV access needs a separate per-student permission and audit.
- Delete export artifacts after download/expiry.

### 3.4 Report/PDF controls

- Existing PDF download is owner-scoped and type-whitelisted; no path traversal was found (`ReportService.generatePdf` uses a switch over known types).
- A future staff report endpoint must not reuse the student controller by adding a student ID parameter without institution/role checks.
- Persist a report-generation record if staff reports are audited or regenerated.

---

## 4. Audit logging and logging hygiene

### 4.1 Current state

- Application logs exist for auth events, some admin CRUD, AI failures, and uploads.
- AI provider errors are sanitized and common key patterns are redacted.
- There is no audit entity/table, no append-only trail, no actor/institution/request ID correlation, and no before/after capture.
- Admin CRUD logs do not consistently identify the acting admin, source IP, or affected institution.
- There is no log for report access, CV download, export, or staff read access.

### 4.2 Required audit events

At minimum:

- staff/admin login, logout, failed login, MFA/invite events;
- role/designation/scope changes;
- institution/department/program/batch changes;
- student create/update/deactivate/import/link;
- assessment/readiness/report/CV/LinkedIn access by staff;
- report generation and download;
- CSV import/export with filters and row counts;
- export denial;
- mock-interview create/update/feedback;
- AI consent changes and data deletion;
- permission changes and support access.

### 4.3 Audit record design

Suggested fields:

```text
audit_events
  id
  occurred_at
  actor_user_id
  actor_role
  institution_id
  action
  entity_type
  entity_id
  outcome (ALLOWED/DENIED/FAILED)
  ip_address
  user_agent
  request_id
  metadata_json (redacted)
  prev_hash / event_hash (optional tamper evidence)
```

Requirements:

- append-only; no application update/delete path;
- queryable by institution, actor, action, entity, and time;
- redact secrets, tokens, raw CV text, and unnecessary PII;
- retention policy and legal hold;
- separate from debug logs;
- alert on repeated denied access/export anomalies.

---

## 5. Authentication and session security

### 5.1 Strengths

- JWT secret must be at least 32 bytes; prod fails fast without `JWT_SECRET`.
- Access tokens expire in 15 minutes by default.
- Refresh tokens are opaque, hashed at rest, rotated, and reuse revokes the family.
- BCrypt password hashing.
- Auth endpoints have an in-memory rate limiter.
- Login errors do not reveal whether an email exists (authentication failure is generic).
- Google ID tokens are verified server-side for audience, issuer, expiry, and verified email.
- Prod disables Swagger; health details are hidden.

### 5.2 Weaknesses

- Tokens are in `localStorage` and a JS-readable cookie; XSS becomes account takeover.
- No CSP increases XSS impact.
- The route guard does not verify signature or expiry.
- No email verification; a user can register with an email they do not control.
- No forgot-password/reset flow; account recovery is an operational manual process.
- No MFA for staff/admin.
- No device/session list or per-session revocation UI beyond "revoke all".
- The rate limiter is per-process and IP-based; it does not survive restart or scale horizontally.
- `X-Forwarded-For` trust is too permissive; a spoofed header can bypass per-IP limiting if the header reaches the backend.
- Admin first-run password is printed and not forced to rotate.

### 5.3 Required before staff rollout

- Verified email and invite-only activation.
- MFA or at least strong step-up auth for college administrators/TPO.
- Secure session storage/CSP or a BFF with HttpOnly cookies.
- Server-side session validation for staff pages, not unsigned JWT decoding.
- Trusted-proxy configuration and edge rate limiting.
- Forced admin password rotation and no secret echo in deploy logs.

---

## 6. Data protection, uploads, and AI privacy

### 6.1 Data protection

- CV S3 objects are private; downloads stream through the backend.
- Profile photos are local and owner-scoped.
- MySQL is not published to the host.
- TLS/HSTS is present at the public edge.
- Backend traffic to MySQL uses `useSSL=false` on the private Compose network. This is acceptable only while the network is truly private; it would be inadequate for a remote DB.
- There is no field-level access policy, data classification, operational consent, retention, or deletion workflow. A static Privacy Policy/Terms page was added late in the audit, but it is not backed by these controls.
- The admin student projection exposes mobile, DOB, college, and personal URLs platform-wide.

### 6.2 Uploads

- CV allows PDF/DOC/DOCX up to 5 MB; profile photos are separate.
- Keys are server-generated, which prevents path traversal.
- No magic-byte validation, malware scan, content-disarm, parser timeout, or quarantine.
- CV parsing is heuristic and should be treated as untrusted input.
- Add scanning/quarantine and a retention/deletion policy before staff bulk access.

### 6.3 AI

- The AI tool allowlist limits reads to the current student's data.
- Raw CV text is not sent by the assistant tools; profile fields and analysis summaries can be.
- Chat history is persisted.
- There is no AI-specific consent screen, provider retention control, or no-AI fallback for students who object. A general static privacy policy exists but does not implement consent or choice.
- Prompt injection can cause incorrect guidance and unwanted tool calls, but the reviewed tools are read-only and student-scoped. Do not add write/action tools without explicit confirmation and authorization.
- Provider errors are sanitized; live provider configuration was not verified.

---

## 7. Dependency and supply-chain posture

### 7.1 Frontend

`npm ci` installed 794 packages and reported 12 vulnerabilities (3 moderate, 8 high, 1 critical). `npm audit --omit=dev` still reports 12 because several affected packages are in the production tree.

Critical/direct:

- `next@16.3.5` — critical; fixed in `16.4.3`. Advisories include unauthenticated RCE in image optimization/`use cache`/`next/og` paths.
- `shadcn` is a direct production dependency although it is a CLI/tooling package; it contributes a high advisory and unnecessary runtime supply-chain surface.

High/transitive examples:

- `@modelcontextprotocol/sdk`, `body-parser`, `follow-redirects`, `sharp`, `source-map-js`, `undici`, `zod`.

Action:

1. Upgrade `next` and `eslint-config-next` to the patched version.
2. Re-run `npm ci`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.
3. Move CLI-only packages to `devDependencies`.
4. Do not use `npm audit fix --force` blindly; verify the framework upgrade and lockfile diff.
5. Add audit to CI.

### 7.2 Backend

- Spring Boot 3.5.4, Spring AI 1.1.0, JJWT 0.12.6 are pinned.
- No Maven dependency vulnerability scan was configured or run.
- Add OWASP Dependency-Check or equivalent to CI and define a patch cadence.

### 7.3 Containers

- Images run as non-root.
- Base images are tag-pinned, not digest-pinned.
- No image signing/SBOM/scan in the repository.
- Add image scanning and SBOM generation before a college production release.

---

## 8. Production and deployment audit

### 8.1 Controls that are present

| Control | Assessment |
|---|---|
| Secrets in environment, not images | Good |
| JWT secret length/fail-fast | Good |
| Non-root containers | Good |
| MySQL private network | Good (not published) |
| Swagger disabled in prod | Good |
| Health endpoint limited, no details | Good |
| HSTS and basic security headers | Good |
| S3 private objects | Good |
| Automated first-run bootstrap | Good for empty DB, not for ongoing schema change |
| Rate limiting | Basic, single-instance |
| CORS | Explicit origins, credentials enabled; no wildcard found |

### 8.2 Gaps

| Area | Finding | Severity |
|---|---|---|
| CI | No pipeline; no merge/release gate | High |
| Migrations | One-time `ddl-auto=update`; no versioned migrations | High |
| Test suite | 1 failure; build fails | High |
| Deployment parity | Live backend lacks newer Google routes | High |
| Staging | No staging environment or synthetic data | Medium |
| Backups | Manual runbook only; no automation/restore test | Medium |
| Monitoring | Health/logs only; no metrics/alerting/tracing | Medium |
| Rollback | No tested application/schema rollback procedure | High |
| Secrets rotation | No periodic rotation/automation | Medium |
| Backend exposure | `8080:8080` published; blocked externally in this test only | Medium |
| Storage fallback | Local volume can be selected without strong warning | Medium |
| Admin bootstrap | Printed password, no forced rotation | Low/Medium |
| CSP | Missing | Medium |
| Error tracking | Missing | Medium |
| Data retention | Missing | Medium |
| Load capacity | Not tested | Unknown |

### 8.3 Deployment parity finding

The live frontend, backend, and repository HEAD are not from the same effective build:

- live frontend JavaScript contains `auth/config` and Google Identity code (the Oct-16 baseline);
- live `GET /api/v1/auth/config` returns `401`;
- live `POST /api/v1/auth/google` returns `404`;
- live `/legal/privacy` and `/legal/terms` return `404`, although both pages exist in HEAD;
- repository code exposes the auth routes and permits config.

This is a concrete production-control failure. The deploy script has no commit marker, no version endpoint, and no post-deploy route smoke test for auth/legal routes. Add a deploy manifest and smoke checks.

### 8.4 Backend network exposure

Compose publishes `8080:8080`. A public probe timed out, which suggests a host firewall, but the repository itself does not guarantee private-only. The correct configuration is to remove the host port or bind it to loopback, and expose only the frontend/reverse proxy. The Next rewrite should be the only path to the API from browsers.

---

## 9. Privacy and compliance readiness

The current product can collect name, email, mobile, DOB, college, degree, branch, graduation year, semester, location, GitHub/LinkedIn/portfolio, CV, profile photo, assessment results, AI chat, and career plans. For a college rollout, this becomes education records and staff-accessible PII.

A static Privacy Policy and Terms page now exists in the repository (added after the initial review), but it is not operational compliance:

- Contact details are placeholders: `admin@your-college.edu` and `https://careeros.your-college.edu`.
- The policy claims access/correction/deletion/portability, retention, and institution sharing, but there is no request workflow, deletion path, retention job, or consent record.
- The registration checkbox text is plain spans, not links (`app/register/page.jsx:216-222`).
- Google sign-up is a separate path that does not require the checkbox.
- There is no AI-specific consent, provider retention control, or no-AI opt-out.
- The live site returns 404 for `/legal/privacy` and `/legal/terms`, so users cannot currently read the policy.
- No processor agreements/data-region disclosure, staff-access audit review, breach runbook, or backup key-management statement was found.

Still missing or partial:

- operational consent/notice for collection and AI processing;
- role-based field minimization;
- data retention and deletion;
- subject access/export;
- processor agreements and data-region disclosure;
- audit of staff access;
- breach/incident runbook;
- backup encryption/key management statement;
- consequence/access review for staff.

This is not just a legal formality: the absence of field-level policy would let a broad faculty role see mobile/DOB/CV data it does not need, and the current placeholder policy would be misleading if presented as compliance.

---

## 10. Security acceptance checklist for Phase 1

Do not call the college Phase 1 production-ready until all are true:

- [ ] Two institutions are seeded; cross-college list/report/export/IDOR tests pass.
- [ ] `PROFESSOR` + membership/designation model is implemented; `ADMIN` is not used as TPO.
- [ ] Invite-only onboarding, email verification, expiry, revocation, and audit work.
- [ ] Every staff query derives institution/scope server-side.
- [ ] CSV import is validated, idempotent, partially recoverable, scoped, and audited.
- [ ] CSV exports neutralize formula injection and enforce field/row scope.
- [ ] Durable audit events cover sensitive reads/writes/exports/denials.
- [ ] Next.js is patched; `npm audit --omit=dev` has no critical/high findings that are not risk-accepted.
- [ ] Backend tests pass; frontend lint/build pass; CI enforces them.
- [ ] Migrations are versioned, rehearsed, and rollback-documented.
- [ ] Backup automation and a restore drill are evidenced.
- [ ] Staging exists with synthetic data.
- [ ] Deployment exposes the tested commit and post-deploy smoke tests pass.
- [ ] CSP, token storage, rate limiting, and trusted-proxy configuration are hardened.
- [ ] Privacy policy contacts/claims are accurate and the pages are deployed; consent is captured for all signup paths, including Google.
- [ ] AI consent, retention, and data-minimization are documented.
- [ ] Staff field-level access and audit review are approved by the college.

---

## 11. Audit test evidence and limitations

Commands/results are recorded in the summary. The security conclusions rely on:

- code review of `SecurityConfig`, JWT/filter/rate-limiter code, controller/service ownership checks, storage, and admin services;
- existing integration tests for auth, authorization, CV, reports, roadmap/projects, AI, and settings;
- frontend lint/build and `npm audit`;
- unauthenticated live HTTP checks for headers, routes, the Google mismatch, and the 404 responses for `/legal/privacy` and `/legal/terms`.

Not performed:

- authenticated live tests;
- IDOR fuzzing;
- SQL injection/XSS/CSRF testing;
- dependency scanning for Maven;
- container/image scanning;
- restore drill;
- load test.

These limitations are material. The audit found no direct student IDOR, but it cannot prove absence. The college tenant boundary is absent, so its security cannot be tested yet.

Related documents:

- [Technical discovery](CAREEROS_TECHNICAL_DISCOVERY.md)
- [Requirements gap matrix](CAREEROS_REQUIREMENTS_GAP_MATRIX.md)
- [Implementation roadmap](CAREEROS_IMPLEMENTATION_ROADMAP.md)
- [Audit summary](CAREEROS_AUDIT_SUMMARY.md)
