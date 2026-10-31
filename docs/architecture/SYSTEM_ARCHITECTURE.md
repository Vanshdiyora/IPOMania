# System architecture

## Current scope

The repository is a TypeScript npm-workspaces monorepo. The browser application is a React SPA
served and built by Vite. Its HTTP boundary is a Hono application running on Cloudflare
Workers. PostgreSQL is provided by Supabase. It stores authentication-linked profiles/preferences
and user-owned demat accounts/import history with forced RLS. IPO applications and the quota engine
remain out of scope until the account module is verified.

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
- `workers/api` owns HTTP routing, request/response behavior, environment parsing, and
  caller-scoped database adapters.
- `packages/shared` contains transport-neutral shared TypeScript contracts.
- `packages/validation` exposes the common Zod validation library to packages.
- `packages/financial-engine` is an isolated future computation package; Phase 1 has no financial
  calculations.
- `supabase` owns local Supabase project configuration and database migration files.
- `apps/web` account pages provide responsive management and use TanStack Query, Table, and
  Virtual for account data and large lists.
- `workers/api` validates account input, verifies ownership, parses bounded CSV/XLSX imports,
  and forwards the caller JWT for RLS-protected operations.
- PostgreSQL serializes each user's account-capacity changes through a private, atomically updated
  counter row; its trigger is the authoritative 500-active-account limit.

Dependencies point inward to shared contracts and validation. Shared packages must not import
from apps or workers, preventing circular dependencies.

## API and errors

`GET /api/health` returns a typed status payload with the API version and validated runtime
environment. Protected profile and demat-account routes verify the bearer token through Supabase
Auth before forwarding it as the PostgREST authorization context. Auth-user deletion is the only
service-role operation and receives only the verified caller's user ID. Errors are structured;
logs do not include tokens or request bodies.

## Database and RLS

User-scoped database operations use Supabase's anon project key with the caller's verified JWT
forwarded as the request authorization context. This retains PostgreSQL RLS behavior. Account
imports stage every row before atomic, idempotent confirmation; reversal archives unchanged
import-created accounts. See
[DATA_FLOW.md](./DATA_FLOW.md) and [environment variables](../deployment/ENVIRONMENT_VARIABLES.md).
