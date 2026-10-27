# CODEIT CareerOS — Production Guide (Sprint 8)

How to run, configure, deploy, back up, and troubleshoot CareerOS in production.
Local development is covered in `README.md`; database backup/restore detail lives in
`docs/BACKUP_RESTORE.md`. This file is the production companion to both.

## 1. Architecture

- **Backend:** Java 21 + Spring Boot 3.5 (`careeros-backend`), Spring Security (JWT),
  Spring Data JPA, MySQL 8 only (H2 for tests only). Base API path `/api/v1`.
- **Frontend:** Next.js 16 + React 19 + Tailwind 4 (`careeros-frontend`, `output: "standalone"`).
  Browsers call same-origin `/api/*`, which Next rewrites server-side to the backend
  (`API_PROXY_URL`) — no mixed-content block on HTTPS, no browser CORS involved.
- **AI:** Spring AI with provider abstraction (OpenAI-compatible or Gemini), 8 allowlisted
  CareerOS tools, max 6 tool iterations, per-user rate limit, offline Smart Guidance fallback.
- **CV storage:** S3 in prod (`S3CvStorage`, private objects), local directory in dev/test.
- **Auth:** 15-min JWT access tokens, 7-day rotating opaque refresh tokens (SHA-256 stored,
  reuse detected and punished by revoking the whole family).

## 2. Local development setup

```bat
run-backend.bat      :: checks Java 21+, MySQL on localhost:3306, starts with --spring.profiles.active=dev
run-frontend.bat     :: npm install (if needed) + npm run dev on :3000
```

Or with Docker (dev defaults only, never prod secrets):

```bash
docker compose -f docker-compose.yml up --build
```

Dev profile: MySQL `careeros`/`careeros`+`careeros_dev_pw`, `ddl-auto: update`,
local CV dir `./data/cv-storage`, Swagger at `/swagger-ui.html`, relaxed logging.

## 3. Environment variables

All secrets come from the environment — never from committed files. Copy the template on the
deployment host (never commit the real file):

```bash
cp .env.example backend.env      # fill in, keep on the host
```

| Variable | Required | Purpose / default |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | prod: yes | Prod MySQL JDBC URL + credentials |
| `JPA_DDL_AUTO` | no | Prod default `validate` — never use `update`/`create-drop` in prod |
| `JWT_SECRET` | prod: yes | ≥32 bytes, e.g. `openssl rand -base64 48`. Boot fails fast otherwise |
| `JWT_ACCESS_EXPIRATION_MS` | no | Default `900000` (15 min) |
| `JWT_REFRESH_EXPIRATION_MS` | no | Default `604800000` (7 days) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first deploy | Consumed only when users table is empty (initial admin) |
| `CORS_ALLOWED_ORIGINS` | prod: yes | Comma-separated exact origins, e.g. `https://careeros.example.com`. Never `*` with credentials |
| `AUTH_RATE_LIMIT_PER_MINUTE` | no | Default `60` (login/register/refresh per IP) |
| `AI_PROVIDER` | no | `openai` (default) or `gemini` |
| `AI_API_KEY` | for LLM mode | OpenAI-compatible key (server-side only) |
| `AI_MODEL`, `AI_BASE_URL` | no | Defaults `gpt-4o-mini`, `https://api.openai.com/v1` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | for Gemini | Defaults to `AI_API_KEY` fallback, `gemini-2.0-flash` |
| `AI_MAX_TOOL_ITERATIONS` | no | Default `6` (hard cap 10) |
| `AI_HISTORY_LIMIT` | no | Default `20` messages of history sent to provider |
| `AI_REQUEST_TIMEOUT_SECONDS` | no | Default `120` (clamped 1–300) |
| `AI_RATE_LIMIT_PER_MINUTE` | no | Default `20` per user |
| `AI_OFFLINE_FALLBACK` | no | Default `true` — Smart Guidance answers from CareerOS data without a key |
| `CV_STORAGE` | no | Prod default `s3`, dev `local` |
| `CV_S3_BUCKET` | prod (s3): yes | Private bucket name |
| `CV_S3_REGION` | no | Default `us-east-1` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | if no IAM role | Prefer IAM role; keys stay server-side |
| `FRONTEND_API_URL` | no | Leave empty (default): browsers use same-origin `/api/*`, proxied server-side. Set only to bypass the proxy (then it must be https + in CORS origins) |
| `API_PROXY_URL` | prod compose | Server-side proxy target, e.g. `http://backend:8080` (never reaches browsers) |
| `SERVER_PORT` | no | Default `8080` |

`NEXT_PUBLIC_*` vars are embedded in the browser bundle — public endpoint URLs only, never keys.

## 4. MySQL setup

- Engine MySQL 8. Prod datasource strictly `${DB_URL/USERNAME/PASSWORD}` (fail-fast, no defaults).
- Hikari pool: max 10, min idle 2 (see `application-prod.yml`).
- Schema: managed with `ddl-auto: validate` in prod. Dev uses `update`; capture the DDL diff and
  apply additive-only migrations to prod manually (flow documented in `docs/BACKUP_RESTORE.md`).
- Indexes/constraints: FKs + unique constraints on ownership columns (user/student/attempt/CV/LinkedIn/AI session owners); refresh-token `token_hash` unique.

## 5. Backend startup

```bash
SPRING_PROFILES_ACTIVE=prod DB_URL=... DB_USERNAME=... DB_PASSWORD=... \
JWT_SECRET=... CORS_ALLOWED_ORIGINS=https://app.example.com \
java -jar careeros-backend-0.1.0-SNAPSHOT.jar
```

Requires Java 21+. Fails fast when `JWT_SECRET` (<32 bytes), `DB_*`, or `CORS_ALLOWED_ORIGINS` are missing in prod.

## 6. Frontend startup

```bash
cd careeros-frontend
npm ci
npm run build     # bakes NEXT_PUBLIC_API_URL
npm start         # serves standalone server on :3000
```

Build arg: `API_PROXY_URL=http://backend:8080` (server-side target).
`NEXT_PUBLIC_API_URL` only to bypass the proxy (browsers call the API directly).

## 7–8. AI provider setup (OpenAI / Gemini)

- OpenAI-compatible: set `AI_PROVIDER=openai`, `AI_API_KEY`, optionally `AI_MODEL`, `AI_BASE_URL`.
- Gemini: set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` (or reuse `AI_API_KEY`), optionally `GEMINI_MODEL`.
- Without any key the assistant still works via offline Smart Guidance (`AI_OFFLINE_FALLBACK=true`);
  `/api/v1/ai/status` reports `{configured, provider, model, mode}` (no secrets exposed).
- Keys are backend-only env vars. Never put them in `NEXT_PUBLIC_*` or frontend code.

## 9–10. AWS S3 / CV storage

- Prod: `CV_STORAGE=s3` + `CV_S3_BUCKET` (private bucket, no public objects; backend streams downloads
  through authorized endpoints). IAM role preferred; static keys only if required.
- Dev/test: `CV_STORAGE=local`, files under `./data/cv-storage` with UUID keys (traversal-safe).
- Upload rules (server-enforced): CV ≤5 MB, `pdf/doc/docx` + MIME allowlist; photos ≤2 MB, images only.
  Replacement deletes the old object; parse failures mark `FAILED` without leaking internals.

## 11. Docker setup

- `docker-compose.yml` — local dev stack (MySQL + backend `dev` + frontend).
- `docker-compose.prod.yml` — production stack (`SPRING_PROFILES_ACTIVE=prod`, `backend.env` file,
  MySQL health-gated startup). Secrets only via `backend.env` / build args on the host.
- Backend image: Maven build → Temurin 21 JRE, non-root `app` user.
- Frontend image: multi-stage Node 22 build → standalone server, non-root `app` user.
- `.dockerignore` files exclude secrets (`backend.env`, `*.pem/*.key`), dumps (`*.sql`), `data/`, logs.

## 12. Production deployment (checklist)

1. Provision MySQL 8, create DB + least-privilege user.
2. Apply schema (validated migrations, `JPA_DDL_AUTO=validate`).
3. Create `backend.env` from `.env.example` (strong `JWT_SECRET`, real DB creds, exact CORS origins, approved `LEGAL_CONTACT_EMAIL`/`LEGAL_WEBSITE`, and `APP_BUILD_COMMIT`/`APP_VERSION` if not auto-derived).
4. First boot creates the admin from `ADMIN_EMAIL/ADMIN_PASSWORD` only if no users exist; rotate afterwards.
5. `./deploy-prod.sh <public-host-or-ip>` from the repo root (recommended —
   creates `backend.env`, generates first-run secrets, aligns
   `FRONTEND_API_URL`/`CORS_ALLOWED_ORIGINS`, bootstraps an empty DB once,
   rebuilds and health-checks). Manual equivalent:
   `docker compose -f docker-compose.prod.yml up -d --build`.
6. Verify from the host: `FRONTEND_URL=https://<host> BACKEND_URL=http://127.0.0.1:8080 ./scripts/smoke-deployment.sh`. It checks frontend `/health`, legal routes, public auth config, build identity, protected-route denial, Google-route existence, and backend liveness/readiness. Compare `/api/v1/meta/version` with the tested commit.
7. Confirm Swagger is off in prod (`springdoc … enabled: false`).

## 13–14. Database backup / restore

Full procedure in `docs/BACKUP_RESTORE.md` (mysqldump `--single-transaction --routines`, S3 versioning
for binaries, manual additive-only migration flow, `docker exec` variant for Compose volumes).

## 15. Security considerations

- Server-side authorization everywhere: `SecurityUtils.currentUserId()` ownership scoping per module;
  `/api/v1/admin/**` requires `ADMIN`; AI controller requires `STUDENT`; cross-student access returns 404.
- JWT: HS-signed ≥256-bit secret (boot-checked), issuer `careeros`, expired/invalid rejected, refresh
  rotation with reuse detection. BCrypt passwords, never logged.
- CORS: exact origins only, credentials allowed, `Authorization/Content-Type/Accept` headers.
- Rate limits: auth 60/min/IP, AI chat 20/min/user; CV/photo size+type enforced server-side.
- AI: 8 allowlisted tools only (no SQL/DB/filesystem/repos), args validated, output truncated,
  prompt-injection system rules, provider errors sanitized, no secret leakage (`safeProviderMessage`).
- Error responses: consistent `ApiResponse`, no stack traces/SQL/paths/keys (see `GlobalExceptionHandler`).
- Frontend: `Secure` cookie flag on HTTPS, single-flight token refresh, friendly error mapping, no secrets in bundle.
- Known residual risk: auth state lives in JS-readable storage/cookie (HttpOnly server cookies would
  require a backend session-cookie mechanism — future work, not Sprint 8 scope).

## 16. API / Swagger usage

- Dev/test: Swagger UI at `/swagger-ui.html` (JWT `bearerAuth` scheme in `OpenApiConfig`).
- Prod: Swagger disabled. Use the DTO-shaped JSON contracts; auth via `Authorization: Bearer <accessToken>`,
  refresh via `POST /api/v1/auth/refresh` with the opaque refresh token.

## 17. Testing

```bash
# Backend (needs JDK 21+, uses H2, no external services)
SPRING_PROFILES_ACTIVE=test mvn test        # 136 tests: security/auth, careers/skills,
                                            # assessment incl. expiry, scoring, gaps, readiness,
                                            # roadmap/projects, reports, CV, LinkedIn, AI incl.
                                            # fallback/rate-limit/provider-failure/injection
# Frontend
npm run lint                                # eslint, must be clean
npm run build                               # production build, all 22 routes
```

Do not weaken tests to make them pass. New production code (e.g. `ProdAdminBootstrapRunner`,
JWT secret check) is covered by boot-time behavior, not fabricated data.

## 18. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Boot fails: JWT secret message | `JWT_SECRET` missing/short | Set ≥32-byte secret |
| Boot fails: DB connection | Wrong `DB_URL`/creds, MySQL down | Check host, user grants, Compose health |
| 401 everywhere | Clock skew / bad secret after rotation | Re-login; keep single secret per env |
| 429 on login | Rate limiter doing its job | Wait a minute; check for retry loops |
| AI says unavailable | No key + `AI_OFFLINE_FALLBACK=false` | Set key or re-enable fallback |
| CV upload rejected | >5 MB or non pdf/doc/docx | Compress/convert client-side |
| Swagger 404 in prod | Intended | Use dev env for API exploration |
| Signup/login fails on HTTPS site | Browser calls `http://…:8080` directly (mixed-content block) | Deploy with the same-origin `/api` proxy (default): rebuild frontend so `NEXT_PUBLIC_API_URL` stays empty |
