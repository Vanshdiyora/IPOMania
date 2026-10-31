# Testing strategy

Phase 8 prepares shared test infrastructure and independently tests features available on the
current branch. It does not certify production readiness. Phase 7 is now integrated in this branch;
its analytics tests are in scope, but no production-scale dashboard performance measurement is
claimed.
The new axe scans identified accessible-name mismatches in icon-only sidebar links and the brand;
the shared layout now preserves screen-reader names without overriding visible link text.

## Test layers

| Layer                       | Tooling                                            | Purpose                                                                              |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit and API contract       | Vitest                                             | Decimal engine, schemas, API routes with mocked Supabase/Auth, security contracts    |
| Component and accessibility | React Testing Library, user-event, axe-core, jsdom | User-visible behavior, keyboard interaction, WCAG rule scan, XSS-safe text rendering |
| PostgreSQL / RLS            | Supabase CLI and pgTAP                             | Actual constraints, triggers, grants, forced RLS, and two-user isolation             |
| Opt-in concurrency          | Vitest and `postgres`                              | Parallel database writes against an explicitly configured loopback database          |
| Browser                     | Playwright and axe-core                            | Responsive browser behavior, navigation, and automated accessibility scanning        |
| Build and static quality    | TypeScript, ESLint, Prettier, npm audit            | Type and style checks, production builds, dependency advisories                      |

`npm test` runs deterministic unit, API, security, integration (when explicitly enabled), and UI
tests. `npm run test:e2e` launches the web app with test-only Supabase settings and no remote API
base URL. `npm run test:security:db` delegates to the local Supabase CLI and never targets a linked
or hosted project.

## Safety and evidence

- Never load `.env` or use production records/credentials for tests. Browser tests use synthetic
  configuration. Database tests use rolled-back pgTAP fixtures or unique synthetic users.
- `DEMAT_TEST_DATABASE_URL` is opt-in. The integration helper rejects malformed and non-loopback
  hosts; still use a disposable local database.
- Mocked Auth/PostgREST tests prove request construction and API behavior, not PostgreSQL RLS or
  JWT signature cryptography. Identify mocks in each report.
- A skipped opt-in test is not a pass. A documented test plan is not a measurement.
- Phase 5/6/7 business logic is out of Phase 8 scope. The final cross-phase audit must run after all
  changes are integrated.

## Current verification baseline

See [`TEST_COVERAGE.md`](./TEST_COVERAGE.md) for the phase-aware evidence matrix and the exact
results recorded for this branch.
