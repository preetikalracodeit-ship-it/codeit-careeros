# CareerOS API

Standalone Express + TypeScript + MongoDB API. It loads configuration from this folder's `.env` file or the process environment; it does not read configuration from the Spring Boot backend or repository-root environment files.

## Profile photo storage

Set `PROFILE_PHOTO_DIR` to a private filesystem directory with enough capacity. The default is `./data/profile-photos`. In any container deployment, mount a persistent volume at that path; the directory must not be served as static web content. MongoDB stores only generated photo keys in student profiles.

`POST /api/v1/students/me/photo` accepts one multipart file under `file`. Uploads are limited to 2 MB and checked against the allowed JPG/JPEG, PNG, or WebP extension, declared MIME type, and image signature. `GET` and `DELETE` on the same path operate only on the authenticated student's own photo.

## Campus career and placement API

College staff with an active institution membership use `/api/v1/college`. The dashboard and student list support academic year, department, program, batch, section, semester, assessment status, assessment date, and evidence-based preparation filters. Student detail includes profile completion and, for non-faculty staff, available CV and LinkedIn analysis summaries. Readiness scores and preparation gaps use assessed skill results only; missing assessment data is not reported as a failed skill.

Use `GET /api/v1/college/students/import/template.csv` to download the CSV header template, then `POST /api/v1/college/students/import/preview` to validate an upload before committing it with `POST /api/v1/college/students/import/:jobId/commit`. Both preview and commit enforce the staff member's academic scope. Student and report exports are CSV; report types include `roster`, `assessment-completion`, `readiness-summary`, `department-skill-gaps`, and `batch-assessment-coverage`.

## Local development

From this folder, copy `.env.example` to `.env`, set a strong `JWT_SECRET`, and configure `MONGODB_URI` to point to a MongoDB replica set. MongoDB must be running separately; this API does not depend on the Spring Boot backend. Install dependencies with `npm ci`, then run `npm run dev`. The `PROFILE_PHOTO_DIR` default is covered by the repository's ignored `data/` directory.

The AI assistant works with grounded offline guidance by default. To enable a provider, configure `AI_PROVIDER` and the matching `AI_API_KEY` (or `GEMINI_API_KEY` for Gemini); OpenAI-compatible endpoints also support Ollama and custom providers through `AI_BASE_URL`. Provider errors fall back to offline guidance unless `AI_OFFLINE_FALLBACK=false`.
