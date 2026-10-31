# Unit and component testing

## Commands

```powershell
npm test
npm run test:ui
npm run test:coverage
```

Vitest uses Node by default; component tests opt into jsdom with
`// @vitest-environment jsdom`. `tests/setup.ts` installs `@testing-library/jest-dom` and cleans up
React trees after each test. Coverage uses the V8 provider and reports text and HTML; it does not
set a repository-wide percentage threshold while legacy coverage baselines are unknown.

## Conventions

- Test observable behavior and public contracts; avoid implementation details and production code
  changes solely to make tests pass.
- Use `tests/helpers/factories.ts` for synthetic financial inputs. Factories compose existing
  financial-engine types and do not implement calculations.
- Use Testing Library role/name queries and `user-event` for keyboard and interaction tests.
- Keep database, network, and system time deterministic unless the test explicitly exercises them.
- Label tests that mock Supabase/Auth as contract tests, not integration/RLS proof.

The current UI tests exercise keyboard focus, a WCAG 2.2 AA axe scan, and safe rendering of
user-provided text. The financial regression test uses `calculateCapitalSummaries` directly to
assert exact decimal balances for a partial allotment, blocked and actual debit, allotment debit,
and refund.
