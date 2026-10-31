# Application API

All paths require a valid Supabase bearer token. Ownership is derived from the verified Auth user,
and database requests use that caller's JWT with the anon project key. The API does not accept
`user_id` from clients. Responses use `{ data }` or `{ error: { code, message } }`; internals,
tokens, and database credentials are not returned.

## Routes

| Method and path                           | Behavior                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/applications`                   | Filter and page owned applications                                       |
| `GET /api/applications/summary`           | Exact active totals for each application status                          |
| `GET /api/applications/export`            | CSV export using filters; maximum 50,000 rows                            |
| `POST /api/applications/preview`          | Calculate and check an individual application before saving              |
| `POST /api/applications`                  | Validate eligibility/calculation and create one application              |
| `GET /api/applications/:applicationId`    | Read one owned application and its saved snapshot                        |
| `PATCH /api/applications/:applicationId`  | Edit application number, reference, submission date, statuses, and notes |
| `DELETE /api/applications/:applicationId` | Soft-archive one active application                                      |
| `POST /api/applications/bulk/preview`     | Independently validate a set of account-specific inputs                  |
| `POST /api/applications/bulk`             | Create up to 500 applications atomically after validation                |
| `PATCH /api/applications/bulk/status`     | Update one or more independent operational statuses                      |
| `POST /api/imports/preview`               | Parse/map CSV or XLSX, validate rows, and persist preview                |
| `POST /api/imports/confirm`               | Atomically confirm an owned preview; safe to retry                       |
| `GET /api/imports/history`                | List the caller's application import batches                             |
| `GET /api/imports/:importId/report`       | Read the row-level report for one owned import                           |
| `POST /api/imports/:importId/reverse`     | Archive unchanged applications created by a confirmed import             |

List query parameters: `page` (1), `page_size` (25, max 100), `ipo_id`,
`demat_account_id`, `broker`, `category_id`, `application_status`, `mandate_status`,
`submission_from`, `submission_to`, `search` (application number/external reference), and
`include_archived` (`false` or `true`).

Creation input includes IPO/account/category IDs, positive integer `lots`, explicit `price_type`
and decimal `price`, nullable `shareholder_shares`, and explicit `eligibility_answers`. Optional
application fields include number, external reference, submission date, statuses, and notes. Unknown
properties are rejected. The server verifies all owned records, checks active account state and
category/IPO linkage, runs the shared financial engine, and derives shares, amount, and rule version.
The client cannot supply amount, shares, snapshot, owner, or rule version.

Bulk creation validates every row before one insert. If any row is invalid, it returns an
account-specific `422 BULK_VALIDATION_FAILED` report and inserts nothing. Duplicate detection is
non-blocking except for the unique stable external reference constraint.

## Statuses and errors

Application, mandate, and allotment statuses are distinct columns. Imported rows default to
`DRAFT`; no import route automatically marks an application submitted. Unconfigured category rules
fail closed. Unowned/missing records are not disclosed.

Common errors include `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `APPLICATION_NOT_FOUND` /
`IMPORT_NOT_FOUND` (404), `DUPLICATE_EXTERNAL_REFERENCE` (409),
`IMPORT_REVERSAL_BLOCKED` (409), `BULK_VALIDATION_FAILED` (422), and `EXPORT_TOO_LARGE` (413).
