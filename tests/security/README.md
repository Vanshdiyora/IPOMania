# Security tests

`api-auth.test.ts` exercises the protected Worker routes against a stubbed Supabase Auth endpoint.
It covers missing, rejected, and expired-token responses and verifies that client-supplied user IDs
do not select or update another account. The stub validates API behavior, not JWT cryptography.

`supabase/tests/rls_isolation.test.sql` creates two database users and executes reads, updates, and
deletes as the `authenticated` database role with each user's JWT subject claim. Run it against the
local Supabase database with `npm run test:security:db`; this exercises PostgreSQL policies rather
than frontend restrictions. A live local Supabase CLI/Docker environment is required.
