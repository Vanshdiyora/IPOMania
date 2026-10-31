# Application import processing

## Parsing and staging

The authenticated Worker accepts CSV and one-sheet XLSX, capped at 5 MiB, 500 data rows, and
30 unique non-empty headers. It parses the file in memory with bounded dimensions, requires an
explicit column mapping, validates each row at the boundary, and resolves IPO, account, and
category references only within the authenticated user's scope.

IPO UUID/symbol, demat account UUID/masked identifier/masked client reference, and category code or
rule UUID are resolved to owned rows. Ambiguous account matches are invalid. Price and price type
must be supplied explicitly; amount, shares, rule version, and calculation snapshot are derived by
the financial engine from the selected issue-specific rules. The owner is always the authenticated
caller. Each prepared row is saved as a preview row with errors/warnings and no application is
created at preview.

The report's row number identifies a source position only; it is not an idempotency key. A stable
external reference, when supplied, is unique per user. Repeated or previously used external
references are invalid. Duplicate IPO/account/category/application-number combinations are reported
as potential duplicates and do not silently overwrite or prohibit multiple applications.

## Atomic confirmation and retry

`confirm_application_import(uuid)` is a fixed `SECURITY DEFINER` routine with an empty
`search_path`. It verifies `auth.uid()`, locks the import row, returns the stored result for an
already-confirmed import, and otherwise inserts staged `ready` and duplicate-warning rows. Invalid
rows are not inserted. The row links, imported count, confirmation timestamp, and result update
commit in the same transaction. Any constraint or insert failure rolls back the full confirmation.
No service-role database client is used for user data.

## Reversal and audit report

`reverse_application_import(uuid)` locks the owned import and only archives its created
applications when they remain unchanged. Editing an imported record or prior archiving blocks the
whole reversal; the function never deletes financial history. Import rows keep their source record,
outcome, errors, warnings, and application link (cleared only if an application is deleted through
an administrative cascade).

Import history and reports are read under RLS. A retry uses the existing import ID; a corrected
source file requires a new preview so the original report remains auditable.

## Operational limits and tests

The API processes up to 500 rows in one batch and preloads the caller's owned issue, account,
category, and recent application references before row validation. The database is the final
authority for external-reference uniqueness and ownership constraints, including concurrent
confirmation attempts. Unit/API coverage includes CSV/XLSX parsing, mapping, owned matching, draft
default, duplicate external references, and row reports; a 500-row CSV verifies bounded processing
and row-level errors. `supabase/tests/applications.test.sql` covers forced RLS, owner isolation,
status/snapshot preservation, external-reference uniqueness, confirmation retry, and reversal.
Run `npm run test:integration:applications` with `DEMAT_TEST_DATABASE_URL` pointed at an isolated,
loopback-only local Supabase database to verify concurrent submissions; the test refuses non-local
database hosts. Database tests require the local Supabase test environment.
