# Account database schema

Current shape: `supabase/migrations/20261104180000_remove_broker_fields.sql`.

## `public.demat_accounts`

The table stores one user's masked demat account record. `id` is a generated UUID primary key;
`user_id` is non-null and references `auth.users(id) ON DELETE CASCADE`. Fields and constraints:

- `holder_name`: trimmed non-empty text, maximum 160 characters.
- `depository_type`: `NSDL` or `CDSL`.
- `masked_demat_identifier`: required printable masked value containing `X` or `*`, 3–80
  characters.
- `masked_demat_identifier_normalized`: stored generated lower-case/trimmed comparison value.
- `masked_client_reference`: optional 3–80 character masked value containing `X` or `*`.
- `account_status`: `active` (default), `inactive`, or `closed`.
- `notes`: optional, at most 2,000 characters.
- `created_at`, trigger-maintained `updated_at`, and nullable `archived_at`.

A unique index on `(user_id, depository_type, masked_demat_identifier_normalized)` prevents
duplicate records, including archived ones. Owner/date, status/depository/archive, and
trigram search indexes support the API filters.

## Account count

There is no per-user account count limit. The
`20261102120000_remove_demat_account_capacity.sql` migration removes the former 500-account
trigger, function, private counter table, and capacity-only index. The API still reports total,
active, and archived counts from `demat_accounts`.

## Import tables

- `account_imports` stores the owner, source name/type, preview/confirmed/reversed state, row
  counts, and lifecycle timestamps.
- `account_import_rows` stores every source row's mapped JSON, row number, status, errors/warnings,
  and optional `created_account_id`. Deleting a user cascades; deleting an account only clears the
  report's account link.
- `confirm_account_import(uuid)` locks an owned preview, inserts all `ready` rows in one
  transaction, records row links and the result, and returns the previous result on retry.
- `reverse_account_import(uuid)` archives unchanged import-created accounts atomically. It refuses
  reversal if the import's accounts are not all unchanged and still unarchived.

These narrowly scoped `SECURITY DEFINER` functions have an empty `search_path`, explicitly compare
the import owner with `auth.uid()`, and expose no arbitrary SQL or caller-provided owner value.
Authenticated users cannot directly update import state or row result links; those privileges are
held only inside the fixed confirmation/reversal functions. The API still calls them using the
verified caller JWT and does not use a service-role client.

## RLS and privileges

RLS is enabled and forced for all three tables. Policies scope select/insert/update to `auth.uid()`
and constrain account deletion to owned, archived rows. Import rows are authorized through their
owned import record. Grants are restricted to authenticated users and needed operations/columns;
anonymous access is revoked. `user_id` is not updateable.

Account deletion requires an archived row. Future financial-history tables must reference the
account using a restrictive delete rule so history cannot be lost. Auth-user deletion intentionally
cascades all of the user's account and import data.

## Verification

`supabase/tests/demat_accounts.test.sql` exercises actual two-user RLS, invalid values, duplicate
identifiers, create/archive/restore/delete beyond 500 active accounts, import confirmation
retry, and safe reversal. Run it with the other pgTAP tests using `npm run test:security:db`.

`tests/integration/demat-account-concurrency.test.ts` uses two independent PostgreSQL transactions to
create accounts simultaneously above 500 existing active accounts. It is skipped unless
`DEMAT_TEST_DATABASE_URL` is explicitly set, and rejects non-loopback hosts. Use a disposable local
Supabase database only; the fixture user and its 502 records are removed after the test.
