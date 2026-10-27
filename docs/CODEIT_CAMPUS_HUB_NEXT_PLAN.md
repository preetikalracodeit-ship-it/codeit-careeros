# CODEIT CareerOS Campus Hub — Next Implementation Plan

**Prepared:** 27 October 2026  
**Basis:** CODEIT CareerOS Campus Career & Placement Hub Developer Requirements v1.0 (13 October 2026), current repository at `e7af1f6` (`main`), and existing design/audit documents.  
**Purpose:** Prioritize the next changes to the existing CareerOS website and backend. This is an engineering plan, not authorization to expose new personal data or deploy to production.

## Executive assessment

The specification asks to extend the deployed CareerOS product, with the TPO Readiness Dashboard as the first priority. The repository already contains a substantial Campus/TPO implementation: a tenant and academic-structure migration, institution and staff management APIs, scoped student lists and Student 360 views, CSV import preview/commit and student export, dashboard calculations, PDF reports, frontend Campus routes, audit services, and a College integration-test class. The next step is therefore to verify and complete this implementation, not start a parallel application or rebuild the feature from scratch.

Source presence does not establish that the feature is approved, fully tested against production-like MySQL, deployed, or safe for real student records. Several repository planning documents describe an earlier state and/or say the College role matrix and feature are pending approval. Reconcile those documents against the current code and the new requirements before treating any old “not implemented” or “NO-GO” assessment as current. The new requirements describe desired behavior, but do not settle all sensitive-field and role-scope decisions.

### Current implementation signals

| Area | What is present in source | What remains to establish |
|---|---|---|
| Campus foundation | V4 college tenant model; institution, department, program, academic-year, batch, section and membership workflows | Fresh-install and upgrade behavior on supported MySQL; rollback/recovery evidence; production data mapping |
| Roles and tenant scope | College staff designations, server-derived scope, department-aware access services and scoped endpoints | Approved role/field matrix; test every endpoint, aggregate, export and file boundary, including foreign IDs and role edge cases |
| Student operations | Search/list, status management, Student 360, two-step CSV preview/commit, existing-account linking, CSV export | Verify all duplicate and partial-failure cases, field allowlists, consent/notice, usability and realistic-volume behavior |
| Readiness dashboard | Active-student assessment coverage, not-assessed count, readiness distribution, department and batch coverage, scoped filters, and date filtering by assessment submission in the institution timezone are present in source | Verify metric click-through and count/list agreement; confirm date-boundary behavior with institution fixtures; business definitions remain subject to approval |
| Reports | Cohort and Student 360 PDFs, student CSV export, and five scoped CSV datasets (roster, assessment completion, readiness summary, department skill gaps, batch coverage) are present in source | Verify each report’s field allowlist, date semantics, role access, limits, audit records, and figures against synthetic fixtures |
| Tests | College integration tests cover invitation, scope, dashboard/report, account linking and CSV paths | Run and extend the full relevant suite; demonstrate migration and rollback in staging and regression coverage |
| Product documentation | Earlier audit, roadmap and role-matrix documents exist | Reconcile their status/approval claims with current code and the 13 October 2026 specification |

## Delivery order

### Gate 0 — Confirm scope, authority and data rules

Before enabling real college data, record the accepted Phase 1 scope and resolve the decisions below with the product owner/institution. The uploaded specification prioritizes Phase 1, but does not itself approve every data-access rule proposed in the older role matrix.

- Approve the role-to-scope rules for College Admin, TPO, HOD and Faculty/Mentor, including whether staff can hold more than one institution membership and how department/section/student assignments are managed.
- Approve a field visibility and export allowlist: name/email/roll, mobile/DOB, target role, assessment details, LinkedIn URL/analysis, CV metadata/file/text, mock-interview feedback, and AI chat. Do not infer access to sensitive data from general permission to view students.
- Define the qualifying completed assessment, the denominators for active students and assessment coverage, profile completion, and the evidence-backed “students needing preparation” rule. Keep not-assessed and readiness-unavailable states distinct from failed or low readiness.
- Date range is implemented against assessment submission time, using the institution timezone and including the full end date; confirm that this matches the institution’s reporting policy.
- Confirm import notice/authorization/consent, student-to-college association rules, duplicate identity policy, retention/deletion handling, and pilot-data ownership.
- Confirm which five CSV reports are in the first release, the columns each may contain, who may export them, and applicable row limits/audit requirements.
- Confirm whether the new document supersedes the older roadmap’s phase ordering, and explicitly keep mock-interview display conditional on a supported existing module.

**Exit:** decisions and data rules are written down and the applicable permission matrix is approved. Until then, use synthetic data for verification and do not widen sensitive-field access.

### Gate 1 — Reconcile repository and deployment state

- Map each Phase 1 requirement to its current frontend route, API/controller, service, migration and test. Mark each `present`, `partial`, `missing`, `unverified`, or `approval-gated`.
- Compare current branch/migrations and deployment configuration with the actual target environment; verify whether V4 has been applied anywhere and identify the supported upgrade path. Do not infer production deployment from code in `main`.
- Review the old technical audit, implementation roadmap, requirements gap matrix and role matrix. Update stale implementation-status statements only after their claims have been checked against code and test/deployment evidence.
- Record the exact test environment, synthetic fixtures and migration/rollback procedure for handover.

**Exit:** an agreed, evidence-linked requirement matrix and confirmed deployment/migration baseline.

### Phase 1A — Security, tenant integrity and migration proof

Treat this as the first engineering workstream because every dashboard, list and report relies on the tenant boundary.

- Test a clean database migration and an upgrade from the supported pre-V4 schema on the supported MySQL version. Test rollback/recovery in staging, including backup restoration; do not assume a destructive schema downgrade is safe.
- Build a two-institution test fixture. For each role, exercise page access and direct API requests for lists, detail records, counts, dashboard summaries, imports, exports, PDFs and academic structures. Try foreign institution, department, batch, section, student and import-job IDs.
- Confirm server-derived institution/department scope, least privilege, 404 behavior where required by policy, and no leakage through counts, validation messages, search, logs or error bodies.
- Verify audit coverage and redaction for student reads, import preview/commit, exports, staff/invitation/role changes and report downloads. Confirm sensitive values and credentials are not logged.
- Verify CSV size/type/row limits, preview expiry and ownership, duplicate and existing-account behavior, transaction/partial-failure behavior, idempotency, and spreadsheet-formula neutralization on every export.
- Run synthetic-data checks for privacy/consent workflow and retention/deletion obligations before any real import.

**Exit:** approved access matrix is enforced on backend routes and all aggregate/data paths; isolation, migration, recovery, import/export and audit evidence is recorded in staging.

### Phase 1B — Finish the TPO Readiness workflow

Once Gate 0 rules exist, close the visible product gaps in the Campus pages and APIs.

1. **Readiness definitions and filters:** dashboard and roster now expose active, assessed/not-assessed and readiness status filters, assessment submission date range, batch coverage and metric links in source. Verify date-window definitions, exact filter/list consistency, and denominators. Profile completion and “students needing preparation” remain unimplemented until their definitions are approved. Do not present assessment participation as readiness evaluation without labeling it.
2. **Student readiness profile:** show institutional identity and academic placement plus target role, profile/assessment status and dates. Show CV, LinkedIn, career-gap and mock-interview results only when the module has data and the approved role may see the fields. Show source/evidence and recommended next steps; label missing results as unavailable/not assessed.
3. **Skill-gap analysis:** count unique students with actual assessed evidence, compare authorized departments/batches, support drill-down to the authorized student set, and identify training priorities only under the approved rule. Keep missing assessment out of gap counts.
4. **CSV reports:** the five requested report types are now present in source. Verify their tenant, role, field-allowlist, cap, date-filter and audit behavior before acceptance. PDF remains supplementary.
5. **Import and roster usability:** provide a downloadable template and clear preview errors; explain create/link/reject outcomes; prevent duplicate enrollment and unsafe account takeover; give a clear commit result for rejected rows and retries. Preserve the current two-step preview/commit workflow if its security checks pass.
6. **Operational clarity:** provide loading, empty, permission-denied and recoverable error states; pagination and responsive layouts; expose only actions valid for the current role.

**Exit:** the Phase 1 acceptance criteria in the requirements are demonstrated with synthetic users in the staging environment, including dashboard-to-list consistency, evidence-backed gaps, exports, tenant isolation and student-feature regressions.

### Phase 1C — Performance, regression and release handover

- Profile dashboard and list queries with realistic cohort sizes; investigate the current per-enrollment readiness lookup pattern and batch it only if measurement shows an N+1 or latency problem.
- Verify pagination and bounded export behavior at the agreed volume; add indexes only from query plans and measured need.
- Run backend migration/integration tests, frontend build/lint checks, and regression coverage for existing assessment, CV/LinkedIn and student flows. Record actual results; do not claim pass status before execution.
- Document APIs, migration/configuration changes, test evidence, deployment steps, backup and recovery, monitoring and rollback limitations. Deploy to staging and obtain the required production release approval after acceptance review.

**Exit:** measured performance meets agreed targets; test and regression evidence, deployment instructions and recovery plan are reviewable.

### Later phases — Keep separate from the Phase 1 release

- **Phase 2 — Improvement plans:** evidence-based, editable actions with owner, due date, status, completion and reassessment history; student and authorized staff views. First decide whether Phase 1’s “needs preparation” is only a dashboard indicator or requires an actual plan.
- **Phase 3 — Placement operations:** companies, jobs, eligibility, drives, registrations, configurable recruitment stages, offers and joining. Add restricted contact fields, authorized eligibility overrides with reasons, and auditable status changes. No placement-management models or actions are evidenced in the current Phase 1 implementation.
- **Phase 4 — Outcome analytics:** participation, applications, interviews, offers, accepted offers and joining, each with explicit denominators and unique-student outcome counts. Do not fabricate historical trends or count multiple offers as multiple placed students.

Do not pull placement workflows, external job-board integrations, AI hiring decisions or unsupported mock-interview data into the Phase 1 work.

## Phase 1 acceptance checklist

- [ ] Approved role, field, scope, report and metric definitions are recorded.
- [ ] Tenant isolation and role enforcement pass direct API tests across two institutions, including lists, details, aggregates and exports.
- [ ] Migration from a supported prior schema, fresh install, backup and staging recovery procedure are demonstrated.
- [ ] College admins can manage the approved academic structure and staff workflows.
- [ ] CSV preview exposes validation before commit; duplicates and existing accounts are handled safely and visibly.
- [ ] Dashboard counts use real records, documented denominators and filters; clicking a metric yields the matching authorized list.
- [ ] Student readiness details show available, dated evidence and never treat missing assessment as failure.
- [ ] Skill-gap counts use assessed evidence and unique students; approved reports export the same authorized cohort and fields.
- [ ] Import, export, access and relevant changes are audited without logging sensitive content.
- [ ] Existing CareerOS student flows pass regression checks; test evidence and deployment/rollback instructions are handed over.

## Recommended immediate next step

Run Gate 0 and Gate 1 as a short approval-and-reconciliation pass, then execute Phase 1A against a two-institution synthetic fixture. This converts the existing Campus implementation into a verified baseline and produces a precise list of code changes for Phase 1B. Do not start Phase 2–4 work until Phase 1 acceptance and access rules are settled.

