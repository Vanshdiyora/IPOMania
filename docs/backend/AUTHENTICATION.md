# Authentication

## Provider and configuration

Supabase Auth owns credentials, email verification, password recovery, sessions, refresh, and user
deletion. The browser uses the public project URL and anon key (`VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`); these values are intended to be public. The Worker uses
`SUPABASE_URL` and `SUPABASE_ANON_KEY`. Configure `SUPABASE_SERVICE_ROLE_KEY` only as a secret
Worker binding for the isolated account-deletion operation. Never expose it to Vite or a browser.
Both URL variables must be the Supabase project base URL (for example,
`https://<project-ref>.supabase.co`), with no `/rest/v1` or `/auth/v1` path. Supabase clients add
their own API paths.

Set `WEB_APP_ORIGIN` to the exact production web origin to allow API CORS requests, and
`VITE_WEB_APP_ORIGIN` to the exact production web origin for auth email redirects. In the hosted
Supabase project's **Authentication → URL Configuration**, set the Site URL to the production web
origin and add `/auth/confirm` and `/reset-password` callback URLs to the Redirect URLs allowlist.
The deployment environment is independent of the local Supabase CLI configuration.
For local development, set the public `VITE_` variables and Worker bindings in the repository-root
`.env`; Vite exposes only `VITE_` variables, and the local Wrangler command loads the file for the
API. Do not commit the file. Use hosted Supabase credentials to connect to the hosted project, or
the values reported by `supabase status` to use the local Supabase stack.

## User flows

- Registration uses email and password, requires a 12-character minimum, and sends a PKCE email
  verification link. A database trigger provisions the profile and preferences.
- Login uses Supabase `signInWithPassword`. Supabase persists the browser session and refreshes
  tokens; protected routes wait for initial session restoration.
- Forgot password returns a non-enumerating success message and sends a recovery link. Reset
  exchanges the one-time PKCE code, removes the query string immediately, and updates the password
  through Supabase Auth.
- Logout clears the local Supabase session. Invalid/expired API sessions render a dedicated
  session-expired state and require the user to sign in again.
- Account deletion calls `DELETE /api/auth/account`. The Worker first verifies the bearer token
  with Supabase Auth, then calls the admin delete API using the verified caller's ID only. This
  privileged client is isolated to that route; normal API/database requests never use the
  service-role key. Foreign-key cascades remove the profile and preferences.

The browser exchanges PKCE codes from the callback query only in memory and immediately replaces
the URL. Access and refresh tokens are not put in application URLs or logs. Supabase's browser
session persistence uses the SDK's default browser storage; protect the application from XSS and
use a restrictive production Content Security Policy.

## Protected API

`authenticate` requires a bearer token and asks the configured Supabase Auth service to resolve it
with `auth.getUser(token)`. The Auth service verifies its JWT and returns an authoritative user;
the Worker does not decode an unverified token or accept an ID from the request body. Invalid or
expired tokens receive a structured `401`. Protected handlers attach this user to Hono context.

User-scoped PostgREST operations use the project anon key and forward the same bearer token through
`createRlsSupabaseClient`. PostgreSQL RLS remains authoritative even if a route has a bug. See
[RLS policies](../database/RLS_POLICIES.md) and
[multi-user isolation](../security/MULTI_USER_ISOLATION.md).

## Remaining production configuration

Email delivery, sender-domain authentication, redirect allowlists, rate limits, CAPTCHA/bot
controls, password policy, MFA policy, and production origins must be configured and tested in the
target Supabase project before launch. Local/mock tests do not prove that hosted email delivery or
production Auth settings work.
