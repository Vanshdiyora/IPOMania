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

Do not proceed to Phase 3 until the current branch passes GitHub Actions and the production
Supabase email/redirect configuration and deployed Worker are separately verified. Purge and rotate
the tracked local Supabase credentials before pushing this branch.
