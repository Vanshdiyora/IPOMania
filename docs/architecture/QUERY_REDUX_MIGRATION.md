# Query and Redux migration

## Existing request inventory and migration plan

The browser already used TanStack Query for most IPO, account, application, capital, and
analytics reads, but pages declared unrelated key strings and used the default zero stale time.
Profile and several admin views fetched through effects and local response state. The admin
overview and sync page independently fetched the same status endpoint. Dashboard and
application pages also requested the same full account option set under different keys.
The auth provider restored the session through both an auth-state subscription and `getSession`,
and the global QueryClient was not cleared when accounts changed. The admin catalog fetched up to
500 rows and paged/filtered them in the browser. Sync history similarly fetched up to 100 rows.

The migration keeps existing API boundaries and business workflows. Query owns all migrated
server responses; Redux owns shared UI and dashboard filter choices. The remaining page-local
forms and drawers stay local. Every private query key includes the verified session user ID.
Session transitions cancel and clear cached queries and reset shared client state. The admin
catalog and sync history apply validated page and search parameters on the server. Existing callers
without list parameters retain the legacy array response. No new database table or index was
needed: the existing queries use bounded ranges and the existing status/update ordering.
Administrator overview counts now use the authenticated catalog-count RPC, so the overview no
longer downloads every IPO status row for browser-side counting.
Application import history and account import history also use the shared validated pagination
contract; all listing page-size selectors offer 10, 25, 50, and 100 rows and default to 10.
Dashboard application metrics and IPO catalog status cards are derived from database aggregates,
not the currently visible list page.
Public IPO catalog and administrator catalog/sync-history searches are debounced; these list
queries consume their abort signals. Admin IPO create/update/archive now rely on targeted cache
invalidation rather than issuing a page-local explicit refetch. Profile deletion and quota
calculation/tracking writes use Query mutations.

## Cache policy

| Data                                 |  Fresh for |
| ------------------------------------ | ---------: |
| IPO lists and catalog                |  2 minutes |
| IPO details and profile              |  5 minutes |
| Category rules                       | 10 minutes |
| Applications and administrator views |   1 minute |
| Dashboard analytics                  | 30 seconds |
| Other private reads                  |   1 minute |

Inactive entries are collected after five minutes. Fresh entries are reused on navigation;
stale entries refetch on mount, focus, or reconnect. One retry is permitted for transient errors,
while client errors are not retried. The browser does not persist Query or Redux data to disk.

## Request comparison method

| Same-session route sequence (within cache freshness)   |  Before | After | Evidence                                       |
| ------------------------------------------------------ | ------: | ----: | ---------------------------------------------- |
| Admin overview → sync → settings, sync-status GETs     |       3 |     1 | Mocked Chromium Network test                   |
| Profile → another page → profile, profile GETs         |       2 |     1 | Query key and five-minute freshness, code path |
| Application → IPO detail, complete account-option GETs |       2 |     1 | Shared key and one-minute freshness, code path |
| Dashboard initial load, primary query GETs             |       4 |     4 | Four query declarations, code path             |
| Admin catalog page 1 → page 2, catalog GETs            |       1 |     2 | Intentional server pagination, code path       |
| Admin IPO save or archive, catalog GETs per mutation   |       1 |     1 | Mocked Chromium request-count assertion        |
| IPO search, successive keystrokes                      | per key |     1 | Mocked Chromium request-count assertion        |

The table counts named GETs only; a page may make other requests. The browser test uses mocked
API responses. Initial page counts are unchanged because caching reduces revisits rather than
the first data load.

Set `VITE_LOG_API_REQUESTS=true` and inspect the browser Network panel for the same signed-in
account and same route sequence, with browser cache disabled. Count API GET requests on initial
load, profile revisit, admin overview to sync/settings navigation, IPO detail revisit, and
list page changes. The previous code performs an admin status request on each of overview,
sync, and settings navigation (three requests); the mocked browser route test measures one
request across those three pages with the shared key. The previous profile effect performs a GET on each mount; a revisit within five
minutes now uses the cached response. The account option query shared by application and IPO
detail pages also reuses its result for one minute. These are deterministic code-path
comparisons and a mocked browser measurement. Live before/after totals across all routes require
an authenticated browser run against a configured environment.

## Scope and follow-up

List and import-history routes use server pagination. The legacy admin catalog URL without page
parameters remains bounded at 500 rows for compatibility; new UI requests are paginated. Some
application and dashboard option queries intentionally load multiple pages to populate filters.
The application has no watchlist or portfolio feature, so there is no server state for those
domains to migrate. The Phase 3 local RLS, concurrency, and repository-wide formatting gate is
still open until its separate checks pass.
