# Data flow

## Current Phase 1 flow

The Vite frontend loads a client-rendered application shell with local navigation. The Hono Worker
handles `/api/health`; the endpoint validates runtime bindings and returns application status,
version, and a non-secret environment label. There is no current frontend data request, login, or
business-data flow.

## Planned authenticated database flow

When authenticated routes are introduced:

1. The browser obtains a Supabase-issued user access token through the approved authentication
   flow.
2. The browser sends the bearer token to a protected API route over HTTPS.
3. The API validates the request and verifies the caller's Supabase JWT before authorization.
4. A database adapter uses the Supabase project URL and anon key while forwarding the caller's
   bearer token as the PostgREST authorization context.
5. PostgreSQL RLS evaluates the user context; the API returns only the validated response contract.

Never replace the user's JWT with a service-role credential for user-scoped operations. Avoid
logging tokens, environment secrets, or full connection strings. This flow is a design constraint,
not an implemented authentication feature.

## Initial connectivity check

Set `DATABASE_URL` to a local Supabase PostgreSQL URL or a Supabase connection string, then run
`npm run db:check`. The script performs `SELECT 1`, reports success or a connection failure, and
does not print the connection string. It does not create schema or modify data.
