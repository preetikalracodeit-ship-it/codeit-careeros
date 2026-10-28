# CODEIT CareerOS — Implementation Roadmap

> **Superseded for Phase 1-4 status (2026-10-28):** The Phase 2-4 items below are retained as planning history. The current working tree contains uncommitted Phase 1-4 implementation and local/test evidence; see [PHASE1_FINAL_ACCEPTANCE_AUDIT.md](PHASE1_FINAL_ACCEPTANCE_AUDIT.md). Staging/production deployment is still not claimed or authorized.

> **Planning document plus Phase 0 status.** The College/TPO phases below are not implemented. It preserves the existing MySQL + Spring Boot + Next.js architecture and assumes the audit's recommendation to re-baseline the brief's Phase 1 before building. Phase 0 stabilization work is in the working tree but is uncommitted and undeployed; see [CAREEROS_AUDIT_SUMMARY.md](CAREEROS_AUDIT_SUMMARY.md).

> **Phase 0 status (2026-10-27, later state):** dependency/test stabilization, build/version visibility, health probes, request IDs, consent enforcement with durable evidence, role-cookie migration, report-only CSP, rate-limiter hardening, CI workflow, deployment smoke script, Flyway V1–V3, platform-admin audit events, and backend dependency scanning are locally implemented and verified (backend suite green; frontend build/lint pass; npm audit 0; local smoke 9/9). The CI workflow and MySQL migration job have not executed on the repository host, and no production migration/deploy has run. Phase 1A remains blocked on an approved role/membership matrix and migration strategy; see [CAREEROS_COLLEGE_ROLE_MATRIX.md](CAREEROS_COLLEGE_ROLE_MATRIX.md).

## 0. Principles

1. **Resolve scope before UI.** The brief's Phase 1 and the repository PDF's Phase 1 are different products. Approve one in writing.
2. **Tenant foundation first.** Institution, enrollment, staff membership, and server-derived scope must exist before any TPO list, dashboard, report, or export.
3. **Do not use `ADMIN` as a college role.** Add `PROFESSOR` and scoped designations.
4. **Reuse, don't duplicate.** College read models should call the existing readiness/assessment/CV/roadmap/project services through staff-authorized methods. Do not create a second CareerOS or copy business logic.
5. **Additive, reversible changes.** No destructive migration, no rewriting existing student data, no production-data experiments.
6. **Audit and permission are part of the feature.** A report/export/import is not done until its authorization and audit event are done.
7. **No new app, no UI redesign, no stack migration.** Keep MySQL, Spring Boot, Next.js, and the existing design system.
8. **Green gates only.** No Phase 1 release while backend tests fail, a critical frontend advisory is open, or the deployed backend does not match the tested commit.

---

## 1. Gate 0 — Scope and ownership decision

**Deliverable:** a one-page signed decision covering:

- Which Phase 1 is authoritative: the brief's college/TPO scope or the PDF's student/admin scope?
- Are mock interviews in Phase 1? If yes, is the requirement scheduling/outcome tracking, AI interview simulation, or both?
- Which staff designations are required: TPO, HOD, faculty, college administrator, or a subset?
- Is a student allowed to belong to more than one institution in Phase 1?
- Is placement status part of Phase 1? There is no placement model today.
- Which fields may each designation see (mobile, DOB, CV, AI chat, LinkedIn)?
- Which institution is the pilot, and who owns data mapping/approval?
- Who owns the privacy/terms text, consent model, retention schedule, and data-subject request process? The current pages use configurable owner contacts; Google signup now requires the same consent checkbox, but retention/deletion policy is still unapproved (see `DATA_RETENTION_AND_DELETION.md`).

**Exit criteria:** written scope, role matrix, field-visibility matrix, pilot institution, and acceptance criteria. Do not implement dashboards before this gate.

---

## 2. Phase 0 — Release stabilization (before college code)

Target: 2–4 working days, assuming no framework-upgrade surprises.

### 2.1 Fix the release blockers

1. **Upgrade Next.js**
   - `next` 16.3.5 → `16.4.3` or later patched release.
   - Update `eslint-config-next` to the same line.
   - Run `npm ci`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.
   - Verify `next/image` behavior; the app uses it in `logo.jsx` and `hero-scroll.jsx`.
   - Do not use `npm audit fix --force` without reviewing the lockfile and framework compatibility.

2. **Fix the stale Gemini test**
   - `AiChatGeminiAutoConfigTest.gemini_effectiveKeyAndModel` expects `gemini-2.0-flash`; the application default is `gemini-2.5-flash`.
   - The deploy script itself warns that 2.0 was shut down, so the test expectation is stale.
   - Align the test with the supported model (or explicitly set the test property) and make `mvn test` green.

3. **Add CI**
   - Backend: JDK 21, `mvn -B test`.
   - Frontend: `npm ci`, `npm run lint`, `npm run build`.
   - Dependency audit: fail on critical/high unless a documented exception exists.
   - No production deploy from CI in Phase 0; build/test only.

4. **Deployment parity**
   - Add a public, non-secret version endpoint or build metadata (commit SHA, build time, environment).
   - Add post-deploy smoke checks for `/`, `/login`, `/api/v1/careers`, `/api/v1/auth/config`, and the Google route's expected behavior.
   - Investigate why the live backend lacks the Oct-16 routes; redeploy or fix the nginx/API upstream.
   - Never call a deploy successful until frontend and backend report the same commit.

5. **Migration baseline**
   - Introduce versioned migrations before any new college table.
   - Recommended: Flyway with the existing schema baselined; if adding Flyway is not approved, a small versioned SQL runner with a schema-history table is the minimum.
   - Record the current production schema as the baseline; do not let `ddl-auto=update` mutate production again.

6. **CSP and basic hardening**
   - Add a Content-Security-Policy in report-only mode first, then enforce after checking the app's inline styles/scripts and Google Identity origin.
   - Disable `X-Powered-By`.
   - Keep HSTS and existing headers.
   - Longer-term: move staff sessions toward HttpOnly/server-validated cookies or a BFF; do not pretend the current localStorage scheme is XSS-safe.

7. **Legal/consent alignment**
   - Replace placeholder privacy/terms contacts (`admin@your-college.edu`, `careeros.your-college.edu`) with approved details.
   - Make the registration Terms/Privacy text actual links.
   - Require the consent checkbox for email **and** Google sign-up.
   - Record consent server-side where required, and implement the access/deletion/retention rights the policy claims.
   - Deploy `/legal/privacy` and `/legal/terms`; they currently return 404 live.

**Phase 0 exit criteria**

- `mvn test` green (278+ tests).
- `npm run lint` and `npm run build` green (current HEAD builds 30 static pages).
- No critical/high frontend advisory unresolved without a written exception.
- Live frontend/backend commit parity demonstrated, including legal and auth routes.
- Migration mechanism tested on a copy.
- CI runs on the default branch.
- Privacy contacts are accurate and consent is enforced on all signup paths.

---

## 3. Phase 1A — Tenant foundation and staff identity

Target: 1–2 weeks, after Gate 0.

This phase unlocks every later college feature. Do not build TPO UI first.

### 3.1 Canonical academic model

Add additive tables (names illustrative; final naming follows existing conventions):

| Table | Key fields | Notes |
|---|---|---|
| `institutions` | id, code, name, status, timezone, contact_email, created_at | `code` unique; status active/inactive |
| `departments` | id, institution_id, code, name, status | unique (institution_id, code) |
| `programs` | id, institution_id, department_id, code, name, degree_type, duration | unique (institution_id, code) |
| `academic_years` | id, institution_id, label, start_date, end_date, active | one active per institution |
| `batches` | id, program_id, academic_year_id, label, graduation_year | unique (program_id, label) |
| `sections` | id, batch_id, name, status | unique (batch_id, name) |
| `student_enrollments` | id, student_profile_id, institution_id, department_id, program_id, batch_id, section_id, roll_number, status, start_date, end_date | unique (institution_id, roll_number); one active enrollment per student for Phase 1 |

**Backfill**

- Keep `student_profiles.college/degree/branch/graduation_year/semester` during transition; do not drop them.
- Map free-text values to canonical institutions/departments/programs/batches with an admin-reviewed mapping.
- Start nullable; backfill; validate; then enforce where safe.
- Create a legacy/pilot institution for unmatched records rather than guessing.
- Do not auto-merge institutions by name similarity.

**Scope strategy**

- Use `student_enrollments` as the authoritative student-institution relation.
- Keep career/skill/assessment master data platform-level unless a documented requirement says otherwise.
- Add indexes on institution_id, department_id, program_id, batch_id, section_id, student_profile_id, and created_at.
- Do not add a blind `tenant_id` to every table; use the enrollment/membership joins and add tenant keys only where the access model needs them.

### 3.2 Roles and staff membership

Keep platform `ADMIN` distinct. Add:

- `Role.PROFESSOR` as the authenticated college-staff role (as previously recommended), and
- a membership/designation model:
  - `institution_memberships`: user_id, institution_id, designation (`TPO`, `HOD`, `FACULTY`, `COLLEGE_ADMIN`), status, scope_type, scope_id, invited_by, accepted_at, created_at.
  - Scope can be institution, department, program, batch, or section. Use the narrowest scope needed.
  - A staff member may have one or more memberships; Phase 1 can restrict to one active membership for simplicity.

**Authorization rule**

- Derive the actor's institution/scope from the server-side membership on every request.
- Never trust `institutionId`, `departmentId`, or role from the URL, query string, JWT claim, or local storage.
- Use repository methods that include the institution/scope predicate.
- Return 404 for foreign resources.
- Keep `ADMIN` platform-level; any support access to college PII must be a separate, explicit, time-bound, audited permission.

### 3.3 Invite-only onboarding

Tables/flow:

- `staff_invitations`: institution_id, email, designation, scope_type, scope_id, token_hash, expires_at, accepted_at, revoked_at, created_by.
- One-time token, hashed at rest, 24–48 hour expiry, single use.
- Email delivery through an interface (`InvitationMailer`) with a provider adapter (SES or SMTP; no hardcoded credentials).
- Activation requires email verification and password setup; no password in the email.
- Resend/revoke; rate-limit; audit.
- Do not auto-create staff from CSV or self-registration.

### 3.4 Audit foundation

- Add append-only `audit_events` (see security audit).
- Record invites, activation, role/scope changes, deactivation, denied access, and later imports/exports/report/CV access.
- Redact secrets and raw CV text.
- Add request ID propagation.

### 3.5 Tests

- Two institutions A/B; staff A cannot read/list/export B.
- TPO/HOD/faculty/college-admin scope matrix.
- Invite expiry, reuse, revocation, wrong-email, wrong-institution.
- Forged JWT role/institution claim.
- Foreign IDs return 404.
- Audit event created for allow and deny.
- Existing student tests remain green.

**Phase 1A exit criteria:** a pilot institution can be created, staff can be invited/activated/scoped, a staff member can access only their authorized scope, and the isolation suite passes in CI.

---

## 4. Phase 1B — CSV student import and account onboarding

Target: 1–2 weeks.

### 4.1 Import pipeline

1. Download a versioned template.
2. Upload with size/row limits and permission `student:import`.
3. Parse/validate:
   - required headers and template version;
   - email, mobile, institution/department/program/batch/section codes;
   - roll number and duplicate policy;
   - date/graduation-year sanity;
   - UTF-8/BOM and malformed rows.
4. Preview: create/link/skip/error counts before commit.
5. Commit in batches with idempotency.
6. Produce row-level error CSV, downloadable only by authorized staff.
7. Send invites/setup links; do not email plaintext passwords.
8. Record import job, counts, actor, institution, source file hash, and audit events.
9. Delete/retain the raw upload according to policy.

### 4.2 Duplicate and account-linking rules

Define and test:

- existing email in the same institution → link/enroll or reject per policy;
- existing email in another institution → reject unless explicitly authorized;
- duplicate roll number in institution → reject;
- same person with multiple emails → no automatic merge in Phase 1;
- inactive/graduated student → explicit status, no silent overwrite.

### 4.3 CSV safety

- Treat all cells as text; never evaluate formulas.
- Reject unexpected HTML/script content? At minimum, store as text and render escaped.
- Validate institution IDs against the actor's scope, not the file's claim.
- Limit file size/rows/time; stream where possible.
- Audit failures/denials.
- Add tests for cross-institution rows, duplicate rows, malformed CSV, formula payloads, and partial failures.

**Phase 1B exit criteria:** a pilot can import a representative student file, see a correct preview, resolve duplicates, invite students, download a scoped error report, and prove no cross-college import is possible.

---

## 5. Phase 1C — Student management and 360 view

Target: 1–2 weeks.

### 5.1 Scoped list and search

- Server-side search: name, email, roll number.
- Filters: institution, department, program, batch, section, status, target career, assessment completion, readiness band.
- Sort: name, roll number, created date, readiness.
- Pagination with stable ordering and indexes.
- No client-side-only filtering of the current page.

### 5.2 Student 360

Reuse existing services through staff-authorized methods:

- profile/academic/enrollment;
- assessment history and latest scores;
- readiness/gaps;
- roadmap/projects progress;
- CV metadata/analysis (not raw file by default);
- LinkedIn analysis;
- report summaries/PDF access if permitted;
- notes/interventions only if a requirement exists (do not invent).
- Mock interview outcomes if Phase 1 includes them.

### 5.3 Field-level visibility

Define by designation:

| Field | TPO | HOD | Faculty | College admin |
|---|---|---|---|---|
| Name/email/roll | Yes | Scoped | Scoped | Yes |
| Mobile/DOB | Policy | Policy | Usually no | Policy |
| Assessments/readiness | Yes | Scoped | Assigned mentees | Yes |
| CV file | Explicit permission | Explicit permission | Usually no | Policy |
| LinkedIn URL | Yes | Scoped | Scoped | Yes |
| AI chat | No by default | No by default | No by default | No by default |
| Reports/exports | Yes, scoped | Scoped | Mentees only | Yes |

The final matrix must be approved by the college, not assumed by engineering.

### 5.4 Student lifecycle

- Edit academic/enrollment data with audit.
- Deactivate/graduate/transfer with reason and audit.
- No hard delete by default; use status and a documented erasure process.
- Preserve user self-service profile edits; staff edits must not silently overwrite student data.

**Phase 1C exit criteria:** TPO can find any authorized student from the full population, open a consistent 360 view, see only permitted fields, and every sensitive view is audited.

---

## 6. Phase 1D — TPO dashboard, reports, and exports

Target: 1–2 weeks.

### 6.1 Dashboard metrics

Implement as database aggregates, not per-student loops:

- total students, active students, graduated/inactive;
- assessment completion (unique students and attempts);
- readiness bands (e.g., 0–39/40–59/60–79/80–100);
- average readiness by department/program/batch;
- top skill gaps by cohort;
- roadmap/project completion;
- placement status only if the data model exists;
- trend over time only if readiness/attempt snapshots support it.

Each metric must define its denominator and be reproducible in SQL. Do not reuse global admin counts as college counts.

### 6.2 Filters and drill-down

- Filter by academic year, department, program, batch, section, status, target career, readiness band.
- Drill down from a metric to the authorized student list with the filter preserved.
- Empty states and "no data" must be honest, not zero-filled fake values.

### 6.3 Reports and exports

- Staff report access only through scoped authorization.
- CSV export with:
  - field allowlist by designation;
  - row cap and streaming;
  - formula-injection neutralization;
  - safe content type/filename;
  - audit event with filters/row count/hash;
  - short-lived or streamed download.
- PDF exports only if a requirement exists; reuse report generation.
- No bulk CV export by default.
- Add export tests for scope, field restriction, formula payloads, and denial.

**Phase 1D exit criteria:** a TPO can compare cohorts, drill to students, export only authorized fields, and reconcile every metric to the database. A cross-college export request is denied and audited.

---

## 7. Phase 1E — Mock interviews (conditional)

Target: 1 week, only after Gate 0 clarifies scope.

### Option A — scheduling/outcome tracking

- `mock_interviews`: institution, student, scheduled_at, mode, interviewer, status, score/feedback, created_by/updated_by.
- Student view of own schedule/feedback.
- Staff view scoped to institution/department/mentees.
- Reminders require email/notification infrastructure; do not promise them unless built.
- Audit and consent.

### Option B — AI interview simulation

This is a materially larger product. It needs:

- a separate consent/data flow;
- prompt/response storage and retention;
- safety/evaluation criteria;
- provider cost controls;
- human-review boundaries;
- explicit labeling that it is practice, not a hiring decision.

Do not silently interpret "mock interviews" as Option B. If the brief means scheduling/tracking, build Option A first.

**Phase 1E exit criteria:** the chosen option is usable end to end, scoped, audited, and covered by tests; no AI simulation is marketed as real interview scoring.

---

## 8. Phase 1F — Hardening and release

Target: 1 week.

### 8.1 Security and correctness

- Full two-institution isolation suite, including forged IDs and exports.
- Role/field visibility tests.
- CSV injection/import abuse tests.
- Authenticated E2E smoke for the main TPO and student journeys.
- Rate-limit/trusted proxy review.
- CSP enforcement; token storage decision.
- Dependency audit and image scan.
- Audit-log review and retention.
- Privacy-policy accuracy, linked consent, retention/deletion workflow, and DPA input.
- Backup/restore drill on a copy.
- Migration rehearsal and rollback note.
- Load test with realistic cohort sizes; check dashboard query plans and indexes.
- Uptime/error alerts and a release marker.

### 8.2 Release gates

- [ ] Scope/role/field matrix approved.
- [ ] `mvn test` green; frontend lint/build green; audit clean or exceptions documented.
- [ ] Two-institution isolation, IDOR, import, export, and audit tests pass.
- [ ] Migrations applied on a copy and verified.
- [ ] Backup/restore drill passes.
- [ ] Deployed frontend/backend commit parity verified.
- [ ] Privacy pages deployed with accurate contacts; consent enforced for email and Google signup; retention/deletion defined.
- [ ] Staging acceptance by a real TPO/faculty proxy user.
- [ ] No critical/high security exception open.
- [ ] Rollback and incident contacts documented.

---

## 9. Indicative sequence and effort

These are planning ranges, not commitments. Validate after Gate 0.

| Phase | Indicative effort | Depends on |
|---|---:|---|
| Gate 0 — scope/role/field decisions | 1–2 days | Product/college owner |
| Phase 0 — stabilization | 2–4 days | Gate 0 not strictly required for dependency/test/legal fixes |
| Phase 1A — tenant foundation | 1–2 weeks | Phase 0, Gate 0 |
| Phase 1B — CSV import | 1–2 weeks | Phase 1A |
| Phase 1C — student management/360 | 1–2 weeks | Phase 1A, 1B |
| Phase 1D — dashboard/reports/exports | 1–2 weeks | Phase 1A–C |
| Phase 1E — mock interviews | 1 week (Option A) | Gate 0, Phase 1A/C |
| Phase 1F — hardening/release | 1 week | All above |

A realistic pilot-ready sequence is **8–12 weeks** for a focused team, excluding college data cleanup and email/provider procurement. The largest uncertainty is not coding; it is scope, data mapping, and college approval of field visibility.

---

## 10. Explicitly out of scope / do not do

- Do not create a second app or duplicate the student CareerOS.
- Do not redesign the existing UI or replace the design system.
- Do not migrate MySQL to PostgreSQL just because the PDF's example stack says PostgreSQL.
- Do not use `ADMIN` as a TPO/professor workaround.
- Do not build employer portal, job matching, campus hiring, OJT, or internship management in this Phase 1.
- Do not scrape LinkedIn.
- Do not add microservices, a separate data warehouse, or a new auth provider without a documented requirement.
- Do not build dashboards before tenant scoping.
- Do not expose raw CVs/AI chats to broad faculty roles.
- Do not call mock-interview AI output a hiring decision.
- Do not treat a green frontend build as a release; backend, migrations, deployment parity, and audit matter.

---

## 11. Open decisions

1. Does the brief's college/TPO scope supersede the PDF's Phase 1?
2. Are mock interviews scheduling/tracking, AI simulation, or both?
3. Which staff designations exist in the pilot, and what is each allowed to see?
4. Can a student belong to more than one institution in Phase 1?
5. Is placement status required? If yes, what is the source of truth?
6. Which email provider (SES, college SMTP, other) is approved?
7. Is Flyway acceptable, or is a versioned SQL runner required?
8. Who owns institution/department/program mapping and student duplicate resolution?
9. What is the retention period for CVs, imports, audit events, and AI chats?
10. Is platform-admin support access to college PII allowed? Under what approval/audit?

---

## 12. Recommended next task

**Next task:** run Gate 0 and start Phase 0 immediately; do not start TPO UI.

Concretely:

1. Get written Phase 1 scope and role/field-matrix approval.
2. Patch Next.js to `16.4.3+`, fix the stale Gemini test, and make CI green.
3. Redeploy/repair the backend so live Google Sign-In and `/auth/config` match the tested frontend, and deploy the legal pages.
4. Fix the placeholder privacy contacts and consent bypass, and approve the tenant data model and migration approach.
5. Implement Phase 1A (institution + `PROFESSOR`/membership + invite-only onboarding + isolation tests) before any dashboard, import, or export work.

This order protects student data, avoids building on a global admin service, and gives the team a defensible release gate.

Related documents:

- [Technical discovery](CAREEROS_TECHNICAL_DISCOVERY.md)
- [Requirements gap matrix](CAREEROS_REQUIREMENTS_GAP_MATRIX.md)
- [Security and production audit](CAREEROS_SECURITY_AND_PRODUCTION_AUDIT.md)
- [Audit summary](CAREEROS_AUDIT_SUMMARY.md)
