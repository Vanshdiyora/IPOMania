# Technology stack

| Area               | Foundation choice                                                  |
| ------------------ | ------------------------------------------------------------------ |
| Runtime/tooling    | Node.js 22.12+, npm 10+, npm workspaces                            |
| Language           | TypeScript 5, strict compiler options                              |
| Web                | React 18, Vite 7, React Router 7                                   |
| Styling/UI         | Tailwind CSS 3, shadcn/ui-compatible component conventions, Lucide |
| Browser state/data | Zustand, TanStack Query, TanStack Table, TanStack Virtual          |
| Forms/charts       | React Hook Form, Zod, Recharts                                     |
| API                | Hono on Cloudflare Workers, Wrangler                               |
| Database           | Supabase PostgreSQL, Drizzle ORM and Drizzle Kit                   |
| Validation         | Zod                                                                |
| Tests              | Vitest and Playwright                                              |
| Quality/CI         | ESLint, Prettier, GitHub Actions, npm audit                        |

The choices are wired in the manifests and configuration. The demat-account management module
uses the existing TanStack data/table/virtualization stack. IPO applications, market data, and the
quota engine are not implemented.
