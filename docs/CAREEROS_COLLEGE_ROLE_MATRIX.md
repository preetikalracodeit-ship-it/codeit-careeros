# CareerOS — College/TPO Role and Permission Matrix (Draft for Approval)

> Status: **design only — not implemented**. This is the minimum matrix needed
> to approve the tenant model. It is derived from
> `CAREEROS_IMPLEMENTATION_ROADMAP.md` (Phase 1A), the requirements gap matrix,
> and the security audit. Items marked **[P]** are engineering proposals that
> the institution/owner must approve in writing; they are not evidence of an
> existing requirement. Nothing here authorises building dashboards, imports,
> exports, or staff screens yet.

## 1. Roles and scope

| Role | Scope | Relationship to existing `ADMIN` | Status |
|---|---|---|---|
| `PLATFORM_ADMIN` (existing `ADMIN`) | Entire platform | Existing platform-wide role. Must **not** be reused as TPO/HOD/faculty. | [R] |
| `COLLEGE_ADMIN` | One institution | Institution administrator; cannot grant platform admin. | [R] |
| `TPO` | One institution (placement cell) | Institution-scoped staff designation. | [R] |
| `HOD` | One department within one institution | Department-scoped staff designation. | [R] |
| `FACULTY` / `PROFESSOR` | Assigned sections/mentees within one institution | Narrowest staff scope; authenticated staff role `PROFESSOR` + designation `FACULTY`. | [R] |
| `STUDENT` (existing) | Own account/data | Existing role; unchanged. | [R] |

- A staff member has exactly one authenticated role (`ADMIN`, `PROFESSOR`, or
  `STUDENT`) plus one or more **memberships** carrying the designation
  (`COLLEGE_ADMIN`, `TPO`, `HOD`, `FACULTY`) and scope.
- Institution scope is derived from the verified membership on the server. It is
  never taken from a URL, query string, request body, JWT claim, localStorage,
  or email domain. [R]
- Phase 1 should allow **one active institution membership per staff user**.
  Multiple simultaneous institutions are a separate decision (section 4). [P]
- The platform admin is not a college staff member and has no automatic right
  to student PII. Any support access must be a separate, explicit, time-bound,
  audited permission. [R]

## 2. Capability matrix

Legend: **Yes** = allowed across the full scope; **Scoped** = allowed only
within the stated scope (institution/department/assigned mentees); **No** = not
allowed by default; **Approval** = requires an explicit owner decision.

| # | Capability | Platform admin | College admin | TPO | HOD | Faculty |
|---|---|---|---|---|---|---|
| 1 | Manage global career/skill/assessment/project/roadmap content | Yes | No | No | No | No |
| 2 | Create, activate, or deactivate an institution | Yes | No | No | No | No |
| 3 | Edit institution profile, contacts, timezone | Yes | Yes (own) | No | No | No |
| 4 | Manage departments, programs, batches, sections, academic years | Approval (platform content) | Yes (own) | No | Approval (propose/read) | No |
| 5 | Invite staff into an institution | Yes (bootstrap only) | Yes (own) | No | No | No |
| 6 | Activate/deactivate staff membership | Yes | Yes (own) | No | No | No |
| 7 | Change a staff role/designation or scope | Yes (platform admin only) | Yes (own, except platform admin) | No | No | No |
| 8 | View student profile (name, email, roll, program, batch) | Approval (support only) | Yes (institution) | Yes (institution) | Scoped (department) | Scoped (assigned mentees/sections) |
| 9 | View assessment history and readiness/gap results | Approval (aggregate only) | Yes (institution) | Yes (institution) | Scoped (department) | Scoped (mentees) |
| 10 | View roadmap/project progress | Approval (aggregate only) | Yes (institution) | Yes (institution) | Scoped (department) | Scoped (mentees) |
| 11 | View LinkedIn profile URL and analysis | Approval | Approval (field policy) | Approval (placement purpose) | Approval (department) | Approval (mentees) |
| 12 | View/download a student's CV file | No | Approval (explicit permission) | Approval (explicit permission) | No by default | No by default |
| 13 | View a student's CV extracted text | No | Approval | Approval | No by default | No by default |
| 14 | View AI chat content | No | No by default | No by default | No by default | No by default |
| 15 | View mobile number / date of birth / other sensitive fields | No | Approval (field policy) | Approval (placement contact) | Scoped + Approval | Scoped + Approval |
| 16 | Generate a student report / 360 view | Approval (aggregate only) | Yes (institution) | Yes (institution) | Scoped (department) | Scoped (mentees) |
| 17 | Export a report or student list (CSV/PDF) | Approval (platform aggregate) | Yes (institution, field allowlist) | Yes (institution, field allowlist) | Scoped + Approval | No by default |
| 18 | Search/filter the full authorized population | No (platform-wide counts only) | Yes (institution) | Yes (institution) | Scoped (department) | Scoped (mentees) |
| 19 | Access another institution's students/reports/files | No | No | No | No | No |
| 20 | Access more than one institution with one account | Yes (platform) | No (Phase 1) | No (Phase 1) | No (Phase 1) | No (Phase 1) |
| 21 | View audit events | Approval (platform security) | Approval (own institution, redacted) | No | No | No |
| 22 | Delete/export all data on a student's behalf | Approval (DSAR process) | Approval (DSAR process) | No | No | No |

### Mandatory server-side rules for every row

1. Authorization is checked on details, lists, counts, searches, reports,
   exports, and file downloads — not only on the page that links to them. [R]
2. Foreign institution/department/program/batch/section/student ids return
   **404**, not a permission error that confirms existence. [R]
3. A role string or `institutionId` supplied by the client is ignored; the
   server derives both from the authenticated membership. [R]
4. A student owns their own data and may not read another student's data. [R]
5. Platform admin privileges and college-scoped privileges are separate code
   paths and separate tests. [R]
6. Every staff read of sensitive student data, every export, and every
   role/membership change is audited. [R]

## 3. Field visibility (proposal — requires approval)

This expands the roadmap’s draft field table. “See” means the field may be
displayed; “Export” means it may leave the system in a report/CSV.

| Field | College admin | TPO | HOD | Faculty | Export |
|---|---|---|---|---|---|
| Name, email, roll number, program/batch/section | See institution | See institution | See department | See mentees | College admin/TPO with allowlist |
| Mobile | See (policy) | See (placement) | See (policy) | See (policy) | Approval |
| Date of birth | See (policy) | No by default | No by default | No by default | No |
| Assessment scores / readiness / gaps | See institution | See institution | See department | See mentees | Aggregate only by default |
| Roadmap/project progress | See institution | See institution | See department | See mentees | Aggregate only by default |
| LinkedIn URL | See (policy) | See (policy) | See (policy) | See mentees | Approval |
| LinkedIn analysis text | See (policy) | See (policy) | See (policy) | See mentees | No by default |
| CV metadata (filename/status) | See | See | See | See mentees | No |
| CV file / extracted text | Explicit permission | Explicit permission | No by default | No by default | No |
| AI chat content | No | No | No | No | No |
| Audit events | Own institution, redacted | No | No | No | No |
| Password hash, refresh tokens, consent evidence internals | No | No | No | No | No |

The final field matrix must be approved by the institution/owner. Engineering
must not infer that “staff can see students” means “staff can see every
sensitive field.” [R]

## 4. Decisions not supported by the existing sources

The following are **unresolved** and must not be implemented by assumption:

1. **Scope of TPO**: institution-wide, placement-cell-only, or program/batch?
   The roadmap allows institution/department/program/batch/section scopes but
   does not choose TPO’s default.
2. **HOD authority**: may an HOD invite/deactivate faculty, or only view and
   propose? The roadmap says “manage institution and academic structures” but
   does not grant HOD staff administration.
3. **Faculty scope**: assigned mentees vs section vs department. The roadmap
   says “assigned mentees” for assessments and “usually no” for CV files; it
   does not define how assignments are created.
4. **CV file access**: whether any college role may download the raw file by
   default. The roadmap calls it “explicit permission” and says “no bulk CV
   export by default”; the exact permission and audit model is unresolved.
5. **Mobile/DOB visibility**: the roadmap’s field table lists only
   name/email/roll, assessments, CV, LinkedIn, AI chat, and reports. Mobile and
   DOB are not explicitly assigned.
6. **Multi-institution membership**: Phase 1 simplification is one active
   membership, but the institution may require staff to serve multiple colleges.
7. **Platform-admin support access**: whether platform admins may ever view
   student PII, and under what time-bound/audited “break-glass” process.
8. **Report/export field allowlists and row caps** per designation.
9. **Placement status** (not modelled today) and whether it is in Phase 1.
10. **Mock interviews** (explicitly excluded by the current task; the roadmap
    treats them as a later phase).
11. **Student consent for staff access to CV/LinkedIn/AI data** (a student may
    need to opt in to placement sharing; the current consent is only
    Terms/Privacy).
12. **Retention and deletion** for staff-visible data (see
    `DATA_RETENTION_AND_DELETION.md`).

## 5. Minimum data model gate (do not build yet)

After this matrix is approved, the minimum model is:

- `institutions` (code, name, status, timezone, contact);
- `departments` (institution, code, name, status);
- `programs` (institution, department, code, name, degree type, duration);
- `academic_years` (institution, label, start/end, active);
- `batches` (program, academic year, label, graduation year);
- `sections` (batch, name, status);
- `student_enrollments` (student profile, institution, department, program,
  batch, section, roll number, status, dates);
- `institution_memberships` (user, institution, designation, status, scope
  type/id, invited by, accepted at);
- `staff_invitations` (institution, email, designation, scope, token hash,
  expiry, accepted/revoked, created by);
- `audit_events` (already implemented for platform actions; extend with
  institution/scope columns only when the membership model is approved).

Rules already agreed in the roadmap:

- Reuse `users` and `student_profiles`; do not create a second account or
  student identity.
- Keep `student_profiles.college/degree/branch/graduation_year/semester` during
  transition; do not drop them.
- Backfill with an admin-reviewed mapping; create a legacy/pilot institution
  for unmatched records; never auto-merge by name similarity.
- Institution membership must never be inferred from an email domain.
- Do not add a blind `tenant_id` to every table; use enrollment/membership joins
  and add tenant keys only where the access model needs them.
- Do not create sample institutions or alter real student data.

## 6. Approval record

| Decision | Owner | Date | Status |
|---|---|---|---|
| Authoritative Phase 1 scope (brief vs PDF) | Product owner | — | **Pending** |
| Role names and scope defaults (section 1) | Institution + product | — | **Pending** |
| Capability matrix (section 2) | Institution + product | — | **Pending** |
| Field visibility (section 3) | Institution + legal/privacy | — | **Pending** |
| Unresolved decisions (section 4) | Institution + product | — | **Pending** |
| Tenant schema and migration plan | Engineering + DBA | — | **Pending** |

Until every row above is approved, the College/TPO implementation remains
**NO-GO**. This document is not an implementation authorisation.
