# Database migrations

Application PostgreSQL migrations are stored here and applied by the Supabase CLI. Supabase Auth
owns the `auth` schema; application tables may reference `auth.users` but must not modify that
schema. Current migrations cover profiles/preferences, demat accounts/import history, user-owned
IPO records, issue-specific category rules, quota snapshots, manual application records, mandates,
allotments, and the append-only capital ledger. See
[RLS policies](../../docs/database/RLS_POLICIES.md), [ACCOUNT_SCHEMA.md](../../docs/database/ACCOUNT_SCHEMA.md),
and [IPO_SCHEMA.md](../../docs/database/IPO_SCHEMA.md) for ownership, constraints, and retention.
See [CAPITAL_LEDGER.md](../../docs/database/CAPITAL_LEDGER.md) for financial record semantics.

Run `supabase test db` against the local Supabase stack to execute the database policy, account,
IPO, and capital tests in `supabase/tests/`. Run the additional two-connection capacity test only against a
disposable loopback database using `DEMAT_TEST_DATABASE_URL`.
