# Phase tasks

## Phase 1 — Project foundation and DevOps

- [x] Inspect the repository and preserve existing working code.
- [x] Create npm workspace and strict TypeScript foundations.
- [x] Add React/Vite frontend shell, shared layout, routing, and fixed light theme.
- [x] Add Hono/Cloudflare Worker API health and structured error handling.
- [x] Configure Supabase, Drizzle, migration layout, and database connectivity check.
- [x] Establish shared types, validation, and financial-engine packages.
- [x] Configure unit, integration, security, and Playwright E2E test locations.
- [x] Add GitHub Actions CI and required documentation.
- [x] Execute and record Phase 1 verification checks.
- [x] Confirm GitHub Actions configuration is present and valid for the repository.

## Phase 2 — Authentication and multi-user security

- [x] Add Supabase Auth client configuration and email/password UI flows.
- [x] Add protected frontend routing, session loading/expiration states, and profile page.
- [x] Add Hono bearer authentication using Supabase Auth user verification.
- [x] Add profiles/preferences migration, ownership foreign keys, and RLS policies.
- [x] Add caller-JWT/anon-key user-scoped database adapter and isolated account deletion.
- [x] Add API auth regression tests and direct two-user PostgreSQL RLS tests.
- [x] Add requested backend, security, database, and testing documentation.
- [x] Verify local Supabase Auth registration, email confirmation, login/logout, recovery/reset,
      session persistence, profile RLS access, and account deletion using Mailpit.
- [x] Run direct two-user PostgreSQL RLS tests against local Supabase (19/19 pgTAP tests passed).
- [x] Exercise the local Worker API with two users, valid/invalid/expired tokens, forged user IDs,
      profile updates, and authenticated account deletion.
- [x] Run `npm run db:check` against the configured database URL; read-only `SELECT 1` passed.
- [ ] Verify hosted-project email delivery, redirect allowlists, and production Auth configuration.
- [x] Triage the npm audit findings, remediate high/critical advisories, and pass the CI dependency
      audit (upgraded Zod 4, Hono 4.13, Wrangler 4, React Router 7, Vite 7, Vitest 4, Node.js 22.12+).
- [x] Run all required local quality/build checks, browser tests, and the dependency audit.
- [ ] Remove generated Supabase CLI logs and `.temp/start-secrets` from unpushed Git history and
      rotate local keys before publishing the branch.
- [ ] Verify a new GitHub Actions run, including the database-security job, on the current branch.
- [x] Record remaining production risks; do not open the Phase 3 gate until hosted configuration
      and GitHub CI have also passed.

## Phase 3 — Demat account management

- [x] Read the existing architecture, auth, UI, database, and security documentation.
- [x] Add the owned demat account schema, constraints, search indexes, updated-at behavior, and
      forced RLS policies.
- [x] Enforce a 500 unarchived-active-account limit with per-user transaction serialization in
      PostgreSQL and map capacity/duplicate conflicts in the API.
- [x] Add authenticated account CRUD, archive/restore, archived-only deletion, filtering, and
      server-side pagination.
- [x] Add owned import history and row staging, CSV/XLSX parsing, mapping, validation, duplicate
      reports, confirmation retry safety, and safe archive-based reversal.
- [x] Add responsive dashboard, account list/details/forms, bulk import, and import-history pages.
- [x] Add unit/API/import tests and direct pgTAP lifecycle, isolation, limit, and retry tests.
- [x] Add an opt-in two-connection capacity race test that uses a disposable loopback database.
- [x] Add the requested account product, API, schema, and import documentation.
- [ ] Run the local Supabase migration and all database/RLS tests (requires Supabase CLI + Docker).
- [ ] Run the two-connection capacity test with `DEMAT_TEST_DATABASE_URL` against a disposable
      loopback database.
- [x] Run `npm run lint`, `npm run typecheck`, `npm test` (26 passed, 1 skipped),
      `npm run build:web`, and `npm run build:api` using a temporary Node.js 22 runtime.
- [x] Check Prettier formatting for all changed/new supported source and documentation files.
- [ ] Pass repository-wide `npm run format:check`; it currently reports 32 pre-existing
      unformatted files.
- [x] Run and record responsive account-page browser tests (desktop and mobile; 2/2 passed).

The Phase 2 hosted-Auth, deployment, GitHub Actions, and secret-history follow-ups remain open.
Do not publish this branch until those existing gates are resolved. The Phase 3 local database,
concurrency, and formatting verification items remain open. The user explicitly authorized Phase 4
implementation despite those Phase 3 gates; that authorization does not mark them passed.
The earlier full Phase 3 database suite reported an invalid `throws_ok` invocation, a restore-boundary
expectation mismatch, and import fixture/grant issues; these remain outside the Phase 4 changes.

## Phase 4 — IPO manager and quota engine

- [x] Read product, database, and architecture documentation before implementation.
- [x] Choose and document user-owned IPO records until an approved shared-catalog editor exists.
- [x] Add IPO CRUD, search/filter, manual provenance, status, archive, and database ownership/RLS.
- [x] Add append-only issue-specific rules for RETAIL, SHNI, BHNI, and SHAREHOLDER without category
      defaults or hard-coded limits.
- [x] Add the decimal.js calculation engine, validations, explicit eligibility conditions, and
      reproducible calculation snapshots.
- [x] Add protected IPO, category, and quota API routes with caller-JWT database access.
- [x] Add IPO list/details/form, category configuration, calendar, and quota calculator pages.
- [x] Add product, API, database, engine, architecture, and security documentation.
- [x] Run IPO-specific pgTAP ownership and RLS tests (23/23 passed locally).
- [x] Run all Phase 4 unit/API tests (52 passed, 1 skipped), IPO E2E tests (2/2), and required
      repository checks; lint, typecheck, unit/security tests, and both builds passed.
- [x] Record known failures from the pre-existing Phase 3 full database suite; do not treat them as
      IPO test failures or claim the Phase 3 gate has passed.
- [x] Verify critical financial tests pass before considering application workflows; no application
      submission/allotment workflow was added.
- [x] Run Prettier on changed/new supported files; repository-wide `npm run format:check` still
      reports 43 unformatted files outside this change.

## Phase 5 — Application manager and bulk import

- [x] Verify the critical financial-engine tests pass before adding application calculations
      (17/17 focused financial-engine tests passed at Phase 5 start).
- [x] Add an owner-scoped application schema, ownership foreign keys, forced RLS, independent
      application/mandate/allotment statuses, soft archive, immutable historical snapshots, and
      stable external-reference uniqueness.
- [x] Add authenticated create/read/edit/archive, filters, pagination, export, bulk validation and
      creation, and bulk status update APIs using caller-JWT access.
- [x] Add CSV/XLSX column mapping, owned IPO/account/category matching, price/lots validation,
      duplicate reports, staged preview, retry-safe confirmation, history, and reversal.
- [x] Add application dashboard/table/details/add pages, per-account bulk entry, and import,
      preview, report, and history pages.
- [x] Add product/backend import and application documentation.
- [x] Add focused validation/API tests (15 passed, including all four quota categories).
- [x] Run `supabase/tests/applications.test.sql` against local Supabase/PostgreSQL (16/16 passed),
      covering two-user RLS, snapshot preservation, idempotent retry, external-reference uniqueness,
      and reversal.
- [x] Add CSV/XLSX, 500-row CSV, duplicate-warning, and formula-safe export coverage; execute the
      two-transaction external-reference race test against local Supabase (1/1 passed).
- [ ] Complete browser/E2E coverage.
- [x] Run full tests (67 passed, 2 skipped), lint, typecheck, and both production builds. The
      required repository-wide format check still fails on pre-existing unformatted files; Phase 3
      local database/RLS and concurrency gates remain open.
