# Demat account API

All routes are under `/api/accounts`, require `Authorization: Bearer <Supabase access token>`, and
return the repository's structured `{ data }` or `{ error: { code, message } }` response shape.
The API verifies the token with Supabase Auth and uses the same caller JWT with the project anon
key for every user-scoped database operation. Ownership is derived from the verified user; request
payloads do not accept `user_id`.

## Account routes

| Method and path                         | Behavior                                                |
| --------------------------------------- | ------------------------------------------------------- |
| `GET /api/accounts`                     | List, filters, pagination, and account-capacity summary |
| `POST /api/accounts`                    | Create an account                                       |
| `GET /api/accounts/:accountId`          | Read one owned account                                  |
| `PATCH /api/accounts/:accountId`        | Update a non-archived owned account                     |
| `POST /api/accounts/:accountId/archive` | Soft-archive an account                                 |
| `POST /api/accounts/:accountId/restore` | Restore an account, subject to the capacity guard       |
| `DELETE /api/accounts/:accountId`       | Permanently delete an archived account only             |

Create and update accept only the account fields in
[DEMAT_ACCOUNT_SPECIFICATION.md](../product/DEMAT_ACCOUNT_SPECIFICATION.md). Unknown properties
are rejected. An empty patch is invalid. The database RLS policy additionally prevents deleting
unarchived accounts. A restrictive foreign-key error for linked history is returned as `409
ACCOUNT_HAS_HISTORY`.

### List parameters

`page` defaults to 1; `pageSize` defaults to 25 and is limited to 100. Optional filters:

- `holder_name`, `broker`: case-insensitive prefix search
- `depository`: `NSDL` or `CDSL`
- `status`: `active`, `inactive`, or `closed`
- `created_from`, `created_to`: ISO-8601 timestamps, inclusive
- `archived`: `false` (default), `true`, or `all`

The response contains `accounts`, `pagination` (`page`, `pageSize`, `total`, `totalPages`), and
`summary` (`total`, `active`, `archived`, `remainingCapacity`). `total` includes inactive and
closed records; `active` counts only unarchived active records.

## Import routes

| Method and path                               | Behavior                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /api/accounts/import/preview`           | Multipart file parsing, column mapping, validation, duplicate detection, and persisted preview |
| `POST /api/accounts/import/confirm`           | Atomically save ready rows; safe to retry                                                      |
| `GET /api/accounts/import/history`            | Paginated import history                                                                       |
| `GET /api/accounts/import/:importId`          | Import summary and row report                                                                  |
| `POST /api/accounts/import/:importId/reverse` | Archive unchanged accounts created by an import                                                |

Preview accepts `file` and optional JSON `mapping` multipart fields. Without `mapping`, it returns
the detected header names and a small sample without staging any data. With a mapping, required
fields are `holder_name`, `broker_name`, `depository_type`, and `masked_demat_identifier`. Optional
fields are `broker_code`, `masked_client_reference`, `account_status`, and `notes`. Mapping
values must name a header in the uploaded file.

The API accepts CSV (`text/csv`) and XLSX
(`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) only, with matching file
extensions, one worksheet for XLSX, a 5 MiB file limit, up to 500 data rows, and up to 30 unique
columns. Every input row is stored in the preview report as `ready`, `duplicate`, or `invalid`;
duplicate/invalid rows are not imported.

Confirm uses one database function and transaction. A repeated confirm returns the stored result
instead of inserting a second set of accounts. The database capacity trigger can reject an import
atomically if it would exceed the active-account limit. Reversal is all-or-nothing and fails with
`409 IMPORT_REVERSAL_BLOCKED` if any created account has since changed or been archived.

## Error codes

| HTTP | Codes                                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`, `INVALID_HEADERS`, `INVALID_ROW_COUNT`, `INVALID_FILE`                                              |
| 401  | `UNAUTHORIZED`                                                                                                          |
| 404  | `ACCOUNT_NOT_FOUND`, `IMPORT_NOT_FOUND`                                                                                 |
| 409  | `ACCOUNT_LIMIT_REACHED`, `DUPLICATE_ACCOUNT`, `ACCOUNT_HAS_HISTORY`, `IMPORT_NOT_REVERSIBLE`, `IMPORT_REVERSAL_BLOCKED` |
| 413  | `FILE_TOO_LARGE`                                                                                                        |
| 415  | `UNSUPPORTED_FILE_TYPE`                                                                                                 |

Errors contain no stack trace, bearer token, database connection information, or secrets.
