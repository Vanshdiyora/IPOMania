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

**Status: Implementation in progress; not accepted as complete.**

Supabase Auth flows, protected Worker routes, profile/preferences schema and RLS policies,
two-user SQL tests, and security documentation have been added. Direct local RLS tests now pass.
This environment has Docker and the Supabase CLI (run through `npx supabase`) but no Supabase
URL/keys or database URL. Consequently, registration/email verification/password recovery against
a real Auth project, hosted integration checks, and GitHub Actions status have not been verified
here. Do not proceed to Phase 3 until all completion criteria in `TASKS.md` are independently
verified and recorded.

The API auth tests use a stubbed Supabase Auth response and do not prove signature verification;
the Worker delegates JWT verification to the Supabase Auth service. Production email delivery,
redirect allowlists, rate limits, HTTPS origins, and browser XSS protections remain deployment
configuration requirements.

### Phase 2 verification in this workspace

- Passed: `npm run lint`, `npm run typecheck`, `npm test` (8 tests), `npm run build:web`,
  `npm run build:api`, and `npm run test:e2e -- --project=chromium` (3 tests).
- Passed: `npm run format:check`, `npm audit --audit-level=high`, and a dry-run `npm ci` against the
  updated lockfile. The Worker build was re-verified with Node.js 22 (Wrangler 4 requires it).
- Passed: `npm run test:security:db` against local Supabase (pgTAP `rls_isolation.test.sql`, 19/19
  tests). The suite failed before this run because a data-modifying CTE was nested inside a scalar
  subquery; the assertions now hoist each `WITH` to the statement's top level.
- GitHub Actions has not run for these local, uncommitted changes.

`npm audit --audit-level=high` now passes with no high or critical advisories (it previously
reported 39 advisories, including 14 high and 2 critical). Remediation upgraded Zod to 4.6.7,
Hono to 4.13, `@hono/zod-validator` to 0.9, Wrangler to 4.156, React Router to 7, Vite to 7,
Vitest to 4, and moved the toolchain to Node.js 22.12+, which Wrangler 4 requires. The 22
remaining advisories are moderate or low and affect development tooling only.
