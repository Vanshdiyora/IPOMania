# IPO Mania

IPO Mania is a TypeScript monorepo for a future IPO research application. Phase 1 established the
development and CI foundation. Phase 2 adds Supabase email/password authentication, protected API
routes, profile/preferences tables, and PostgreSQL RLS. IPO business workflows and market data are
not implemented.

## Requirements

- Node.js 22.12 or newer and npm 10 or newer
- (Database and RLS tests) Supabase CLI and Docker
- (Optional, database connectivity check) A reachable PostgreSQL connection string

## Get started

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev:web
```

In another terminal, run the Cloudflare Worker API:

```powershell
npm run dev:api
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` from
`supabase status` for local authentication. Keep the service-role key only in
`workers/api/.dev.vars`; it is used only for account deletion. See
[authentication setup](./docs/backend/AUTHENTICATION.md). The web app is served at
`http://127.0.0.1:4175`. The API listens at `http://127.0.0.1:8787`; check `GET /api/health`.

## Useful commands

| Command                       | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `npm run dev:web`             | Start the Vite frontend                                      |
| `npm run dev:api`             | Start the Wrangler Worker                                    |
| `npm run typecheck`           | Type-check all TypeScript projects                           |
| `npm run lint`                | Lint TypeScript and TSX source                               |
| `npm run format:check`        | Verify Prettier formatting                                   |
| `npm test`                    | Run unit and configured integration tests                    |
| `npm run test:e2e`            | Run the Playwright browser test                              |
| `npm run test:security:db`    | Run direct PostgreSQL RLS tests (requires Supabase + Docker) |
| `npm run build:web`           | Create the production frontend build                         |
| `npm run build:api`           | Bundle the Worker with Wrangler                              |
| `npm run build`               | Type-check and build both applications                       |
| `npm run db:check`            | Verify PostgreSQL connectivity with `SELECT 1`               |
| `npm run db:migrations:check` | Check Drizzle migration consistency                          |
| `npm run db:generate`         | Generate Supabase TypeScript types from the local project    |
| `npm run audit`               | Audit installed dependencies for high/critical advisories    |

Database checks need explicit credentials and do not run as part of the default test suite. See
[environment variables](./docs/deployment/ENVIRONMENT_VARIABLES.md) and
[architecture documentation](./docs/architecture/SYSTEM_ARCHITECTURE.md).

## Repository map

- `apps/web/` — React, Vite, Tailwind, and accessible application shell
- `workers/api/` — Hono API deployed to Cloudflare Workers
- `packages/` — shared API types, validation exports, and financial-engine package boundary
- `supabase/` — local Supabase CLI configuration, seed entry point, and SQL migrations
- `tests/` — unit, integration, security, and end-to-end test locations
- `docs/` — architecture, frontend, and deployment documentation

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md) before making changes.
Security tests and remaining deployment checks are documented in
[SECURITY_TESTING.md](./docs/testing/SECURITY_TESTING.md). Passing local checks is not a security
certification; review production configuration and residual risks before launch.
