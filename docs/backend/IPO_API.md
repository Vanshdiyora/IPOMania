# IPO API

All routes require a verified Supabase bearer token and use the caller JWT with the project anon
key for database operations. User IDs are derived from Auth, never accepted from the request.
Responses use `{ data }` or `{ error: { code, message } }`.

| Method and path                                  | Behavior                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/ipos`                                  | Return the caller's personal IPOs by default; `source=all` can include active shared catalog IPOs.                            |
| `GET /api/ipos/catalog`                          | Read active admin-managed IPOs shared with users; paginated, searchable by company or exact symbol, and filterable by status. |
| `GET /api/ipos/catalog/:ipoId`                   | Read one active shared IPO, including incomplete issue data.                                                                  |
| `GET /api/ipos/catalog/:ipoId/categories`        | Read all published shared category-rule versions for an active catalog IPO.                                                   |
| `POST /api/ipos/catalog/:ipoId/import`           | Copy complete shared issue data and the latest shared category rules into a private application snapshot.                     |
| `POST /api/ipos`                                 | Reject user-submitted IPO creation with `403`; shared catalog creation is handled by the admin API.                           |
| `GET /api/ipos/:ipoId`                           | Read one owned IPO.                                                                                                           |
| `PATCH /api/ipos/:ipoId`                         | Update a non-archived owned IPO.                                                                                              |
| `POST /api/ipos/:ipoId/archive`                  | Soft-archive an owned IPO.                                                                                                    |
| `GET /api/ipos/:ipoId/categories`                | Read all immutable category-rule versions for the owned IPO.                                                                  |
| `POST /api/ipos/:ipoId/categories`               | Add a validated issue-specific rule version. The database assigns its version.                                                |
| `GET /api/admin/ipos/catalog/:ipoId/categories`  | Read shared category-rule versions; administrators only.                                                                      |
| `POST /api/admin/ipos/catalog/:ipoId/categories` | Add a source-backed shared rule version; administrators only.                                                                 |
| `POST /api/quota/validate`                       | Validate a calculation without saving an audit record.                                                                        |
| `POST /api/quota/calculate`                      | Calculate and save a reproducibility snapshot.                                                                                |
| `POST /api/capital/applications`                 | Record an owned application from an eligible saved calculation; does not submit it.                                           |
| `GET /api/capital/applications`                  | List capital-tracked applications with IPO/account/date filters.                                                              |
| `GET /api/mandates`                              | List owned mandates with IPO/account/category/date/status filters.                                                            |
| `POST /api/mandates`                             | Record a pending UPI mandate; never initiates or approves a payment.                                                          |
| `PATCH /api/mandates/:mandateId`                 | Manually update a mandate using validated state transitions.                                                                  |
| `GET /api/allotments`                            | List owned allotments and refund state with issue/account/date filters.                                                       |
| `POST /api/allotments`                           | Record a full, partial, or no-allotment result against an application.                                                        |
| `PATCH /api/allotments/:id`                      | Update current allotment data; prior values are retained in audit history.                                                    |
| `GET /api/capital/summary`                       | Read reconciled per-currency financial summaries.                                                                             |
| `GET /api/capital/ledger`                        | List immutable financial events with filters and pagination.                                                                  |
| `POST /api/capital/ledger`                       | Record a manual, idempotent financial event with an audit reference.                                                          |

IPO list filters include company search (or exact symbol), status, exchange, opening-date bounds,
and archive inclusion. Category POST bodies are strict structured objects; unknown fields and
invalid limit states are rejected. Category rules require `default_lots`, which is checked against
the configured minimum, maximum, and increment. The IPO's `lot_size` is its shares-per-lot value.

`GET /api/ipos` returns personal records by default, with `data.pagination`; `source=all` merges
the caller's personal records with active shared catalog records, and `source=catalog` returns
only shared records. Shared metadata remains available in `data.catalog` with
`data.catalog_pagination`. Each collection uses the same page and page-size parameters and
relevant search/status/exchange/date filters. The dedicated
`GET /api/ipos/catalog` endpoint remains available for callers that only need shared catalog
records. Both endpoints use the caller's verified JWT; catalog list entries expose normalized
summary fields needed for browsing (name, status, dates, prices, lot size, and source metadata),
while the catalog detail endpoint provides the full available issue record.

The shared catalog accepts `page`, `page_size` (maximum 100), `search`, and uppercase `status`
(`UPCOMING`, `OPEN`, `CLOSED`, or `LISTED`). It always excludes archived entries, including when
the caller is an admin, and orders by opening date, company name, then ID. Responses use the same
normalized issue field names as personal IPOs, with uppercase statuses and decimal-string prices;
unpublished dates, amounts, symbols, exchanges, and lot sizes remain null. `IPO_GURU` source
attribution and the last synchronization timestamp are retained. Shared catalog IDs are separate
from user-owned IPO IDs and cannot be used directly for application calculations. Admin-managed
category rules are append-only and source-backed. The import endpoint copies only the latest shared
rule for each category into the user's owned IPO; later imports add newer shared rule versions
without changing existing snapshots. Required issue data is never invented: an incomplete shared
IPO returns `IPO_DATA_INCOMPLETE` (422), and a personal IPO with the same symbol returns
`DUPLICATE_IPO` (409).

The user IPO list shows the shared catalog only. Regular users cannot create catalog records through
`POST /api/ipos`; the endpoint returns `403`, and administrators create catalog entries through the
admin IPO API. Private IPO snapshots remain application data and are created from catalog issues
when needed for application tracking. From shared IPO details, **Use for application** imports a
caller-owned snapshot and its current category rules, then opens the normal application form. This
private snapshot preserves the existing owner-bound calculation and
application audit constraints while the shared catalog remains the issue-data source of truth.

The application form's IPO selector includes existing personal snapshots and active shared catalog
IPOs. Selecting a shared IPO uses its catalog lot size and maximum price locally for an editable,
live amount preview; no import request is made at selection. When the user saves, the current
catalog issue and category rule are copied into the caller-owned audit snapshot and validated on
the server before the application is created.

Calculation inputs include `ipo_id`, owned `demat_account_id`, category, lots, `BID` or `CUT_OFF`
price type, decimal-string price, optional user-provided shareholder shares, and a map of explicit
condition confirmations. A demat account's ownership does not imply shareholder eligibility.

Important errors include `VALIDATION_ERROR` (400), `IPO_NOT_FOUND` and
`DEMAT_ACCOUNT_NOT_FOUND` (404), `DUPLICATE_IPO` (409), and validation codes in the calculation
result. Missing issue-specific category configuration returns a clear `CATEGORY_RULES_NOT_FOUND`
result rather than applying a default.

Application records can be created only from the caller's saved, eligible quota calculation.
Mandate approval is manual and informational; it does not imply a cash debit. Ledger event
replays with an identical idempotency key return the existing event; conflicting repeats return
`409`. Database constraints enforce allotment quantities, issue prices, refund limits, and ledger
balances. See [mandate management](../product/MANDATE_MANAGEMENT.md),
[allotment management](../product/ALLOTMENT_MANAGEMENT.md), and
[capital management](../product/CAPITAL_MANAGEMENT.md).
