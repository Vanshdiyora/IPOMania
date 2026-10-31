# Security testing

## API tests

`tests/security/api-auth.test.ts` stubs the Auth HTTP endpoint and verifies protected-route handling
for missing, invalid, and expired bearer tokens, as well as ignored/invalid client-supplied user
IDs. These tests validate middleware and route behavior only; a stubbed Auth response is not a
cryptographic JWT test.

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

## Full verification and limits

Before proposing a change, run the repository's format check, lint, type-check, unit/integration
tests, web build, and Worker build. Run the direct RLS suite as well when database policies change.
Record exact results. The local RLS test does not verify a hosted project's auth configuration,
email delivery, production keys, deployed Worker, or CI status.
