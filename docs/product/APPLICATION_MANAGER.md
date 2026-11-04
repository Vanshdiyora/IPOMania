# Application manager

The application manager stores private, user-owned application records for the user's own IPO and
demat-account records. It supports individual entry, account-by-account bulk entry, archive,
filtered search, pagination, CSV export, and reviewed spreadsheet imports. The management view is
read-only for status: it does not display lifecycle statuses or offer bulk status changes.

## Application lifecycle

Application status is independent of payment mandate and allotment:

- Application: `DRAFT`, `SUBMITTED`, `UNDER_PROCESSING`, `REJECTED`, `FAILED`, `COMPLETED`.
- Mandate: `UNKNOWN`, `PENDING`, `APPROVED`, `REJECTED`, `FAILED`, `NOT_REQUIRED`.
- Allotment: `UNKNOWN`, `PENDING`, `ALLOTTED`, `PARTIALLY_ALLOTTED`, `NOT_ALLOTTED`.

New and imported records default to `DRAFT` and do not imply an exchange submission. Imported
statuses are only set to another value when the user explicitly maps that field. The edit drawer
changes only the category, lots, and price; the server recalculates shares, amount, and the
calculation snapshot from those terms. Application number, external reference, rule version, and
the server-recorded submission timestamp are not editable. Archiving is soft; the application and
its historical details remain available.

## Calculation and validation

The add-application form keeps entry to an owned, unarchived IPO, an active owned demat account,
a selected category, positive whole lots, and price. Shared IPO details offer
**Use for application**, which copies complete shared issue data and the latest admin-managed
category rules into the caller's private application snapshot before opening the form. Unknown market values are not
filled with defaults; incomplete shared records cannot be imported for application calculations.
Personal IPO records and their independently configured rules are unchanged. When category rules
exist, selecting a category prefills its configured lots and the existing rule checks remain in
effect. Without a configured category rule, the category is saved as a label and users can enter
lots manually (from 1 to 1,000,000); price must still match the IPO's issue-price range. The form
states the shares in one lot and shows the corresponding total shares. The server calculates the
amount from price, lots, and IPO lot size. The server records the submission date and time when the
form is saved. A saved application remains a tracking record, not issuer eligibility verification
or investment advice.

The saved record includes exact application amount, total shares, an optional rule version, a
server-recorded submission timestamp, and a snapshot of the IPO pricing/lot-size inputs, optional
category rule, applicant inputs, and result. This snapshot is historical evidence of the calculation, not issuer
verification, investment advice, or an allotment prediction.

## Duplicate review

The application manager warns when the IPO/account/category combination, application number, or
external reference may match an existing record. Multiple applications with the same IPO/account/
category combination are not automatically prohibited. A stable external reference is unique per
user when supplied and prevents re-importing the same external record. A duplicate warning is
visible during preview; it does not silently overwrite an existing application. Users review and
confirm import batches explicitly.

## Bulk entry

Bulk entry requires one IPO, a selected category, lots, price type, and price, then validates
each selected active demat account separately. The preview reports errors and exact calculated
amounts per account. The application batch is created only after every selected row validates.
SHAREHOLDER inputs and configured conditions are surfaced for explicit confirmation; selecting
accounts is never treated as proof of eligibility.

## Pages

- `/applications`: dashboard with RETAIL, sHNI, bHNI, and SHAREHOLDER application totals. An IPO
  selector above the table scopes those totals and the table to one IPO; the count beside it always
  shows how many different IPOs have applications.
- `/applications/list`: searchable, filterable table with pagination and filtered CSV export.
- `/applications/new`, `/applications/:applicationId`, and `/applications/:applicationId/edit`:
  creation, historical details, and category/lots/price revision. The table keeps an icon-only
  edit action in its last column.
- `/ipos/:ipoId`: an account-first table of active demat accounts and recorded applications for
  that IPO. It shows the selected category and recorded bid price, opens the application form in a
  drawer with the IPO and account preselected, and returns to the table after save or edit.
- `/applications/bulk`: per-account validation and confirmed bulk creation.
- `/applications/import`: CSV/XLSX mapping, validation, duplicate review, and confirmation.
- `/applications/import-history` and `/applications/import-history/:importId`: batch history and
  row-level report with safe reversal.

## Capacity and safety

The schema and API are paginated; a 100-row page size supports reviewing 90+ applications without
loading an unbounded table. Imports accept up to 500 rows per batch and 5 MiB. Export is bounded
to 50,000 matching records per request. CSV formula-like values are escaped. Every API access uses
the verified caller's JWT and RLS; request-supplied owner IDs are rejected.
