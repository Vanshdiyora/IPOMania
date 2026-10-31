# Phase tasks

## Phase 1 — Project foundation and DevOps

- [x] Inspect the repository and preserve existing working code.
- [x] Create npm workspace and strict TypeScript foundations.
- [x] Add React/Vite frontend shell, shared layout, routing, and fixed light theme.
- [x] Add Hono/Cloudflare Worker API health and structured error handling.
- [x] Configure Supabase, Drizzle, migration layout, and database connectivity check.
- [x] Establish shared types, validation, and financial-engine packages.
- [x] Configure unit, integration, security, and Playwright E2E test locations.
- [x] Add GitHub Actions CI and required documentation.
- [x] Execute and record Phase 1 verification checks.
- [x] Confirm GitHub Actions configuration is present and valid for the repository.

## Phase 2 — Authentication and multi-user security

- [x] Add Supabase Auth client configuration and email/password UI flows.
- [x] Add protected frontend routing, session loading/expiration states, and profile page.
- [x] Add Hono bearer authentication using Supabase Auth user verification.
- [x] Add profiles/preferences migration, ownership foreign keys, and RLS policies.
- [x] Add caller-JWT/anon-key user-scoped database adapter and isolated account deletion.
- [x] Add API auth regression tests and direct two-user PostgreSQL RLS tests.
- [x] Add requested backend, security, database, and testing documentation.
- [ ] Configure a real Supabase project and verify registration, verification, login, logout,
      recovery/reset, profile updates, and account deletion.
- [ ] Run `npm run test:security:db` against local Supabase and record passing direct RLS results.
- [x] Triage the npm audit findings, remediate high/critical advisories, and pass the CI dependency
      audit (upgraded Zod 4, Hono 4.13, Wrangler 4, React Router 7, Vite 7, Vitest 4, Node.js 22.12+).
- [ ] Run all required quality/build checks and verify GitHub CI, including the database-security
      job.
- [ ] Review remaining production risks and record evidence before opening the Phase 3 gate.

Do not proceed to Phase 3 until every unchecked verification item passes. Mocked API tests are not
a replacement for live Auth or direct database-policy verification.
