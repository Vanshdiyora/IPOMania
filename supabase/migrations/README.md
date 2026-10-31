# Database migrations

Application PostgreSQL migrations are stored here and applied by the Supabase CLI. Supabase Auth
owns the `auth` schema; application tables may reference `auth.users` but must not modify that
schema. See [RLS policies](../../docs/database/RLS_POLICIES.md) for user-owned table requirements.

Run `supabase test db` against the local Supabase stack to execute the database policy tests in
`supabase/tests/`.
