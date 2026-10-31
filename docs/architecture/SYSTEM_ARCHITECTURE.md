# System architecture

## Current scope

The repository is a TypeScript npm-workspaces monorepo. The browser application is a React SPA
served and built by Vite. Its HTTP boundary is a Hono application running on Cloudflare
Workers. PostgreSQL is provided by Supabase. It stores authentication-linked profiles/preferences
and user-owned demat accounts/import history, IPO records, issue-specific rules, and private
calculation history with forced RLS. IPO application submission and allotment management remain out
of scope until critical calculation tests pass.

```text
Browser
  └── React / Vite application
        ├── Supabase Auth (email/password; PKCE session)
        └── bearer-token HTTP calls ──> Hono / Cloudflare Worker
                                        ├── Supabase/PostgreSQL (caller JWT + anon key + RLS)
                                        └── isolated decimal.js financial engine

Shared packages: API types | validation exports | financial engine boundary
```

## Boundaries and responsibilities

- `apps/web` owns presentation, navigation, browser state, and accessible components.
- `workers/api` owns HTTP routing, request/response behavior, environment parsing, and
  caller-scoped database adapters.
- `packages/shared` contains transport-neutral shared TypeScript contracts.
- `packages/validation` exposes the common Zod validation library to packages.
- `packages/financial-engine` owns transport-independent exact-decimal quota calculations and
  accepts explicit issue-specific rules; it contains no hard-coded category limits.
- `supabase` owns local Supabase project configuration and database migration files.
- `apps/web` account pages provide responsive management and use TanStack Query, Table, and
  Virtual for account data and large lists.
- `workers/api` validates account input, verifies ownership, parses bounded CSV/XLSX imports,
  and forwards the caller JWT for RLS-protected operations.
- `workers/api` owns user-scoped IPO CRUD, append-only category rule creation, and quota API
  transport. It snapshots exact inputs/results and never substitutes the service-role key.
- IPO master data is per-user until the project defines a trusted shared-catalog publishing role.
- `apps/web` provides IPO list/details/forms, a date-ordered calendar, category configuration, and
  a calculator with explicit eligibility explanations.
- PostgreSQL serializes each user's account-capacity changes through a private, atomically updated
  counter row; its trigger is the authoritative 500-active-account limit.

Dependencies point inward to shared contracts and validation. Shared packages must not import
from apps or workers, preventing circular dependencies.

## API and errors

`GET /api/health` returns a typed status payload with the API version and validated runtime
environment. Protected profile, demat-account, IPO, and quota routes verify the bearer token
through Supabase Auth before forwarding it as the PostgREST authorization context. Auth-user
deletion is the only service-role operation and receives only the verified caller's user ID. Errors
are structured; logs do not include tokens or request bodies.

## Database and RLS

User-scoped database operations use Supabase's anon project key with the caller's verified JWT
forwarded as the request authorization context. This retains PostgreSQL RLS behavior. Account
imports stage every row before atomic, idempotent confirmation; reversal archives unchanged
import-created accounts. IPO rule versions and calculation snapshots are owner-scoped and protected
by forced RLS. See [DATA_FLOW.md](./DATA_FLOW.md),
[IPO_SCHEMA.md](../database/IPO_SCHEMA.md), and
[QUOTA_ENGINE.md](../backend/QUOTA_ENGINE.md).
