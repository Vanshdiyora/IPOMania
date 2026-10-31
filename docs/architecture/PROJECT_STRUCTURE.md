# Project structure

```text
apps/
  web/                 React/Vite application shell and shared UI
workers/
  api/                 Hono Worker routes and environment validation
packages/
  shared/              Shared response and health types
  validation/          Shared Zod export
  financial-engine/    Isolated future package boundary
supabase/
  migrations/          Drizzle/PostgreSQL migration location
  config.toml          Local Supabase CLI project configuration
  seed.sql             Seed entry point; no Phase 1 records
tests/
  unit/                Fast isolated tests
  integration/          Future service/database boundary tests
  security/             Future security regression tests
  e2e/                  Playwright browser tests
scripts/                Local development and database utilities
docs/
  architecture/         System and package design
  frontend/             UI architecture and design system
  deployment/           CI and environment procedures
.github/workflows/      GitHub Actions automation
```

Each package owns its TypeScript compiler settings. The root TypeScript project references packages
and applications so `npm run typecheck` checks the monorepo in dependency order.
