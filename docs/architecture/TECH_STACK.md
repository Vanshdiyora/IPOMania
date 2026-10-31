# Technology stack

| Area               | Foundation choice                                                  |
| ------------------ | ------------------------------------------------------------------ |
| Runtime/tooling    | Node.js 20+, npm 10+, npm workspaces                               |
| Language           | TypeScript 5, strict compiler options                              |
| Web                | React 18, Vite 5, React Router 6                                   |
| Styling/UI         | Tailwind CSS 3, shadcn/ui-compatible component conventions, Lucide |
| Browser state/data | Zustand, TanStack Query, TanStack Table, TanStack Virtual          |
| Forms/charts       | React Hook Form, Zod, Recharts                                     |
| API                | Hono on Cloudflare Workers, Wrangler                               |
| Database           | Supabase PostgreSQL, Drizzle ORM and Drizzle Kit                   |
| Validation         | Zod                                                                |
| Tests              | Vitest and Playwright                                              |
| Quality/CI         | ESLint, Prettier, GitHub Actions, npm audit                        |

The choices are wired in the manifests and configuration. UI and data libraries are foundational
dependencies only; no IPO business module is implemented.
