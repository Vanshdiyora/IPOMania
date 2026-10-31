# Architecture decisions

## ADR 001 — npm workspaces and package boundaries

**Decision:** Use npm workspaces for the browser app, Worker API, and shared packages.

**Reasoning:** A single lockfile and shared tooling keep the foundation reproducible while TypeScript
project references enforce dependency order. Shared packages may not depend on deployable apps.

## ADR 002 — React SPA and Hono Worker

**Decision:** Build the web shell with React/Vite and the API with Hono on Cloudflare Workers.

**Reasoning:** The frontend is independently deployable and the Worker provides a small, modular
HTTP boundary suited to the target runtime.

## ADR 003 — fixed light design system

**Decision:** Force `color-scheme: light`, use the specified palette, and provide no theme toggle or
device theme detection.

**Reasoning:** A consistent readable visual experience is an explicit product constraint. Target
touch controls are at least 44 CSS pixels.

## ADR 004 — Supabase RLS context preservation

**Decision:** User-scoped database operations must use the caller's verified JWT with Supabase's
anon key, not service-role credentials.

**Reasoning:** Forwarding the user authorization context allows PostgreSQL RLS to enforce access at
the database. The Phase 1 scaffold does not implement authentication or data operations.

## ADR 005 — no business schema in Phase 1

**Decision:** Add database tooling and migration locations without inventing domain tables or seed
records.

**Reasoning:** Product requirements and policy need to define the business model in a later phase.

## ADR 006 — Supabase Auth and caller-context RLS

**Decision:** Supabase Auth owns credentials and PKCE sessions. Protected API routes verify the
bearer token with Supabase Auth and forward the same token with the anon project key for
user-scoped PostgREST operations.

**Reasoning:** Server-side Auth verification provides the authoritative user identity, and
PostgreSQL RLS remains the final owner-isolation boundary. Service-role access is isolated to the
verified account-deletion operation.
