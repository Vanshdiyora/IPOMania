# Repository guidance

## Phase boundary

Phase 1 is project foundation only. Do not add IPO workflows, real or simulated authentication,
business tables, investment advice, or fabricated market data without an approved later-phase task.

## Engineering conventions

- Use strict TypeScript and preserve package boundaries: `shared` has no app dependencies;
  `validation` may depend on validation libraries; `financial-engine` must not depend on apps or API.
- Keep API transport, environment parsing, and database adapters in `workers/api/`.
- Validate all external input at the boundary with Zod. Use structured API errors and do not return
  stack traces, secrets, or connection strings to clients.
- For future RLS-protected database operations, use the caller's verified Supabase JWT with the
  project anon key. Never substitute a service-role key for a user's context.
- Preserve the fixed light palette and accessible focus and touch-target styles. Do not introduce
  system theme detection, dark mode, or theme toggles.
- Add unit tests for changed logic. Add integration, security, and E2E tests when the relevant
  behavior or service is implemented.
- Keep documentation accurate and update relevant docs with code changes.

## Before opening a change

Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:web`,
and `npm run build:api`. Do not claim a check passed unless it was run.
