# Multi-user isolation

## Ownership rule

The verified Supabase `auth.users.id` is the canonical owner. Every user-owned row must contain a
non-null owner foreign key to `auth.users(id)` with `ON DELETE CASCADE`. Never take an owner ID
from a request body, query parameter, or route parameter; derive it from the verified request
identity. Enforce ownership in both route filters and PostgreSQL RLS.

The current profile is keyed by `profiles.id`; preferences are keyed by `user_preferences.user_id`.
The authenticated user's verified bearer token is forwarded to PostgREST with the anon project
key, so `auth.uid()` is populated for the database policies. Service-role access bypasses this
boundary and is forbidden for normal user requests.

Demat accounts use `demat_accounts.user_id`; imports use the same owner key and import rows inherit
ownership through their `account_imports` parent. Account and import API filters include the
verified owner as defense in depth, and forced PostgreSQL RLS remains authoritative. The active
capacity trigger atomically updates a private counter row for the verified owner; clients cannot
read or modify that counter directly.

## Adding another user-owned table

1. Add a non-null `user_id uuid references auth.users(id) on delete cascade` (or use the auth ID as
   the primary key for a one-to-one table).
2. Enable and force RLS. Add narrowly scoped policies for each operation. At minimum, both `USING`
   and `WITH CHECK` for updates must bind the owner to `auth.uid()`.
3. Grant only the table/column privileges needed by the client. A grant is not a substitute for an
   RLS policy.
4. Use the caller-token/anon-key database adapter. Do not query with a service-role client.
5. Add SQL tests with two distinct users for read, update, and delete isolation, including an
   attempt to alter ownership. Add API validation and authorization tests for any route.
6. Document data retention and cascade behavior.

## Verified tests

`supabase/tests/rls_isolation.test.sql` creates User A and User B, assumes the `authenticated`
database role, sets each user's JWT subject claim, and executes profile/preferences reads, updates,
and delete attempts directly against PostgreSQL. Run it with `npm run test:security:db` against a
running local Supabase stack. These database-policy tests are separate from frontend route guards
and mocked API middleware tests.
