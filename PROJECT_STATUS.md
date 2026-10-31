# Project status

## Phase 1 — Project foundation and DevOps

**Status: Complete.**

The Phase 1 foundation contains npm workspaces for the web app, Worker API, and shared packages;
the frontend shell and fixed light design tokens; a Hono health endpoint; Supabase and Drizzle
configuration; test scaffolding; and CI configuration. Authentication, profile, and preference
features were intentionally outside Phase 1 and are implemented as Phase 2 work below.

## Execution summary

The following checks were run successfully during Phase 1:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build:web`
- `npm run build:api`
- `curl http://127.0.0.1:8787/api/health`
- `npx playwright test tests/e2e/foundation.spec.ts --project=chromium`

The frontend app served successfully from `http://127.0.0.1:4175` during the browser smoke test.
The API responded with a structured health payload:
`{"data":{"status":"ok","version":"1.0.0","environment":"development"}}`

The database connectivity utility is configured in `scripts/check-db.ts` and requires an explicit
`DATABASE_URL` value for local or Supabase PostgreSQL connectivity tests.

## Phase 2 — Authentication and multi-user security

**Status: Implemented and locally verified; hosted-project and GitHub CI gates remain open.**

Supabase Auth flows, protected Worker routes, profile/preferences schema and RLS policies,
two-user SQL tests, and security documentation have been added. Direct local RLS tests now pass.
Local Supabase Auth and Mailpit were used to exercise registration, email verification, password
login, password recovery/reset, session persistence, logout, profile access under RLS, and account
deletion. The local Worker API was exercised with two independent users, including signed expired
JWT rejection and account deletion through the authenticated route. The configured database
connection also passed a read-only `SELECT 1` connectivity check. No users, migrations, or other
data were created or changed in the hosted Supabase project.

The API auth tests use a stubbed Supabase Auth response and do not prove signature verification;
the separate local Worker integration check confirmed missing, invalid, and expired JWT rejection
through Supabase Auth. Production email delivery, redirect allowlists, rate limits, HTTPS origins,
secret management, and browser XSS protections remain deployment configuration requirements.

### Phase 2 verification in this workspace

- Passed: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (8 tests),
  `npm run build:web`, and `npm run build:api`.
- Passed: `npm run test:e2e` (3 browser tests), after installing the matching Playwright Chromium.
- Passed: `npx supabase test db` against local PostgreSQL (pgTAP `rls_isolation.test.sql`, 19/19
  assertions). It verified both users' read/update/delete isolation under actual database RLS.
- Passed: `npm run db:check` with the configured database URL; the script completed a read-only
  `SELECT 1`.
- Passed: Local Supabase Auth + Mailpit registration, email confirmation, password login,
  recovery/reset, password change, session restore, logout, profile read, and account deletion.
- Passed: Local Worker API checks for missing, invalid, and correctly signed expired tokens; two
  users' profile reads/updates; forged `user_id` rejection; and authenticated account deletion.
- Passed: `npm run audit` at the configured high-severity threshold. It reports 20 moderate
  development-tooling advisories (primarily esbuild/tsx and minimatch); none are high or critical.
- GitHub Actions has not yet verified the current branch state. The earlier RLS workflow failure
  was caused by the SQL CTE form corrected before the 19/19 local run; a new remote run is still
  required. The branch is three commits ahead of its remote. Do not push it yet: tracked Supabase
  CLI output and `.temp/start-secrets` include generated local key material and must be removed
  from the unpushed history before publication.

`npm audit --audit-level=high` now passes with no high or critical advisories (it previously
reported 39 advisories, including 14 high and 2 critical). Remediation upgraded Zod to 4.6.7,
Hono to 4.13, `@hono/zod-validator` to 0.9, Wrangler to 4.156, React Router to 7, Vite to 7,
Vitest to 4, and moved the toolchain to Node.js 22.12+, which Wrangler 4 requires.

The hosted email/redirect configuration, deployed Worker, current-branch GitHub Actions run, and
tracked local Supabase credentials still require the Phase 2 follow-up described above. No hosted
project was changed for Phase 3. Do not publish this branch until its existing secret-history and
production configuration follow-ups are resolved.

## Phase 3 — Demat account management

**Status: Implemented; local database/RLS/concurrency verification remains open.**

The implementation adds user-owned `demat_accounts`, import history/staging tables, forced RLS,
caller-JWT API routes, a database-serialized 500-active-account cap, responsive account pages, and
CSV/XLSX import with row reports and retry-safe confirmation. The active limit counts only records
whose `account_status` is `active` and `archived_at` is null. Archived, inactive, and closed
accounts do not consume capacity.

Direct SQL coverage seeds 499 test accounts and exercises the 500th/501st account, owner
isolation, account lifecycle, duplicates, and import retry/reversal. A separate disposable
loopback-only PostgreSQL test is provided for truly simultaneous account creation; it creates 500
fixture accounts and cleans its fixture user up afterward. These database tests are not verified
until run against a local Supabase/PostgreSQL test environment. The integration test is opt-in via
`DEMAT_TEST_DATABASE_URL` and is skipped when that variable is unset.

The system Node.js is 20.20.2, below the repository's 22.12+ requirement. For local verification,
a temporary Node.js 22 runtime obtained through npm was used. `npm run lint`, `npm run typecheck`,
`npm test` (26 passed, 1 skipped), `npm run build:web`, and `npm run build:api` passed.
Both account browser tests passed at desktop and mobile viewport sizes. Prettier passed for every
changed/new supported source and documentation file; repository-wide `npm run format:check`
remains blocked by 32 pre-existing unformatted files. The web build reports a large JavaScript
chunk warning.

Production Supabase, hosted CI, and all database/integration checks remain separate verification
gates. The Phase 3 local RLS/concurrency and repository-wide formatting gates remain open; the user
explicitly authorized Phase 4 work to proceed despite those gates. This does not mark Phase 3 as
verified. The earlier full local database suite also exposed pre-existing demat-test failures: an
invalid `throws_ok` invocation, an incorrect restore-boundary expectation, and import fixture/grant
issues. These were not changed as part of Phase 4.

## Phase 4 — IPO manager and quota engine

**Status: Implementation complete; local functional verification passed. Repository-wide
formatting and the independent Phase 3 database gates remain open.**

The Phase 4 implementation adds user-owned IPO records, issue-specific append-only category rule
versions, exact-decimal financial calculations, authenticated API routes, and protected IPO list,
details, edit, category, calendar, and quota-calculator pages. IPO records are user-specific because
the application has no trusted shared-catalog editor. Manual records and user-provided eligibility
inputs are never represented as automatically verified. No IPO application or allotment workflow
has been added.

The quota engine is in `packages/financial-engine/` and uses `decimal.js`. It has no category
defaults; unknown lot or investment rules fail closed. Historical calculations retain issue price,
lot size, rule version, user inputs, result, and timestamp. The new two-user pgTAP suite passed 23/23 assertions locally. The local database had already
recorded the migration before its final composite category/IPO foreign-key strengthening; the
additional local constraint was applied without resetting data, and the focused pgTAP suite was
rerun successfully.

No official IPO-rule example was available in the repository. Tests use synthetic arithmetic
fixtures, explicitly not authoritative rules. Do not proceed to IPO application management until
the critical financial tests pass; the financial, API, validation, and database tests now pass, and
no application-submission or allotment workflow was added.

### Phase 4 verification in this workspace

- Passed: `npm run lint`, `npm run typecheck`, `npm test` (52 passed, 1 skipped),
  `npm run build:web`, and `npm run build:api`.
- Passed: IPO Playwright smoke tests (2/2) and local IPO pgTAP tests (23/23).
- Passed: Prettier check for changed/new supported source and documentation files.
  Repository-wide `npm run format:check` remains blocked by 43 files outside this change.
- The web build reports the existing large-chunk warning; both application builds completed.

## Phase 5 — Application manager and bulk import

**Status: Implemented; automated verification passes except for browser/E2E coverage.**

Phase 5 adds a user-owned application table with composite ownership foreign keys to the caller's
IPO, demat account, and issue-specific category rule; forced RLS; retained calculation snapshots;
independent application/mandate/allotment statuses; soft archive; paginated filtering/export;
individual and all-or-nothing bulk creation; bulk status changes; and CSV/XLSX staging, previews,
history, retry-safe confirmation, and archive-based reversal. Application calculations call the
existing exact-decimal quota engine. Imported rows default to draft; imported prices must be
explicitly mapped rather than inferred from current IPO pricing.

The application dashboard, application table/details/forms, per-account bulk validation, import
mapping/preview, and import-history/report pages are protected by authenticated routing. Import
row numbers are report references only. Stable external references are unique per user, while other
potential duplicates are surfaced as warnings and do not prohibit legitimate multiple applications.

Focused application unit/API validation passes (15 tests, including all four quota categories). The
direct application pgTAP suite passes 16/16 locally, including owner isolation, snapshot/status
preservation, import retry, external-reference uniqueness, and reversal. The full test suite passes
(67 passed, 2 skipped), and lint, typecheck, and both production builds pass. API tests cover
CSV/XLSX imports, a 500-row CSV,
duplicate warnings, and formula-safe export. The loopback-only two-transaction race test passes
(1/1) via `npm run test:integration:applications`; browser/E2E coverage remains outstanding. The
repository-wide format check still reports pre-existing unformatted files, and the broader Phase 3
local database/RLS and concurrency gates remain open.

## Phase 6 — Mandates, allotments, and capital management

**Status: Implementation complete; workspace tests and builds pass. Direct PostgreSQL/RLS
verification remains open.**

Phase 6 adds owner-scoped mandate state management, allotment and refund tracking, an append-only
capital ledger, per-currency decimal-safe summaries, API routes, and management pages. Application
records retain the issue lot size and price bounds used by the calculation so allotment checks do
not rely on later-edited IPO configuration. No application is submitted externally, no payment is
initiated, and mandates are never approved automatically.

Automated unit and API tests cover mandate validation, allotment and refund rules, blocked versus
debited capital, duplicate events, idempotency, and financial reconciliation. The migration also
contains direct two-user pgTAP coverage; that test was not run as part of Phase 6 verification.

### Phase 6 verification in this workspace

- Passed before merging Phase 5: `npm run lint`, `npm run typecheck`, `npm test` (69 passed, 1
  skipped), `npm run build:web`, and `npm run build:api`.
- Repository-wide `npm run format:check` remains blocked by unformatted files, including
  pre-existing formatting debt outside Phase 6. Targeted Prettier checks passed for changed source
  and feature documentation.
- Not run as Phase 6 verification: `supabase/tests/capital_management.test.sql`.
- The Phase 3 local RLS/concurrency and repository-wide formatting gates remain open.

## Phase 7 — Dashboard and analytics

**Status: Implementation complete; focused, browser, PostgreSQL, unit, lint, type, and build
checks pass. Repository-wide formatting and production-scale performance verification remain open.**

The authenticated home dashboard now reports caller-owned IPO applications, account and IPO
inventory, status/category/IPO/account/broker counts, trends, allotment/refund performance, recent
activity, and upcoming closing dates. PostgreSQL aggregates the data through a bounded,
invoker-rights RPC with explicit caller scoping and forced RLS. Capital-ledger totals remain
separate by currency and event type; blocked capital, actual debits, allotment debits, refunds, and
the canonical Phase 6 reconciled capital/P&L summaries are not combined or double-counted.
Application groupings are counts only to avoid summing monetary values across currencies.
Authenticated CSV and Excel exports use the active filters and escape formula-leading text.

Phase 7 depends on the existing Phase 5 application/IPO/account/category records and Phase 6
capital-ledger, refund, allotment, and capital-summary APIs. Phase 5 and Phase 6 business logic was
not changed. No table or index was added; Phase 7 adds one analytics migration/function.

### Phase 7 verification in this workspace

- Passed: focused analytics validation/API tests (7/7), dashboard Playwright tests (3/3), and
  direct local PostgreSQL/pgTAP analytics tests (11/11), including two-user isolation, date
  boundaries, exact `NUMERIC` capital aggregation, empty data, and 5,000 application rows.
- Passed: `npm run typecheck`, `npm run lint`, `npm test` (93 passed, 2 skipped),
  `npm run build:api`, and `npm run build:web`.
- Passed targeted Prettier checks for the changed/new feature source and feature documentation.
  `PROJECT_STATUS.md` and `TASKS.md` remain among the files flagged by the repository-wide check,
  which still fails on 128 files, primarily pre-existing files.
- The 5,000-row pgTAP test completed as part of a 3-second local test-file run, including fixture
  setup; this is not an isolated RPC latency or query-plan benchmark. The web build also reports
  a 1.3 MB minified JavaScript bundle warning.
- The Phase 3 local database/RLS, concurrency, secret-history, hosted configuration, and GitHub CI
  gates remain open and are not represented as passed.
