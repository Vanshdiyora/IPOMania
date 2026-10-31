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

## Phase 7 — Dashboard and analytics

- [x] Review the existing Phase 1–6 implementation, architecture, database, backend, and product
      documentation before implementation.
- [x] Add an authenticated, validated analytics API backed by bounded PostgreSQL aggregation,
      caller-JWT access, explicit owner scoping, and existing forced RLS.
- [x] Add date, IPO, category, and demat-account filters; count-based IPO/category/account/broker
      groupings; monthly trends; allotment/refund metrics; recent activity; and upcoming IPO dates.
- [x] Add the responsive, fixed-light dashboard with accessible charts, loading/empty/error states,
      paginated filter options, and formula-safe CSV/XLSX exports.
- [x] Reuse the Phase 6 capital summary and decimal reconciliation engine. Keep application
      breakdowns count-only and capital event totals separate by currency and event type.
- [x] Add unit/API/export, responsive browser, and direct two-user PostgreSQL tests, including
      exact decimal aggregation and a 5,000-application database aggregation case.
- [x] Update the Phase 7 API, frontend, product, database/RLS, architecture, testing, changelog,
      project-status, and task documentation.
- [x] Apply the pending Phase 6 and Phase 7 migrations to the local database and run the Phase 7
      pgTAP test file (11/11 passed).
- [x] Run focused analytics tests (7/7), dashboard E2E tests (3/3), the full suite (93 passed,
      2 skipped), lint, typecheck, and both production builds.
- [ ] Run an isolated query-plan and production-scale latency benchmark; the 5,000-row pgTAP case
      is a functional large-set check, not a latency benchmark.
- [ ] Pass repository-wide `npm run format:check`; it currently reports 128 files, while targeted
      formatting checks pass for changed/new supported source and feature documentation.

Phase 7 does not include application submission/allotment workflows or changes to Phase 5/6
business logic. The Phase 3 database/RLS, concurrency, secret-history, hosted-configuration, and CI
gates remain open.

## Phase 8 — Parallel QA, security, and testing infrastructure

- [x] Read `AGENTS.md`, `PROJECT_STATUS.md`, and `TASKS.md`; create and work on the isolated
      `feature/phase-8` branch.
- [x] Fast-forward the Phase 8 branch to the latest shared main, including integrated Phase 7,
      without editing Phase 5/6/7 business logic or shared migrations.
- [x] Add React Testing Library, user-event, jsdom, axe-core, Vitest setup/coverage, and Playwright
      browser CI execution.
- [x] Add synthetic financial factories, reusable mocked Supabase API helpers, and explicit
      loopback-only database URL safeguards for opt-in integration tests.
- [x] Add or extend tests for keyboard/axe accessibility, React text escaping, auth boundaries,
      owner scoping, SQL-like filter values, file upload size/type, caller-JWT/anon-key forwarding,
      and decimal capital reconciliation through the existing financial engine.
- [x] Create/update the requested strategy, unit, integration, E2E, security, performance, and test
      coverage documentation.
- [x] Run full Vitest (111 passed, 2 skipped), local pgTAP (144/144), Playwright (13/13 including
      four WCAG-tagged axe scans), coverage, lint, typecheck, and both production builds.
- [x] Run targeted Prettier on touched supported source/docs; repository-wide format check remains
      blocked by 117 files of baseline formatting debt.
- [x] Run dependency audit: no high/critical findings; 20 moderate advisories remain in existing
      toolchain dependency trees.
- [ ] Resolve the existing dependency advisories without introducing a breaking toolchain change.
- [ ] Add workload benchmarks for 1,000/5,000 applications and dashboard queries; record only
      measurements actually obtained against an isolated test database.
- [ ] Run opt-in two-transaction account-capacity and application-reference concurrency tests
      against a disposable loopback database; both currently skip without `DEMAT_TEST_DATABASE_URL`.
- [ ] Complete the final integrated security and accessibility audit after all parallel changes
      are merged; do not certify production readiness in this preparation stage.

Phase 8 remains in preparation until the open checks and integrated audit are complete. The Phase 3
database/concurrency/format gates and hosted/CI gates remain open. Local Phase 6 capital pgTAP has
now passed as part of the full 144-assertion database run.

### Phase 8 final integrated audit gate

- [ ] Pass and record the final integrated audit; this remains a mandatory production-deployment
      gate and is not completed by Phase 9 preparation.

## Phase 9 — Parallel deployment preparation

- [x] Read repository guidance, architecture, existing deployment workflows, environment docs,
      Supabase configuration, and migration guidance.
- [x] Preserve the Workers Static Assets frontend and Hono API service-binding architecture with
      separate preview and production Worker environments.
- [x] Remove automatic production deployment from pushes to `main`.
- [x] Add secret-free pull-request CI, manual trusted preview deployment, and manually dispatched
      production deployment gated to `main`, Phase 8 confirmation, and a protected GitHub
      environment.
- [x] Add TypeScript CodeQL and dependency audit scanning; add local Supabase RLS and loopback-only
      integration concurrency test jobs.
- [x] Document environment variables and secret handling, CORS, domains/HTTPS, health checks,
      migration rollout, RLS/index validation, cost limits, backup/recovery, and incident response.
- [ ] Configure and verify GitHub preview/production environment protections and environment-scoped
      secrets/variables with authorized maintainers.
- [ ] Verify Cloudflare preview/production Worker bindings, environment variables, domains,
      certificates, and health endpoints without deploying production.
- [ ] Verify the actual Supabase plan, hosted Auth configuration, migration state, backup settings,
      and an isolated restore drill.
- [ ] Pass Phase 8's final integrated audit and obtain explicit production deployment approval
      before any production workflow dispatch.
- [ ] Run and record every repository-mandated format, lint, type, test, and build check. Do not
      claim the existing Phase 3 repository-wide formatting or database/RLS/concurrency gates pass
      unless independently verified.

Phase 9 is deployment preparation only. No production deployment, hosted migration, active
monitoring, or verified backup is claimed. No Phase 5–8 business logic or shared migration is in
scope.
