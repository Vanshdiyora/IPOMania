# Financial and lifecycle testing

## Independent fixtures

Financial unit tests use standalone synthetic records under `tests/unit/`; no live market values
or IPO data are used. `capital-calculations.test.ts` exercises decimal-safe summary arithmetic,
currency separation, blocked/released/debited capital, mandate-versus-debit semantics, outstanding
refunds, allocation cost, realized sales, missing valuation prices, and negative-balance
reconciliation failures. `capital-validation.test.ts` covers boundary request shapes, partial
allotments, event idempotency requirements, and listing proceeds arithmetic.

Run the focused suite with:

```powershell
npm test -- --run tests/unit/capital-calculations.test.ts tests/unit/capital-validation.test.ts tests/unit/financial-engine.test.ts
```

`tests/security/capital-api.test.ts` exercises caller-scoped API creation, strict ownership, list
filters, manual pending mandate creation, invalid status transition responses, application capture
from an owned eligible calculation, and duplicate ledger event conflicts.

## Database tests

`supabase/tests/capital_management.test.sql` tests actual PostgreSQL behavior under two authenticated
users, including forced RLS, application ownership, valid/invalid transitions, partial allotment,
refund status, idempotency uniqueness, and ledger immutability. Run:

```powershell
npm run test:security:db
```

Database tests require the local Supabase CLI and Docker. Unit/API tests do not prove RLS behavior.

## Invariants under test

- Mandate approval is manual and never creates an actual debit.
- Blocked capital and actual invested capital are separate balances.
- An actual debit consumes its matching blocked balance once; a release is counted only as a
  release, and an allotment debit is not added to cash investment again.
- Refund receipts cannot exceed the expected refund or actual cash debited above allocation cost.
- Allotment lots/shares/price are checked against the saved application and IPO lot/price rules.
- Sale quantities cannot exceed allotted shares; P&L requires allocation and price evidence.
- Repeated ledger idempotency keys never insert a second row; conflicting audit events are reported.
- Summary functions fail explicitly on inconsistent negative balances rather than masking them.
