# Row-level security policies

## Existing tables

The `20261031100000_auth_profiles_rls.sql` migration creates:

- `profiles.id`, a primary key and cascading foreign key to `auth.users.id`.
- `user_preferences.user_id`, a primary key and cascading foreign key to `auth.users.id`.
- `created_at` and trigger-maintained `updated_at` timestamps on both tables.

The `20261031120000_demat_accounts_rls.sql` migration adds:

- `demat_accounts`, owned by `user_id` with an `auth.users(id) ON DELETE CASCADE` foreign key.
- `account_imports` and `account_import_rows`, owner-scoped import history and row reports.
- `user_demat_account_capacity`, a private capacity counter with no client privileges.
- Forced RLS and authenticated-only, owner-scoped policies on the user-facing tables; the counter
  has forced RLS and is maintained only by its fixed trigger function.
- Column-scoped insert/update grants. Account deletion is permitted only for an archived row.
- A database trigger enforcing the 500 unarchived, active-account limit and a unique index on the
  normalized masked identifier per user and depository.

Import rows inherit ownership from their import record. Confirmation/reversal use narrowly scoped
`SECURITY DEFINER` RPCs with an empty `search_path`, explicit `auth.uid()` ownership checks, and
fixed operations. Authenticated clients cannot directly update import states or result links; the
API invokes these functions with the caller's verified JWT and never uses a service-role client.

RLS is enabled and forced on both tables. Authenticated users can select only their own rows and
update only permitted profile/preference columns when the row owner matches `auth.uid()`. There
are no insert or delete policies: an Auth database trigger creates rows, and auth-user deletion
cascades them. Grants are restricted to authenticated users and the columns required for updates.
Anonymous users have no table privileges.

## Database verification

Run `supabase start` followed by `npm run test:security:db`. The pgTAP suites execute as the
`authenticated` database role with User A's and User B's JWT subject claims and verifies actual
PostgreSQL RLS behavior, including cross-user reads, updates, and deletes, account lifecycle,
duplicate, capacity, and import behavior. Do not infer RLS safety from a client-side check or an
API unit test.

The simultaneous-capacity test is separate because it needs two concurrent PostgreSQL
transactions. Set `DEMAT_TEST_DATABASE_URL` only to a disposable loopback test database and run
`npm run test:integration:accounts`; the test refuses non-loopback hosts and removes its fixture
user after running.

## Requirements for future tables

Every additional user-owned table must:

- Have a non-null foreign key to `auth.users(id)` and an intentional deletion/cascade policy.
- Enable and force RLS.
- Define operation-specific owner policies using `auth.uid()`; updates need both `USING` and
  `WITH CHECK`.
- Grant only needed privileges and columns. No broad grants, public policies, or service-role
  substitutes for user-context access.
- Include two-user SQL tests that attempt unauthorized read/update/delete and owner changes.
- Keep database access in the API adapter and pass the verified caller JWT with the anon key.
