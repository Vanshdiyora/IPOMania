# Security policy

## Supported scope

The active development branch is the only supported branch during this implementation phase.

## Reporting a vulnerability

Please do not publish credentials or exploit details in public issues. Report suspected security
issues privately to the repository maintainers through GitHub's private vulnerability reporting
feature, if enabled, or contact the maintainers directly. Include the affected component, impact,
and safe reproduction details.

## Security notes

- Never commit secrets, `.env` files, `.dev.vars`, service-role keys, or production connection
  strings.
- Supabase Auth owns all credentials. The frontend receives only the public anon key; the service
  role key is a Worker secret restricted to account deletion using the verified caller ID.
- The health endpoint exposes only application status, API version, and a non-secret environment
  label.
- Protected API routes verify bearer tokens with Supabase Auth. RLS-protected operations preserve
  the caller's JWT context and use the anon project key; service-role credentials must not be used
  as a substitute.
- Profiles and preferences have owner-scoped RLS policies. Direct database isolation tests are in
  `supabase/tests/rls_isolation.test.sql`.
- CI runs `npm audit --audit-level=high`. Dependency audit output should be triaged and resolved
  rather than suppressed without review.
- Phase 2 checks and unresolved production risks are documented in
  [security testing](./docs/testing/SECURITY_TESTING.md) and
  [security architecture](./docs/security/SECURITY_ARCHITECTURE.md). This is not a security
  certification or production-readiness claim.
