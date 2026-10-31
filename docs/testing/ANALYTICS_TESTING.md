# Dashboard analytics testing

## Unit and API tests

Run the focused schema and authenticated API/export checks:

```powershell
npm test -- --run tests/unit/dashboard-validation.test.ts tests/security/analytics-api.test.ts
```

These tests cover date/filter boundaries, rejecting caller-supplied owner IDs, forwarding the
verified caller JWT to the RPC, empty results, decimal-string preservation, CSV formula escaping,
Excel workbook content, and CORS exposure of the download filename. They use mocked HTTP/database
responses and do not prove PostgreSQL behavior.

## PostgreSQL and RLS tests

`supabase/tests/dashboard_analytics.test.sql` exercises the migration function as multiple
authenticated users. It checks user isolation, IPO/category/date filters, inclusive date boundaries,
empty results, unavailable success-rate semantics, exact numeric aggregation, and a 5,000-row
aggregate case.

Run with:

```powershell
npm run test:security:db
```

This requires the local Supabase CLI and Docker. It validates SQL correctness and data isolation;
the 5,000-row case is not a wall-clock performance benchmark. No live Supabase project is used by
unit or browser tests.

## Browser and responsive checks

Run the dashboard E2E tests with:

```powershell
npm run test:e2e -- --grep dashboard
```

The browser tests cover authenticated dashboard rendering, filters, report download, accessible
labels/chart descriptions, analytics-error handling, unavailable metric display, and narrow-screen
horizontal overflow. Existing UI tests and checks are listed in
`docs/testing/FINANCIAL_TESTING.md` and `docs/testing/SECURITY_TESTING.md`.

## Performance and known verification limits

Dashboard totals and groupings are produced by one bounded PostgreSQL aggregation RPC rather than
loading application rows into the browser. The existing indexes on owner/date/status dimensions
are reused; this migration adds no index. The capital summary intentionally reuses the established
Phase 6 decimal reconciliation endpoint and its canonical financial engine. The latest local
5,000-row pgTAP run completed in 3 wall-clock seconds for the entire test file, including fixture
setup; this is not isolated RPC latency. No query-plan or production-scale latency benchmark is
claimed.
