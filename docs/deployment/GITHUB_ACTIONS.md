# GitHub Actions

## Workflows

- `ci.yml` validates pull requests and pushes to `main` and `feature/phase-9-preparation`.
  It runs formatting, lint, type checking, Vitest, web/API builds, `npm audit`, Supabase RLS
  tests, and loopback-only database concurrency tests.
- `codeql.yml` runs CodeQL for TypeScript on `main`, same-repository pull requests, and a weekly
  schedule. Fork pull requests receive no write-scoped token or deployment credentials; dependency
  audit and regular CI still run for them.
- `deploy-preview.yml` is `workflow_dispatch` only. It accepts a selected, trusted non-`main`
  branch and deploys to the isolated `preview` Cloudflare environment.
- `deploy-production.yml` runs automatically after the `CI` workflow completes successfully for
  a push to `main` (including the push created when a pull request is merged). It can also be
  dispatched manually from `main`. Its `production` GitHub environment must require
  reviewer approval before the job can access environment secrets. This workflow does not apply
  database migrations.

## GitHub environment setup

Create GitHub environments named `preview` and `production` under **Settings → Environments**.

For `production`:

1. Require one or more designated reviewers; disallow self-review and administrator bypass where
   the repository plan/settings permit it.
2. Limit deployment branches to `main`.
3. Add environment-scoped secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Use a
   production-specific Cloudflare API token.
4. Add the environment variables listed in
   [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md), including production Supabase public
   values and the exact production health-check URLs.

Also protect `main` in repository rulesets: require pull requests, block force pushes, and require
the `Quality and build`, `Supabase RLS tests`, and `Analyze TypeScript` checks before merge. These
repository-side rules are not enabled by workflow files and must be configured by an authorized
maintainer. Confirm check names against the Actions UI after the first run.

For `preview`, use a separate Cloudflare API token and preview-only Supabase project/keys. Add
preview-scoped variables and health-check URLs. Restrict who can approve/use this environment.
Cloudflare Worker edit permissions are account-scoped; a token with Worker edit access may be able
to modify other Workers in that account. Prefer a separate Cloudflare account for preview if
stronger blast-radius isolation is needed.

Never put production tokens or service-role credentials in repository-wide secrets, pull-request
workflows, artifacts, build logs, or `VITE_` variables. Fork pull requests do not receive Actions
secrets. Do not change these workflows to `pull_request_target` or check out untrusted PR code in a
privileged workflow.

## Validation and deployment sequence

Before creating or approving a production release:

1. Confirm required CI, database/RLS, security, financial, and Phase 8 integrated-audit checks
   passed on the exact commit.
2. Confirm migrations were reviewed and applied separately under the procedure in
   [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).
3. Dispatch the preview workflow from a trusted branch and verify the preview health endpoints,
   authentication redirects, CORS, and core smoke tests.
4. A push of the exact commit to `main` starts production automatically after successful CI, or
   dispatch production manually from `main`; obtain the independent `production` environment
   approval before deployment.
5. Confirm the API health response reports `production`, the website responds over HTTPS, and
   browser authentication uses the intended production Supabase project.
6. If verification fails, stop further changes and use
   [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md) and the incident steps in
   [MONITORING.md](./MONITORING.md). Do not assume a Worker rollback restores database state.

Set health check variables to full HTTPS URLs. `API_HEALTH_URL` must address the deployed API
Worker's `/api/health`; `WEB_HEALTH_URL` must address the website root. These values are public
URLs, not secrets.

## Actions billing and restrictions

Standard GitHub-hosted runners are free for public repositories. For private repositories, runner
minutes/compute and artifact/cache storage are subject to the repository owner's plan allowances
and overage billing; usage is shared with other eligible GitHub products. Check the current billing
dashboard and [GitHub Actions billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
before enabling high-frequency CI, retention-heavy artifacts, or larger runners. Fork workflows
may require maintainer approval, and repository settings can restrict Actions or secret access.

This repository does not currently configure artifact uploads, deployment previews on every PR, or
paid GitHub services. Availability of CodeQL, environment protection rules, and billing controls
depends on repository visibility and the GitHub plan.
