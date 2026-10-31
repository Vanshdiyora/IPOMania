# System architecture

## Phase 1 scope

The repository is a TypeScript npm-workspaces monorepo. The browser application is a React SPA
served and built by Vite. Its future HTTP boundary is a Hono application running on Cloudflare
Workers. PostgreSQL is provided by Supabase; the initial repository contains CLI configuration,
Drizzle configuration, a seed entry point, and a `SELECT 1` connectivity check, but no business
schema.

```text
Browser
  └── React / Vite application
        └── future HTTP calls ──> Hono / Cloudflare Worker
                                   └── Supabase/PostgreSQL (future RLS operations)

Shared packages: API types | validation exports | financial engine boundary
```

## Boundaries and responsibilities

- `apps/web` owns presentation, navigation, browser state, and accessible components.
- `workers/api` owns HTTP routing, request/response behavior, environment parsing, and future
  database adapters.
- `packages/shared` contains transport-neutral shared TypeScript contracts.
- `packages/validation` exposes the common Zod validation library to packages.
- `packages/financial-engine` is an isolated future computation package; Phase 1 has no financial
  calculations.
- `supabase` owns local Supabase project configuration and database migration files.

Dependencies point inward to shared contracts and validation. Shared packages must not import
from apps or workers, preventing circular dependencies.

## API and errors

`GET /api/health` returns a typed status payload with the API version and validated runtime
environment. The API does not expose credentials. Unmatched routes return a structured 404. The
global error handler logs server-side context and returns a generic structured 500 response.

## Database and RLS plan

Future database operations should use Supabase's anon project key with the caller's verified
Supabase JWT forwarded as the request authorization context. This retains PostgreSQL RLS behavior.
No service-role access or authentication flow is implemented in Phase 1. See
[DATA_FLOW.md](./DATA_FLOW.md) and [environment variables](../deployment/ENVIRONMENT_VARIABLES.md).
