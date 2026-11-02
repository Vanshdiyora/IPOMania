# Dashboard and analytics

The authenticated home dashboard shows the signed-in user's saved IPO, demat-account, and
application records. IPO facts and status are manually entered by the user and are not represented
as market-verified. No IPO or application data is fabricated. Financial summaries remain in the API
but are temporarily hidden from the web dashboard.

## Dashboard metrics

- Active, non-archived IPO applications and their application statuses.
- Current active demat accounts and tracked, non-archived IPOs. These inventory counts are
  independent of application date filters.
- Applications by IPO, category (`RETAIL`, `SHNI`, `BHNI`, `SHAREHOLDER`), demat account, and
  broker, plus a monthly application-count trend.
- Recent application records and upcoming IPO closing dates from the user's saved data.

The API still provides financial aggregates and exports. The Phase 6 financial engine remains
authoritative for their calculations. No currency conversion or investment advice is provided.

The dashboard labels unavailable evidence as **Unavailable** instead of assuming missing records
mean a financial amount of zero. It describes IPO data provenance and does not infer a future IPO
or listing from absent data.

## Filters and exports

Users can filter by inclusive start/end dates, IPO, category, and demat account. Date filters apply
to application creation time and, for API exports, capital-ledger effective time. Inventory counts
and upcoming IPO closing dates are not narrowed by the application date selection. IPO/account
filter choices are loaded in pages; chart groupings are limited to the top 10 by default and can
return up to 50.

CSV and multi-sheet Excel exports use the active filters and include application aggregates,
recent applications, upcoming IPO rows, and financial aggregates still available from the API.
Formula-leading text is escaped.

The signed-in home route shows the dashboard. Signed-out users continue to see the public welcome
page and must authenticate before accessing analytics.
