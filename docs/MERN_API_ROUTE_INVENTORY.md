# MERN Migration API Route Inventory

Generated route declarations are recorded in [`mern-api-route-inventory.csv`](./mern-api-route-inventory.csv). Regenerate them from the existing Spring Boot controllers with:

```powershell
node scripts/extract_spring_routes.mjs
```

The inventory contains **154** Spring controller method mappings: 76 GET, 38 POST, 23 PUT, 10 PATCH, and 7 DELETE. It records HTTP method, full path, controller, and handler so migration coverage can be tracked against the source implementation.

This is a route inventory, not the frozen OpenAPI contract. It does not capture query/path parameter constraints, request and response schemas, security rules, or error behavior. Those still need to be exported from the running Spring application or documented from its DTOs and verified with golden responses before cutover.

## Express parity snapshot

| Area | Current Express coverage |
|---|---|
| Health, metadata, settings | Foundation endpoints present |
| Auth, consent, refresh | Implemented in the migration scaffold |
| Student profile | `GET` and `PUT /api/v1/students/me` ported |
| Student profile photo | `POST`, `GET`, and `DELETE /api/v1/students/me/photo` ported; student-scoped, 2 MB cap, JPEG/PNG/WebP signature validation |
| Career catalog | Public `GET /api/v1/careers`, `/{id}`, and `/{id}/skills` ported |
| Student target career | `PUT /api/v1/students/me/career` ported with published-career enforcement |
| Assessment availability | `GET /api/v1/assessments/{careerId}/available` ported for student role; counts active questions and caps displayed count at 20 |
| Assessment attempts and insights | Start/resume, attempt state, ownership-checked autosave, expiry, grading, latest attempt, submitted history, and target-career readiness ported |
| Roadmaps | Student roadmap, live skill-gap enrichment, and target-career-scoped progress updates ported |
| Projects | Published target-career recommendations, live skill-gap enrichment, and target-career-scoped progress updates ported |
| CV, reports, AI | Not ported |
| College, invitation, placement, admin modules | Not ported |

The Next.js/Spring application remains the production source of truth while endpoint parity is incomplete.
