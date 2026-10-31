# Project structure

```text
apps/
  web/                 React/Vite app, Supabase Auth, dashboard, demat and IPO pages
workers/
  api/                 Hono routes, JWT verification, analytics aggregation, and DB adapters
packages/
  shared/              Shared response and health types
  validation/          Shared Zod export
  financial-engine/    Decimal.js IPO quota calculations, independent of apps and API
supabase/
  migrations/          PostgreSQL schema and RLS migrations
  tests/               Direct pgTAP policy, isolation, account, and IPO RLS tests
  config.toml          Local Supabase CLI project configuration
  seed.sql             Seed entry point; no Phase 1 records
tests/
  unit/                 Fast schema, financial-engine, and logic tests
  integration/          Service/database boundary and opt-in capacity race tests
  security/             API authentication, ownership, import, and IPO regressions
  e2e/                  Playwright browser tests
scripts/                Local development and database utilities
docs/
  architecture/         System and package design
  backend/              Authentication integration
  database/             RLS and schema requirements
  frontend/             UI architecture and design system
  deployment/           CI and environment procedures
  security/             Threat boundaries and multi-user isolation
.github/workflows/      GitHub Actions automation
```

Each package owns its TypeScript compiler settings. The root TypeScript project references packages
and applications so `npm run typecheck` checks the monorepo in dependency order.
