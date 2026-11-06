# UI design system

## Fixed light palette

| Token          | Value     | Use                        |
| -------------- | --------- | -------------------------- |
| Primary navy   | `#101338` | Headings and primary brand |
| Secondary navy | `#29265C` | Secondary brand            |
| Background     | `#F8F7FF` | Application canvas         |
| Cards          | `#FFFFFF` | Surfaces                   |
| Primary text   | `#101338` | Body text                  |
| Secondary text | `#555D83` | Supporting text            |
| Borders        | `#E5E1F5` | Dividers and outlines      |
| Primary action | `#4B0FE8` | Interactive actions        |
| Success        | `#15803D` | Positive state             |
| Warning        | `#B45309` | Warning state              |
| Danger         | `#DC2626` | Error/destructive state    |

The catalog reference sets the visual pattern for the application: a white sidebar, pale violet
page headers, purple icon tiles and actions, rounded filter surfaces, and lavender table headers.
Dashboard and other page metrics use the same pale violet card treatment. Values are always sourced
from API data; the decorative chart in the catalog header is illustrative only.

## Accessibility and behavior

- The application always uses a light color scheme; OS theme preferences are ignored.
- Use readable system sans-serif typography, clear heading hierarchy, and meaningful labels.
- Interactive targets have a minimum 44px height/width where practical.
- Maintain keyboard-visible focus indicators, semantic landmarks, sufficient text contrast, and
  status announcements for loading.
- Keep the layout usable on narrow screens; navigation labels may compact while retaining
  accessible names.
- Do not add a dark theme or a theme switch.

These are implementation constraints. Before adding product components, verify text and component
contrast against WCAG 2.2 AA in their actual states.

## Forms and drawers

- Use `FormInput`, `FormSelect`, and `FormTextarea` from `FormControls.tsx`. They forward refs
  to the native controls for React Hook Form registration, reset, and invalid-field focus.
  Labels, required markers, errors, and hint descriptions share one accessible implementation.
- `SearchableFormSelect` adds a search field for more than eight options, retaining the selected
  option while filtering. Native select behavior remains available for touch and keyboard users.
- Use `SideDrawer` for general side panels and `FormDrawer` for local add/edit interfaces.
  Route-backed editors use `RouteFormDrawer` to preserve deep links and browser history.
  Opening an editor from a page retains that page behind the backdrop. A direct link opens
  the same editor over a neutral records surface.
- Drawers open from the right, are at most 576px wide, and fill narrow mobile screens. The body
  scrolls independently of the header and footer. Safe-area padding keeps footer buttons usable.
- `useModalLayer` manages focus, background inertness, and scroll locks. It keeps callback refs
  current without restarting focus effects during typing, and handles stacked confirmations.
  Cancel, Escape, and backdrop clicks protect unsaved edits. Route-backed editors also protect
  browser Back navigation; dirty editors register the native refresh/close warning.
- Disable save and close actions during submission. Use `ConfirmButton` for destructive actions
  and synchronization confirmation; it prevents repeated confirmation while processing and
  presents retryable errors in the dialog. Keep imports, authentication, and settings in their
  appropriate dedicated workflows.
- Show completed or failed user actions, including create, update, archive, import, and export
  results, through the shared toast viewport. Keep field validation and persistent page-level
  loading/data errors inline where users need them to resolve or retry the current form.
- Use `formValuesFromRecord` when loading an API record into a strict write form: IDs, ownership,
  and server timestamps must not become form fields. Keep financial values as decimal strings.
  `toIsoDateTime` tolerates incomplete editing values without throwing during rendering; Zod
  schemas still validate the final payload.
- The admin editor and API share `adminIpoSchema`. Optional unknown pricing and date values
  remain null; editing a provider record retains its data source. No schema migrations are needed.
- The admin catalog supports search, status filtering, pagination, mobile cards, inline errors,
  and retry. Sync history uses mobile cards and right-aligned numeric columns on desktop.

Component regressions are covered in `tests/ui/form-components.test.tsx`; browser form, admin,
accessibility, and viewport checks are in `tests/e2e/forms.spec.ts`. Browser tests use isolated
API fixtures and do not establish live Supabase persistence, RLS, or concurrency verification.
The Phase 3 database/RLS, concurrency, and repository-wide formatting gate remains open.

## Detail and list navigation

- IPO, account, and application list filters and pagination are stored in the URL. Detail links
  carry their originating list URL, and the visible back link returns to that exact URL.
- Direct detail links use their corresponding parent list as the fallback. The back link accepts
  only allowed local parent routes from navigation state.
- IPO detail views share issue, date, and source sections. They show only API-backed fields;
  unavailable subscription, GMP, financial, and listing data are described as unavailable.
- IPO status badges use semantic colors: upcoming blue, open green, closed neutral, and listed
  purple. Admin catalog and application tables align their headers with their data cells.
- Admin catalog search, status and page state live in the URL. Its View action opens the shared
  detail page with a return link to the exact management list state. Archive confirmation names
  the selected company.
- A single app-level toast viewport presents create, update, archive, import, synchronization,
  authentication, and password-reset outcomes. Dialog and form errors may also remain inline for
  correction, while the action outcome appears as a toast.
  On phones, toasts use a compact card above the bottom safe area and stack upward; on wider
  screens, they use the full card at the top right.
