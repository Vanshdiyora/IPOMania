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

**Reasoning:** Product requirements and policy define each business model in its approved phase.

## ADR 006 — Supabase Auth and caller-context RLS

**Decision:** Supabase Auth owns credentials and PKCE sessions. Protected API routes verify the
bearer token with Supabase Auth and forward the same token with the anon project key for
user-scoped PostgREST operations.

**Reasoning:** Server-side Auth verification provides the authoritative user identity, and
PostgreSQL RLS remains the final owner-isolation boundary. Service-role access is isolated to the
verified account-deletion operation.

## ADR 007 — database-enforced active demat-account capacity

**Decision:** Limit each user's unarchived active demat accounts to 500 with a private per-user
counter row and a PostgreSQL trigger that atomically increments/decrements it.

**Reasoning:** API preflight counts are racy under concurrent requests. A guarded atomic counter
update locks the user's capacity row and protects creation, restoration, status changes, and
imports regardless of caller path.

## ADR 008 — staged and idempotent account imports

**Decision:** Persist each mapped import row and report before confirmation; use one caller-scoped
database transaction to confirm, and archive unchanged rows for reversal.

**Reasoning:** A durable preview preserves invalid/duplicate row reports, a transaction avoids
partial imports, and an idempotent state transition makes retries safe without service-role access.

## ADR 009 — user-specific IPO records until a trusted publisher exists

**Decision:** IPO records, category rules, and calculation history are user-owned and protected by
forced RLS.

**Reasoning:** The application has no trusted shared-catalog editor or publication workflow.
Making records shared would allow one user's manual data and private context to leak or be changed
by another user. A future shared catalog requires a separately approved editorial authorization
model.

## ADR 010 — immutable issue-specific quota rule versions

**Decision:** Store category rules per IPO and category as append-only versions. Assign version
numbers under a database transaction lock, and snapshot the selected version and calculation
inputs/results.

**Reasoning:** IPO limits and eligibility criteria vary by issue. No category defaults or
hard-coded quota limits are safe; unknown rules must fail closed. Immutable versions preserve
historical reproducibility after an issue is edited.

## ADR 011 — Decimal financial calculations

**Decision:** Use `decimal.js` for monetary comparison and multiplication in the isolated
financial-engine package. Monetary API inputs are decimal strings.

**Reasoning:** IEEE-754 floating-point rounding is inappropriate for financial calculations.
Integer share counts are range-checked separately, and the engine has no market-data or investment
advice behavior.
