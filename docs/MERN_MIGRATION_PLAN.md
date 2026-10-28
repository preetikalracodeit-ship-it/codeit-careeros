# CareerOS MERN Migration Plan

**Status:** In progress — local migration implementation is authorized. Production database migration, deployment, traffic cutover, and decommissioning remain gated.
**Date:** 2026-10-28
**Baseline:** `main` at `c3cd28f` (`feat: scaffold careeros-api (Express + MongoDB) migration target`), with subsequent local MERN migration work tracked in `docs/MERN_MIGRATION_PROGRESS.md`. The Spring Boot/MySQL and Next.js applications remain the current source of truth and rollback target.
**Scope:** Replace the Spring Boot + MySQL backend with Node.js + Express + MongoDB, and replace the Next.js frontend with a React 19 + Vite SPA, while preserving all current behavior.

---

## 1. Executive decision

### Target: strict MERN

Use a **strict MERN SPA**:

- **React 19 + Vite** for the frontend.
- **Express + TypeScript** for the API.
- **MongoDB replica set** for persistence.
- **Node.js LTS** as the runtime.
- **Keep the existing `/api/v1` contract** so the backend can be ported without redesigning every screen.

The existing Next.js application is the source for the React conversion, not the target runtime. The React SPA will replace Next.js after route, auth, and API parity are proven.

### What “ReactJS” means here

- React 19 with Vite, not Create React App.
- JavaScript/JSX by default to match the existing codebase; TypeScript is optional.
- React Router for routing.
- The existing Tailwind/CSS, component library, API client, and visual design are retained.
- No Next.js App Router, server components, Next.js middleware, `next/link`, `next/image`, `next/font`, or Next rewrites remain in production.

### Why this is a real migration, not a UI port

The current Next.js app has about **57 app files** and **45 built routes**. Most pages are already client components, so the React conversion is feasible, but it still requires:

- Replacing the App Router with a React Router route table.
- Replacing Next layouts with nested route layouts.
- Replacing `next/navigation`, `next/link`, and `next/image`.
- Replacing `proxy.js` route guards with React protected-route components.
- Moving security headers and the `/api` proxy to Nginx or Express.
- Re-testing deep links, auth redirects, role guards, and responsive behavior.
- Rebuilding and redeploying the frontend as a static SPA.

This adds roughly **4–8 weeks** compared with keeping Next.js. The plan below includes that work explicitly.

### Do not do a big-bang rewrite

The current system has:

- **315** backend Java source files, about **28,000** lines.
- **56** backend test files, about **10,000** lines.
- **44** JPA entities.
- **32** controllers with about **154** route mappings.
- **5** Flyway migrations.
- About **48** frontend page files / **45** built routes.
- A working tenant-isolation, invitation, CSV, audit, improvement-plan, placement, and analytics model.

A big-bang rewrite would put those guarantees at risk. The plan below uses staged parity, golden API tests, a data-migration rehearsal, and two controlled cutovers: backend first, React SPA second.

---

## 2. Goals and non-goals

### Goals

1. Preserve every current API behavior and response shape.
2. Preserve student accounts, assessments, readiness, roadmaps, projects, CVs, LinkedIn data, reports, and audit history.
3. Preserve tenant isolation and role-based authorization on every list, search, count, dashboard, report, export, document, and student operation.
4. Preserve append-only audit behavior and secret/PII redaction.
5. Preserve CSV validation, formula neutralization, row limits, duplicate-file blocking, and CV-content exclusion.
6. Preserve placement eligibility, stage history, offers, joining outcomes, and analytics denominators.
7. Keep the current Next.js frontend deployable until the React SPA is ready to cut over.
8. Deliver a React SPA with route, role-guard, and visual parity for every current page.
9. Provide a tested rollback path.

### Non-goals

- No new product features during the migration.
- No UI redesign.
- No public URL changes unless unavoidable.
- No production cutover without explicit authorization and a verified recovery plan.
- No change to privacy/retention policy as part of the migration.
- No assumption that MongoDB automatically improves scalability or security.

---

## 3. Current baseline

| Area | Current state |
|---|---|
| Current frontend | Next.js 16.4.3, React 19.2.8, App Router, 45 built routes |
| Backend | Spring Boot 3.5.4, Java 21, Spring Security, Spring Data JPA, Spring AI |
| Database | MySQL 8, Flyway V1–V5 |
| Auth | JWT access/refresh tokens, BCrypt passwords, Google Sign-In, role cookie hint |
| API | `/api/v1`, `{ success, message, data, errorCode, timestamp }` envelope |
| Files | CVs in local filesystem or S3; profile photos on local filesystem |
| Reports | CSV and PDF (OpenPDF) |
| AI | Spring AI with OpenAI/Gemini/Ollama-compatible providers and offline fallback |
| Tests | 333 backend tests; frontend lint/build; no full browser E2E suite |
| Frontend API path | Browser → Next.js `/api/*` rewrite → Spring Boot |
| Target frontend | React 19 + Vite SPA, React Router, same visual system |

### Important current behaviors to preserve

- Null fields are omitted from JSON (`spring.jackson.default-property-inclusion: non_null`). The frontend relies on this for sensitive-field checks.
- Business errors map to 400/401/403/404/409/413/500 with stable error codes.
- Validation errors include `fieldErrors: [{ field, message }]`.
- The JWT subject is the numeric user ID; claims include `email` and `role`.
- `JwtAuthFilter` reloads the user and checks active status on every request; the role claim is not trusted alone.
- Refresh tokens are stored hashed and rotated/revoked.
- Auth responses use no-store headers.
- Request IDs are attached to logs.
- The frontend stores access/refresh tokens in `localStorage` and sends `Authorization: Bearer ...`.
- The current Next.js host proxies `/api/*` server-side, avoiding browser CORS. The React SPA must preserve this same-origin model through Vite/Nginx proxying.

---

## 4. Target architecture

```text
Browser
  |
  v
React 19 + Vite SPA  (new careeros-web)
  |  /api/* same-origin request
  v
Nginx / CDN  (serves static SPA and proxies /api)
  |
  v
Express 5 + TypeScript  (new careeros-api)
  |
  +--> MongoDB replica set
  +--> S3 or local filesystem (CVs, profile photos)
  +--> AI provider adapter (OpenAI / Gemini / Ollama / offline fallback)
  +--> Email adapter (invitations; provider still needs configuration)
  +--> Scheduled jobs (refresh-token purge, CSV staging cleanup)
```

Local development uses Vite's `/api` proxy. Production uses Nginx or a CDN with an `/api` reverse proxy so the SPA and API remain same-origin and CORS stays out of the browser path.

### Runtime choices

| Concern | Choice |
|---|---|
| Frontend | React 19 + Vite |
| Frontend language | JavaScript/JSX by default; TypeScript optional |
| Routing | React Router |
| Frontend tests | Vitest + React Testing Library + Playwright |
| Runtime | Node.js current LTS |
| Backend language | TypeScript |
| HTTP | Express 5 |
| ODM | Mongoose |
| Validation | Zod |
| Auth | `jsonwebtoken`, `bcrypt` or `bcryptjs` |
| Security | `helmet`, `express-rate-limit`, CORS, request IDs |
| Logging | `pino` |
| CSV | `csv-parse` / `csv-stringify` |
| PDF | `pdfkit` |
| File uploads | `multer` |
| Tests | Vitest + Supertest + Testcontainers MongoDB |
| Browser tests | Playwright |
| Scheduler | `node-cron` with Mongo-backed locks initially; add BullMQ/Redis only if load requires it |
| API docs | OpenAPI 3 generated from Zod schemas or hand-maintained |

---

## 5. Key design decisions

### 5.1 React 19 + Vite SPA

Replace the Next.js runtime with a Vite-built React SPA. Keep the existing visual system, Tailwind styles, components, API client behavior, and route URLs.

#### Next.js to React mapping

| Next.js today | React target |
|---|---|
| `app/**/page.jsx` | React Router route components |
| `app/**/layout.jsx` | Nested route layouts with `<Outlet />` |
| `next/link` | `react-router-dom` `Link` |
| `next/navigation` `useRouter` | `useNavigate` |
| `next/navigation` `usePathname` | `useLocation` |
| `next/navigation` `useParams` | `useParams` |
| `next/navigation` `useSearchParams` | `useSearchParams` |
| `next/navigation` `redirect` | `<Navigate>` or a route guard |
| `next/image` | `<img>` or a small image component |
| `next/font/google` | `@fontsource` or a CSS font stack |
| `app/layout.js` metadata | `react-helmet-async` or a small document-title hook |
| `app/error.jsx` | React error boundary |
| `app/not-found.jsx` | 404 route |
| `proxy.js` route guards | `ProtectedRoute` / `RoleRoute` components |
| `next.config.mjs` headers and rewrites | Nginx/CDN headers and `/api` proxy |
| `app/health/route.js` | Express health endpoint; remove the frontend route |

#### Route and auth parity

- Preserve the current URLs: `/student/*`, `/college/*`, `/admin/*`, `/login`, `/register`, `/accept-invitation`, `/legal/*`.
- Port the role guard logic from `proxy.js` into React route guards.
- Keep the role cookie as a routing hint only; the backend remains authoritative.
- Preserve deep-link behavior. The SPA host must fall back to `index.html` for client-side routes.
- Preserve login redirects and role-based home routing.
- Preserve the current localStorage token and refresh flow initially.

#### Serving model

- **Development:** Vite dev server proxies `/api` to Express.
- **Production:** Nginx or a CDN serves `dist/` and proxies `/api` to Express.
- **Fallback:** unknown non-API paths return `index.html`.
- **Headers:** port the current security headers and CSP report-only policy to the SPA host; keep Google Identity origins allowed.

This keeps the browser same-origin with the API and avoids introducing CORS.

Build the React SPA incrementally on a separate host, but cut users over only after route, auth, and critical-flow parity pass. Do not run two frontends against production for different user groups unless there is a tested rollback plan.

#### Recommended sequencing

Separate the two risks:

1. Move the backend and data to Express/Mongo while the existing Next.js frontend still serves users through its `/api` rewrite.
2. Verify backend parity, tenant isolation, and data migration in production-like staging.
3. Cut over the frontend to the React SPA once backend behavior is stable.

This lets the team isolate data/API failures from UI failures. The React SPA can still be built in parallel; it just does not have to be the first production cutover.

### 5.2 Preserve the API contract

Do not redesign the API during migration. The Express API must match:

- Paths and HTTP methods.
- Query parameters and filters.
- Request bodies.
- Response envelope.
- Null-field omission.
- Error codes and status codes.
- Validation error shape.
- File-download headers.
- Auth/refresh behavior.

Generate a frozen OpenAPI document from the running Spring Boot app and store it as the parity reference before writing Express handlers.

### 5.3 Preserve numeric IDs

The frontend uses numeric IDs in URLs and request bodies. Do **not** replace them with Mongo ObjectId strings during migration.

Use a `counters` collection:

```text
{ _id: "users", seq: 123 }
```

`getNextSequence(name)` atomically increments and returns the next number. Store that number as the document `id` (and optionally `_id`). Preserve existing MySQL IDs exactly during data migration. New IDs start at the current maximum + 1.

This avoids rewriting frontend routes, DTOs, and tests.

### 5.4 MongoDB topology and transactions

Use a **replica set**, not a standalone MongoDB.

Required for:

- Invitation acceptance and single-use guarantees.
- CSV import row processing.
- Application/offer/joining changes.
- Any operation that writes related documents and an audit event atomically.

Local development: Docker Compose with a single-node replica set.  
Production: MongoDB Atlas or a managed replica set with backups.

### 5.5 Tenant isolation

Tenant scope must never come from a client-supplied institution ID.

- Resolve the active membership from the authenticated user.
- Attach `req.scope = { userId, institutionId, role, designation, scopeType, scopeId }`.
- Every repository/query helper requires `institutionId`.
- Foreign IDs return 404, not 403.
- Add compound indexes beginning with `institutionId` on every tenant-owned collection.
- Add security tests for two institutions, cross-tenant reads/writes, department scope, and forged IDs.

### 5.6 Audit

Use a dedicated `audit_events` collection.

- Application code never updates or deletes audit documents.
- No audit update/delete routes.
- Restrict the production database user to insert/read for this collection where practical.
- Store `institutionId`, `actorUserId`, `action`, `targetType`, `targetId`, `targetPath`, `outcome`, sanitized details, request ID, and timestamp.
- Never log passwords, tokens, invitation secrets, full CVs, or unnecessary PII.
- Critical writes should write the audit event in the same Mongo transaction.

### 5.7 Authentication and authorization

- Reuse existing BCrypt password hashes.
- Reproduce JWT claims and issuer/expiry behavior.
- Keep access/refresh rotation and hashed refresh-token storage.
- Keep Google ID-token verification.
- Keep rate limiting and trusted-proxy behavior.
- Keep auth no-store headers.
- Keep platform `ADMIN` separate from college roles.
- Keep `PROFESSOR` + `StaffDesignation` for college staff.
- Keep invitation token hashing, 48-hour expiry, single use, and password verification when linking an existing account.
- Keep the last-active-college-administrator guard.

### 5.8 Files, CSV, PDF, and AI

- **CVs:** keep object-storage keys; never store CV bytes in MongoDB.
- **Profile photos:** keep local/S3 storage behavior.
- **CSV:** preserve preview/commit, row caps, MIME/header checks, formula neutralization, 24-hour duplicate-file blocking, and per-row outcome reporting. Use an independent per-row transaction or an ordered `bulkWrite` with explicit per-row error mapping so one bad row does not roll back successful rows, matching the current `REQUIRES_NEW` behavior.
- **PDF:** reproduce report layout with `pdfkit`; verify text extraction against golden fixtures.
- **AI:** port the provider adapter and tool-calling behavior. If AI parity is high-risk, temporarily proxy AI requests to the existing Spring service while the rest of the API moves.

### 5.9 Background jobs

Port:

- Expired refresh-token purge.
- CSV staging cleanup.
- Any scheduled invitation/import cleanup.

Use `node-cron` initially. Ensure only one instance runs a job via a Mongo lock document, or use a single scheduler deployment.

---

## 6. Target repository layout

```text
careeros-web/
  src/
    main.jsx               # React entry point
    App.jsx                # Router and providers
    routes/                # Route table and protected-route guards
    layouts/               # Public, student, college, admin shells
    pages/                 # One component per current page
    components/            # Reused from the existing frontend
    lib/                   # API client, auth, roles, formatting, download
    styles/                # Tailwind entry and global CSS
  test/                    # Vitest + React Testing Library
  e2e/                     # Playwright
  index.html
  vite.config.js
  package.json
  Dockerfile
  nginx.conf

careeros-api/
  src/
    app.ts                 # Express app, middleware, route mounting
    server.ts              # HTTP listener, graceful shutdown
    config/                # env validation, constants
    middleware/            # auth, tenant scope, request ID, errors, rate limit
    modules/
      auth/
      users/
      consent/
      careers/
      skills/
      assessments/
      roadmaps/
      projects/
      cv/
      linkedin/
      college/
      improvement/
      placement/
      reports/
      ai/
    models/                # Mongoose schemas
    lib/                   # jwt, password, csv, pdf, storage, audit
    jobs/                  # scheduled cleanup
  test/
    contract/              # golden API responses
    integration/           # Mongo-backed tests
    security/              # tenant/IDOR/invitation/CSV abuse
  scripts/
    migrate-from-mysql.ts
    verify-migration.ts
  package.json
  tsconfig.json
  Dockerfile
```

The existing `careeros-frontend` remains in the repository as the reference implementation and rollback target until the React SPA is accepted. After cutover it can be archived or removed with authorization.

---

## 7. MongoDB data model

### Collection strategy

Use references for independently queried or scoped records. Embed only immutable child data that is always read with its parent.

Recommended collections:

| Domain | Collections |
|---|---|
| Identity | `users`, `student_profiles`, `refresh_tokens`, `consent_records` |
| College | `institutions`, `academic_years`, `departments`, `programs`, `batches`, `sections`, `institution_memberships`, `staff_invitations`, `student_enrollments` |
| CSV | `csv_import_jobs`, `csv_import_rows`, `csv_upload_locks` |
| Content | `skills`, `careers`, `career_skills` |
| Assessment | `assessment_tests`, `assessment_questions`, `question_options`, `assessment_attempts`, `assessment_attempt_questions`, `assessment_answers`, `skill_scores` |
| Roadmap | `roadmap_phases`, `roadmap_items`, `roadmap_item_progress` |
| Projects | `projects`, `project_skills`, `project_progress` |
| CV/LinkedIn | `cv_documents`, `linkedin_profiles` |
| AI | `ai_chat_sessions`, `ai_chat_messages` |
| Improvement | `improvement_plans`, `improvement_tasks` |
| Placement | `companies`, `job_openings`, `placement_drives`, `placement_applications`, `application_stage_events`, `placement_offers` |
| Audit | `audit_events` |
| Sequences | `counters` |

### Required indexes

At minimum:

```text
users:                    { emailLower: 1 } unique
student_profiles:         { userId: 1 } unique; { studentId: 1 } unique
refresh_tokens:           { tokenHash: 1 } unique; { userId: 1, expiresAt: 1 }; TTL on expiresAt
consent_records:          { userId: 1, type: 1, policyVersion: 1 } unique
institutions:             { code: 1 } unique
academic years:           { institutionId: 1, code: 1 } unique
departments:              { institutionId: 1, code: 1 } unique
programs:                 { institutionId: 1, departmentId: 1, code: 1 } unique
batches:                  { institutionId: 1, programId: 1, label: 1 } unique
sections:                 { institutionId: 1, batchId: 1, name: 1 } unique
memberships:              { userId: 1, institutionId: 1 } unique; { institutionId: 1, status: 1, role: 1 }
staff_invitations:        { tokenHash: 1 } unique; { institutionId: 1, emailLower: 1, status: 1 }
student_enrollments:      { studentProfileId: 1 } unique; { institutionId: 1, rollNumber: 1 } unique
                          { institutionId: 1, departmentId: 1, programId: 1, batchId: 1, sectionId: 1, status: 1 }
csv_import_jobs:          { institutionId: 1, createdAt: -1 }
csv_import_rows:          { jobId: 1, rowNumber: 1 } unique; TTL for staging rows
csv_upload_locks:         { institutionId: 1, fileHash: 1 } unique; TTL expiresAt
audit_events:             { institutionId: 1, createdAt: -1 }; { actorUserId: 1, createdAt: -1 }
                          { targetType: 1, targetId: 1 }
placement_applications:   { institutionId: 1, driveId: 1, studentProfileId: 1 } unique
placement_drives:         { institutionId: 1, status: 1, createdAt: -1 }
placement_offers:         { applicationId: 1 } unique; { institutionId: 1, status: 1 }
```

Add MongoDB `$jsonSchema` validators for enums, required fields, and numeric types. Keep Zod validation at the API boundary as the first line of defense.

### Null and date behavior

- Store dates as BSON `Date` in UTC.
- Serialize as ISO-8601 strings.
- Omit null/undefined response fields to match Jackson `non_null`.
- Use institution timezone for date-only business rules, as the current code does.

---

## 8. API parity matrix

| Module | Controllers / routes | Migration notes |
|---|---|---|
| Auth, consent, settings | `AuthController` 9, `UserSettingsController` 4, `MetaController` 2 | Highest priority; port first |
| Student profile and career | `StudentController` 5, `StudentCareerController` 1, `CareerController` 3, `SkillController` 1 | Core student flows |
| Assessment/readiness | `AssessmentController` 6, `StudentInsightController` 2, `ProgressController` 1 | Preserve scoring and readiness formulas exactly |
| Roadmap/projects | `RoadmapController` 2, `ProjectController` 2 | Preserve progress semantics |
| CV/LinkedIn | `CvController` 4, `LinkedInController` 3 | Preserve file limits, storage keys, analysis output |
| Reports | `ReportController` 7 | CSV/PDF parity |
| AI | `AiChatController` 6 | Provider/tool-calling parity; proxy fallback acceptable |
| College core | `CollegeController` 18, `CollegeDashboardController` 3, `CollegeStudentController` 8 | Tenant scope and field visibility are critical |
| College admin | `AdminInstitutionController` 7, `PublicInvitationController` 2 | Platform-admin and invitation rules |
| Improvement plans | `CollegeImprovementPlanController` 7, `StudentImprovementPlanController` 2 | Evidence-gated generation and task ownership |
| Placement | `CollegePlacementController` 17, `StudentPlacementController` 5 | Eligibility, offers, joining, analytics |
| Admin content | `AdminController` 4, `AdminAssessmentController` 9, `AdminCareerController` 6, `AdminProjectController` 1, `AdminRoadmapController` 1, `AdminSkillController` 5, `AdminAiController` 1 | Port after student/college parity |

Total: about **154 route mappings**. Every route needs a contract test or an explicitly documented exception.

---

## 8A. Frontend route parity

The React SPA must reproduce the current route surface, including role guards and deep links.

| Area | Routes |
|---|---|
| Public | `/`, `/login`, `/register`, `/accept-invitation`, `/legal/privacy`, `/legal/terms` |
| Student | `/student/dashboard`, `/student/assessment`, `/student/assessment/attempt/:attemptId`, `/student/careers`, `/student/cv`, `/student/linkedin`, `/student/profile`, `/student/progress`, `/student/projects`, `/student/reports`, `/student/roadmap`, `/student/settings`, `/student/ai`, `/student/improvement-plan`, `/student/placements` |
| College | `/college`, `/college/dashboard`, `/college/import`, `/college/placement`, `/college/placement/analytics`, `/college/placement/drives/:id`, `/college/plans`, `/college/plans/:id`, `/college/reports`, `/college/settings`, `/college/staff`, `/college/structure`, `/college/students`, `/college/students/:id` |
| Platform admin | `/admin/dashboard`, `/admin/students`, `/admin/institutions`, `/admin/assessments`, `/admin/assessments/:id`, `/admin/careers`, `/admin/skills`, `/admin/roadmaps`, `/admin/projects`, `/admin/reports`, `/admin/settings`, `/admin/ai`, `/admin/:section` |
| Student catch-all | `/student/:section` |
| Errors | `*` → 404 route; render errors → error boundary |

### Route guard parity

Port `proxy.js` behavior into React route guards:

- Unauthenticated access to `/student/*`, `/college/*`, or `/admin/*` redirects to `/login`.
- `STUDENT` cannot open `/college/*` or `/admin/*`; redirect to the student home.
- `PROFESSOR` cannot open `/student/*` or `/admin/*`; redirect to the college home.
- `ADMIN` cannot open `/student/*` or `/college/*`; redirect to the admin home.
- Authenticated users visiting `/login` or `/register` redirect to their role home.
- The role cookie is only a hint; every API call remains server-authorized.

### Frontend acceptance criteria

- Every current URL renders the equivalent React page.
- No `next/*` import remains in `careeros-web`.
- Deep links work after a hard refresh.
- Role guards and login redirects match the current app.
- All forms, tables, filters, downloads, and modals behave the same.
- Responsive and keyboard behavior matches or improves on the current app.
- The production build is a static `dist/` bundle served by Nginx/CDN.

---

## 9. Phased plan

Durations are indicative for a team of roughly 2 backend engineers, 1 frontend engineer, 0.5 QA, and 0.5 DevOps. A single engineer should roughly double the timeline.

### Phase 0 — Decision and baseline (1 week)

Deliverables:

- Approve the strict MERN target: React 19 + Vite, Express, MongoDB.
- Approve React JS vs React TypeScript, React Router version, and SPA hosting model.
- Approve numeric-ID strategy.
- Approve MongoDB topology and hosting.
- Freeze feature work.
- Create a clean migration branch after authorization.
- Record the current commit, Flyway version, test counts, and API baseline.
- Export the current OpenAPI document.
- Capture a route inventory and screenshots of the current frontend.

Exit criteria:

- Written architecture decision record.
- No unresolved blocker on IDs, hosting, or frontend language.
- Current system remains deployable.

### Phase 1 — Contract and data-model design (2 weeks)

Deliverables:

- Frozen OpenAPI 3 contract for `/api/v1`.
- Golden response fixtures for representative requests.
- Mongo collection/index/validator design.
- Error envelope and null-omission specification.
- Data migration mapping table: MySQL table → Mongo collection → fields/indexes.
- React route/component inventory and shared-component reuse list.
- Test data seed plan for two institutions.

Exit criteria:

- Contract review approved.
- Every current entity mapped.
- Every endpoint assigned an owner and parity test.

### Phase 2 — Express foundation (2 weeks)

Deliverables:

- `careeros-api` TypeScript project.
- Express app, env validation, pino logging, request IDs.
- Error middleware matching current status/error codes.
- Auth middleware and tenant-scope middleware skeleton.
- Health/readiness and version endpoints.
- Mongo connection and transaction helper.
- Docker Compose with Mongo replica set.
- Vitest/Supertest/Testcontainers harness.

Exit criteria:

- `/health`, `/api/v1/meta/version`, and error-shape tests pass.
- Mongo transactions work in local integration tests.
- CI runs lint, typecheck, unit tests, and integration tests.

### Phase 3 — Identity, auth, consent, audit (3 weeks)

Deliverables:

- `users`, `student_profiles`, `refresh_tokens`, `consent_records`, `audit_events`.
- Login, register, refresh, logout, Google sign-in, `/auth/me`, `/auth/config`.
- BCrypt hash compatibility.
- JWT parity and refresh rotation/revocation.
- Consent enforcement.
- Rate limiting, trusted proxy handling, no-store headers.
- Audit service and append-only rules.
- Platform admin bootstrap.

Exit criteria:

- Existing password hashes work.
- Token refresh/rotation tests pass.
- Cross-user and inactive-user denial tests pass.
- Audit events are created and cannot be updated/deleted through the API.

### Phase 4 — Student core (4 weeks)

Deliverables:

- Student profile, target career, skills, careers.
- Assessment tests/questions/attempts/answers/skill scores.
- Readiness and insight calculations.
- Progress aggregation.
- Roadmap phases/items/progress.
- Projects/progress.
- CV metadata/storage and LinkedIn analysis.
- Student reports.

Exit criteria:

- Assessment scoring and readiness match golden fixtures.
- File-size/type and CV-content protections pass.
- Student self-service cannot access another student’s data.
- React student routes pass smoke tests against Express.

### Phase 5 — College core and tenant isolation (5 weeks)

Deliverables:

- Institutions, academic structure, enrollments.
- Memberships, staff designations, invitations.
- College dashboard.
- Scoped student list/search/detail.
- Field-level privacy rules.
- CSV import preview/commit and student export.
- College CSV/PDF reports.
- Audit integration.

Exit criteria:

- Two-institution isolation suite passes.
- Department/program/batch/section scope passes.
- Forged IDs return 404.
- Invitation expiry, single-use, reuse, and existing-account linking tests pass.
- CSV abuse, duplicate-file, row-limit, formula-neutralization tests pass.
- Imported CV contents never appear in exports.

### Phase 6 — Improvement plans (2 weeks)

Deliverables:

- Plan and task collections.
- Evidence-gated generation from assessed gaps.
- Manual plans.
- Task ownership, dates, priority, status.
- Student task self-service.
- Role rules: view/create/edit/read-only.

Exit criteria:

- Missing assessment evidence is not treated as a gap.
- Faculty create/edit returns 403.
- Foreign-tenant plan returns 404.
- Student can update only their own task status.
- Task updates create audit events.

### Phase 7 — Placement and analytics (4 weeks)

Deliverables:

- Companies, jobs, drives, applications, stage events, offers.
- Hierarchy-aware drive visibility.
- Eligibility checks and audited overrides.
- Student registration/withdrawal.
- Offer acceptance/decline/joining.
- Placement analytics and CSV export.

Exit criteria:

- Cross-tenant and department-scope placement tests pass.
- HOD read-only behavior and faculty denial pass.
- Company contacts/notes redaction passes.
- Duplicate registration, ineligible registration, and override audit pass.
- Offer/joining consistency and stale-joining-date cleanup pass.
- Analytics denominators and distinct-student metrics match golden values.
- CSV export cap and formula neutralization pass.

### Phase 8 — AI, reports, and remaining admin modules (3 weeks)

Deliverables:

- AI chat sessions/messages and provider adapter.
- Tool-calling and offline fallback.
- Remaining admin content controllers.
- PDF layout parity.
- Scheduled cleanup jobs.

Exit criteria:

- AI disabled/configured/fallback behavior matches current contract.
- PDF text extraction matches golden fixtures.
- Admin content CRUD passes parity tests.

### Frontend workstream — React SPA (runs alongside backend phases)

The frontend is a separate workstream because it can start once the API contract and auth behavior are stable. It must not be left as a last-minute port.

#### F1 — React shell and routing foundation (2 weeks)

Deliverables:

- `careeros-web` Vite project with React 19.
- React Router route table for every current URL.
- Public, student, college, and admin layouts.
- Shared API client, auth storage, role helpers, and download helper.
- Error boundary, 404 route, and document-title handling.
- Tailwind/global CSS and existing design tokens.
- Vite `/api` proxy for local development.

Exit criteria:

- Every route renders a placeholder or the first real page.
- Deep links work in `vite preview`.
- No `next/*` dependency remains.

#### F2 — Auth, guards, and shared shell behavior (2 weeks)

Deliverables:

- Login, register, Google sign-in, invitation acceptance, logout.
- Token refresh and 401 handling.
- Protected-route and role-guard components.
- Role-based home redirects.
- Navbar, sidebars, mobile navigation, and permission-filtered nav.
- Toast/error handling parity.

Exit criteria:

- All role-guard scenarios from `proxy.js` pass.
- Existing tokens continue to work.
- Auth redirects match the current app.

#### F3 — Student pages (3 weeks)

Deliverables:

- Dashboard, assessment, attempt runner, careers, CV, LinkedIn, profile, progress, projects, reports, roadmap, settings, AI, improvement plan, placements.
- All student forms, filters, downloads, and task/offer actions.

Exit criteria:

- Student flows pass Playwright against Express.
- No student route can access another student’s data.
- Responsive behavior passes manual checks.

#### F4 — College pages (4 weeks)

Deliverables:

- College dashboard, students, student detail, import, reports, staff, structure, settings.
- Improvement-plan list/detail.
- Placement workspace, drive detail, analytics.
- Permission-filtered navigation from `/college/me`.
- CSV import preview/commit and export/download UX.

Exit criteria:

- College admin, TPO, HOD, and faculty views match backend permissions.
- Cross-tenant and department-scope UI behavior is correct.
- All college routes pass Playwright.

#### F5 — Platform admin, marketing, and legal pages (2 weeks)

Deliverables:

- Admin dashboard, students, institutions, assessments, careers, skills, roadmaps, projects, reports, settings, AI, catch-all.
- Home page, legal pages, login/register visuals.
- All remaining modals, tables, and downloads.

Exit criteria:

- Admin flows pass Playwright.
- Marketing and legal pages match current content.
- No placeholder tabs or buttons remain.

#### F6 — Accessibility, responsive, and cutover readiness (2 weeks)

Deliverables:

- Keyboard and focus checks.
- Screen-reader labels for forms, tables, dialogs, and navigation.
- Mobile/tablet layouts for all role areas.
- Bundle-size and performance checks.
- CSP/security-header verification.
- Frontend cutover and rollback runbook.

Exit criteria:

- No P0/P1 accessibility findings.
- Lighthouse/performance targets agreed.
- SPA build is deployable as static assets.
- Rollback to the Next.js frontend is tested.

### Phase 9 — Data migration and shadow comparison (3 weeks, overlaps Phase 8)

Deliverables:

- MySQL → Mongo exporter with consistent snapshot.
- Transform/load scripts with idempotent upserts.
- Numeric-ID preservation.
- Collection counts, checksums, orphan checks.
- Shadow-read comparison: same request against Spring/MySQL and Express/Mongo.
- Migration runbook.

Exit criteria:

- Three full rehearsals on production-sized data.
- 100% row counts and checksums reconciled.
- No orphaned relationships.
- Representative API responses match after normalization.
- Measured migration duration fits the cutover window.

### Phase 10 — Test parity, security, and performance (4 weeks, overlaps)

Deliverables:

- Ported backend test suite covering the current 333 tests’ behavior.
- Contract tests for all 154 route mappings.
- Security suite: tenant isolation, IDOR, invitation, CSV abuse, audit, secrets.
- React route, role-guard, and component tests.
- Playwright critical-path E2E against the React SPA.
- Visual/regression screenshots for key pages.
- k6 load tests for student lists, dashboards, placement analytics, and exports.
- Dependency and container scans for both apps.

Exit criteria:

- No P0/P1 security findings.
- Contract parity above agreed threshold.
- p95 latency within agreed budget.
- No cross-tenant access in the security suite.
- Rollback rehearsal passes.

### Phase 11 — Staging, cutover, and decommission (2 weeks)

Deliverables:

- Staging deployment with production-like Mongo, Nginx/CDN SPA hosting, API proxy, storage, and secrets.
- React SPA deployment and deep-link smoke tests.
- Smoke tests for student, college, and admin flows.
- Cutover and rollback runbooks covering both backend and frontend.
- Maintenance-window plan.
- Post-cutover monitoring.
- Spring/MySQL/Next.js decommission checklist.

Exit criteria:

- Staging sign-off.
- Backup verified.
- Cutover authorized.
- Rollback tested.
- No unresolved P0/P1 issues.

---

## 10. Data migration plan

### Source

MySQL remains the source of truth until cutover.

### Export

- Use a consistent snapshot (`START TRANSACTION WITH CONSISTENT SNAPSHOT` or equivalent).
- Export each table to NDJSON.
- Record row counts, min/max IDs, and checksums.

### Transform

- Map each table to its collection.
- Preserve numeric IDs.
- Convert enums to strings.
- Convert timestamps to UTC `Date`.
- Resolve relationships to numeric IDs.
- Preserve BCrypt password hashes and refresh-token hashes.
- Preserve audit and consent history exactly.
- Do not migrate CV file bytes into Mongo; migrate metadata and storage keys only.

### Load

- Create collections, validators, and indexes.
- Load with idempotent upserts.
- Start new sequence counters at `max(id) + 1`.
- Run orphan and duplicate checks.

### Verify

- Row counts per table/collection.
- Checksums of canonical JSON.
- Foreign-key orphan checks.
- Sample API response diffs.
- Login with migrated accounts.
- Scoped student/college/placement smoke tests.
- Audit history spot checks.

### Cutover strategy

Recommended: **two maintenance-window cutovers**.

#### Cutover A — backend and data

1. Announce a read-only window.
2. Stop writes to MySQL.
3. Take a final backup.
4. Run delta export/load.
5. Verify counts and smoke tests.
6. Switch the Next.js host `/api` upstream from Spring Boot to Express.
7. Run smoke tests and security checks.
8. Reopen writes.
9. Monitor error rate, latency, and audit volume.

At this point the existing Next.js frontend is still the UI. This isolates data/API risk.

#### Cutover B — React SPA

1. Deploy the React SPA build to the staging SPA host.
2. Run route, deep-link, role-guard, and critical-flow tests.
3. Switch DNS/traffic from the Next.js host to the React SPA host.
4. Run smoke tests, accessibility checks, and download checks.
5. Keep the Next.js host available for rollback for an agreed observation period.

Do not reopen writes until Cutover A verification passes. Once writes resume, rollback requires a reverse migration or replay; treat post-reopen rollback as an incident procedure, not a routine step.

### Rollback

- Keep the Spring Boot deployment, MySQL database, and Next.js host intact and read-only.
- Keep the previous API upstream, DNS record, and environment configuration.
- If Cutover A fails before writes resume, switch the API upstream back immediately.
- If Cutover B fails, switch DNS/traffic back to the Next.js host; the Express API can remain live.
- If failure occurs after writes resume, freeze Express, preserve Mongo data, and execute the documented reverse-reconciliation procedure.
- Never run destructive Mongo or MySQL operations during rollback.

---

## 11. Test strategy

### Contract tests

- Freeze OpenAPI and golden responses from Spring.
- Run the same requests against Express with equivalent seed data.
- Compare status, headers, envelope, error codes, and null-field behavior.
- Cover all 154 route mappings or document exceptions.

### Integration tests

- Testcontainers MongoDB replica set.
- Real transactions, indexes, and validators.
- Two institutions, multiple departments/programs/batches/sections.
- Invitation expiry/reuse, existing-account linking.
- CSV preview/commit, duplicate-file blocking, formula neutralization.
- Audit creation and append-only behavior.

### Security tests

- Cross-tenant reads/writes.
- Forged IDs.
- Department/program/batch scope.
- Role denial for faculty/HOD/TPO/admin.
- Platform admin cannot act as a college role.
- Secrets never appear in logs or audit.
- CV contents never appear in CSV/audit.
- Rate limiting and trusted-proxy behavior.

### React tests

- Route table coverage for every current URL.
- Protected-route and role-guard tests.
- API client auth/refresh/401 behavior.
- Form validation and error rendering.
- Component tests for shared tables, filters, dialogs, and downloads.
- Visual regression screenshots for key pages.

### Browser tests

Playwright critical paths:

- Student login, assessment, readiness, roadmap, CV upload, improvement plan, placement.
- College admin login, student list/detail, CSV import/export, dashboard, reports.
- TPO placement drive/application/offer flow.
- HOD read-only placement access.
- Faculty denial.
- Invitation acceptance.
- Platform admin institution management.
- Hard refresh on nested routes and role-guard redirects.
- Login/logout redirects for each role.

### Performance tests

- Student list/search with large cohorts.
- College dashboard.
- Placement analytics.
- CSV export at the 10,000-row cap.
- Concurrent application/offer updates.

---

## 12. Security and compliance

- Keep all current tenant and role rules; do not “simplify” them in Mongo.
- Validate every request with Zod.
- Never trust client-supplied `institutionId`, `studentProfileId`, or `enrollmentId`.
- Use compound indexes and repository helpers that require `institutionId`.
- Return 404 for foreign IDs.
- Keep audit append-only and sanitized.
- Keep password/token/CV/PII redaction.
- Use `helmet`, CORS allowlist, rate limiting, and no-store auth responses.
- Keep JWT secret minimum length and issuer validation.
- Keep refresh-token rotation and reuse detection.
- Keep Google ID-token audience verification.
- Keep CV MIME/type/size checks.
- Keep CSV formula neutralization.
- Port the current security headers and CSP report-only policy to the SPA host.
- Ensure the SPA never trusts the role cookie for authorization.
- Ensure deep-link fallback never serves `index.html` for `/api/*` requests.
- Run dependency, secret, and container scans in CI for both apps.
- Do not claim production readiness from local tests alone.

---

## 13. Deployment and CI

### Environments

- **Local:** Docker Compose with Mongo replica set, Express, and the React Vite dev server; optional Spring/Next.js for parity comparison.
- **Staging:** production-like Mongo, object storage, Nginx/CDN SPA host, API proxy, secrets, and email configuration.
- **Production:** managed Mongo replica set, Node runtime, static React SPA on Nginx/CDN, API reverse proxy, backups, monitoring.

### CI gates

- Typecheck.
- Lint.
- Unit tests.
- Integration tests with Mongo replica set.
- Contract tests.
- Playwright critical paths against the React SPA and Express.
- React unit/component tests.
- React SPA lint and production build.
- Next.js reference lint/build until cutover.
- `npm audit --omit=dev` for both apps.
- Container build and scan.
- Migration dry run against a disposable MySQL snapshot.

### Required environment variables

```text
NODE_ENV
PORT
MONGODB_URI
JWT_SECRET
JWT_ACCESS_EXPIRATION_MS
JWT_REFRESH_EXPIRATION_MS
CORS_ALLOWED_ORIGINS
GOOGLE_CLIENT_ID
AI_PROVIDER
AI_API_KEY
GEMINI_API_KEY
AI_BASE_URL
AI_MODEL
CV_STORAGE
CV_LOCAL_DIR
CV_S3_BUCKET
CV_S3_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
PROFILE_PHOTO_DIR
VITE_API_PROXY_TARGET
SPA_API_UPSTREAM
```

Secrets must not be committed or logged.

---

## 14. Timeline and staffing

Indicative timeline with the assumed team:

| Phase | Duration |
|---|---|
| 0. Decision and baseline | 1 week |
| 1. Contract and data model | 2 weeks |
| 2. Express foundation | 2 weeks |
| 3. Identity/auth/audit | 3 weeks |
| 4. Student core | 4 weeks |
| 5. College core | 5 weeks |
| 6. Improvement plans | 2 weeks |
| 7. Placement/analytics | 4 weeks |
| 8. AI/reports/admin | 3 weeks |
| F1. React shell/routing | 2 weeks (overlap) |
| F2. React auth/guards | 2 weeks (overlap) |
| F3. React student pages | 3 weeks (overlap) |
| F4. React college pages | 4 weeks (overlap) |
| F5. React admin/public pages | 2 weeks (overlap) |
| F6. React accessibility/cutover | 2 weeks (overlap) |
| 9. Data migration | 3 weeks (overlap) |
| 10. Test/security/performance | 4 weeks (overlap) |
| 11. Staging/cutover | 2 weeks |

**Rough total:** 24–30 weeks with parallel backend and frontend work; longer if AI parity, MySQL migration, accessibility remediation, or security review uncovers issues.

**Single senior engineer:** roughly 12–15 months for production-grade parity, because the React SPA is now in scope.

**Keeping Next.js instead of the React SPA** would save roughly 4–8 weeks, but it is not the target.

These are planning estimates, not commitments.

---

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tenant isolation regression | Critical | Shared scoped repository helpers, compound indexes, two-institution security suite |
| Mongo transactions unavailable | Critical | Require replica set; test with Testcontainers; no standalone production Mongo |
| Numeric ID mismatch | High | Preserve IDs with counters; contract tests; frontend smoke tests |
| Null-field serialization mismatch | High | Explicit response serializer; golden fixtures |
| Audit gaps | High | Transactional audit writes; append-only collection; security tests |
| CSV partial-commit differences | High | Per-row outcome model; duplicate locks; abuse tests |
| AI tool-calling parity | Medium-high | Port adapter; temporary Spring proxy fallback |
| PDF layout drift | Medium | Golden text extraction and visual checks |
| Data migration loss | Critical | Consistent snapshot, checksums, three rehearsals, backup, rollback |
| Cutover writes after rollback | Critical | Maintenance window; no writes until verification; documented incident procedure |
| Scope creep | High | Feature freeze; parity only |
| React route/deep-link regression | High | Full route inventory, hard-refresh tests, Nginx `index.html` fallback |
| Role-guard mismatch after leaving Next middleware | High | Port `proxy.js` rules into tested React guards; backend remains authoritative |
| Frontend visual/behavior drift | Medium-high | Page-by-page parity checklist and Playwright screenshots |
| SPA security-header/CSP regression | High | Port headers to Nginx/CDN; test Google Identity and download flows |
| React conversion delays backend cutover | Medium | Run frontend workstream in parallel; do not gate backend parity on every page |
| Single-engineer knowledge risk | High | ADRs, runbooks, paired review, test coverage |

---

## 16. First two-week sprint

1. Get explicit authorization to create the migration branch and scaffold.
2. Export the current OpenAPI document and save it under `docs/openapi/`.
3. Capture golden responses for auth, student dashboard, college dashboard, placement analytics, and CSV/PDF exports.
4. Create `careeros-api` with TypeScript, Express, Mongoose, Zod, pino, and Vitest.
5. Create `careeros-web` with React 19 + Vite, React Router, and the existing Tailwind/global CSS.
6. Add Docker Compose with a single-node Mongo replica set.
7. Implement `/health`, `/api/v1/meta/version`, and the standard error envelope.
8. Implement `users` and `refresh_tokens` models with numeric IDs and counters.
9. Implement login, refresh, logout, and `/auth/me` against migrated test users.
10. Build the React public layout, login page, protected-route shell, and one student and one college placeholder route.
11. Add Supertest contract tests for auth/error behavior and a React route-guard test.
12. Document the first ADRs: React SPA target, numeric IDs, Mongo replica set, API envelope, SPA hosting.

Exit criteria for the sprint:

- Auth login/refresh works against Mongo with an existing BCrypt hash.
- Error and validation shapes match Spring.
- React Router renders the login route and redirects an unauthenticated protected route.
- Tests run in CI locally.
- No production system is touched.

---

## 17. Definition of done

The migration is complete only when:

- All 154 route mappings have parity tests or approved exceptions.
- The two-institution and cross-tenant security suites pass.
- Invitation, CSV, audit, improvement-plan, placement, and analytics behavior matches the current system.
- Existing users can log in with their current passwords.
- Data migration counts and checksums reconcile.
- Every current URL renders in the React SPA and passes a hard-refresh/deep-link test.
- No `next/*` imports or Next.js runtime dependencies remain in `careeros-web`.
- React role guards, login redirects, and permission-filtered navigation match the current app.
- React student/college/admin flows pass Playwright checks.
- The React SPA production build is served by Nginx/CDN with working `/api` proxying and security headers.
- Staging deployment and rollback rehearsal pass.
- No P0/P1 security findings remain.
- Product/privacy owners approve field visibility and retention.
- Production cutover is explicitly authorized.

---

## 18. Open decisions

1. **React JavaScript or React TypeScript?** Recommendation: JavaScript/JSX to match the current codebase; TypeScript is a larger refactor.
2. **React Router version and data mode?** Recommendation: current stable React Router in declarative mode; avoid framework-mode lock-in.
3. **SPA hosting model?** Recommendation: Nginx/CDN static hosting with an `/api` reverse proxy; Express static hosting is acceptable for small deployments.
4. **MongoDB Atlas or self-hosted replica set?** Recommendation: managed replica set with backups.
5. **Numeric IDs or ObjectIds?** Recommendation: numeric IDs for frontend compatibility.
6. **AI port now or temporary Spring proxy?** Recommendation: proxy first if AI parity threatens the schedule.
7. **Cutover window and rollback authority?** Needs business approval.
8. **Email provider for invitations?** Still unconfigured in the current system.
9. **Imported-student credential activation?** Still an open product/security issue.
10. **Field-visibility and retention policy?** Needs owner approval before production.
11. **Keep localStorage tokens or move to httpOnly cookies?** Recommendation: preserve current behavior for parity; harden separately.
12. **Team and budget?** Timeline depends on staffing.

---

## 19. Approval gates

No production migration proceeds without:

- Gate 0: architecture, React target, and ID strategy approved.
- Gate 1: auth/tenant/audit parity signed off.
- Gate 2: student and college API parity signed off.
- Gate 3: placement and analytics parity signed off.
- Gate 4: React route, role-guard, and deep-link parity signed off.
- Gate 5: migration rehearsal and rollback rehearsal passed.
- Gate 6: security and privacy sign-off.
- Gate 7: explicit production cutover authorization.

Until then, the Spring Boot + MySQL system remains the source of truth.
