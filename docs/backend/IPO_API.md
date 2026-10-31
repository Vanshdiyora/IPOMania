# IPO API

All routes require a verified Supabase bearer token and use the caller JWT with the project anon
key for database operations. User IDs are derived from Auth, never accepted from the request.
Responses use `{ data }` or `{ error: { code, message } }`.

| Method and path | Behavior |
| --- | --- |
| `GET /api/ipos` | Search/filter the caller's IPOs; paginated by `page` and `page_size` (maximum 100). |
| `POST /api/ipos` | Create a user-owned IPO. |
| `GET /api/ipos/:ipoId` | Read one owned IPO. |
| `PATCH /api/ipos/:ipoId` | Update a non-archived owned IPO. |
| `POST /api/ipos/:ipoId/archive` | Soft-archive an owned IPO. |
| `GET /api/ipos/:ipoId/categories` | Read all immutable category-rule versions for the owned IPO. |
| `POST /api/ipos/:ipoId/categories` | Add a validated issue-specific rule version. The database assigns its version. |
| `POST /api/quota/validate` | Validate a calculation without saving an audit record. |
| `POST /api/quota/calculate` | Calculate and save a reproducibility snapshot. |

IPO list filters include company search (or exact symbol), status, exchange, opening-date bounds,
and archive inclusion. Category POST bodies are strict structured objects; unknown fields and
invalid limit states are rejected.

Calculation inputs include `ipo_id`, owned `demat_account_id`, category, lots, `BID` or `CUT_OFF`
price type, decimal-string price, optional user-provided shareholder shares, and a map of explicit
condition confirmations. A demat account's ownership does not imply shareholder eligibility.

Important errors include `VALIDATION_ERROR` (400), `IPO_NOT_FOUND` and
`DEMAT_ACCOUNT_NOT_FOUND` (404), `DUPLICATE_IPO` (409), and validation codes in the calculation
result. Missing issue-specific category configuration returns a clear `CATEGORY_RULES_NOT_FOUND`
result rather than applying a default.
