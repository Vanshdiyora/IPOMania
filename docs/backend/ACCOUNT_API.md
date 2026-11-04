# Demat account API

All routes are under `/api/accounts`, require `Authorization: Bearer <Supabase access token>`, and
return the repository's structured `{ data }` or `{ error: { code, message } }` response shape.
The API verifies the token with Supabase Auth and uses the same caller JWT with the project anon
key for every user-scoped database operation. Ownership is derived from the verified user; request
payloads do not accept `user_id`.

## Account routes

| Method and path                         | Behavior                                      |
| --------------------------------------- | --------------------------------------------- |
| `GET /api/accounts`                     | List, filters, pagination, and account totals |
| `POST /api/accounts`                    | Create an account                             |
| `GET /api/accounts/:accountId`          | Read one owned account                        |
| `GET /api/accounts/:accountId/password` | Reveal an owned account password on demand    |
| `PATCH /api/accounts/:accountId`        | Update a non-archived owned account           |
| `POST /api/accounts/:accountId/archive` | Soft-archive an account                       |
| `POST /api/accounts/:accountId/restore` | Restore an account                            |
| `DELETE /api/accounts/:accountId`       | Permanently delete an archived account only   |

Create and update accept only the account fields in
[DEMAT_ACCOUNT_SPECIFICATION.md](../product/DEMAT_ACCOUNT_SPECIFICATION.md). Unknown properties
are rejected. An empty patch is invalid. The database RLS policy additionally prevents deleting
unarchived accounts. A restrictive foreign-key error for linked history is returned as `409
ACCOUNT_HAS_HISTORY`.

Create requires `holder_name`, `bank_name`, `username`, and `password`. Updates may omit the
password to keep the current value. The Worker encrypts passwords before database writes. List and
ordinary account responses expose only `password_saved`; they never return plaintext or ciphertext.
The password route returns plaintext only after bearer-token verification and owner-scoped lookup,
and responds with `Cache-Control: no-store`. Configure `ACCOUNT_CREDENTIAL_ENCRYPTION_KEY` as a
base64-encoded 32-byte Worker secret; password writes and reveals return
`503 CREDENTIAL_ENCRYPTION_UNAVAILABLE` until it is configured.

### List parameters

`page` defaults to 1; `pageSize` defaults to 25 and is limited to 100. Optional filters:

- `holder_name`: case-insensitive prefix search
- `status`: `active`, `inactive`, or `closed`
- `created_from`, `created_to`: ISO-8601 timestamps, inclusive
- `archived`: `false` (default), `true`, or `all`

The response contains `accounts`, `pagination` (`page`, `pageSize`, `total`, `totalPages`), and
`summary` (`total`, `active`, `archived`). `total` includes inactive and
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
fields are `holder_name`, `bank_name`, and `username`. Optional fields are `account_status` and
`notes`. Passwords are excluded from bulk import; enter them through the account form so they are
encrypted before storage. Mapping values must name a header in the uploaded file.

The API accepts CSV (`text/csv`) and XLSX
(`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) only, with matching file
extensions, one worksheet for XLSX, a 5 MiB file limit, up to 500 data rows, and up to 30 unique
columns. Every input row is stored in the preview report as `ready`, `duplicate`, or `invalid`;
duplicate/invalid rows are not imported.

Confirm uses one database function and transaction. A repeated confirm returns the stored result
instead of inserting a second set of accounts. Reversal is all-or-nothing and fails with
`409 IMPORT_REVERSAL_BLOCKED` if any created account has since changed or been archived.

## Error codes

| HTTP | Codes                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`, `INVALID_HEADERS`, `INVALID_ROW_COUNT`, `INVALID_FILE`, `CREDENTIAL_COLUMN_NOT_ALLOWED` |
| 401  | `UNAUTHORIZED`                                                                                 |
| 404  | `ACCOUNT_NOT_FOUND`, `PASSWORD_NOT_SET`, `IMPORT_NOT_FOUND`                                     |
| 409  | `DUPLICATE_ACCOUNT`, `ACCOUNT_HAS_HISTORY`, `IMPORT_NOT_REVERSIBLE`, `IMPORT_REVERSAL_BLOCKED` |
| 503  | `CREDENTIAL_ENCRYPTION_UNAVAILABLE`                                                             |
| 413  | `FILE_TOO_LARGE`                                                                               |
| 415  | `UNSUPPORTED_FILE_TYPE`                                                                        |

Errors contain no stack trace, bearer token, database connection information, or secrets.
