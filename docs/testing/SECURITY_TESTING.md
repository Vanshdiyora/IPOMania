# Security testing

For the security coverage inventory and its limitations, see
[`TEST_COVERAGE.md`](./TEST_COVERAGE.md). Passing a mocked test does not prove an external
cryptographic, database, or deployment control.

## Mocked API and component tests

```powershell
npm test -- --run tests/security
npm run test:ui
```

`tests/security/api-auth.test.ts` mocks the Supabase Auth response. It checks missing, invalid, and
expired bearer-token behavior, authenticated route guards, forged owner IDs, and safe error/output
contracts. It does **not** implement Supabase JWT signature verification. Supabase Auth verifies
the bearer token in production.

`tests/security/rls-context.test.ts` stubs PostgREST and asserts the caller JWT is used with the
anon key, never the service-role key. SQL-like search syntax is tested as a literal encoded
PostgREST filter, and the React UI test checks untrusted text is rendered as text rather than markup.
These are request/rendering contract checks, not a penetration test against a live database/browser.

## Direct database RLS tests

Install Docker and the Supabase CLI, then run against the local stack:

```powershell
supabase start
npm run test:security:db
```

The pgTAP suites in `supabase/tests/` cover profile/preferences, demat accounts, IPO/category rules,
applications/imports, and capital/allotment/refund records. Two-user queries run as the
`authenticated` database role with separate JWT subject claims. These tests prove local PostgreSQL
policy behavior only; they do not prove hosted-project configuration.

## Concurrency test safety

Concurrency tests are opt-in and use an explicit disposable loopback database:

```powershell
$env:DEMAT_TEST_DATABASE_URL = "postgres://postgres:password@127.0.0.1:54322/postgres"
npm run test:integration:accounts
npm run test:integration:applications
Remove-Item Env:DEMAT_TEST_DATABASE_URL
```

The shared test helper rejects malformed and non-loopback connection URLs. Never point these
fixtures at production or shared user data.

## Limits

The tests do not certify every endpoint, hosted Auth/email configuration, production secrets,
deployed Workers, rate limiting, penetration resistance, or screen-reader support. Report only
checks actually run in the current branch and environment.
