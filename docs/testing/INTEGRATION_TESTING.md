# Integration testing

## PostgreSQL and RLS

Install Docker and the Supabase CLI, start the local stack, and run:

```powershell
supabase start
npm run test:security:db
```

The database test suite applies the local migrations and runs pgTAP files under
`supabase/tests/`. Current files cover auth/profile RLS, demat-account limits and ownership,
IPO/category ownership, application records/imports, and capital/allotment/refund ledger
invariants. Two-user SQL tests are the required evidence for data isolation; API mocks do not
substitute for them. Tests insert synthetic Auth users and roll back transactional fixtures where
supported.

## Opt-in concurrency tests

The account-capacity and application external-reference race tests require a disposable PostgreSQL
database on loopback:

```powershell
$env:DEMAT_TEST_DATABASE_URL = "postgres://postgres:password@127.0.0.1:54322/postgres"
npm run test:integration:accounts
npm run test:integration:applications
Remove-Item Env:DEMAT_TEST_DATABASE_URL
```

The shared URL helper rejects malformed values and non-loopback hosts before opening a connection.
Do not point these tests at a hosted Supabase project or a database containing user data.

## Mocked API integration

Vitest API tests call the Hono Worker in-process and mock Supabase Auth/PostgREST with synthetic
responses. `tests/helpers/supabase.ts` centralizes this stub. These tests cover request validation,
verified caller scoping, import parsing, and error mapping; they do not prove actual RLS or JWT
signature validation.

## Phase dependencies

Phase 5, Phase 6, and Phase 7 database tests are present on this branch and should be run with the
local Supabase stack. `supabase/tests/dashboard_analytics.test.sql` covers caller isolation, date
boundaries, exact numeric aggregation, empty data, and a 5,000-application functional aggregate.
That fixture is not a timing benchmark. Do not copy or edit Phase 5/6/7 migrations from this
testing branch.
