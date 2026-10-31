# Monitoring and reliability

## Current state

No external uptime monitor, error-monitoring provider, alert route, service-level objective,
production log drain, or on-call rotation is configured by this repository. The Hono Worker writes
sanitized metadata for unhandled errors to `console.error`; do not treat that as active alerting or
retained monitoring.

`GET /api/health` currently validates runtime configuration and returns status/version/environment.
It is a liveness check, not a database/auth readiness check. It does not prove that Supabase is
reachable, migrations are current, RLS works, or user-facing flows succeed.

## Health checks and launch verification

Use an uptime monitor with HTTPS checks for the public website root and API `/api/health`. Choose a
provider and region/frequency only after approval; none is selected here. Alert on repeated
failures, not a single transient probe, and avoid sending credentials or user data in probes.

For a release, verify:

1. `curl.exe --fail --silent --show-error https://<api-host>/api/health` returns HTTP 200 and
   `data.status` is `ok`; production should report `data.environment` as `production`.
2. The public website root returns HTTP 200 over HTTPS and its certificate is valid.
3. A browser can authenticate against the intended Supabase environment, complete allowed
   callbacks, and call same-origin `/api/*`.
4. CORS preflight succeeds for the exact canonical origin; an unrelated origin is not granted
   `Access-Control-Allow-Origin`.
5. An authenticated, non-destructive API smoke check proves Supabase connectivity and RLS behavior.

Use the direct API Worker health URL for API health; the web Worker's `/api/health` route exercises
the service binding. These probes are different checks. Do not expose secrets in curl history or
monitoring configuration.

## Worker logs and errors

- Use Cloudflare Workers Logs/Observability for API exceptions and request outcomes after enabling
  and verifying it in the account. Cloudflare settings, retention, sampling, and potential charges
  are account-specific and are not enabled by this repository.
- Retain structured logs without bearer tokens, cookies, request bodies, passwords, Supabase keys,
  SQL connection strings, or personally identifying payloads. Keep log fields to operation,
  sanitized route, status, duration, and correlation ID where available.
- Review the API's existing unhandled-error log; it records error name, method, and path. Do not
  add raw errors, user payloads, or tokens to logs.
- Evaluate an external exception-monitoring provider only after approving data processing,
  redaction, retention, access controls, and cost. No provider SDK or DSN is configured.
- Exercise an alert using a test event before launch and verify who receives it and how to
  acknowledge/escalate. Do not claim alerts are active without this evidence.

## Incident response

1. Acknowledge and assign an incident lead. Record start time, affected environment, release commit,
   migration version, impact, and evidence without secrets or user data.
2. Assess availability, authentication, user-data isolation, financial-data integrity, and whether
   there is active unauthorized access. Escalate suspected data exposure immediately.
3. Stop risky deployments or writes using an approved reversible control. Preserve sanitized logs
   and provider audit events.
4. If a Worker change is implicated, evaluate a known-good Worker version, but first verify
   compatibility with the current database schema. A Worker rollback does not roll back migrations.
5. If data loss or corruption is suspected, follow
   [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md); do not restore or mutate production without
   explicit incident-owner approval.
6. Confirm service health, auth, CORS, and two-user RLS isolation before declaring recovery.
7. Notify stakeholders through the approved communication route, document timeline/impact, and
   complete a follow-up with preventive actions.

## Backup verification

Check provider backup status, latest successful timestamp, retention, restore permissions, and any
independent export checksum. A scheduled backup indicator alone is insufficient: periodically
restore into an isolated project and validate schema, RLS, indexes, data invariants, and API
behavior. Record the drill result and recovery time. Until a real restore is completed, backups and
recovery are unverified.
