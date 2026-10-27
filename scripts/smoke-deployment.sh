#!/usr/bin/env bash
# Deployment smoke checks for a running CareerOS stack.
#
# Usage:
#   FRONTEND_URL=https://careeros.example.edu ./scripts/smoke-deployment.sh
#   FRONTEND_URL=http://localhost:3000 BACKEND_URL=http://localhost:8080 \
#     ./scripts/smoke-deployment.sh
#
# The URLs are supplied by the operator; none are hardcoded in the application.
# "BACKEND_URL" is optional because the backend is intentionally not public in
# the recommended deployment. This script never sends credentials or secrets.
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-}"
BACKEND_URL="${BACKEND_URL:-}"

if [ -z "$FRONTEND_URL" ]; then
  echo "ERROR: set FRONTEND_URL (for example https://careeros.example.edu)." >&2
  exit 1
fi

FRONTEND_URL="${FRONTEND_URL%/}"
BACKEND_URL="${BACKEND_URL%/}"

pass=0
fail=0
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

status_of() {
  curl -sS -o "$tmp" -w '%{http_code}' "$1"
}

expect_status() {
  local url="$1" expected="$2" label="$3" actual
  actual="$(status_of "$url" || echo "000")"
  if [ "$actual" = "$expected" ]; then
    echo "PASS  $label ($actual)"
    pass=$((pass + 1))
  else
    echo "FAIL  $label (expected $expected, got $actual)" >&2
    fail=$((fail + 1))
  fi
}

expect_status "$FRONTEND_URL/health" 200 "frontend health"
expect_status "$FRONTEND_URL/legal/privacy" 200 "privacy policy route"
expect_status "$FRONTEND_URL/legal/terms" 200 "terms route"
expect_status "$FRONTEND_URL/api/v1/auth/config" 200 "public auth config"
expect_status "$FRONTEND_URL/api/v1/meta/version" 200 "public build identity"
expect_status "$FRONTEND_URL/api/v1/auth/me" 401 "protected endpoint remains protected"

# A missing route gives 404. A present route with an empty body gives 400.
google_status="$(curl -sS -o "$tmp" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' -d '{}' \
  "$FRONTEND_URL/api/v1/auth/google" || echo "000")"
if [ "$google_status" = "400" ]; then
  echo "PASS  Google sign-in route exists (400 validation)"
  pass=$((pass + 1))
else
  echo "FAIL  Google sign-in route (expected 400 validation, got $google_status)" >&2
  fail=$((fail + 1))
fi

if [ -n "$BACKEND_URL" ]; then
  expect_status "$BACKEND_URL/actuator/health/liveness" 200 "backend liveness"
  expect_status "$BACKEND_URL/actuator/health/readiness" 200 "backend readiness"
fi

echo
echo "Smoke result: $pass passed, $fail failed."
[ "$fail" -eq 0 ]
