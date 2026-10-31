# GitHub Actions

`.github/workflows/ci.yml` runs for pushes to `main` and all pull requests. The quality job uses
Ubuntu and Node.js 22 with npm caching, then runs `npm ci`, formatting, lint, TypeScript checks,
Vitest, frontend production build, Worker dry-run bundle, and `npm audit --audit-level=high`.

On pushes to `main`, after both the quality and database-security jobs pass, the workflow deploys
`workers/api/` to the `ipo-mania-api` Worker and then deploys the frontend to the `ipo-mania-web`
Worker. Pull requests do not deploy. Both jobs use the project-pinned Wrangler version. The API
deployment sets `RUNTIME_ENV` to `production` and preserves variables configured in the Cloudflare
dashboard.

Before the first deployment, add these repository (or production environment) Actions secrets and
variables in GitHub:

- `CLOUDFLARE_API_TOKEN`: an account-scoped Cloudflare API token with the **Edit Cloudflare Workers**
  permission, limited to the account that hosts this Worker.
- `CLOUDFLARE_ACCOUNT_ID`: the ID of that Cloudflare account.
- `VITE_SUPABASE_URL`: the Supabase project URL used by the frontend.
- `VITE_SUPABASE_ANON_KEY`: the Supabase publishable/anon key used by the frontend. This is
  intentionally public in browser code; never use the service-role key here.

Do not commit or paste the API token into the repository. The workflow retains read-only repository
contents permission; Cloudflare access is provided only through these Actions secrets. Set the
frontend values as GitHub Actions **variables**. The build fails before deployment if either is
missing.

The frontend Worker serves the Vite SPA from Workers Static Assets and forwards `/api/*` requests
through a Cloudflare service binding to `ipo-mania-api`. This keeps API calls same-origin and avoids
needing a custom domain or frontend/API URL variables. The first successful frontend deployment is
available on the Worker's `workers.dev` URL; add that URL to Supabase Auth's allowed site and
redirect URLs before using hosted authentication.

Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Worker variables for `ipo-mania-api`, and
`SUPABASE_SERVICE_ROLE_KEY` as a Worker secret if account deletion is enabled. The deploy command
preserves these dashboard-configured values. Never expose the service-role key to the frontend.

The database-security job starts only the local Supabase database (`supabase db start`) before
running pgTAP tests; startup output remains visible in Actions logs for troubleshooting. Integration
and Playwright E2E jobs are intentionally prepared for future phases and are not yet CI jobs.
