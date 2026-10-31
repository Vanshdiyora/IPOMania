# Environment variables

Copy `.env.example` for local reference, and keep real `.env*` files and `.dev.vars` out of version
control. Do not place production secrets in Vite variables: names prefixed with `VITE_` are exposed
to browser code.

| Variable            | Consumer                       | Required             | Notes                                                             |
| ------------------- | ------------------------------ | -------------------- | ----------------------------------------------------------------- |
| `RUNTIME_ENV`       | Worker                         | No                   | `development`, `test`, or `production`; defaults to `development` |
| `VITE_API_BASE_URL` | Web                            | No                   | Optional base URL for future browser API calls                    |
| `SUPABASE_URL`      | Worker/database tooling        | No in Phase 1        | Supabase project URL; validate before use                         |
| `SUPABASE_ANON_KEY` | Worker/database tooling        | No in Phase 1        | Public project anon key; never use a service-role key here        |
| `DATABASE_URL`      | Drizzle and `npm run db:check` | Only for DB commands | PostgreSQL connection string; keep private                        |

## Local database

Install the Supabase CLI, then use `supabase start` to launch the local project. The local
PostgreSQL port is 54322 as configured in `supabase/config.toml`. Set `DATABASE_URL` to the CLI
reported database URL and run `npm run db:check`. Use the CLI's local status output for the anon
key and API URL. Never check local credentials into source control.

## Future JWT/RLS operations

API database access must pass the caller's verified bearer token as Supabase authorization context
and use the anon project key. Keep all service-role credentials out of browser configuration and
out of user-scoped requests.
