# MERN Migration API Route Inventory

Generated route declarations are recorded in [`mern-api-route-inventory.csv`](./mern-api-route-inventory.csv). Regenerate them from the existing Spring Boot controllers with:

```powershell
node scripts/extract_spring_routes.mjs
```

The inventory contains **154** Spring controller method mappings: 76 GET, 38 POST, 23 PUT, 10 PATCH, and 7 DELETE. It records HTTP method, full path, controller, and handler so migration coverage can be tracked against the source implementation.

This is a route inventory, not the frozen OpenAPI contract. It does not capture query/path parameter constraints, request and response schemas, security rules, or error behavior. Those still need to be exported from the running Spring application or documented from its DTOs and verified with golden responses before cutover.

## Express implementation snapshot (2026-10-30)

The current Express source contains route and service implementations across the following areas. Presence is not evidence of full Spring contract or behavioral parity.

| Area | Current Express implementation | Parity status |
|---|---|---|
| Health, metadata, settings, auth, consent, refresh, password recovery | Implemented | Not compared endpoint-by-endpoint against Spring response and error contracts |
| Student profiles, photos, career selection, assessments, readiness, roadmaps, projects, progress | Implemented | Focused student-flow tests pass; complete contract equivalence is unverified |
| CV, reports, LinkedIn, workspace, improvement plans, student placement | Implemented | Complete behavior and response equivalence is unverified |
| AI chat | Owned sessions/history, grounded offline guidance, OpenAI-compatible providers, Gemini, bounded retries/timeouts, per-student rate limiting, and configurable offline fallback | Provider request and fallback paths have focused tests; full function-calling/answer-quality equivalence remains unverified |
| College structure, enrollment, dashboard, reports/import, placement, improvement plans, invitations | Implemented; improvement-plan paths, enrollment IDs, tenant/scope checks, generated plans from assessed gaps, and task status transitions are covered by regression tests | Broader college role, response, and error equivalence is unverified |
| Platform admin and master-data management | Implemented | Complete route and behavior equivalence is unverified |

The 154 Spring mappings above are an inventory, not a parity test. No complete automated comparison of all paths, methods, schemas, authorization rules, status codes, and response bodies has been established. The Express test suite passing does not prove equivalence for untested behavior. Spring remains the production source of truth until that comparison and the remaining migration gates pass.

## Parity comparison pass (2026-10-30)

A static comparison of the Spring inventory with the recursively mounted Express routers found a method/path counterpart for all 154 Spring mappings. Route parameter names were normalized for comparison. Express also has 30 additional method/path mappings, including health aliases, workspace APIs, and password recovery; these are Express-only additions, not missing Spring routes. This structural check does not verify request DTOs, response fields, authorization, persistence semantics, or edge cases.

The comparison also found and fixed these observable contract mismatches:

- Anonymous access to `GET /api/v1/skills` was allowed by Express although Spring requires authentication.
- Express returned `201` for CV uploads and several admin create operations that return `200` in Spring.
- Per-endpoint multipart file-size limits returned `413` in Express although the corresponding Spring service validations return `400`.
- Invalid platform-admin institution and membership statuses were raised as generic errors (and returned `500`) instead of client errors.
- Several write responses used Express's default `"Success"` message instead of the corresponding Spring success message.

The Express regression suite covers these changes. The Spring suite could not be rerun in this environment because Maven and a Maven wrapper are unavailable. Full behavioral parity across all 154 routes—including schemas, role/scope rules, response bodies, status/error behavior, and database effects—remains unverified; Spring should remain the production source of truth until endpoint-level contract tests and golden-response comparisons pass.
