# GitHub Actions

`.github/workflows/ci.yml` runs for pushes to `main` and all pull requests. The quality job uses
Ubuntu and Node.js 22 with npm caching, then runs `npm ci`, formatting, lint, TypeScript checks,
Vitest, frontend production build, Worker dry-run bundle, and `npm audit --audit-level=high`.

On pushes to `main`, after both the quality and database-security jobs pass, the workflow deploys
`workers/api/` to the `ipo-mania-api` Worker. Pull requests do not deploy. The deploy job uses the
project-pinned Wrangler version and sets `RUNTIME_ENV` to `production` for the deployed Worker.

Before the first deployment, add these repository (or production environment) Actions secrets in
GitHub:

- `CLOUDFLARE_API_TOKEN`: an account-scoped Cloudflare API token with the **Edit Cloudflare Workers**
  permission, limited to the account that hosts this Worker.
- `CLOUDFLARE_ACCOUNT_ID`: the ID of that Cloudflare account.

Do not commit or paste the API token into the repository. The workflow retains read-only repository
contents permission; Cloudflare access is provided only through these Actions secrets.

The database-security job starts only the local Supabase database (`supabase db start`) before
running pgTAP tests; startup output remains visible in Actions logs for troubleshooting.

Integration and Playwright E2E jobs are intentionally prepared for future phases and are not yet CI
jobs. Add service containers or browser installation only alongside the corresponding tests and
approved environment.
