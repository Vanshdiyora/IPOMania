# Browser and accessibility testing

## Run Playwright

```powershell
npx playwright install chromium
npm run test:e2e
```

Playwright starts the Vite web app at `127.0.0.1:4176`, uses synthetic Supabase configuration,
clears the API base URL to prevent remote requests, and does not reuse an unrelated dev server.
The CI browser job installs Chromium and runs the same suite without credentials.

## Test expectations

- Use role, accessible name, and label locators instead of CSS selectors where practical.
- Exercise keyboard operation and responsive viewports for interactive flows.
- Add axe-core scans tagged for WCAG 2.0/2.1/2.2 A and AA to representative rendered pages.
- Treat automated scans as issue detectors, not complete WCAG conformance claims.
- Manually verify screen-reader announcements and workflows with supported assistive technology
  before release; axe does not certify screen-reader compatibility.

The current branch includes welcome/auth shell, account, IPO, and dashboard browser tests.
Representative public shell, account list, IPO list, and dashboard states are scanned with axe-core
in the actual browser. Component axe checks run in jsdom. These scans are automated checks, not a
manual screen-reader audit or complete WCAG conformance claim.
