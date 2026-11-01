# Admin IPO module deployment

## Database

Apply migrations with:

```sh
npx supabase db push
```

Create the initial administrator through Supabase Auth (Dashboard or Admin API). Never place the password in Vite variables, frontend code, migrations, or public settings. After the user exists, grant the admin role using server-side SQL:

```sql
update public.profiles
set role = 'ADMIN', updated_at = now()
where id = (select id from auth.users where email = 'admin@gmail.com');
```

For a new local auth user, create it with the Supabase Dashboard and repeat the SQL above. The requested password is operational configuration and must be stored in the Supabase project's authentication system, not in this repository.

## Existing Worker secrets

```sh
npx wrangler secret put SUPABASE_URL --config workers/api/wrangler.toml
npx wrangler secret put SUPABASE_ANON_KEY --config workers/api/wrangler.toml
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/api/wrangler.toml
npx wrangler secret put IPO_GURU_API_KEY --config workers/api/wrangler.toml
```

Optional provider configuration variables:

```sh
npx wrangler secret put IPO_GURU_API_URL --config workers/api/wrangler.toml
npx wrangler secret put IPO_SYNC_INTERVAL_HOURS --config workers/api/wrangler.toml
```

The API URL defaults to `https://www.ipoguru.in/api/v2/ipos`; requests use the key in the `X-API-KEY` header. The interval defaults to 3 hours. Scheduled and manual synchronization both enforce that interval, and provider attempts are retained in the synchronization log.

Only configure IPO Guru when the API plan permits the intended production usage. Data provenance must still be displayed in the catalog.

## Scheduling

The existing Worker contains:

```toml
[triggers]
crons = ["0 */3 * * *"]
```

The Worker checks its configured interval before calling IPO Guru, so cron cadence and provider-call cadence can be operated independently. Deploy the same Worker normally; do not create another Worker. Verify the deployed trigger in the Cloudflare dashboard before claiming the schedule is active.

## Manual synchronization

1. Sign in as the admin created above.
2. Open `/admin/sync`.
3. Confirm the manual run.
4. Inspect `/admin/ipo-sync-history` for the structured report.

At most one manual run is allowed in a local IST day in addition to the scheduled run, with scheduled/provider failures recorded normally.

## Provider configuration

IPO Guru API calls use `X-API-KEY`. Confirm the provider endpoint and plan scope in IPO Guru's documentation, and rotate keys using Cloudflare secrets. Provider failures preserve existing catalog rows and are recorded in synchronization logs; omitted records are never converted to deleted rows.
