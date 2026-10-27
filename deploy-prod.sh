#!/usr/bin/env bash
# =============================================================================
# CODEIT CareerOS — one-command production deploy (run on the server, repo root)
#
#   ./deploy-prod.sh 13.201.83.135
#   ./deploy-prod.sh careeros.your-college.edu --https
#
# What it fixes (the usual "site opens but nothing works" causes):
#   1. Same-origin /api proxy: browsers call this site's own /api/* (no more
#      mixed-content block on HTTPS, no CORS), the Next server forwards to the
#      backend over the compose network. Rebuild bakes the proxy target in.
#   2. Backend CORS -> sets CORS_ALLOWED_ORIGINS to the real frontend origin.
#   3. Missing/placeholder secrets -> generates JWT/DB passwords on first run.
#   4. Fresh database + prod `validate` mode -> one-time schema bootstrap on an
#      EMPTY database only (never touches existing data).
#
# Requirements on the server: docker (with compose plugin), openssl, curl.
# Only the frontend port must be reachable from browsers (default 3000, or 443
# behind your TLS reverse proxy) — the backend port stays internal.
# =============================================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="backend.env"

HOST=""
SCHEME="http"
FRONTEND_PORT="3000"

usage() {
  echo "Usage: $0 <public-host-or-ip> [--https] [--frontend-port PORT]"
  echo "Example: $0 13.201.83.135"
  echo "Example: $0 careeros.your-college.edu --https"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --https) SCHEME="https"; FRONTEND_PORT="443"; shift ;;
    --frontend-port) FRONTEND_PORT="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) if [ -z "$HOST" ]; then HOST="$1"; shift; else usage; fi ;;
  esac
done
[ -z "$HOST" ] && usage

# --- 0. Preconditions ---------------------------------------------------------
command -v docker >/dev/null || { echo "ERROR: docker not found."; exit 1; }
docker compose version >/dev/null || { echo "ERROR: docker compose plugin not found."; exit 1; }
command -v openssl >/dev/null || { echo "ERROR: openssl not found."; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not found."; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "ERROR: run this from the repo root ($COMPOSE_FILE missing)."; exit 1; }
[ -f ".env.example" ] || { echo "ERROR: .env.example missing."; exit 1; }

origin_of() { # $1=scheme $2=host $3=port -> origin, omitting default ports
  if { [ "$1" = "http" ] && [ "$3" = "80" ]; } || { [ "$1" = "https" ] && [ "$3" = "443" ]; }; then
    echo "$1://$2"
  else
    echo "$1://$2:$3"
  fi
}

FRONTEND_ORIGIN="$(origin_of "$SCHEME" "$HOST" "$FRONTEND_PORT")"
echo "Frontend origin : $FRONTEND_ORIGIN"
echo "API access      : same-origin $FRONTEND_ORIGIN/api/* -> backend:8080 (no browser CORS)"

# --- 1. backend.env ------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE from .env.example ..."
  cp .env.example "$ENV_FILE"
fi

set_kv() { # $1=KEY $2=value -> replace line (or append) in backend.env
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

FIRST_RUN=false
if grep -q "CHANGE_ME" "$ENV_FILE"; then
  FIRST_RUN=true
  echo "First run: generating secrets ..."
  set_kv "JWT_SECRET" "$(openssl rand -base64 48)"
  ROOT_PW="$(openssl rand -hex 24)"
  APP_PW="$(openssl rand -hex 24)"
  set_kv "MYSQL_ROOT_PASSWORD" "$ROOT_PW"
  set_kv "MYSQL_PASSWORD" "$APP_PW"
  set_kv "DB_PASSWORD" "$APP_PW"
  ADMIN_PW="Admin@$(openssl rand -hex 4)"
  set_kv "ADMIN_EMAIL" "admin@careeros.local"
  set_kv "ADMIN_PASSWORD" "$ADMIN_PW"
  echo "  -> generated JWT_SECRET, DB passwords, admin password (shown at the end)."
fi

# Always align these with the real public host (the core fix).
set_kv "CORS_ALLOWED_ORIGINS" "$FRONTEND_ORIGIN"
set_kv "SPRING_PROFILES_ACTIVE" "prod"

# File uploads: S3 needs a real bucket + credentials. Without one, use the
# persisted local volume (/data, see docker-compose.prod.yml) so CV upload /
# analysis / download and profile photos work out of the box.
BUCKET="$(grep "^CV_S3_BUCKET=" "$ENV_FILE" | cut -d= -f2- || true)"
if [ -z "$BUCKET" ] || [[ "$BUCKET" == *"your-careeros-cv-bucket"* ]] || [[ "$BUCKET" == *"CHANGE_ME"* ]]; then
  set_kv "CV_STORAGE" "local"
  set_kv "CV_LOCAL_DIR" "/data/cv-storage"
  set_kv "PROFILE_PHOTO_DIR" "/data/profile-photos"
  echo "No S3 bucket configured: using persisted local upload storage."
fi
if ! grep -q "^ADMIN_EMAIL=" "$ENV_FILE"; then
  set_kv "ADMIN_EMAIL" "admin@careeros.local"
fi

# AI sanity check (non-blocking, never prints secrets): the deploy script
# provisions JWT/DB/admin secrets above but AI keys must be set by hand.
# A missing key is the usual "chat says it cannot reach the AI provider"
# cause: the backend then runs unconfigured (503 AI_NOT_CONFIGURED or the
# offline Smart-Guidance fallback) while localhost works fine.
AI_PROVIDER_VAL="$(grep "^AI_PROVIDER=" "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)"
AI_API_KEY_VAL="$(grep "^AI_API_KEY=" "$ENV_FILE" | cut -d= -f2- || true)"
GEMINI_API_KEY_VAL="$(grep "^GEMINI_API_KEY=" "$ENV_FILE" | cut -d= -f2- || true)"
GEMINI_MODEL_VAL="$(grep "^GEMINI_MODEL=" "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)"
AI_MODEL_VAL="$(grep "^AI_MODEL=" "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)"
if [ "${AI_PROVIDER_VAL:-openai}" = "gemini" ]; then
  if [ -z "$GEMINI_API_KEY_VAL" ] && [ -z "$AI_API_KEY_VAL" ]; then
    echo "WARNING: AI_PROVIDER=gemini but neither GEMINI_API_KEY nor AI_API_KEY is set in $ENV_FILE."
    echo "  The AI chat will answer with the offline fallback (or 503) until you set one, e.g.:"
    echo "    GEMINI_API_KEY=AIza-...  GEMINI_MODEL=gemini-2.5-flash"
    echo "  Then rebuild + restart:  docker compose -f $COMPOSE_FILE up -d --build backend"
  fi
  if [ "$GEMINI_MODEL_VAL" = "gemini-2.0-flash" ] || [ "$AI_MODEL_VAL" = "gemini-2.0-flash" ]; then
    echo "WARNING: gemini-2.0-flash was shut down on 2026-06-01 and returns 404."
    echo "  Set GEMINI_MODEL=gemini-2.5-flash (or gemini-3.8-flash) in $ENV_FILE and redeploy."
  fi
else
  if [ -z "$AI_API_KEY_VAL" ]; then
    echo "WARNING: AI_PROVIDER=${AI_PROVIDER_VAL:-openai} but AI_API_KEY is empty in $ENV_FILE."
    echo "  The AI chat will run unconfigured (offline fallback / 503) until a key is set."
  fi
fi

# Google Sign-In sanity check (non-blocking): the backend verifies ID tokens
# against GOOGLE_CLIENT_ID and the frontend bakes the same value in at build
# time (NEXT_PUBLIC_GOOGLE_CLIENT_ID, see docker-compose.prod.yml). Empty on
# either side means email/password-only — the site still works, the Google
# button just stays hidden. After ADDING a client ID, rebuild the frontend:
#   docker compose -f $COMPOSE_FILE up -d --build frontend
GOOGLE_CLIENT_ID_VAL="$(grep "^GOOGLE_CLIENT_ID=" "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)"
if [ -z "$GOOGLE_CLIENT_ID_VAL" ]; then
  echo "NOTE: GOOGLE_CLIENT_ID is empty in $ENV_FILE — Google Sign-In stays disabled."
  echo "  Set GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com in $ENV_FILE"
  echo "  and add your domain under Authorized JavaScript origins in Google Cloud Console."
fi

# --- 2. Start MySQL first (so we can inspect it before booting the API) --------
echo "Starting MySQL ..."
docker compose -f "$COMPOSE_FILE" up -d mysql
echo "Waiting for MySQL to become healthy ..."
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" ps mysql --format '{{.Health}}' 2>/dev/null | grep -qi "healthy"; then
    break
  fi
  sleep 5
done

# shellcheck disable=SC1090
set -a; . "./$ENV_FILE"; set +a
# Proxy mode: browsers must use same-origin /api (never call the backend
# directly), so a stale FRONTEND_API_URL from an older backend.env must not
# leak into the frontend build through the exported environment.
export FRONTEND_API_URL=""
export API_PROXY_URL="http://backend:8080"
# Record the deployed identity when the operator has not supplied one. This is
# public, non-sensitive, and lets /api/v1/meta/version and /health prove which
# build is actually serving traffic.
if [ "${APP_BUILD_COMMIT:-unknown}" = "unknown" ] && command -v git >/dev/null 2>&1; then
  APP_BUILD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  export APP_BUILD_COMMIT
fi
if [ "${APP_VERSION:-unknown}" = "unknown" ] && command -v git >/dev/null 2>&1; then
  APP_VERSION="$(git describe --tags --always --dirty 2>/dev/null || echo unknown)"
  export APP_VERSION
fi
# Google Sign-In: NEXT_PUBLIC_GOOGLE_CLIENT_ID is baked into the frontend at
# BUILD time (docker-compose.prod.yml maps GOOGLE_CLIENT_ID -> build-arg).
# Sourcing backend.env above exports it, but make it explicit + visible so a
# missing ID is caught here instead of "button not showing" on the live site.
if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  export GOOGLE_CLIENT_ID
  echo "Google Sign-In: GOOGLE_CLIENT_ID is set — frontend build will include the Google button."
else
  echo "Google Sign-In: GOOGLE_CLIENT_ID is empty — frontend will build WITHOUT the Google button (email/password only)."
  echo "  To enable: set GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com in $ENV_FILE,"
  echo "  add the live origin ($FRONTEND_ORIGIN) in Google Cloud Console > Credentials > Authorized JavaScript origins,"
  echo "  then rebuild: docker compose -f $COMPOSE_FILE up -d --build frontend"
fi

TABLE_COUNT="$(docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME:-careeros}';" 2>/dev/null | tr -d '[:space:]' || echo "unknown")"
echo "Tables in '${DB_NAME:-careeros}': $TABLE_COUNT"

# --- Flyway owns the schema --------------------------------------------------
# Fresh database: V1..Vn create the schema.
# Existing database: Flyway baselines at V1 and applies V2+ only.
# Never let Hibernate create/update schema in production.
set_kv "JPA_DDL_AUTO" "validate"
if ! grep -q "^FLYWAY_ENABLED=" "$ENV_FILE"; then
  set_kv "FLYWAY_ENABLED" "true"
fi
echo "Schema: Flyway migrations + JPA validate (no auto-DDL)."

# --- 3. Build + start everything (rebuild bakes the API proxy target in) -----
echo "Building and starting the full stack ..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "Waiting for the backend API ..."
HEALTHY=false
for _ in $(seq 1 36); do
  if curl -fsS -m 5 "http://localhost:8080/actuator/health" 2>/dev/null | grep -q '"UP"'; then
    HEALTHY=true
    break
  fi
  sleep 5
done
if [ "$HEALTHY" != "true" ]; then
  echo "ERROR: backend did not become healthy. Recent logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail=60 backend || true
  exit 1
fi
echo "Backend is UP."

# --- 4. Verify the applied migration version ---------------------------------
FLYWAY_VERSION="$(docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -N -e \
  "SELECT version FROM flyway_schema_history WHERE success=1 AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1;" \
  "${DB_NAME:-careeros}" 2>/dev/null | tr -d '[:space:]' || true)"
if [ -n "$FLYWAY_VERSION" ]; then
  echo "Flyway schema version: $FLYWAY_VERSION"
else
  echo "WARNING: no successful Flyway history row found. Check backend logs and the schema."
fi

# --- 5. Summary -----------------------------------------------------------------
echo
echo "================ DEPLOY COMPLETE ================"
echo "Open the app : $FRONTEND_ORIGIN"
echo "API (proxied): $FRONTEND_ORIGIN/api/v1/... (same origin, no mixed content)"
echo "Build identity: version=${APP_VERSION:-unknown} commit=${APP_BUILD_COMMIT:-unknown}"
if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  echo "Google button: enabled (GOOGLE_CLIENT_ID set; also served at runtime via /api/v1/auth/config)."
else
  echo "Google button: DISABLED (GOOGLE_CLIENT_ID empty in $ENV_FILE)."
fi
if [ "$FIRST_RUN" = true ]; then
  # shellcheck disable=SC1090
  set -a; . "./$ENV_FILE"; set +a
  echo "Admin login  : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
  echo "  (change the admin password after first login; it is only used on empty DB)"
fi
echo "Still stuck? On the site press F12 -> Console and read the red lines:"
echo "  calls to http://...:8080 = old build still serving; redeploy to rebuild."
echo "================================================="
