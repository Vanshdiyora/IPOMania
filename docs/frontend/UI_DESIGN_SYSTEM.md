# UI design system

## Fixed light palette

| Token          | Value     | Use                        |
| -------------- | --------- | -------------------------- |
| Primary navy   | `#101828` | Headings and primary brand |
| Secondary navy | `#1D2D44` | Secondary brand            |
| Background     | `#F8FAFC` | Application canvas         |
| Cards          | `#FFFFFF` | Surfaces                   |
| Primary text   | `#0F172A` | Body text                  |
| Secondary text | `#475569` | Supporting text            |
| Borders        | `#E2E8F0` | Dividers and outlines      |
| Primary action | `#1D4ED8` | Interactive actions        |
| Success        | `#15803D` | Positive state             |
| Warning        | `#B45309` | Warning state              |
| Danger         | `#DC2626` | Error/destructive state    |

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
