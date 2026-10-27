# CODEIT CareerOS — Requirements Gap Matrix

> **Audit-plus-remediation status.** The baseline rows below are based on repository evidence, existing automated tests, the production build, and unauthenticated live checks. Later stabilization work is uncommitted and locally verified only; a feature is not marked complete merely because a file, table, route, or UI label exists, and local tests do not establish live deployment parity. See [CAREEROS_AUDIT_SUMMARY.md](CAREEROS_AUDIT_SUMMARY.md).

> **Post-audit remediation snapshot (2026-10-27):** the college/TPO functional totals are unchanged (0 of 49 complete). Phase 0 improvements are local and uncommitted: backend 298/0, frontend build/lint pass, npm audit 0, CI workflow added but not executed remotely, build-version endpoint and health probes added, consent enforced for new accounts and logged (not durably stored), role cookie and report-only CSP added, rate limiter hardened. Live deployment parity remains unresolved and no migration was added.

## 0. Status definitions

| Status | Meaning |
|---|---|
| **COMPLETE AND VERIFIED** | Implemented and exercised by automated tests and/or reproducible builds/checks; behavior is credible. |
| **PARTIALLY IMPLEMENTED** | Some code/data/UI exists, but the requirement is not end to end, not correctly scoped, or not covered by sufficient evidence. |
| **IMPLEMENTED BUT UNVERIFIED** | Code exists and may be logically sound, but the real integration or live behavior was not proven. |
| **MISSING** | No implementation was found. |
| **BLOCKED** | Requirement cannot be assessed/implemented without an external decision, access, or unresolved dependency. |

No row in the brief's college/TPO scope is **BLOCKED** in the technical sense; the missing work is not blocked by technology, but by scope and sequencing. The scope conflict itself is recorded below.

## 1. Scope note

Two different "Phase 1" definitions were found:

1. **The audit brief (controlling for this audit):** college/TPO Phase 1 — institution setup, staff roles, CSV import, student management, college dashboards, reports/exports, mock interviews, tenant isolation, auditability.
2. **The repository PDF (`docs/CODEIT_CareerOS_Developer_Documentation.pdf`):** Phase 1 is the student core plus admin content management. College/TPO, multi-tenancy, and mock interviews are explicitly Phase 2/3.

This matrix reports both:

- **Section 2:** brief's expanded college/TPO Phase 1.
- **Section 3:** the repository PDF's narrower Phase 1 baseline.
- **Section 4:** cross-cutting security/production requirements.

**Late repository change (baseline):** privacy-policy and terms pages were committed during the audit, after the baseline tests. At that point they changed only the privacy/consent row from MISSING to PARTIAL; they were static notice pages, not an operational consent/retention system, and were not deployed live. The subsequent uncommitted working tree links and enforces consent for new accounts, removes fake contacts, and logs consent, but still lacks durable consent storage and live verification.

## 2. Brief Phase 1 — college/TPO requirements

### 2.1 Summary

| Category | Total | Complete and verified | Partially implemented | Implemented but unverified | Missing |
|---|---:|---:|---:|---:|---:|
| Tenant/academic structure (T1–T10) | 10 | 0 | 1 | 0 | 9 |
| Roles and staff access (R1–R9) | 9 | 0 | 1 | 0 | 8 |
| Student onboarding/import (I1–I8) | 8 | 0 | 0 | 0 | 8 |
| Student management/360 (S1–S8) | 8 | 0 | 2 | 0 | 6 |
| TPO dashboard/analytics (D1–D6) | 6 | 0 | 2 | 0 | 4 |
| Reports/exports (E1–E6) | 6 | 0 | 1 | 0 | 5 |
| Mock interviews (M1–M2) | 2 | 0 | 0 | 0 | 2 |
| **Functional total** | **49** | **0** | **7** | **0** | **42** |

**Result: 0 of 49 functional college/TPO requirements are complete and verified.** The existing student/admin product is a useful base, but it does not satisfy this Phase 1.

### 2.2 Tenant and academic structure

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| T1 | Canonical institution/college record (name, code, location, contacts, status) | **MISSING** | `student_profiles.college` is free text (`StudentProfile.java:55`); no institution entity/table/repository. |
| T2 | Departments under an institution | **MISSING** | No department entity, table, route, or UI. `branch` is free text (`StudentProfile.java:61`). |
| T3 | Programs/degrees mapped to departments | **MISSING** | `degree` is free text (`StudentProfile.java:58`); no program/degree catalog. |
| T4 | Batches/graduation years | **MISSING** | `graduation_year` is an integer on the profile; no batch entity or lifecycle. |
| T5 | Sections | **MISSING** | No section field/table/route. |
| T6 | Academic years/semesters | **MISSING** | `semester` is an optional integer (`StudentProfile.java:74`); no academic-year or term model. |
| T7 | Institution lifecycle and configuration | **MISSING** | No activation/deactivation, branding, contacts, timezone, or institution settings. |
| T8 | Canonical student enrollment/academic mapping | **PARTIAL** | Free-text college/degree/branch plus year/semester exist, and the profile mapper exposes them (`StudentProfileMapper.java:23-27`). They are not canonical, validated, or linked to an institution. |
| T9 | Server-derived institution scope on every request | **MISSING** | No institution membership or scope resolution. Admin endpoints are platform-wide. |
| T10 | Cross-college isolation tests | **MISSING** | No second institution exists to test against; no tenant-scoped repositories or isolation suite. |

### 2.3 Roles and staff access

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| R1 | Dedicated `PROFESSOR` authenticated role | **MISSING** | `Role.java` has only `STUDENT, ADMIN`; no `PROFESSOR` anywhere in Java/JS. |
| R2 | TPO role/permissions | **MISSING** | No TPO role, designation, or scoped permission. |
| R3 | HOD role/permissions | **MISSING** | No HOD role or department scope. |
| R4 | Faculty role/permissions | **MISSING** | No faculty role or mentee/section scope. |
| R5 | College administrator role | **MISSING** | No institution-level administrator. `ADMIN` is platform-wide (`SecurityConfig.java:59`). |
| R6 | Platform admin separated from college staff | **PARTIAL** | A platform `ADMIN` exists and is protected by `hasRole("ADMIN")`, but there is no staff role to separate from it. |
| R7 | Invite-only staff onboarding/activation | **MISSING** | No invitation entity, token, email flow, activation page, or staff registration route. Registration always creates `STUDENT` (`AuthService.java:61,106`). |
| R8 | Staff lifecycle, role changes, deactivation, audit | **MISSING** | No staff management API/UI. `UserStatus.INACTIVE/LOCKED` exist but no code changes status. |
| R9 | Authorization matrix and forged-ID tests | **MISSING** | Existing tests cover student ownership, not staff roles, institution scopes, or cross-college IDOR. |

**Design constraint:** the prior recommendation remains the correct direction: a dedicated `PROFESSOR` role, canonical institution, invite-only onboarding, and **server-derived** institution scope. `ADMIN` must not be reused as a TPO workaround.

### 2.4 Student onboarding and import

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| I1 | CSV student import | **MISSING** | No import endpoint, parser, page, job, or table. CSV matches in the repo are question content, not import code. |
| I2 | Import template/header/schema validation | **MISSING** | No template or schema contract. |
| I3 | Per-row validation (email, mobile, institution IDs) | **MISSING** | No import validation. Existing registration validates single accounts only. |
| I4 | Duplicate detection and reconciliation | **MISSING** | No import duplicate policy. User email is unique; no institution/roll-number uniqueness. |
| I5 | Partial success and row-level error report | **MISSING** | No import job/error model or downloadable error file. |
| I6 | Account creation/linking and invite credentials | **MISSING** | No bulk invite, email delivery, activation, or account-linking flow. |
| I7 | Import permission, audit, retention | **MISSING** | No scoped permission, no audit log, no retention policy. |
| I8 | CSV formula-injection defense for exports | **MISSING** | There are no CSV exports yet. When added, cells starting with `=`, `+`, `-`, `@`, tab, or carriage return must be neutralized; see security audit. |

### 2.5 Student management and 360 view

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| S1 | College-scoped student list | **PARTIAL** | Admin list exists but is platform-wide: `studentProfileRepository.findAll(pageable)` (`AdminStudentService.java:26`). |
| S2 | Server-side search/filter by department, program, batch, status | **MISSING** | Backend accepts only `page`/`size` and sorts by `createdAt` (`AdminStudentService.java:23-26`). The frontend filters only the current 12 records (`admin/students/page.jsx:110-119`). |
| S3 | Student 360 for authorized staff | **PARTIAL** | Admin sees basic profile fields via `StudentProfileMapper`; it cannot see assessments, readiness, gaps, roadmap, projects, CV, or LinkedIn through an authorized staff flow. |
| S4 | Staff view of assessment results and readiness | **MISSING** | Reports/readiness are student-only (`ReportController.java:36`); admin has no student report endpoint. |
| S5 | Staff view of CV/LinkedIn analysis | **MISSING** | CV/LinkedIn controllers are owner-scoped to the student; no staff read endpoint; admin UI has no CV/LinkedIn view. |
| S6 | Staff view of roadmap/projects | **MISSING** | Admin only browses global template catalogs; no per-student roadmap/project view. Admin roadmap/project pages are read-only. |
| S7 | Edit/deactivate student and manage status | **MISSING** | Admin has list/count only. No update, deactivate, delete, or status endpoint. |
| S8 | Field-level privacy and consent for staff access | **MISSING** | No staff roles or field-level policy. Admin DTO exposes mobile, DOB, and personal URLs platform-wide. |

### 2.6 TPO dashboard and analytics

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| D1 | College-wide total/active student counts | **PARTIAL** | `AdminStatsService` returns global role counts (`AdminStatsService.java:33`); no college scope, no active-status filter, and no user-status management. |
| D2 | Assessment completion metrics | **PARTIAL** | Global `assessmentsCompleted` counts submitted attempts, not unique students or cohorts (`AdminStatsService.java:39-40`). |
| D3 | Readiness distribution | **MISSING** | No aggregate readiness query; readiness is computed per student on request. |
| D4 | Skill-gap aggregation | **MISSING** | Gap analysis is per student (`CareerInsightService`); no cohort aggregation. |
| D5 | Department/program/batch comparisons | **MISSING** | No canonical cohorts exist, so comparison is impossible. |
| D6 | Trend, filters, drill-down | **MISSING** | No historical readiness snapshots, cohort filters, or drill-down endpoints. |

The admin dashboard UI is also inconsistent: it locks assessment, roadmap, and report cards even though those modules exist (`app/admin/dashboard/page.jsx:137-155`), and computes a branch chart from only the 10 most recent students (`:56-57`, `:223`). This is a partial/global overview, not a TPO dashboard.

### 2.7 Reports and exports

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| E1 | College/TPO reports | **MISSING** | No college report API/UI. Admin reports page is an overview and says reports remain private (`app/admin/reports/page.jsx:92`). |
| E2 | Authorized staff access to individual reports | **MISSING** | `ReportController` is `hasRole('STUDENT')` (`ReportController.java:36`); admin cannot retrieve a student's report. |
| E3 | CSV export of students/results | **MISSING** | No CSV export endpoint or page. Only student PDF downloads exist. |
| E4 | Export field-level permissions and institution scoping | **MISSING** | No export, no staff scope, no field policy. |
| E5 | Export audit trail | **MISSING** | No audit log; no export event record. |
| E6 | Report persistence/snapshots | **PARTIAL** | Real PDFs are generated live (`ReportController.java:78-87`), but no report row, generation timestamp, filters, or snapshot is persisted. |

### 2.8 Mock interviews

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| M1 | Mock interview module | **MISSING** | No entity, table, route, page, or service. The PDF lists mock interviews as Phase 2; the brief lists them in Phase 1. |
| M2 | Scheduling/outcomes/feedback and staff access | **MISSING** | No scheduling, interviewer assignment, score, feedback, consent, or audit. |

### 2.9 Production/security gates for Phase 1

| ID | Requirement | Status | Evidence and gap |
|---|---|---|---|
| P1 | Durable audit log | **MISSING** | No audit table/entity. Application logs exist but are not a durable, queryable trail with actor/scope/before/after. |
| P2 | Audit coverage for staff/admin actions | **MISSING** | No staff actions; admin logs omit actor ID, institution, IP, request ID, and before/after values. |
| P3 | Versioned database migrations | **MISSING** | No `db/migration`; prod bootstraps once with `ddl-auto=update`, then `validate` (`deploy-prod.sh:195-208`). |
| P4 | CI quality gate | **PARTIAL** | `.github/workflows/ci.yml` now runs frontend lint/build/audit and backend `mvn -B verify`; it has not been executed on the repository host or proven as a protected branch gate. |
| P5 | Frontend dependency remediation | **COMPLETE AND VERIFIED (local)** | `next@16.4.3`, `eslint-config-next@16.4.3`, `shadcn@4.22.1`; `npm audit --audit-level=high` reports 0. Deployment not verified. |
| P6 | Backend test suite green | **COMPLETE AND VERIFIED (local)** | `mvn -B verify`: 298 tests, 0 failures, BUILD SUCCESS on JDK 21/H2. Live deployment not verified. |
| P7 | Deployment parity and version verification | **PARTIAL** | Public build-version and frontend health endpoints plus a smoke script were added locally. Prior live 401/404/404 observations remain unresolved; no deployed-commit verification has happened. |
| P8 | Token storage and CSP hardening | **PARTIAL** | Access-token cookie replaced by a non-sensitive role hint; report-only CSP and COOP added. Tokens still live in `localStorage`, and CSP is not enforced. |
| P9 | Email verification and password reset | **MISSING** | No mail sender, verification token, forgot-password flow, or reset flow. |
| P10 | Staff MFA | **MISSING** | No MFA. |
| P11 | Backup automation and tested restore | **PARTIAL** | Manual runbook only (`docs/BACKUP_RESTORE.md`); no scheduled job or restore drill evidence. |
| P12 | Monitoring and alerting | **PARTIAL** | Health endpoint and application logs only; no metrics, tracing, error tracking, or alerting. |
| P13 | Privacy, consent, retention, deletion | **PARTIAL** | Registration and new Google identities now require consent; legal pages are linked and fake contacts were removed in favor of owner-supplied values. Consent is logged only, with no durable table, retention job, access/deletion workflow, or data-processing record. Live legal routes remain unverified. |
| P14 | Rate-limit hardening | **PARTIAL** | Limiter now trusts only configured proxy CIDRs, uses the closest untrusted hop, bounds tracked clients, purges periodically, and no longer crashes on 429. Still in-memory and not reliable across instances. |
| P15 | Documentation/runbook parity | **PARTIAL** | `README.md` still says admin controllers do not exist and describes a smaller route set; `PRODUCTION.md` is more current. |

**Production total: 0 of 15 fully release-verified; 2 locally complete and verified; 8 partial; 5 missing.** Local completion does not establish deployment parity.

---

## 3. Repository PDF Phase 1 baseline

This table answers a different question: *how complete is the product the repository actually set out to build?* The PDF is narrower and explicitly defers college features.

| ID | PDF Phase 1 capability | Status | Evidence |
|---|---|---|---|
| B1 | Email/password registration/login | **COMPLETE AND VERIFIED** | Auth integration tests; live login route validates. |
| B2 | Google Sign-In | **PARTIALLY IMPLEMENTED** | Code and tests exist, but live backend returns 404 on `/auth/google` and 401 on `/auth/config`. |
| B3 | Student profile and education details | **COMPLETE AND VERIFIED** | Profile integration tests; `students/me` endpoints. |
| B4 | Career selection | **COMPLETE AND VERIFIED** | Career selection integration tests. |
| B5 | Skill assessment | **COMPLETE AND VERIFIED** | Assessment flow/randomization/scoring tests. |
| B6 | Assessment result | **COMPLETE AND VERIFIED** | Result/scoring tests. |
| B7 | Career gap analysis | **COMPLETE AND VERIFIED** | `CareerInsightService`; insight integration tests. |
| B8 | Career readiness score | **COMPLETE AND VERIFIED** | Weighted assessment calculation; readiness tests. No historical persistence. |
| B9 | Career roadmap | **COMPLETE AND VERIFIED** | Roadmap generation/progress tests. |
| B10 | CV upload and analysis | **COMPLETE AND VERIFIED** | CV integration tests; private storage. |
| B11 | LinkedIn profile analysis | **COMPLETE AND VERIFIED** | Manual URL/analysis tests; no scraping. |
| B12 | Project recommendations | **COMPLETE AND VERIFIED** | Project recommendation/progress tests. |
| B13 | Progress tracking | **COMPLETE AND VERIFIED** | Consolidated progress service/tests; derived, not a `progress_tracking` table. |
| B14 | AI career assistant | **IMPLEMENTED BUT UNVERIFIED** | Stub/offline tests; real provider not verified on live. |
| B15 | Career readiness PDF | **COMPLETE AND VERIFIED** | Report/PDF integration tests; real OpenPDF output. |
| B16 | Admin login | **COMPLETE AND VERIFIED** | Admin auth and authorization tests. |
| B17 | Admin student management | **PARTIALLY IMPLEMENTED** | Platform-wide list/count only; no edit/deactivate/filter. |
| B18 | Career management | **COMPLETE AND VERIFIED** | Admin career CRUD/competency tests. |
| B19 | Skill management | **COMPLETE AND VERIFIED** | Admin skill CRUD tests. |
| B20 | Skill-category management | **PARTIALLY IMPLEMENTED** | Category is a fixed enum on skills; no category CRUD. |
| B21 | Assessment/question management | **COMPLETE AND VERIFIED** | Admin assessment/question tests. |
| B22 | Competency framework management | **COMPLETE AND VERIFIED** | Admin career-skill framework tests. |
| B23 | Roadmap management | **MISSING** | Admin roadmap API/UI is read-only; PDF asks for management. |
| B24 | Project management | **MISSING** | Admin project API/UI is read-only; PDF asks for management. |
| B25 | AI configuration | **PARTIALLY IMPLEMENTED** | Read-only status page; config is env-driven, no editable configuration. |
| B26 | Admin report access | **MISSING** | Student-only report controller; admin reports page explicitly keeps reports private. |
| B27 | Admin dashboard/analytics | **PARTIALLY IMPLEMENTED** | Global counts, locked cards, branch chart from 10 students. |
| B28 | Persisted readiness/report/audit records | **PARTIALLY IMPLEMENTED** | Readiness and PDFs are live-generated; `audit_logs` is absent; no report/readiness history tables. |
| B29 | Notifications | **OUT OF PDF PHASE 1** | UI honestly says no notification infrastructure exists. |
| B30 | Mock interviews | **DEFERRED BY PDF (PHASE 2)** | No implementation; PDF Phase 2. |
| B31 | College/TPO/multi-tenant | **DEFERRED BY PDF (PHASE 2/3)** | No implementation; PDF explicitly defers. |

**Baseline counts:** 18 complete and verified, 1 implemented but unverified, 6 partial, 3 missing, 3 deferred/out of scope = 31 rows.

Even under the narrower PDF Phase 1, the following are not complete:

- admin report access;
- admin roadmap management;
- admin project management;
- dashboard/analytics quality;
- persisted readiness/report/audit records;
- CI and deployment verification.

---

## 4. Cross-cutting findings

1. **The brief and the repository disagree about what Phase 1 means.** This must be resolved before code. The gap matrix's brief section is not a fair description of the team's original Phase 1.
2. **The missing tenant model is the critical path.** Without institution/enrollment/membership scope, every TPO feature would either be global or rely on client-supplied filters, which is unsafe.
3. **The existing student ownership model is a strength.** Reports, attempts, CVs, roadmaps, projects, and AI sessions are owner-scoped and tested. Reuse those service reads rather than duplicating them.
4. **Admin is not a college role.** Reusing `ADMIN` for professors/TPO would expose platform-wide PII and content controls.
5. **"No CSV" is not "CSV safe."** The requirement is absent. Any implementation must include formula-injection defenses, scoped permissions, and audit.
6. **A green local build is not a green release.** The current working tree has 298/0 backend tests, frontend lint/build passing, and a clean npm audit, but the CI workflow has not run on the host and the live deployment remains inconsistent. Deployment parity is still a release gate.
7. **The PDF's example PostgreSQL stack is not a reason to migrate.** MySQL remains appropriate; the missing tenant model is the real architectural gap.
8. **Consent enforcement is not yet consent operations.** New accounts now require acceptance and legal pages are linked, but consent is only logged, owner contacts are unset, and rights/deletion/retention workflows plus live verification are still missing.

---

## 5. Acceptance definition for a future "Phase 1 complete"

A future Phase 1 should not be called complete until all of the following are demonstrable:

- Two institutions can exist without seeing each other's students, staff, reports, or exports.
- A `PROFESSOR`/TPO/HOD/faculty/college-admin membership can be invited, activated, scoped, and revoked without using `ADMIN`.
- A CSV import validates, rejects, reports, and audits row-level outcomes; duplicate and account-linking behavior is defined.
- A TPO can search the whole authorized population, open a 360 view, filter by cohort, and see readiness/gap/completion metrics with real data.
- Staff report access and CSV export are field-scoped, permission-checked, formula-safe, and audited.
- Mock-interview scheduling/outcomes are implemented if they remain in Phase 1.
- Cross-college IDOR, export, and role-matrix tests pass in CI.
- Migrations are versioned and rollback/runbook tested.
- Backend tests, frontend lint/build, and dependency audit pass in CI.
- The deployed commit is verifiable and matches the tested commit.

Related documents:

- [Technical discovery](CAREEROS_TECHNICAL_DISCOVERY.md)
- [Security and production audit](CAREEROS_SECURITY_AND_PRODUCTION_AUDIT.md)
- [Implementation roadmap](CAREEROS_IMPLEMENTATION_ROADMAP.md)
- [Audit summary](CAREEROS_AUDIT_SUMMARY.md)
