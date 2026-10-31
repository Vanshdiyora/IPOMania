# Changelog

Notable project changes are recorded here.

## Unreleased

### Added

- Phase 1 monorepo foundation with strict TypeScript workspaces.
- React/Vite frontend shell with a fixed light theme and accessible shared components.
- Hono API on Cloudflare Workers with a structured health endpoint and error handling.
- Supabase CLI configuration, PostgreSQL connectivity check, and Drizzle migration setup.
- Unit and browser test scaffolding, documentation, and GitHub Actions CI.

### Phase 4 — IPO manager and quota engine

- Added user-owned IPO CRUD, search/filter, manual provenance, archive, category configuration,
  opening-date calendar, and quota-calculator pages.
- Added append-only issue-specific category rule versions, forced RLS, and owner-bound calculation
  snapshots.
- Added an isolated `decimal.js` financial engine and protected validation/calculation APIs.
- Added synthetic unit/API/E2E fixtures and two-user IPO database-policy tests; no test fixture is
  presented as an official market rule.

### Not included

- IPO application submission/allotment workflows, investment advice, shared-market data, and
  automated market-data integrations.
