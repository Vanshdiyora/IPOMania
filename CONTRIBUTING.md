# Contributing

## Local setup

Install Node.js 20+ and npm 10+, then run `npm ci`. Copy `.env.example` to `.env.local` for local
settings. The web frontend and Worker API run independently with `npm run dev:web` and
`npm run dev:api`.

## Development workflow

1. Keep changes scoped to the requested phase and preserve the package boundaries.
2. Use strict TypeScript, Zod at external input boundaries, and structured API errors.
3. Add or update tests alongside behavior; avoid introducing mock business workflows.
4. Update directly related documentation.
5. Before submitting, run:

   ```powershell
   npm run format:check
   npm run lint
   npm run typecheck
   npm test
   npm run build:web
   npm run build:api
   npm audit --audit-level=high
   ```

Database connectivity checks require a configured `DATABASE_URL` and are not part of this default
list. Never commit `.env` files, `.dev.vars`, tokens, service-role keys, or credentials.

## Pull requests

Describe the change and its phase, note test results and any checks that could not be run, and call
out security, schema, or migration implications. GitHub Actions executes the repository's Phase 1
quality and build checks on pushes to `main` and pull requests.
