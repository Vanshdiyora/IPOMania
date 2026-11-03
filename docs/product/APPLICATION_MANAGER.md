# Application manager

The application manager stores private, user-owned application records for the user's own IPO and
demat-account records. It supports individual entry, account-by-account bulk entry, status tracking,
archive, filtered search, pagination, CSV export, and reviewed spreadsheet imports.

## Application lifecycle

Application status is independent of payment mandate and allotment:

- Application: `DRAFT`, `SUBMITTED`, `UNDER_PROCESSING`, `REJECTED`, `FAILED`, `COMPLETED`.
- Mandate: `UNKNOWN`, `PENDING`, `APPROVED`, `REJECTED`, `FAILED`, `NOT_REQUIRED`.
- Allotment: `UNKNOWN`, `PENDING`, `ALLOTTED`, `PARTIALLY_ALLOTTED`, `NOT_ALLOTTED`.

New and imported records default to `DRAFT` and do not imply an exchange submission. Imported
statuses are only set to another value when the user explicitly maps that field. Editing statuses,
legacy numbers, and notes never rewrites the calculation snapshot; the server-recorded submission
timestamp is not editable. Archiving is soft; the
application and its historical details remain available.

## Calculation and validation

The add-application form keeps entry to an owned, unarchived IPO, an active owned demat account,
an issue-specific category configuration, positive whole lots, and price. The IPO selector lists
only the user's **My IPOs** records: the shared catalog remains read-only and does not supply
personal category rules. If the selector is empty, the form links to add a personal IPO; configure
an issue-specific category before recording an application. It shows the calculated
total amount without exposing a price-type field; the application service selects an allowed price
mode from the configured issue rules. The server records the submission date and time when the
form is saved, rather than accepting a user-entered timestamp. The same decimal financial engine
checks the selected issue rules. Unknown or unconfigured lot, investment, and price rules remain
errors. A saved application remains a tracking record, not issuer eligibility verification or
investment advice.

The saved record includes exact application amount, total shares, rule version, a server-recorded
submission timestamp, and a snapshot of the IPO pricing/lot-size inputs, category rule, applicant
inputs, and result. This snapshot is historical evidence of the calculation, not issuer
verification, investment advice, or an allotment prediction.

## Duplicate review

The application manager warns when the IPO/account/category combination, application number, or
external reference may match an existing record. Multiple applications with the same IPO/account/
category combination are not automatically prohibited. A stable external reference is unique per
user when supplied and prevents re-importing the same external record. A duplicate warning is
visible during preview; it does not silently overwrite an existing application. Users review and
confirm import batches explicitly.

## Bulk entry

Bulk entry requires one IPO, one configured category, lots, price type, and price, then validates
each selected active demat account separately. The preview reports errors and exact calculated
amounts per account. The application batch is created only after every selected row validates.
SHAREHOLDER inputs and configured conditions are surfaced for explicit confirmation; selecting
accounts is never treated as proof of eligibility.

## Pages

- `/applications`: dashboard and totals.
- `/applications/list`: searchable, filterable table with pagination, selection for bulk status
  changes, and filtered CSV export.
- `/applications/new`, `/applications/:applicationId`, and `/applications/:applicationId/edit`:
  creation, historical details, and editable operational fields.
- `/applications/bulk`: per-account validation and confirmed bulk creation.
- `/applications/import`: CSV/XLSX mapping, validation, duplicate review, and confirmation.
- `/applications/import-history` and `/applications/import-history/:importId`: batch history and
  row-level report with safe reversal.

## Capacity and safety

The schema and API are paginated; a 100-row page size supports reviewing 90+ applications without
loading an unbounded table. Imports accept up to 500 rows per batch and 5 MiB. Export is bounded
to 50,000 matching records per request. CSV formula-like values are escaped. Every API access uses
the verified caller's JWT and RLS; request-supplied owner IDs are rejected.
