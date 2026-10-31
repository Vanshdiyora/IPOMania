# Security testing

## API tests

`tests/security/api-auth.test.ts` stubs the Auth HTTP endpoint and verifies protected-route handling
for missing, invalid, and expired bearer tokens, as well as ignored/invalid client-supplied user
IDs. These tests validate middleware and route behavior only. The local API integration checks also
sent missing and invalid tokens and a correctly signed expired token through the running Worker and
local Supabase Auth service.

Run with `npm test`.

## Direct database RLS tests

Install Docker and the Supabase CLI, then run:

```powershell
supabase start
npm run test:security:db
```

`supabase/tests/rls_isolation.test.sql` creates two independent Auth users and runs profile and
preference operations as the `authenticated` PostgreSQL role with each user's subject claim. This
tests the actual policies, not just frontend restrictions. The test rolls back its fixture data.
The suite passed locally with 19/19 pgTAP assertions.

## Local Auth and API integration

The local Supabase Auth + Mailpit flow was exercised for registration, email confirmation,
password login, password recovery/reset, password change, session restore, logout, profile access,
and Auth account deletion. The local Worker was exercised with two users for profile read/update,
forged `user_id` rejection, token rejection, and account deletion. These checks do not modify the
hosted Supabase project.

## Full verification and limits

Before proposing a change, run the repository's format check, lint, type-check, unit/integration
tests, web build, and Worker build. Run the direct RLS suite as well when database policies change.
Record exact results. The local RLS test does not verify a hosted project's auth configuration,
email delivery, production keys, deployed Worker, or CI status.
