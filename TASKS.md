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
- [x] Verify local Supabase Auth registration, email confirmation, login/logout, recovery/reset,
      session persistence, profile RLS access, and account deletion using Mailpit.
- [x] Run direct two-user PostgreSQL RLS tests against local Supabase (19/19 pgTAP tests passed).
- [x] Exercise the local Worker API with two users, valid/invalid/expired tokens, forged user IDs,
      profile updates, and authenticated account deletion.
- [x] Run `npm run db:check` against the configured database URL; read-only `SELECT 1` passed.
- [ ] Verify hosted-project email delivery, redirect allowlists, and production Auth configuration.
- [x] Triage the npm audit findings, remediate high/critical advisories, and pass the CI dependency
      audit (upgraded Zod 4, Hono 4.13, Wrangler 4, React Router 7, Vite 7, Vitest 4, Node.js 22.12+).
- [x] Run all required local quality/build checks, browser tests, and the dependency audit.
- [ ] Remove generated Supabase CLI logs and `.temp/start-secrets` from unpushed Git history and
      rotate local keys before publishing the branch.
- [ ] Verify a new GitHub Actions run, including the database-security job, on the current branch.
- [x] Record remaining production risks; do not open the Phase 3 gate until hosted configuration
      and GitHub CI have also passed.

Do not proceed to Phase 3 until every unchecked verification item passes. Local Auth and direct RLS
tests do not establish hosted email configuration or production readiness.
