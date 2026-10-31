# Project structure

```text
apps/
  web/                 React/Vite app, Supabase Auth state, and accessible UI
workers/
  api/                 Hono routes, JWT verification, environment, and DB adapters
packages/
  shared/              Shared response and health types
  validation/          Shared Zod export
  financial-engine/    Isolated future package boundary
supabase/
  migrations/          PostgreSQL schema and RLS migrations
  tests/               Direct pgTAP policy and isolation tests
  config.toml          Local Supabase CLI project configuration
  seed.sql             Seed entry point; no Phase 1 records
tests/
  unit/                 Fast isolated tests
  integration/          Service/database boundary tests
  security/             API authentication and ownership regressions
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
