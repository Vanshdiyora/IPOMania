# Dashboard analytics API

## Endpoints

Both endpoints require a Supabase bearer token verified by the Worker. The database adapter uses
the caller's JWT with the project anon key; the request never accepts a `user_id`.

| Method and path                              | Behavior                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /api/analytics`                         | Return bounded dashboard aggregates from `get_dashboard_analytics`.                                               |
| `GET /api/analytics/export?format=csv\|xlsx` | Export the same filtered aggregates as a formula-safe CSV or a multi-sheet Excel workbook.                        |
| `GET /api/capital/summary`                   | Reuse the Phase 6 decimal financial engine for per-currency blocked, invested, refund, and listing-P&L summaries. |

Analytics filters are `date_from`, `date_to` (inclusive ISO calendar dates), `ipo_id`, `category`
(`RETAIL`, `SHNI`, `BHNI`, or `SHAREHOLDER`), `account_id`, and `limit` (default 10, maximum 50).
Unknown query parameters are rejected. A two-sided date range cannot exceed 10 years. IPO,
demat-account, and category filters are applied to application, allotment, refund, and
application-linked ledger aggregates. The date range applies to application `created_at` and ledger
`effective_at` in UTC. Current active-account and tracked-IPO inventory counts are not affected by
application/date filters. Upcoming IPOs are selected from the caller's active records whose status
is `UPCOMING` or `OPEN` and whose closing date has not passed.

The IPO, account, and broker charts return the top `limit` groups. Recent activity and upcoming IPO
lists are bounded by the same limit. The dashboard loads its filter options with the existing
paginated IPO and account endpoints rather than downloading records for aggregation.

## Aggregation and financial semantics

`supabase/migrations/20261031170000_dashboard_analytics.sql` adds the invoker-rights PostgreSQL
function `public.get_dashboard_analytics`. It performs grouping, counts, and per-currency `NUMERIC`
sums in the database, returns financial values as decimal strings, and applies explicit `auth.uid()`
predicates in addition to forced RLS. Application breakdowns use counts only, avoiding the addition
of application amounts across currencies. Execute permission is limited to `authenticated`; no new
table or index is introduced. Existing owner/date/status indexes support the filtered queries.

Capital ledger trends and gross debit totals keep each currency separate and report `CAPITAL_BLOCKED`,
`CAPITAL_RELEASED`, `ACTUAL_DEBIT`, and `REFUND_RECEIVED` as distinct event types. They do not add
blocked amounts, actual debits, or `ALLOTMENT_DEBIT` together. Current blocked capital,
outstanding refunds, completed refund receipts, and listing P&L are sourced from the existing
`/api/capital/summary` endpoint and `calculateCapitalSummaries`; Phase 7 does not duplicate that
financial reconciliation logic. Missing ledger evidence or listing valuations is shown as
unavailable, not as a fabricated zero. The dashboard does not convert currencies.

The CSV and Excel exports contain aggregated reports only. CSV cells and spreadsheet strings that
could be interpreted as formulas are escaped. Excel is generated in the Worker using the existing
XLSX dependency. CORS exposes `Content-Disposition` so the browser can use the provided download
filename.

## Error behavior and verification

Invalid filters return the standard `400 VALIDATION_ERROR`. Authentication, internal database
errors, and RLS remain on the existing structured error path. Responses include no owner IDs from
other records, account credentials, tokens, or database error details.

Unit and mocked API checks are in `tests/unit/dashboard-validation.test.ts` and
`tests/security/analytics-api.test.ts`. Direct PostgreSQL aggregation and two-user checks are in
`supabase/tests/dashboard_analytics.test.sql`; run them with `npm run test:security:db` against local
Supabase. These SQL tests are distinct from the unit tests and must pass before claiming database
RLS verification.
