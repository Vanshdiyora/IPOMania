# Environment variables

Copy `.env.example` to the repository-root `.env` for local development, and keep real `.env*` files
and `.dev.vars` out of version control. Vite reads that root file but exposes only variables prefixed
with `VITE_` to browser code. Never put secrets in `VITE_` variables.

| Variable                    | Consumer                       | Required               | Notes                                                             |
| --------------------------- | ------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| `RUNTIME_ENV`               | Worker                         | No                     | `development`, `test`, or `production`; defaults to `development` |
| `VITE_API_BASE_URL`         | Web                            | No                     | Worker API base URL                                               |
| `VITE_SUPABASE_URL`         | Web                            | Yes for authentication | Public project base URL; do not append `/rest/v1` or `/auth/v1`   |
| `VITE_SUPABASE_ANON_KEY`    | Web                            | Yes for authentication | Public anon key, intended for browser use                         |
| `SUPABASE_URL`              | Worker/database tooling        | Yes for authentication | Project base URL; do not append `/rest/v1` or `/auth/v1`          |
| `SUPABASE_ANON_KEY`         | Worker/database tooling        | Yes for authentication | Public key for user-scoped operations                             |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker                         | Account deletion only  | Secret binding isolated to verified account deletion              |
| `WEB_APP_ORIGIN`            | Worker                         | Production             | Exact web origin permitted by API CORS                            |
| `DATABASE_URL`              | Drizzle and `npm run db:check` | Only for DB commands   | PostgreSQL connection string; keep private                        |

## Local database

For local development, Vite reads the root `.env`, and `npm run dev:api` passes it to Wrangler.
Use either hosted Supabase project values or local values from `supabase status`. The service-role
key is available only to the API Worker and must never be given a `VITE_` name. For database checks,
install the Supabase CLI and run `supabase start`; the local PostgreSQL port is 54322 as configured
in `supabase/config.toml`. Set `DATABASE_URL` to the CLI-reported database URL and run
`npm run db:check`. Never check local credentials into source control.

## JWT/RLS operations

API database access must pass the caller's verified bearer token as Supabase authorization context
and use the anon project key. Keep all service-role credentials out of browser configuration and
out of user-scoped requests. The service-role key is restricted to account deletion using the
verified caller ID.
