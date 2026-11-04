# Dashboard and analytics

The authenticated home dashboard shows the signed-in user's saved IPO, demat-account, and
application records alongside the shared admin-managed IPO catalog. Personal IPO facts are entered
by the user; shared catalog fields retain their recorded source and may be unpublished. No IPO or
application data is fabricated. Financial summaries remain in the API but are temporarily hidden
from the web dashboard.

## Dashboard metrics

- Active, non-archived IPO applications and their application statuses.
- Current active demat accounts, personal tracked IPOs, and active shared catalog IPOs. These inventory counts are
  independent of application date filters.
- Applications by IPO, category (`RETAIL`, `SHNI`, `BHNI`, `SHAREHOLDER`), demat account, and
  account, plus a monthly application-count trend.
- Shared IPO counts by status and a bounded list of issue details including price band, lot size,
  exchange, dates, and source. Missing source values are labeled as unpublished.
- Recent application records and upcoming IPO closing dates from personal and shared IPO data.

The API still provides financial aggregates and exports. The Phase 6 financial engine remains
authoritative for their calculations. No currency conversion or investment advice is provided.

The dashboard labels unavailable evidence as **Unavailable** instead of assuming missing records
mean a financial amount of zero. It describes IPO data provenance and does not infer a future IPO
or listing from absent data.

## Filters and exports

Users can filter by inclusive start/end dates, personal IPO, shared IPO, category, and demat account. Date filters apply
to application creation time and, for API exports, capital-ledger effective time. Inventory counts
and upcoming IPO closing dates are not narrowed by the application date selection. The personal IPO
filter scopes application analytics; the shared IPO filter scopes catalog analytics. IPO/account
filter choices are loaded in pages; chart groupings are limited to the top 10 by default and can
return up to 50.

CSV and multi-sheet Excel exports use the active filters and include application aggregates,
shared IPO analytics and issue details, recent applications, upcoming IPO rows, and financial aggregates still available from the API.
Formula-leading text is escaped.

The signed-in home route shows the dashboard. Signed-out users continue to see the public welcome
page and must authenticate before accessing analytics.
