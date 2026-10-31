# Capital ledger and financial ownership

Migration: `supabase/migrations/20261031160000_capital_management.sql`.

## Tables

- `applications` stores immutable, manually recorded application terms copied from an eligible,
  owner-scoped quota calculation. Composite foreign keys bind the record to the same user's IPO,
  account, category configuration, and calculation.
- `mandates` stores user-entered UPI mandate references and manually managed statuses. A database
  trigger permits only documented transitions.
- `allotments` stores the current full/partial/not-allotted result and expected refund. Each update
  writes its prior and new values into append-only `allotment_history`.
- `capital_ledger` stores immutable, append-only financial events using `NUMERIC(38,6)`.

All user-owned tables reference `auth.users`, enable and force RLS, and have owner-scoped policies.
The API derives `user_id` from the verified Supabase Auth user and sends the caller JWT with the
project anon key. It never uses the service-role key for user financial records.

## Ledger constraints

Every event has an owner, optional application, transaction type, positive amount, three-letter
currency, effective and created timestamps, source, audit reference, and idempotency key. Listing
sales and price updates also require a positive quantity and unit price, with `amount = quantity ×
unit_price`. Adjustments require a debit/credit direction.

Unique constraints reject repeated per-user idempotency keys and repeated source/type/audit
references. A `BEFORE INSERT` trigger serializes balance-sensitive events, validates application,
allotment, refund, and sale bounds, and records how much an actual debit consumes from blocked
capital. `APPLICATION_RECORDED` and `MANDATE_APPROVED` ledger entries are generated as
informational events by database triggers; they are never cash debits. Refund status is refreshed
after a refund receipt.

Authenticated clients may select and insert manual ledger rows, but cannot update/delete ledger
history, choose `SYSTEM`/`AUTHORIZED_INTEGRATION` sources, or write the internal
`blocked_consumed` value. Future integrations require a separately authorized database path.

## Reconciliation

`packages/financial-engine/src/capital.ts` calculates summaries using decimal arithmetic from
these persisted rows. Per currency:

- Blocked = capital blocks − explicit releases − blocked amounts consumed by actual debits.
- Released = explicit capital releases only.
- Net actual invested = actual debits + adjustment debits − refunds − adjustment credits.
- Outstanding refunds = expected allotment refunds − refund receipts per application.
- Realized P&L = sale proceeds − sold shares × allotment price.
- Unrealized P&L = remaining shares × (latest recorded listing price − allotment price); it is
  `null` if an open position has no listing valuation.

`ALLOTMENT_DEBIT` is retained as allocation audit information and is excluded from cash invested
capital to avoid counting the same allocation twice.

## RLS verification

`supabase/tests/capital_management.test.sql` contains direct two-user pgTAP checks for forced RLS,
owner-bound foreign keys, manual mandate transition constraints, allotment validation, partial
allocation/refund behavior, ledger immutability, duplicate-event rejection, and blocked/debit
separation. Run with `supabase test db` against local PostgreSQL.
