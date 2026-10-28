# CareerOS React SPA (migration target)

This Vite + React Router app is being built alongside `careeros-frontend`, which remains the current reference and rollback app until migration acceptance.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm ci` in this folder after the lockfile is generated.
3. Start the API at `http://localhost:8080` or set `VITE_API_PROXY_TARGET`.
4. Run `npm run dev` and open the URL printed by Vite.

The development server forwards `/api/*` to the Express API. Protected routes use the same access-token, refresh-token, and user storage keys as the current frontend. Route checks are for navigation only; the API remains authoritative for authorization.

## Migration status

The route table covers the existing public, student, college, and administrator URL patterns. Login, student registration, Google sign-in, legal policies, and refresh-token retry use the Express API. Invitation activation is not available in Express yet. Student, college, and administrator workspaces remain placeholders until their corresponding API and frontend parity work is complete. This app is not a production replacement yet.
