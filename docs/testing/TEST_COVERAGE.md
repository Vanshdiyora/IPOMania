# Test coverage and evidence

This is a test inventory, not a production-readiness certification. “Existing” means a test file
is present on the Phase 8 branch; a passing result must also be recorded from an executed run.
Latest recorded results: Vitest 111 passed / 2 skipped; local pgTAP 144 passed; Playwright 13 passed.
V8 coverage is 24.55% statements and 26.58% lines for the configured source set, without a threshold.

| Area                            | Test evidence on this branch                                                                                                                                    | Execution / limit                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Decimal calculations            | `tests/unit/financial-engine.test.ts`, `capital-calculations.test.ts`, `capital-validation.test.ts`, plus factory regression                                    | Unit tests; uses existing engine                               |
| Applications/import/API         | Application validation and security API tests; import tests include bounded CSV/XLSX cases                                                                      | Supabase responses mocked in API tests                         |
| Capital/allotments/refunds      | Capital calculation, validation, and API tests; direct `supabase/tests/capital_management.test.sql`                                                             | Run local pgTAP for PostgreSQL guarantees                      |
| Auth/JWT                        | `tests/security/api-auth.test.ts`                                                                                                                               | Mocked Auth; no signature verification claim                   |
| Caller context / privileged key | `tests/security/rls-context.test.ts`                                                                                                                            | Mocked HTTP; checks anon key and caller bearer propagation     |
| RLS / two-user isolation        | `supabase/tests/rls_isolation.test.sql`, `demat_accounts.test.sql`, `ipo_manager.test.sql`, `applications.test.sql`, `capital_management.test.sql`              | Local Supabase only                                            |
| IDOR / validation / upload      | `tests/security/accounts-api.test.ts`, `applications-api.test.ts`, `accounts-import.test.ts`, schema unit tests                                                 | Primarily mocked API contracts                                 |
| XSS / accessibility             | `tests/ui/welcome-page.test.tsx`, `tests/e2e/foundation.spec.ts` axe scan                                                                                       | Representative shell only; manual screen-reader test pending   |
| Responsive browser behavior     | `tests/e2e/accounts.spec.ts`, `ipos.spec.ts`, `foundation.spec.ts`, `dashboard.spec.ts`                                                                         | Run Playwright Chromium                                        |
| 500 active accounts             | `supabase/tests/demat_accounts.test.sql`, capacity integration test                                                                                             | Boundary/concurrency correctness; measurement not recorded     |
| 1k/5k applications              | `supabase/tests/dashboard_analytics.test.sql` exercises 5,000 application rows                                                                                  | Functional query check only; no latency benchmark              |
| Phase 7 dashboard               | `tests/security/analytics-api.test.ts`, `tests/unit/dashboard-validation.test.ts`, `tests/e2e/dashboard.spec.ts`, `supabase/tests/dashboard_analytics.test.sql` | Integrated API/browser/DB tests; run in final integrated audit |

Skipped opt-in integration tests are not counted as passed. The recorded coverage percentages are
an initial repository-wide baseline, not a quality threshold; agree on a reviewed target before
using them as a gate. A final audit across the newly integrated Phase 5–7 baseline is still required.
