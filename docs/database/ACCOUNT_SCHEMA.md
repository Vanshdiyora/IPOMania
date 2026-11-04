# Account database schema

Current shape: `supabase/migrations/20261104220100_replace_demat_identifiers_with_bank_credentials.sql`.

## `public.demat_accounts`

The table stores one user's IPO-linked account record. `id` is a generated UUID primary key;
`user_id` is non-null and references `auth.users(id) ON DELETE CASCADE`. Fields and constraints:

- `holder_name`: trimmed non-empty text, maximum 160 characters.
- `bank_name`: bank display name, maximum 120 characters.
- `username`: bank login username, maximum 160 characters.
- `password_encrypted`: nullable AES-GCM ciphertext with a version prefix. Existing rows remain
  nullable and are not backfilled with invented account data.
- `account_status`: `active` (default), `inactive`, or `closed`.
- `notes`: optional, at most 2,000 characters.
- `created_at`, trigger-maintained `updated_at`, and nullable `archived_at`.

Generated normalized bank-name and username columns support import duplicate checks. The
depository, masked identifier, and masked client-reference columns are removed by the migration.
A unique index on `(user_id, bank_name_normalized, username_normalized)` prevents duplicate bank
logins for a user, including archived records.

Passwords are encrypted in the API Worker with AES-256-GCM and a fresh 96-bit nonce before any
database write; the authenticated owner and account IDs are included as authenticated encryption
data. The encryption key is configured as the Worker secret
`ACCOUNT_CREDENTIAL_ENCRYPTION_KEY`; it must be a base64-encoded 32-byte key and must not be
committed. The database stores ciphertext only. List, details, create, update, and lifecycle
responses never contain ciphertext or plaintext. The explicit `GET /api/accounts/:accountId/password`
route verifies the caller, scopes the query to their user ID, decrypts only for that request, and
sets `Cache-Control: no-store`. The UI keeps passwords masked unless the owner explicitly reveals
them. Key loss or rotation without migration makes existing ciphertext unrecoverable; maintain
protected backups and a deliberate key-rotation procedure.

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

`supabase/tests/demat_accounts.test.sql` exercises actual two-user RLS, bank and ciphertext
constraints, create/archive/restore/delete beyond 500 active accounts, import confirmation retry,
and safe reversal. API tests cover encryption, owner-scoped password reveal, and no plaintext
storage. Run the pgTAP suites with `npm run test:security:db`.

`tests/integration/demat-account-concurrency.test.ts` uses two independent PostgreSQL transactions to
create accounts simultaneously above 500 existing active accounts. It is skipped unless
`DEMAT_TEST_DATABASE_URL` is explicitly set, and rejects non-loopback hosts. Use a disposable local
Supabase database only; the fixture user and its 502 records are removed after the test.
