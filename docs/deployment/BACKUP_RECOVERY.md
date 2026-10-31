# Backup and recovery

## Current state

This repository does not configure or verify a hosted Supabase backup plan, Cloudflare Worker
version rollback, independent database export, or restore test. Do not claim that production
backups or recovery are active until the actual Supabase plan/settings are checked and a restore has
been demonstrated.

Supabase's current documentation states that automated daily backups are available on Pro, Team,
and Enterprise; the current plan page lists seven days for Pro and fourteen days for Team. The
Free plan does not include those automated daily backups and can pause inactive projects. Point-in-
time recovery is a paid add-on and must be confirmed in the account. Check
[Supabase backups](https://supabase.com/docs/guides/platform/backups) and
[pricing](https://supabase.com/pricing) at the time of launch.

## Before launch

- Confirm the project's paid/free plan, backup schedule, retention window, PITR state, and restore
  permissions in the Supabase dashboard.
- Identify a backup owner, an operator authorized to restore, and a secure off-project storage
  location with encryption at rest and access logging.
- Set a recovery point objective and recovery time objective appropriate to the product. Record
  these as approved operational targets; this repository does not set them.
- Ensure database backup access does not require exposing a service-role key to the web app or
  deployment workflows.
- Document which Auth, Storage, and database data are covered by the chosen method. A database
  dump alone may not include all hosted Auth/Storage objects or provider configuration.

## Export and retention procedure

An authorized operator may export PostgreSQL to an encrypted, access-controlled location using a
database connection obtained privately from the Supabase dashboard. For example, with a compatible
PostgreSQL client:

```powershell
pg_dump --format=custom --no-owner --no-acl "$env:DATABASE_URL" --file "ipo-mania-<date>.dump"
```

Do not execute the command against production without authorization. Never place the connection
string in command history, CI logs, repository files, or this document. Verify the exit code, file
size, checksum, encryption, upload completion, and retention expiry; then remove any temporary
local copy according to the approved secure-handling policy. Protect backups at least as strongly
as the source database.

Automated Supabase backups and independent exports have separate retention and coverage. Confirm
that independent exports meet the approved recovery objectives rather than assuming a provider
backup is portable or current.

## Restore and recovery drill

1. Declare an incident and appoint the incident lead; record the suspected failure window and last
   known good migration/backup without copying credentials into incident notes.
2. Stop risky writes or deployment activity using an approved, reversible control. Preserve logs
   and evidence.
3. Select a verified recovery point and confirm its timestamp, checksum, encryption, and project
   identity.
4. Restore to a new isolated Supabase project or disposable database first. Do not overwrite
   production during a drill.
5. Verify schema/migration versions, indexes, constraints, RLS and grants, two-user isolation,
   auth-related behavior, row counts, and application-level invariants. Test API connectivity
   without exposing secrets.
6. Obtain explicit owner/incident approval before any production restore or data replacement.
7. Reconcile writes since the recovery point according to an approved data-loss plan; record
   results, unresolved gaps, and recovery duration.
8. Re-enable traffic only after security and data-integrity checks pass. Notify affected stakeholders
   using the approved incident communication path.

Schedule a restore drill after backup activation and periodically thereafter. Record evidence and
the measured recovery point/time separately; until then, backup recovery remains unverified.

## Migration failure and rollback

Database rollback is not equivalent to reverting an application deployment. Prefer forward fixes
and backward-compatible expand/contract migrations. For a failed migration, stop subsequent
deployments, capture the exact migration state, and consult the migration owner. Restore or reverse
data only from an approved recovery plan; never run improvised destructive SQL against production.

Rolling a Cloudflare Worker back does not undo schema changes or reconstruct deleted data. Verify
frontend/API compatibility with both the current schema and the rollback target before release.
