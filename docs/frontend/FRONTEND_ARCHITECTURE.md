# Frontend architecture

`apps/web` is a React 18 single-page app served by Vite. `src/main.tsx` installs the global error
boundary and styles. `src/app/App.tsx` sets up TanStack Query, and `src/app/router.tsx` defines
client-side routes. `AppLayout` composes the responsive sidebar, header, and route outlet.

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
Routing errors and unmatched paths render the not-found page. Unhandled React rendering errors are
logged locally and replaced by an accessible recovery view.
