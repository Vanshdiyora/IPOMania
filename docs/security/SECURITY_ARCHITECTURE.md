# Security architecture

## Trust boundaries

1. Supabase Auth is the credential store and issuer of user sessions. The browser contains only the
   public anon key and the signed-in user's session.
2. The Hono Worker requires a bearer token on protected routes. It calls Supabase Auth
   `auth.getUser(token)` and uses the returned identity, not decoded request data.
3. Ordinary database requests use the anon project key and forward the verified caller's bearer
   token to PostgREST. PostgreSQL RLS is the final ownership boundary for profiles, preferences,
   demat accounts, and import records.
4. The service-role key is not available to the browser or ordinary route handlers. Its only use
   is the account-deletion handler, which deletes the authenticated caller ID returned by the
   verification middleware and accepts no target user ID from the client.

## Controls

- Zod validates API request bodies; the profile update contract does not accept `user_id`.
- Authentication failures return generic structured errors. API logs contain only error names,
  HTTP methods, and paths, never credentials, bearer tokens, or request bodies.
- Password recovery does not disclose whether an email is registered.
- PKCE callback codes are exchanged in the browser and query strings are cleared immediately.
- Profile and preferences tables have RLS enabled and forced, owner-scoped select/update policies,
  and no delete policies. Account cleanup occurs through the auth-user foreign-key cascade.
- Demat account and import tables have forced owner RLS. The private capacity-counter table has
  forced RLS and no client grants. Only archived accounts can be deleted.
  Active membership is serialized and capped in the database. Import confirmation and reversal
  use narrow `SECURITY DEFINER` RPCs with an empty search path and explicit `auth.uid()` ownership
  checks; direct clients cannot update import state or results.
- XLSX parsing uses the patched `@e965/xlsx` fork rather than the unmaintained, advisory-affected
  `xlsx` package. Upload size, file type, row count, column count, and row content are bounded and
  validated.
- CORS allows the configured web origin and the explicit local development origins. CORS is not an
  authorization mechanism; every protected handler still verifies the bearer token.

## Operational requirements and residual risks

Do not treat passing mocked API tests as JWT cryptographic verification or passing SQL tests as a
production security certification. Before launch, configure and test the production Supabase URL,
issuer/audience settings, email delivery, redirect allowlist, HTTPS, rate limits, bot protection,
monitoring, backups, and secret rotation. Review browser XSS protections because the Supabase SDK
persists sessions in browser storage by default. Require an appropriate reauthentication policy
for destructive account actions if product risk warrants it.

The dependency audit gate (`npm audit --audit-level=high`) passes with no high or critical
advisories. Runtime and tooling dependencies were upgraded to remediate the previous findings:
Zod 4, Hono 4.13, Wrangler 4, React Router 7, Vite 7, and Vitest 4. The remaining advisories are
moderate or low and are confined to development tooling (ESLint's legacy `minimatch`/`glob` chain
and Drizzle Kit's esbuild loader) where no upstream fix is available yet. Re-run the audit when
those projects publish fixes; do not suppress findings without review.

The service-role account-deletion integration is intentionally privileged. Keep it restricted to
that handler, do not add it to user-scoped database helpers, and review its access whenever the
handler changes.
