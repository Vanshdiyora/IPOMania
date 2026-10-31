# Dashboard and analytics

The authenticated home dashboard summarizes the signed-in user's own saved IPO, demat-account,
application, allotment, refund, and capital records. IPO facts and status are manually entered by
the user and are not represented as market-verified. No IPO, application, allotment, or listing
data is fabricated.

## Dashboard metrics

- Active, non-archived IPO applications and their application statuses.
- Current active demat accounts and tracked, non-archived IPOs. These inventory counts are
  independent of application date filters.
- Applications by IPO, category (`RETAIL`, `SHNI`, `BHNI`, `SHAREHOLDER`), demat account, and
  broker, plus a monthly application-count trend.
- Current blocked capital, gross `ACTUAL_DEBIT` events, outstanding refunds, and refunds received,
  shown separately for each currency.
- Allotment count and success rate. Success means a recorded positive allotted-share quantity;
  the denominator is recorded allotment outcomes. The rate is unavailable if no outcomes exist.
- Recent application records and upcoming IPO closing dates from the user's saved data.

Blocked capital is held money, not money spent. Actual debit totals include only recorded
`ACTUAL_DEBIT` ledger entries. `ALLOTMENT_DEBIT` is not counted as another cash debit.
Refund-completed amounts come from actual `REFUND_RECEIVED` ledger entries; a released block is not
a refund. The Phase 6 financial engine remains authoritative for blocked balances, outstanding
refunds, and per-currency P&L. Realized/unrealized listing P&L is shown only when listing ledger
events exist; unrealized P&L remains unavailable when an open allotment has no reliable recorded
valuation. No currency conversion or investment advice is provided.

The dashboard labels unavailable evidence as **Unavailable** instead of assuming missing records
mean a financial amount of zero. It describes IPO data provenance and does not infer a future IPO
or listing from absent data.

## Filters and exports

Users can filter by inclusive start/end dates, IPO, category, and demat account. Date filters apply
to application creation time and capital-ledger effective time. Inventory counts and upcoming IPO
closing dates are not narrowed by the application date selection. IPO/account filter choices are
loaded in pages; chart groupings are limited to the top 10 by default and can return up to 50.

CSV and multi-sheet Excel exports use the active filters and include the displayed aggregate
reports, exact decimal strings, recent applications, and upcoming IPO rows. Formula-leading text
is escaped.

The signed-in home route shows the dashboard. Signed-out users continue to see the public welcome
page and must authenticate before accessing analytics.
