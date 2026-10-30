# CareerOS MERN Migration Progress

**Updated:** 2026-10-30
**Migration baseline:** `c3cd28f` (`feat: scaffold careeros-api (Express + MongoDB) migration target`)
**Current status:** Local migration implementation in progress. The existing Spring Boot/MySQL and Next.js applications remain the source of truth and rollback target. No database migration, deployment, production traffic change, or decommissioning has occurred.

## Completed in this workspace

- Added the Express + TypeScript + MongoDB API scaffold in `careeros-api` (auth, consent, audit foundations, health, metadata, settings, and auth integration tests).
- Generated a reproducible inventory of all 154 Spring `/api/v1` controller routes and documented what remains before a full OpenAPI/golden-response contract is frozen.
- Ported authenticated student profile reads and updates to Express with DTO-aligned validation and numeric user/profile IDs.
- Ported student photo upload, private download, and removal with generated opaque keys, a 2 MB limit, supported MIME/extension checks, image-signature validation, and private filesystem storage.
- Connected a responsive student profile page to profile and photo endpoints, including update, upload, and remove actions.
- Ported the published career catalog/detail/skill endpoints and authenticated target-career selection with numeric IDs.
- Added assessment catalog models and student-only availability lookup, preserving published filtering, newest-first ordering, active-question counts, and the 20-question display cap.
- Ported the student assessment lifecycle: start/resume, weighted question selection, frozen attempt questions, option ownership, autosave, expiry enforcement, scoring, and result history.
- Ported target-career readiness with latest per-skill scores, framework targets/weights, strengths, improvement gaps, and no-target empty state.
- Connected a compact responsive React assessment list and attempt runner, with autosave, countdown, submission, result breakdown, and readiness summary.
- Ported student roadmap and project recommendation APIs with Mongo models, latest submitted skill-gap enrichment, and user-scoped status updates. Progress updates are restricted to the student’s current target career.
- Mounted the public college invitation lookup and acceptance endpoints in Express; invitation details remain token-free and mask the invitee email, while acceptance assigns the invited staff role and rejects replay.
- Mounted the Spring-equivalent college staff invitation create/list/revoke endpoints and platform-admin bootstrap endpoint. College invitation management requires an active `COLLEGE_ADMIN` membership resolved from the authenticated user; bootstrap remains super-admin-only.
- Connected responsive roadmap and project pages with clear target-career empty states and simple progress controls.
- Connected the React Careers page to the catalog and target-career APIs with responsive search, category filtering, skill details, and target selection.
- Started F1 with a separate `careeros-web` React + Vite SPA.
- Added React Router route coverage for current public, student, college, and admin URL patterns.
- Added a responsive role-aware shell, client navigation guards, same-origin API client, local login flow, and Vite `/api` proxy.
- Connected student password registration and Google sign-in using the Express auth contract, including explicit signup consent copy and current Terms/Privacy content.
- Added single-flight refresh-token retry, logout revocation, role-aware redirects, and same-origin redirect validation after login.
- Mounted the existing registration, public invitation acceptance, and legal pages in the React SPA router instead of placeholder pages.
- Kept the Next.js legal pages' displayed update date in sync with each policy's content date through the shared legal layout.
- Declared the SPA's Markdown, icon, and PostCSS/Tailwind build dependencies; exported the API client in both named and default forms used by existing pages.
- Added tenant-scoped college student list, skill-gap, detail, and enrollment-status endpoints with input validation, audit records, and transaction-backed status updates.
- Added a cross-tenant integration test covering student visibility, foreign-tenant rejection, status updates, and audit records.
- Ported the college dashboard endpoint to Mongo-backed scoped enrollment, assessment, readiness, skill-gap, department, and batch metrics, including institution-local assessment date boundaries and foreign-scope filter rejection.
- Connected the React SPA college dashboard to the new dashboard and staff-members APIs, replacing its legacy workspace-summary dependency.
- Ported college CSV/PDF report generation and roster exports with staff permission enforcement, tenant scoping, audit events, formula-safe CSV output, and spreadsheet formula-injection coverage.
- Ported college student CSV import preview and commit, including strict CSV parsing, institution-structure validation, duplicate detection, creator/tenant checks, 30-minute preview expiry, per-row Mongo transactions, replay protection, audit events, and immediate staged-PII cleanup after commit.
- Connected the React SPA student roster and CSV import workflow to the Express endpoints, including preview/error review, rejected-row CSV downloads, and commit actions gated by the `IMPORT_STUDENTS` permission.
- Generated the SPA dependency lockfile and verified the Vite production build and ESLint.
- Kept the Next.js application unchanged as the reference implementation.

## Current limitations

- Full Spring contract parity remains incomplete. The current Express CV, report, AI, student placement, and workspace routes still require endpoint-by-endpoint comparison against the Spring inventory and response/authorization contracts.
- College support is partial: student enrollment, dashboard, reports, and CSV import are implemented; placement administration, improvement-plan administration, and remaining tenant workflows are not verified as migrated.
- Admin master-data and management APIs remain incomplete beyond the implemented bootstrap invitation flow.
- Invitation integration coverage verifies masked public lookup, new-account activation, single-use acceptance, create/list/revoke, and rejection of student access; existing-account, expiry, and revoked-token acceptance parity still need tests.
- Google sign-in depends on `GOOGLE_CLIENT_ID` being configured in the Express API environment.
- Production Nginx/CDN routing, CSP/security headers, and deep-link hosting are not configured yet.
- The new SPA has not been deployed.
- No MySQL-to-MongoDB data migrator or rehearsal has been completed. Spring Boot/MySQL remains the source of truth and production deployment target.

## Verification for this slice

- `npm run typecheck`, `npm run lint`, and `npm test` pass in `careeros-api` (64 tests).
- `npm run build` in `careeros-api` passes after the college dashboard port.
- `npm run build` and `npm run lint` pass in `careeros-web`; Vite reports a non-blocking large-bundle warning.
- `npm run build` and `npm run lint` pass in `careeros-frontend`.
- No production data operations or deployment changes were made in this slice.

## Next implementation steps

1. Freeze and compare the full `/api/v1` contract: schemas, query/path constraints, role rules, errors, and golden responses.
2. Complete existing-account, expiry, and revoked-token invitation acceptance parity tests.
3. Implement and verify college placement administration, improvement-plan administration, and admin/master-data endpoints with cross-tenant security coverage.
4. Compare the current CV, report, AI, student placement, and workspace routes against Spring behavior; correct gaps and connect all remaining React pages without placeholder fallbacks.
5. Rehearse MySQL-to-Mongo data conversion against a disposable copy before any real data is involved.
6. Complete parity/security verification and deployment configuration before any production cutover.

Production cutover remains outside the scope of this progress update and requires the gates in `MERN_MIGRATION_PLAN.md`.
