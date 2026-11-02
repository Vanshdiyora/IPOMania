# Performance testing

Performance figures are reported only after executing a reproducible workload against an isolated
test environment. Do not infer production latency from synthetic unit tests, fixture counts, or
the web build.

## Workload matrix

| Scenario                              | Available harness / preparation                                                                                                                                                        | Evidence status                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| More than 500 demat accounts per user | `supabase/tests/demat_accounts.test.sql` tests creation and restoration beyond 500; `tests/integration/demat-account-concurrency.test.ts` creates two accounts concurrently beyond 500 | Run database/concurrency suites; no latency target recorded                |
| 1,000 / 5,000 applications            | Use synthetic records with the application schema and its required ownership/calculation references                                                                                    | Not yet implemented as a performance benchmark                             |
| Concurrent users                      | Account creation and application external-reference tests use independent PostgreSQL transactions                                                                                      | Concurrency correctness only; no throughput measurement                    |
| Bulk import                           | `tests/security/accounts-import.test.ts` and application import API tests cover parsing/validation, including bounded row workloads                                                    | Functional, mocked API tests; no throughput benchmark                      |
| Dashboard aggregation                 | `supabase/tests/dashboard_analytics.test.sql` exercises an aggregate over 5,000 generated application rows                                                                             | Functional correctness only; no isolated latency or query-plan measurement |

## Benchmark protocol

1. Use a disposable loopback database with the exact migrations and indexes under test.
2. Record database and runtime versions, row counts, generated data shape, connection count,
   warm/cold cache state, command, repetitions, median, and tail latency.
3. Use `EXPLAIN (ANALYZE, BUFFERS)` for database query plans; do not run it against production
   without explicit operational approval.
4. Keep correctness assertions enabled while measuring. Include empty, typical, and large inputs.
5. Store raw measurements as CI artifacts or a separately reviewed report; do not commit secrets or
   transient customer data.

The concurrent account inserts and 5,000-row dashboard SQL test do not
establish service-level performance. Record dashboard measurements with the benchmark protocol
after choosing representative workloads and an isolated target environment.
