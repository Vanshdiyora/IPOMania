# Capital management

## Financial record lifecycle

1. The user saves an eligible quota calculation as a manual application record. No application is
   submitted externally.
2. The user may record a pending UPI mandate and manually update its status.
3. Separate ledger events record capital blocks, releases, actual debits, allotment debits, refunds,
   listing sales, listing valuations, and classified adjustments.
4. The user records allotment results and expected refunds. Refund completion follows actual
   `REFUND_RECEIVED` ledger events.

All values use PostgreSQL `NUMERIC` and decimal strings at the API boundary. Each currency is
summarized separately; the system does not convert currencies. Applications are initially recorded
in INR. Ledger entries are immutable and include an effective timestamp, source, audit reference,
and per-user idempotency key.

## Event semantics

- `APPLICATION_RECORDED` and `MANDATE_APPROVED` are informational events. Neither is a cash debit.
- `CAPITAL_BLOCKED` increases the held amount. `CAPITAL_RELEASED` reduces it.
- `ACTUAL_DEBIT` increases actually invested capital and consumes any matching outstanding block
  before adding to invested funds.
- `ALLOTMENT_DEBIT` records allocation cost for audit purposes; it is not counted again as a cash
  debit.
- `REFUND_RECEIVED` reduces net actually invested capital and outstanding refunds.
- `LISTING_SALE` records proceeds, quantity, and unit price.
- `LISTING_PRICE_UPDATE` records a valuation for all currently held shares. It is not a cash flow.
- `ADJUSTMENT` requires an explicit `DEBIT` or `CREDIT` direction.

Posting the same idempotency key and same event returns the existing event. Reuse with different
values, or a duplicate source/audit/type reference, returns a conflict. Events cannot be updated or
deleted; corrections are new, audited adjustments.

## Interfaces

- `/capital` displays per-currency financial summaries.
- `/capital/transactions` shows ledger history and provides manual event entry.
- `/capital/refunds` shows expected versus received refunds.
- `GET /api/capital/summary` calculates summaries from owner-scoped applications, mandates,
  allotments, and ledger rows.
- `GET /api/capital/ledger` lists immutable events with IPO, account, broker, category, and date
  filters. `POST /api/capital/ledger` records manual events with strict validation and idempotency.

Do not treat an approved mandate as a completed debit. Listing P&L requires a valid allotment,
share quantity, and a listing sale or valuation price. No investment advice, promise of
allocation, or external order/payment action is provided.
