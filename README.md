# IPO Mania

IPO Mania is a TypeScript monorepo for an IPO research application. It includes the development
foundation, Supabase authentication and multi-user security, user-owned demat account management,
user-specific IPO records with an issue-configured decimal quota calculator, and manual
application, UPI mandate, allotment, refund, and capital tracking. It does not submit IPO
applications, initiate payments, approve mandates automatically, or fetch market data.

## Requirements

- Node.js 22.12 or newer and npm 10 or newer
- (Database and RLS tests) Supabase CLI and Docker
- (Concurrent capacity integration test) A disposable loopback-only Supabase PostgreSQL database
- (Optional, database connectivity check) A reachable PostgreSQL connection string

## Get started

```powershell
npm ci
Copy-Item .env.example .env
npm run dev:web
```

In another terminal, run the Cloudflare Worker API:

```powershell
npm run dev:api
```

Fill the root `.env` with the Supabase project values for `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. The Vite frontend reads only
variables prefixed with `VITE_`; Wrangler loads the same file for the local API. Keep the service-role
key out of all `VITE_` variables; it is used only by the API for account deletion. See
[authentication setup](./docs/backend/AUTHENTICATION.md). The web app is served at
`http://127.0.0.1:4175`. The API listens at `http://127.0.0.1:8787`; check `GET /api/health`.
For hosted Supabase, use that project's URL and anon key. For local Supabase, use the values from
`supabase status` instead.

## Useful commands

| Command                             | Purpose                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| `npm run dev:web`                   | Start the Vite frontend                                        |
| `npm run dev:api`                   | Start the Wrangler Worker                                      |
| `npm run typecheck`                 | Type-check all TypeScript projects                             |
| `npm run lint`                      | Lint TypeScript and TSX source                                 |
| `npm run format:check`              | Verify Prettier formatting                                     |
| `npm test`                          | Run unit and configured integration tests                      |
| `npm run test:e2e`                  | Run the Playwright browser test                                |
| `npm run test:security:db`          | Run direct PostgreSQL RLS tests (requires Supabase + Docker)   |
| `npm run test:integration:accounts` | Test concurrent account creation in an isolated local database |
| `npm run build:web`                 | Create the production frontend build                           |
| `npm run build:api`                 | Bundle the Worker with Wrangler                                |
| `npm run build`                     | Type-check and build both applications                         |
| `npm run db:check`                  | Verify PostgreSQL connectivity with `SELECT 1`                 |
| `npm run db:migrations:check`       | Check Drizzle migration consistency                            |
| `npm run db:generate`               | Generate Supabase TypeScript types from the local project      |
| `npm run audit`                     | Audit installed dependencies for high/critical advisories      |

Database checks need explicit credentials and do not run as part of the default test suite. See
[environment variables](./docs/deployment/ENVIRONMENT_VARIABLES.md) and
[architecture documentation](./docs/architecture/SYSTEM_ARCHITECTURE.md).

## Repository map

- `apps/web/` — React, Vite, Tailwind, and accessible application shell
- `workers/api/` — Hono API deployed to Cloudflare Workers
- `packages/` — shared API types, Zod contracts, and isolated `decimal.js` financial engine
- `supabase/` — local Supabase CLI configuration, seed entry point, and SQL migrations
- `tests/` — unit, integration, security, and end-to-end test locations
- `docs/` — architecture, frontend, and deployment documentation

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md) before making changes.
The demat account behavior, API, schema, and import workflow are specified in
[DEMAT_ACCOUNT_SPECIFICATION.md](./docs/product/DEMAT_ACCOUNT_SPECIFICATION.md),
[ACCOUNT_API.md](./docs/backend/ACCOUNT_API.md),
[ACCOUNT_SCHEMA.md](./docs/database/ACCOUNT_SCHEMA.md), and
[ACCOUNT_IMPORT_SPECIFICATION.md](./docs/product/ACCOUNT_IMPORT_SPECIFICATION.md).
Security tests and remaining deployment checks are documented in
[SECURITY_TESTING.md](./docs/testing/SECURITY_TESTING.md). Passing local checks is not a security
certification; review production configuration and residual risks before launch.
IPO ownership, issue-specific configuration, calculation limits, and audit history are documented
in [IPO_MANAGER_SPECIFICATION.md](./docs/product/IPO_MANAGER_SPECIFICATION.md),
[IPO_QUOTA_RULES.md](./docs/product/IPO_QUOTA_RULES.md),
[FINANCIAL_CALCULATIONS.md](./docs/product/FINANCIAL_CALCULATIONS.md),
[IPO_API.md](./docs/backend/IPO_API.md), [QUOTA_ENGINE.md](./docs/backend/QUOTA_ENGINE.md),
[IPO_SCHEMA.md](./docs/database/IPO_SCHEMA.md), [MANDATE_MANAGEMENT.md](./docs/product/MANDATE_MANAGEMENT.md),
[ALLOTMENT_MANAGEMENT.md](./docs/product/ALLOTMENT_MANAGEMENT.md),
[CAPITAL_MANAGEMENT.md](./docs/product/CAPITAL_MANAGEMENT.md),
[CAPITAL_LEDGER.md](./docs/database/CAPITAL_LEDGER.md), and
[FINANCIAL_TESTING.md](./docs/testing/FINANCIAL_TESTING.md).
