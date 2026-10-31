# Quota engine

## Package and dependencies

`packages/financial-engine` is a transport-independent package. It depends on `decimal.js` and
does not import the API, web app, database, or validation package. Its functions calculate shares,
amounts, lot boundaries, price validity, category rules, shareholder criteria, and finite maximum
lots. Inputs are explicit issue and rule snapshots; there are no hard-coded category limits.

## API workflow

Protected routes use Supabase Auth to verify the bearer token and forward the same caller JWT with
the anon project key. The API derives the owner from the verified identity and checks the selected
IPO and demat account under that RLS context.

- `POST /api/quota/validate` validates and calculates without persisting an audit record.
- `POST /api/quota/calculate` performs the same calculation and persists its input and result
  snapshots.

Both require an owned IPO, an active owned demat account, a category, lots, price type and price,
plus explicit shareholder/condition inputs. `UNCONFIGURED` issue rules fail closed with
actionable validation errors.

The calculation response returns the formula inputs, shares, decimal amount, rule version,
eligibility verification state, and error list. User-supplied shareholder and condition data is
never marked independently verified.

## Rule versioning and snapshots

Each category change inserts a new rule row. A database trigger serializes version assignment by
owner, IPO, and category. Rules cannot be updated or deleted by authenticated clients. The
calculation audit stores a complete JSON object containing the pricing inputs and selected rule
row, as well as a result object and database timestamp. The audit table has forced RLS and a
composite owner/account reference, so one user's private inputs cannot be linked to another user's
demat account.

## Failure handling

Invalid external input is rejected with a structured `VALIDATION_ERROR`. Missing or unowned IPOs
and accounts receive non-disclosing 404 responses. Business-rule failures are returned as
specific validation codes and messages. Unexpected database errors flow through the API's
structured internal-error handler; stack traces and credentials are not returned.

## Testing boundary

Unit tests cover all four category codes, decimal precision, category and limit boundaries,
invalid price/lot input, shareholder failures, issue-specific attestations, and historical
reproducibility. API tests verify owner derivation, account scoping, rule version selection, and
audit contents. Two-user pgTAP tests exercise the actual database RLS policies.
