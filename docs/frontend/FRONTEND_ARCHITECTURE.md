# Frontend architecture

`apps/web` is a React 18 single-page app served by Vite. `src/main.tsx` installs the global error
boundary and styles. `src/app/App.tsx` sets up TanStack Query, and `src/app/router.tsx` defines
client-side routes. `AppLayout` composes the responsive sidebar, header, and route outlet. At `/`,
signed-out visitors see the full-width public landing page without the header, sidebar, or app
content padding; the signed-in home dashboard retains the application layout.

Supabase Auth state is managed by `src/auth/AuthProvider.tsx`. Registration, login, recovery, reset,
verification, and profile pages use React Hook Form and Zod. Protected routes wait for session
restoration and distinguish expired sessions. Reusable display elements live under
`src/components/`; primitives compatible with shadcn/ui's copy-in component approach live in
`src/components/ui/`. Tailwind design tokens are configured in
`tailwind.config.ts` and global fixed-light tokens are declared in `src/styles.css`. `components.json`
and `src/lib/utils.ts` configure the standard shadcn/ui utility conventions.

The protected demat-account routes include the dashboard, server-filtered account list, add/edit
forms, details, bulk import, and import history. TanStack Query handles API state; TanStack Table
and Virtual render the desktop account list, with readable mobile account cards. The forms and
import mapping use accessible labels and inline validation. The fixed light palette and minimum
touch-target styles apply throughout.
Sidebar dashboard links match their exact routes, so a nested list page highlights only its own link.
Account and application lists retain filter and page state in URL parameters. Their detail pages
use the originating list URL when navigating back, with a safe parent fallback for direct links.

Protected IPO list and opening-date calendar routes show the shared admin-managed catalog by
default, with server-side search, status filters, and pagination. Catalog details are read-only and
retain provider attribution and unset source values. The **My IPOs** view (`?source=personal`)
preserves the user-owned list, details, add/edit form, immutable category-rule configuration, and
quota calculator. Shared issue IDs never become personal category-rule or editing targets.
Category forms expose explicit
unknown/unpublished/configured states rather than applying defaults. Calculator results show
validation reasons, source/rule version, calculation inputs, and a clear notice that self-reported
shareholder conditions are not independently verified.
IPO list search, status and page state also live in URL parameters. Shared and personal detail
views use the same issue and date presentation without inventing unavailable market statistics.
The admin catalog also keeps search, status, and pagination in its URL. Its View action carries
that URL to the catalog detail page so Back returns to the filtered admin list.

The authenticated home route shows the responsive dashboard and analytics page. TanStack Query
loads bounded PostgreSQL aggregates, the canonical Phase 6 capital summary, and paginated IPO and
account filter options. Recharts visualizes status, category, IPO, account, monthly application,
and per-currency ledger-event trends. Date, IPO, category, and account filters update the queries;
CSV and Excel exports use the same filter selection. Signed-out users retain the public welcome
page. Monetary totals remain decimal strings in cards and exports; chart-only number conversion is
for approximate visual scale and is explicitly labeled.
Routing errors and unmatched paths render the not-found page. Unhandled React rendering errors are
logged locally and replaced by an accessible recovery view.
