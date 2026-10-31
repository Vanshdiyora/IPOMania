# GitHub Actions

`.github/workflows/ci.yml` runs for pushes to `main` and all pull requests. The quality job uses
Ubuntu and Node.js 20 with npm caching, then runs `npm ci`, formatting, lint, TypeScript checks,
Vitest, frontend production build, Worker dry-run bundle, and `npm audit --audit-level=high`.

The workflow requests read-only repository contents permission. It does not need secrets because
the Phase 1 build and tests do not connect to Supabase or production services.

Integration, database, and Playwright E2E jobs are intentionally prepared for future phases and are
not yet CI jobs. Add service containers, secrets, or browser installation only alongside the
corresponding tests and approved environment.
