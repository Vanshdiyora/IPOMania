# System architecture

## Current scope

The repository is a TypeScript npm-workspaces monorepo. The browser application is a React SPA
served and built by Vite. Its future HTTP boundary is a Hono application running on Cloudflare
Workers. PostgreSQL is provided by Supabase; the initial repository contains CLI configuration,
Drizzle configuration, a seed entry point, and a `SELECT 1` connectivity check, but no business
schema.

```text
Browser
  └── React / Vite application
        ├── Supabase Auth (email/password; PKCE session)
        └── bearer-token HTTP calls ──> Hono / Cloudflare Worker
                                        └── Supabase/PostgreSQL (caller JWT + anon key + RLS)

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
environment. Protected profile routes verify the bearer token through Supabase Auth before
forwarding it as the PostgREST authorization context. Account deletion is the only service-role
operation and receives only the verified caller's user ID. Errors are structured; logs do not
include tokens or request bodies.

## Database and RLS plan

User-scoped database operations use Supabase's anon project key with the caller's verified JWT
forwarded as the request authorization context. This retains PostgreSQL RLS behavior. See
[DATA_FLOW.md](./DATA_FLOW.md) and [environment variables](../deployment/ENVIRONMENT_VARIABLES.md).
