# Row-level security policies

## Existing tables

The `20261031100000_auth_profiles_rls.sql` migration creates:

- `profiles.id`, a primary key and cascading foreign key to `auth.users.id`.
- `user_preferences.user_id`, a primary key and cascading foreign key to `auth.users.id`.
- `created_at` and trigger-maintained `updated_at` timestamps on both tables.

RLS is enabled and forced on both tables. Authenticated users can select only their own rows and
update only permitted profile/preference columns when the row owner matches `auth.uid()`. There
are no insert or delete policies: an Auth database trigger creates rows, and auth-user deletion
cascades them. Grants are restricted to authenticated users and the columns required for updates.
Anonymous users have no table privileges.

## Database verification

Run `supabase start` followed by `npm run test:security:db`. The pgTAP suite executes as the
`authenticated` database role with User A's and User B's JWT subject claims and verifies actual
PostgreSQL RLS behavior, including cross-user reads, updates, and deletes. Do not infer RLS safety
from a client-side check or an API unit test.

## Requirements for future tables

Every user-owned table must:

- Have a non-null foreign key to `auth.users(id)` and an intentional deletion/cascade policy.
- Enable and force RLS.
- Define operation-specific owner policies using `auth.uid()`; updates need both `USING` and
  `WITH CHECK`.
- Grant only needed privileges and columns. No broad grants, public policies, or service-role
  substitutes for user-context access.
- Include two-user SQL tests that attempt unauthorized read/update/delete and owner changes.
- Keep database access in the API adapter and pass the verified caller JWT with the anon key.
