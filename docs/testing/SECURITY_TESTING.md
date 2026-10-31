# Security testing

## API tests

`tests/security/api-auth.test.ts` stubs the Auth HTTP endpoint and verifies protected-route handling
for missing, invalid, and expired bearer tokens, as well as ignored/invalid client-supplied user
IDs. These tests validate middleware and route behavior only. The local API integration checks also
sent missing and invalid tokens and a correctly signed expired token through the running Worker and
local Supabase Auth service.

Run with `npm test`.

## Direct database RLS tests

Install Docker and the Supabase CLI, then run:

```powershell
supabase start
npm run test:security:db
```

`supabase/tests/rls_isolation.test.sql` creates two independent Auth users and runs profile and
preference operations as the `authenticated` PostgreSQL role with each user's subject claim. This
tests the actual policies, not just frontend restrictions. The test rolls back its fixture data.
The suite passed locally with 19/19 pgTAP assertions.

`supabase/tests/demat_accounts.test.sql` seeds 499 isolated accounts in a rolled-back pgTAP
transaction and verifies the 500th/501st boundary, archive/restore/delete rules, owner isolation,
duplicate and invalid-value constraints, import confirmation retry, and reversal.
`tests/integration/demat-account-capacity.test.ts` uses two independent PostgreSQL transactions to
race for the 500th slot. It requires `DEMAT_TEST_DATABASE_URL` and refuses non-loopback hosts:

```powershell
$env:DEMAT_TEST_DATABASE_URL = "<disposable loopback-only PostgreSQL URL>"
npm run test:integration:accounts
```

The integration test creates a fixture user and 499 accounts before racing two inserts, asserts
exactly one succeeds and the final count is 500, then deletes the fixture through the Auth foreign
key cascade. Use a disposable local database only.

## Account API and import tests

`tests/unit/account-validation.test.ts`, `tests/security/accounts-api.test.ts`, and
`tests/security/accounts-import.test.ts` cover field validation, forged owner rejection, API
ownership filters, search/pagination, CSV/XLSX parsing, duplicates, invalid rows, and unsupported
content types. Mocked API tests do not replace the direct PostgreSQL RLS and capacity checks.

## Local Auth and API integration

The local Supabase Auth + Mailpit flow was exercised for registration, email confirmation,
password login, password recovery/reset, password change, session restore, logout, profile access,
and Auth account deletion. The local Worker was exercised with two users for profile read/update,
forged `user_id` rejection, token rejection, and account deletion. These checks do not modify the
hosted Supabase project.

## Full verification and limits

Before proposing a change, run the repository's format check, lint, type-check, unit/integration
tests, web build, and Worker build. Run the direct RLS suite as well when database policies change.
Record exact results. The local RLS test does not verify a hosted project's auth configuration,
email delivery, production keys, deployed Worker, or CI status.
