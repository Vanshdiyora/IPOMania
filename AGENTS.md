# Repository guidance

## Phase boundary

Phase 4 implements the approved user-owned IPO management and issue-specific quota calculator,
and also permits the separately approved admin-managed IPO synchronization module requested for
IPO Mania. This authorization overrides the previous shared-catalog restriction; implement shared
admin-managed IPO master data without using fabricated market data or investment advice. Phase 3
local database/RLS, concurrency, and repository-wide formatting verification remains open; do not
describe that gate as passed. Preserve existing user-owned IPO behavior and existing application
workflows. Do not proceed to investment advice or IPO application submission/allotment behavior
unless it is separately approved.

## Engineering conventions

- Use strict TypeScript and preserve package boundaries: `shared` has no app dependencies;
  `validation` may depend on validation libraries; `financial-engine` must not depend on apps or API.
- Keep API transport, environment parsing, and database adapters in `workers/api/`.
- Validate all external input at the boundary with Zod. Use structured API errors and do not return
  stack traces, secrets, or connection strings to clients.
- For RLS-protected operations, use the caller's verified Supabase JWT with the project anon key.
  Never substitute a service-role key for a user's context; isolate privileged operations and bind
  them to the verified caller.
- Preserve the fixed light palette and accessible focus and touch-target styles. Do not introduce
  system theme detection, dark mode, or theme toggles.
- Add unit tests for changed logic. Add integration, security, and E2E tests when the relevant
  behavior or service is implemented.
- Keep documentation accurate and update relevant docs with code changes.
- Add owner foreign keys, forced RLS, least-privilege grants, and direct two-user SQL tests for each
  new user-owned table. Derive ownership from verified identity, never request-supplied IDs.

## Before opening a change

Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:web`,
and `npm run build:api`. Do not claim a check passed unless it was run.
