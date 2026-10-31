# Allotment and refund management

## Scope

Allotments are manually recorded outcomes for a saved application. They are not submitted to an
exchange and are not predicted or automatically assigned. Values are checked against the
application snapshot and that IPO's issue configuration.

## Allotment values

- `ALLOTTED` requires the full requested number of shares and lots.
- `PARTIAL_ALLOTMENT` requires a positive quantity smaller than the requested quantity.
- `NOT_ALLOTTED` requires zero allotted lots/shares and no allotment price.
- Allotted shares must equal allotted lots multiplied by the IPO lot size.
- Allotment price must be within the issue price range and cannot exceed the recorded application
  bid price.
- Expected refund cannot exceed the application value less the value of the recorded allocation.

An application has at most one current allotment record. Updates retain before/after snapshots in
`allotment_history`. Allocation terms become immutable after debit, refund, sale, or valuation
events so past cost basis and P&L cannot be rewritten.

## Refund tracking

`refund_amount` is the expected refund. `refund_status` is database-derived:

- `NOT_REQUIRED` when expected refund is zero.
- `PENDING` while an expected refund remains outstanding.
- `COMPLETED` when matching `REFUND_RECEIVED` ledger entries cover the expected refund.

A refund receipt is accepted only when supported by actual debit entries and when it does not
exceed either the expected refund or the amount debited above the allotment cost. A released UPI
block is recorded as `CAPITAL_RELEASED`, not as a cash refund.

## Interfaces

The dashboard, detail, and refund tracker pages are `/allotments`, `/allotments/:allotmentId`, and
`/capital/refunds`. The API supports `GET`/`POST /api/allotments` and
`PATCH /api/allotments/:allotmentId`, with IPO, account, broker, category, date, status, and refund
status filters on list reads. Repeating an identical allotment create returns the existing record;
a different result for the same application returns `409`.
