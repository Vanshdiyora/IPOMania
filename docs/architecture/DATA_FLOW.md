# Data flow

## Current flow

The Vite frontend uses Supabase Auth for email/password registration, verification, login, session
refresh, recovery, and logout. The Hono Worker handles `/api/health`, protected profile routes,
protected demat-account routes, and protected IPO/quota routes. It verifies caller identity through
Supabase Auth and uses the caller's bearer token and project anon key for user-scoped database
operations.

Protected demat-account pages call `/api/accounts` with that same session token. The Worker derives
ownership from the Auth-verified identity; account CRUD, filtering, and import history remain under
RLS. CSV/XLSX previews are parsed and staged as owned import records; confirmation calls a
transactional database function, while atomic updates to a private per-user counter row serialize
active-account count changes. IPO records and category configurations are owned by one user;
category changes append an immutable rule version. Quota calculations read the caller's latest
issue-specific configuration, calculate with `decimal.js`, and store a private snapshot of
pricing, lot-size, inputs, result, and timestamp.

## Authenticated database flow

For a protected API request:

1. The browser obtains a Supabase-issued user access token through the PKCE authentication flow.
2. The browser sends the bearer token to a protected API route over HTTPS.
3. The API validates the request and verifies the caller's Supabase JWT before authorization.
4. A database adapter uses the Supabase project URL and anon key while forwarding the caller's
   bearer token as the PostgREST authorization context.
5. PostgreSQL RLS evaluates `auth.uid()`; the API returns only the validated response contract.

For account import confirmation, a caller-scoped RPC locks the import preview, inserts ready rows,
records results, and commits atomically. Retried requests return the existing result.

For quota calculations, the API derives ownership from the verified identity, reads the IPO,
demat account, and latest category version through caller-context RLS, and validates all inputs.
The `calculate` route stores the exact inputs and result; `validate` does not. A demat account is
not evidence of shareholder eligibility. User-provided holdings and condition confirmations remain
unverified.

Never replace the user's JWT with a service-role credential for user-scoped operations. The
service-role key is isolated to account deletion using the verified caller ID. Avoid logging
tokens, environment secrets, or full connection strings. See
[authentication](../backend/AUTHENTICATION.md) and [RLS policies](../database/RLS_POLICIES.md).

## Initial connectivity check

Set `DATABASE_URL` to a local Supabase PostgreSQL URL or a Supabase connection string, then run
`npm run db:check`. The script performs `SELECT 1`, reports success or a connection failure, and
does not print the connection string. It does not create schema or modify data.
