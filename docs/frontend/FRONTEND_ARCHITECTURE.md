# Frontend architecture

`apps/web` is a React 18 single-page app served by Vite. `src/main.tsx` installs the global error
boundary and styles. `src/app/App.tsx` sets up TanStack Query, and `src/app/router.tsx` defines
client-side routes. `AppLayout` composes the responsive sidebar, header, and route outlet.

Reusable display elements live under `src/components/`; primitives compatible with shadcn/ui's
copy-in component approach live in `src/components/ui/`. Tailwind design tokens are configured in
`tailwind.config.ts` and global fixed-light tokens are declared in `src/styles.css`. `components.json`
and `src/lib/utils.ts` configure the standard shadcn/ui utility conventions.

Zustand, React Hook Form, TanStack Table/Virtual, Recharts, and TanStack Query are available for
future features; this shell intentionally does not create business stores, forms, tables, or charts.
Routing errors and unmatched paths render the not-found page. Unhandled React rendering errors are
logged locally and replaced by an accessible recovery view.
