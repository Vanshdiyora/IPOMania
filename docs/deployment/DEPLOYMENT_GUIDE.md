# Deployment guide

## Scope and gate

This document prepares deployment only. No Cloudflare or hosted Supabase deployment, custom
domain, production secret, or backup has been activated by this change. Do not deploy production
until Phase 8's final integrated audit has passed and a production deployment has explicit approval.
The deployment workflow additionally requires a protected GitHub `production` environment.

Phase 3's local database/RLS, concurrency, secret-history, hosted-configuration, and repository-wide
formatting gates remain open as recorded in [PROJECT_STATUS.md](../../PROJECT_STATUS.md). Do not
interpret this deployment preparation as clearing those gates.

## Approved hosting architecture

The app's approved topology is a Vite-built SPA deployed as Cloudflare Workers Static Assets, with
a small web Worker forwarding `/api/*` through a service binding to the Hono API Worker. The config
is in [apps/web/wrangler.toml](../../apps/web/wrangler.toml) and
[workers/api/wrangler.toml](../../workers/api/wrangler.toml). The `preview` and `production`
environments have separate Worker names and API service bindings. No R2 bucket is configured.

Cloudflare Pages is not configured as a second frontend runtime: changing from the existing
Workers Static Assets/service-binding architecture would require an architecture decision and a
different API proxy integration. Pages limits are included in the cost review below for planning,
not as evidence of a deployed Pages project.

The web Worker makes API calls same-origin; it should not need `VITE_API_BASE_URL`. In production,
set API `WEB_APP_ORIGIN` to the exact canonical frontend origin. The existing API CORS middleware
allows the configured origin and rejects other production origins. Keep preview CORS pointed only
at the preview web origin.

## Cloudflare and GitHub setup

Before dispatching a deployment:

1. Create Cloudflare Workers named `ipo-mania-api`, `ipo-mania-web`, `ipo-mania-api-preview`, and
   `ipo-mania-web-preview` by deploying their corresponding Wrangler environments.
2. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `WEB_APP_ORIGIN` as Worker variables in the
   correct API Worker environment. Set `SUPABASE_SERVICE_ROLE_KEY` only as a Worker secret, and
   only if account deletion is enabled. Keep production and preview values separate.
3. Create GitHub `preview` and `production` environments and configure their environment-scoped
   Cloudflare secrets and variables as described in
   [GITHUB_ACTIONS.md](./GITHUB_ACTIONS.md) and
   [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md). Configure required production reviewers
   and branch restrictions in GitHub settings; workflow YAML alone cannot enforce those settings.
4. Configure preview and production Supabase Auth Site URLs and redirect allowlists separately.
5. Set `API_HEALTH_URL` to the API Worker HTTPS URL plus `/api/health` and `WEB_HEALTH_URL` to the
   web Worker HTTPS root URL in each GitHub environment.
6. Run the manually dispatched preview workflow from a trusted branch. Do not expose Cloudflare
   secrets to pull-request code, particularly pull requests from forks.

The API Worker serves `GET /api/health`, returning `status`, API version, and
`RUNTIME_ENV`. This is a process/configuration liveness check only: it does not connect to Supabase,
verify RLS, or prove that authentication and business routes are healthy.

## Custom domain and HTTPS

No production hostname is assumed or registered by this repository. After choosing and approving a
domain:

1. Add the zone to the correct Cloudflare account and complete registrar nameserver/DNS setup.
2. In **Workers & Pages**, assign a custom domain to the web Worker. Confirm its DNS record is
   Cloudflare-proxied and the certificate is active before changing canonical URLs.
3. Keep the API private behind the web Worker service binding where possible. If a public API
   hostname is needed, configure its custom domain separately and do not weaken CORS.
4. Set `VITE_WEB_APP_ORIGIN` in the matching GitHub environment to the canonical web
   `https://` origin and rebuild. Set the API Worker's `WEB_APP_ORIGIN` to the same exact origin.
5. Update only the matching Supabase project's Auth Site URL and explicit callback paths.
6. Verify certificate validity and redirects with `curl.exe -I https://<host>/` and inspect the
   browser certificate. Verify the app does not load API/auth resources over HTTP.
7. Test a valid CORS preflight from the exact web origin and confirm an unapproved origin receives
   no permissive `Access-Control-Allow-Origin` header.

Do not add hostnames or Supabase URLs for which the project owner has not confirmed control.

## Production release sequence

1. Verify the exact `main` commit has all required CI and security checks passing, all relevant
   database/RLS tests passing, critical financial tests passing, and Phase 8's final integrated
   audit passed.
2. Review migration changes. Apply and verify migrations separately using the database procedure
   below; deployment workflows do not run migrations.
3. Deploy and smoke-test a trusted preview against a non-production Supabase project.
4. Dispatch `Deploy production` from `main`; confirm the Phase 8 audit input only when evidence is
   recorded. A designated reviewer must approve the protected `production` environment.
5. The workflow deploys API first, checks the production environment in `/api/health`, builds the
   SPA with public production Supabase values, deploys the frontend Worker, and checks its HTTPS
   root.
6. Manually verify sign-in, email callback/reset redirects, same-origin API requests, denied
   cross-origin requests, health checks, and sanitized Worker logs. Record the deployed commit,
   migration version, and check results in the release record.

No production deployment is authorized by this preparation task. Do not infer approval from a
green CI run, a workflow file, or the `phase8_integrated_audit_passed` input alone.

## Database deployment and verification

Do not independently modify shared migrations or deploy them without coordinating with the
database/phase owners. The app uses Supabase CLI migrations in `supabase/migrations`; the deploy
workflows intentionally do not run `supabase db push`.

For an authorized release operator with approved access:

1. Confirm the target project ref and environment through the Supabase dashboard. Use an isolated
   staging project before production where available. Never paste connection strings or keys into
   logs or chat.
2. Review every pending migration and its owner-FK, forced-RLS, grant, and index coverage. Run the
   tests locally, including direct two-user SQL tests for each user-owned table.
3. Link the CLI to the intended project using an authorized operator session:
   `supabase link --project-ref <project-ref>`.
4. Check migration state with `supabase migration list --linked`, inspect a dry run with
   `supabase db push --linked --dry-run`, and compare the proposed operations to the reviewed
   migration files.
5. Confirm a current recovery point and a written rollback/recovery plan. Apply only after the
   release approver authorizes the target:
   `supabase db push --linked`.
6. Re-run `supabase migration list --linked` and the schema, RLS, index, and application smoke
   checks below. Record the database migration versions and output without credentials.

### Post-migration checklist

- Expected migrations are applied exactly once and no unreviewed migration is pending.
- Every user-owned table has the correct owner foreign key and ownership is derived from the
  authenticated identity, not a request-supplied ID.
- Row-level security is enabled and forced where required; grants are least-privilege.
- Direct two-user tests prove one user's rows cannot be read, inserted, changed, or deleted by the
  other user; test caller-scoped RPCs and service-role-only paths separately.
- Unique constraints, foreign keys, checks, triggers, and idempotency behavior match the reviewed
  schema.
- Required indexes exist and the query plans for critical paths use them; confirm large data
  operations do not cause unexpected scans or locks.
- The API still uses the caller's verified JWT with the anon project key for RLS-protected
  requests. Never substitute the service-role key.
- `GET /api/health` succeeds, then authenticated smoke checks confirm the actual database path.

The existing Phase 3 database/RLS and concurrency gates are still open. Deployment preparation
does not pass those gates or certify production schema state.

## Rollback principles

Do not assume that reverting a Worker version reverts a database migration. Prefer compatible
expand/contract migrations and application rollback while preserving backward compatibility. For a
destructive or data-transforming migration, stop and use the pre-approved recovery plan; do not
improvise a down migration against production. See
[BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md).

## Current service/free-tier review

Limits and plan prices below were checked against provider documentation on 2026-10-31. They can
change; re-check the linked pricing pages and actual account settings before launch.

| Service                 | Current documented allowance/restriction                                                                                                                               | Cost and operational note                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers Free | 100,000 requests/day and 10 ms CPU per invocation; static asset requests are separately described as free/unlimited.                                                   | Workers Paid is at least $5/month and includes 10M requests/month and 30M CPU ms; overages can apply. CPU, storage, requests, worker count, and account limits still apply. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/)                          |
| Cloudflare Pages Free   | 500 builds/month, one concurrent build, 20-minute build timeout, 20,000 files/site, and 25 MiB maximum per asset. Pages Functions use Workers quotas/billing.          | Pages is not the selected hosting runtime here. [Limits](https://developers.cloudflare.com/pages/platform/limits/)                                                                                                                                                          |
| Supabase Free           | 2 active projects, 500 MB database/project, 50,000 MAU, 5 GB egress, 5 GB cached egress, 1 GB file storage; inactive projects may pause after one week.                | Free does not include daily automatic backups in the current backup docs. Pro begins at $25/month with usage limits and additional compute/egress/storage charges. [Pricing](https://supabase.com/pricing)                                                                  |
| GitHub Actions          | Public standard hosted runner usage is free; private-repository usage draws from plan compute allowances and may be billed. Artifacts/cache have separate plan limits. | Costs depend on visibility, billing plan, minutes, runner class, and retained storage. [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)                                                                                                |
| PostgreSQL storage      | The database is hosted by Supabase; the Free project database allowance is 500 MB.                                                                                     | Monitor database size and indexes against the plan limit. Higher storage, compute, backups, and egress may incur charges.                                                                                                                                                   |
| Cloudflare R2           | No R2 bucket is configured or used by the current application.                                                                                                         | Current Standard free allowance is 10 GB-month storage, 1M Class A and 10M Class B requests/month; Standard beyond that is billed by storage/operations. Infrequent Access has retrieval/minimum-duration charges. [Pricing](https://developers.cloudflare.com/r2/pricing/) |

These are not guarantees of sufficient capacity or zero cost. Set account billing alerts and usage
limits where available, review logs and invoices regularly, and load-test expected traffic.
