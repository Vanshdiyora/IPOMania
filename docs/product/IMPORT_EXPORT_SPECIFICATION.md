# Application import and export specification

## Files and limits

- CSV (`.csv`, `text/csv`) and XLSX (`.xlsx`,
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- Maximum 5 MiB, 500 data rows, and 30 unique non-empty headers.
- XLSX must contain exactly one worksheet. The first row contains headers.
- Imports are parsed and staged in the Worker; no uploaded workbook is retained as a file.

## Mapping

Required source fields:

| Target        | Accepted values                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| IPO           | Owned IPO UUID or symbol                                                                                |
| Demat account | Owned account UUID, masked demat identifier, or masked client reference; must match exactly one account |
| Category      | Configured category code (`RETAIL`, `SHNI`, `BHNI`, `SHAREHOLDER`) or rule UUID for the selected IPO    |
| Lots          | Positive whole-number lot count                                                                         |
| Price         | Explicit positive decimal price                                                                         |
| Price type    | Explicit `BID` or `CUT_OFF`                                                                             |

Price and price type are required in addition to the requested identifiers/status fields so a
historical amount is never fabricated from today's price or guessed from an IPO cut-off value.
Optional mapped fields are application number, stable external reference, submission date,
application status, mandate status, allotment status, and notes. A missing application status is
`DRAFT`; an import is not an implicit submission.

Column mapping values must refer to existing headers. Unknown mapping fields, malformed CSV/XLSX,
invalid encoding, invalid dates/statuses, ambiguous accounts, unknown/archived IPOs, missing
category configuration, invalid lots/prices, and category-rule failures are reported without
creating an application.

## Preview and duplicate rules

The preview stores each source row in an owned import report, keyed by import ID and source row
position only. Row numbers are report locations, never idempotency keys. A stable external
reference is the preferred idempotency key and is unique per user. Repeated external references in
the source or references already in the user's records are invalid. IPO/account/category and
application-number matches are potential-duplicate warnings; they do not prevent legitimate
multiple applications. No existing application is overwritten.

The preview shows every row as ready, potential duplicate, or invalid with messages. Ready and
duplicate-warning rows are staged; invalid rows remain report-only and are skipped at confirmation.

## Confirmation, retry, and reversal

Confirmation locks the owned import, inserts eligible staged rows in one PostgreSQL transaction,
updates row links and import result, and commits atomically. Invalid rows are not created. A
database failure rolls back the full confirmation; it never leaves a partial batch. Repeating
confirmation for the same import returns its saved result and creates no duplicates.

Reversal is available for confirmed imports. It archives, rather than deletes, unchanged
import-created applications. If an imported application has been edited or already archived, the
entire reversal is rejected. Imported application history and snapshots remain retained.

If a preview contains invalid rows, users may review the error report and can correct the source
and create a new preview. The original preview remains auditable and is not changed in place.

## Export

The authenticated CSV export uses the active application filters, is capped at 50,000 rows per
request, and quotes fields. Formula-leading values are prefixed to avoid spreadsheet formula
execution. Export includes IPO/company, masked account, broker, category, lots/shares/amount,
external/application references, date, three independent statuses, rule version, and creation
time. It does not expose unmasked account credentials.
