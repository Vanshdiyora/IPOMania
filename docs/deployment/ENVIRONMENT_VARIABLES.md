# Environment variables

## Rules

- Keep root `.env`, `.env.*`, and `.dev.vars` files out of version control. Use `.env.example`
  only for empty or clearly fake placeholders.
- Vite embeds every `VITE_` value into browser-delivered assets. Only the Supabase project URL,
  publishable/anon key, and public app origin belong there.
- Never put a Supabase service-role key, JWT signing secret/private key, database password,
  Cloudflare API token, or any other private credential in a frontend variable, public Actions
  variable, checked-in file, log, or artifact.
- Supabase JWT signing and verification are managed by Supabase Auth. The API verifies bearer
  tokens with Supabase Auth and forwards the verified caller's JWT with the anon key for RLS.
  Do not add a custom JWT secret to the web build or bypass RLS with a service-role key.
- Use different Supabase projects, Cloudflare variables, credentials, origins, and domains for
  preview and production. Do not reuse production credentials for local or preview testing.

## Variable reference

| Name                        | Consumer                     | Local development                                        | Tests                                       | Preview                                            | Production                                                                                            |
| --------------------------- | ---------------------------- | -------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `RUNTIME_ENV`               | API Worker                   | `development` (Wrangler default)                         | `test` when needed                          | `test` (Wrangler preview environment)              | `production` (Wrangler production environment)                                                        |
| `VITE_SUPABASE_URL`         | Browser build                | Local or hosted project URL                              | Test project URL if a browser test needs it | Preview Supabase project URL                       | Production Supabase project URL                                                                       |
| `VITE_SUPABASE_ANON_KEY`    | Browser build                | Local or hosted publishable/anon key                     | Test project public key                     | Preview project's publishable/anon key             | Production project's publishable/anon key                                                             |
| `VITE_WEB_APP_ORIGIN`       | Browser build/auth redirects | Usually omit; current origin is used                     | Test origin or omit                         | Exact preview web origin                           | Exact canonical web origin                                                                            |
| `VITE_API_BASE_URL`         | Browser build                | Usually omit; direct local API URL when needed           | Usually omit                                | Exact preview API Worker URL                       | Exact production API Worker URL                                                                       |
| `SUPABASE_URL`              | API Worker                   | Same project as browser or local Supabase URL            | Local/test project URL                      | Preview project URL                                | Production project URL                                                                                |
| `SUPABASE_ANON_KEY`         | API Worker                   | Matching project's public anon key                       | Matching test project key                   | Preview project key                                | Production project key                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | API Worker only              | Omit unless explicitly testing isolated account deletion | Never use a production value                | Preview-only secret if account deletion is enabled | Production Worker secret, only if account deletion is enabled                                         |
| `WEB_APP_ORIGIN`            | API Worker CORS              | Optional; localhost ports are allowed in non-production  | Test origin if needed                       | Exact preview web origin                           | Exact canonical web origin                                                                            |
| `DATABASE_URL`              | Local database tooling       | Local/disposable PostgreSQL URL only                     | Loopback-only disposable test URL           | Not used by deploy workflows                       | Never store in the frontend or deployment workflow; use an authorized operator's private tooling only |
| `CLOUDFLARE_API_TOKEN`      | Deployment workflow          | Not needed                                               | Not available to PR CI                      | `preview` environment secret                       | `production-api` and `production-web` environment secret                                              |
| `CLOUDFLARE_ACCOUNT_ID`     | Deployment workflow          | Not needed                                               | Not available to PR CI                      | `preview` environment secret                       | `production-api` and `production-web` environment secret                                              |
| `API_HEALTH_URL`            | Deployment workflow          | Not needed                                               | Not needed                                  | Public HTTPS API `/api/health` URL                 | Variable in `production-api`                                                                          |
| `WEB_HEALTH_URL`            | Deployment workflow          | Not needed                                               | Not needed                                  | Public HTTPS web root URL                          | Variable in `production-web`                                                                          |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `WEB_APP_ORIGIN` are Worker variables, configured
separately for the Cloudflare `preview` and `production` environments. Set
`SUPABASE_SERVICE_ROLE_KEY` with `wrangler secret put` or the Cloudflare dashboard as an
environment-specific secret; never add it to Wrangler `[vars]`. The service-role key is only for
the narrowly scoped account deletion path and is not required for normal user-scoped API access.

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_APP_ORIGIN`, `API_HEALTH_URL`, and
`WEB_HEALTH_URL` are GitHub environment variables for the frontend build and health checks. The
anon key is intended to be public; the API token and service-role key are secrets and must not be
Actions variables.

## Local development

Copy `.env.example` to the ignored repository-root `.env`. Vite reads the root file because
`apps/web/vite.config.ts` sets `envDir` to the repository root; the API dev script also loads it
for Wrangler. Configure matching project values for `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. Local defaults are:

- Web: `http://127.0.0.1:4175`
- API: `http://127.0.0.1:8787`
- Local Supabase database: port `54322` (`supabase status` reports local credentials)

For a local Supabase stack, run `supabase start` and use the local URL and public anon key it
reports. `DATABASE_URL` is only needed for database tooling and must point to a local or disposable
database, never a shared/prod database for tests.

## Tests and hosted environments

Use stubbed auth for unit/API tests. Database and concurrency tests must use an isolated,
loopback-only database; the CI concurrency tests obtain their connection from the local Supabase
stack. Never pass a production database connection string to CI.

Configure Supabase Auth **Site URL** to the exact app origin in each hosted project. Allow only the
matching confirmation and recovery paths, for example:

- `https://<preview-host>/auth/confirm`
- `https://<preview-host>/reset-password`
- `https://<production-host>/auth/confirm`
- `https://<production-host>/reset-password`

Keep preview and production redirect allowlists separate. `WEB_APP_ORIGIN` must be the exact
origin including `https://`, with no path or trailing slash. The API CORS middleware allows this
origin in production and rejects other origins.

API database access must retain the caller's verified Supabase JWT with the project's anon key.
Do not pass client-supplied user IDs as ownership context. Do not use the service-role key for
ordinary CRUD or any request that should be protected by RLS.
