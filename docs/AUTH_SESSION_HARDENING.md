# CareerOS — Authentication Session Hardening

> Status: assessment and migration plan. The full cookie/session migration is
> **not implemented**; the current release still uses JavaScript-readable
> tokens. This document records the residual risk and the safe improvements
> that were made.

## 1. Current architecture (as implemented)

- Backend: stateless Spring Security + HS256 JWT access token (default 15
  minutes) and an opaque refresh token (default 7 days) stored hashed in
  `refresh_tokens`, with rotation and reuse detection.
- Frontend: `lib/auth.js` stores `careeros_access`, `careeros_refresh`, and a
  non-sensitive user cache in `localStorage`. Axios adds
  `Authorization: Bearer <accessToken>` on same-origin `/api/v1` calls.
- Requests are same-origin by default: Next.js rewrites `/api/*` to the
  backend (`API_PROXY_URL`), so the browser does not need CORS or a third-party
  cookie.
- A `careeros_role` cookie exists only as a routing hint (`proxy.js`). It is
  not an authorization boundary; the backend JWT is authoritative.
- There is no server-managed session cookie and no CSRF token, because
  authentication is not cookie-based today.
- CSP is `Report-Only`; inline Next.js bootstrap scripts/styles prevent
  enforcement without nonce work.

## 2. Residual risk

| Risk | Impact | Current mitigation |
|---|---|---|
| XSS can read `localStorage` and exfiltrate both tokens | Full account takeover until refresh revocation | CSP report-only, React escaping, no `dangerouslySetInnerHTML` on user data, short access-token life, refresh reuse detection |
| Long-lived refresh token on a shared device | Persistent access | 7-day expiry, rotation, logout revokes, deactivation now revokes all sessions |
| Malicious browser extension | Token theft | Not preventable client-side |
| Role cookie tampering | UI routing only | Backend re-checks `ADMIN`/owner on every request |
| Token in logs/URLs | Leakage | Tokens are sent in the `Authorization` header or JSON body, never query strings; request logging records method/path/status only; auth responses are `Cache-Control: no-store` |
| No CSRF today | Low while bearer-only | No auth cookie, so browsers do not attach credentials cross-site; CORS is exact-origin |

**This is not XSS-safe token storage.** Do not describe the current scheme as
equivalent to HttpOnly sessions.

## 3. Safe improvements implemented in this change

1. **Deactivated/locked accounts are cut off immediately.**
   - `JwtAuthFilter` refuses an otherwise valid access token when the loaded
     account is not `ACTIVE`. Previously the JWT alone kept working until
     expiry.
   - `AuthService.refresh` checks account status, revokes all outstanding
     refresh tokens, and returns `401`.
   - Google sign-in refuses a deactivated account (`403`).
   - Tests cover access token, refresh, password login, and Google login.
2. **Auth responses are non-cacheable.** `AuthNoStoreFilter` adds
   `Cache-Control: no-store` and `Pragma: no-cache` to `/api/v1/auth/**`.
3. **Auth surface narrowed.** Only the anonymous entry points
   (`register`, `login`, `google`, `refresh`, `logout`, `config`) are public;
   `/api/v1/auth/me` and `/api/v1/auth/consent` require authentication. This
   removed the previous blanket `POST /api/v1/auth/**` permit.
4. **Role cookie remains a hint.** It is never treated as authorization.

## 4. Why a full migration was not done in this change

A correct cookie migration is not a storage swap. It changes:

- cookie domain/path/`SameSite`/`Secure` behavior for the Next proxy and for
  direct backend access;
- CSRF protection for every state-changing endpoint;
- CORS/credentials behavior if the browser ever calls the backend directly;
- Google Sign-In and the existing API consumers;
- logout, refresh rotation, and revoked-account semantics;
- the ability to preserve legitimate existing sessions.

Doing it without staging and an approved session-invalidation plan risks
locking out existing users or creating a second authentication mechanism. The
task explicitly allows documenting the risk and shipping only verifiable safe
improvements when a full migration is unsafe without broader changes.

## 5. Recommended migration plan (for approval)

### Phase A — add cookie mode alongside bearer mode

1. Backend feature flag `app.auth.cookie-mode` (default off).
2. On login/refresh, set:
   - `careeros_access`: `HttpOnly; Secure; SameSite=Lax; Path=/`;
   - `careeros_refresh`: `HttpOnly; Secure; SameSite=Strict;
     Path=/api/v1/auth`.
3. `JwtAuthFilter` reads the `Authorization` header first, then the access
   cookie. It must never read a token from a query parameter.
4. `POST /api/v1/auth/logout` revokes the refresh token and clears both
   cookies.
5. Keep the JSON token response for non-browser API clients during the
   transition. The browser ignores it.

### Phase B — CSRF and cross-origin rules

1. Require a double-submit CSRF token (or an `X-CSRF-Token` header bound to a
   readable cookie) for every cookie-authenticated `POST`/`PUT`/`PATCH`/
   `DELETE`.
2. Validate `Origin`/`Referer` against the exact allowed origins.
3. `SameSite=Lax` for the access cookie, `Strict` for refresh.
4. Keep CORS exact-origin and credentials enabled only for the known frontend.

### Phase C — frontend cutover

1. Remove access/refresh tokens from `localStorage`; keep only non-sensitive
   display data (or fetch `/auth/me`).
2. Use `withCredentials: true` only if the browser calls the backend directly;
   with the same-origin Next proxy, cookies are automatic.
3. Update logout, 401 handling, and the Google sign-in callback.
4. Provide a one-release compatibility path: if a legacy `localStorage` token
   exists, use it for the current session and then clear it.

### Phase D — verification

- login/logout/refresh/expiry/reuse detection;
- deactivated and locked accounts;
- CSRF rejection for cross-site and missing-token requests;
- cookie flags (`HttpOnly`, `Secure`, `SameSite`, path scope);
- Google new/existing user flows;
- direct backend API clients;
- two-instance behavior (cookies are stateless; refresh revocation is DB-based).

### Rollback

Flip the flag off and redeploy the previous frontend. Do not invalidate all
refresh tokens without an approved plan; preserving sessions requires keeping
the JSON token path working during the transition.

## 6. Residual risk statement

Until Phases A–D are implemented and verified in staging, the existing product
remains **CONDITIONAL**: an XSS or malicious extension can steal a session.
The new deactivation checks and no-store headers reduce impact but do not
remove the storage risk.
