# Demat account management specification

## Scope

The module lets an authenticated user manage their own IPO-linked account records. It stores bank
name and username and supports encrypted bank-password storage. Account records are not IPO
applications and do not implement an IPO quota, allocation, or investment workflow.

## Account fields

| Field          | Rule                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| Holder name    | Required, 1–160 trimmed characters                                         |
| Bank name      | Required for new records, 1–120 trimmed characters                         |
| Username       | Required for new records, 1–160 trimmed characters                         |
| Password       | Required on creation; up to 1,024 characters, encrypted before persistence |
| Account status | `active`, `inactive`, or `closed`                                          |
| Notes          | Optional, up to 2,000 characters                                           |

Existing records may have missing bank credentials until edited. Passwords are never imported,
included in ordinary account responses, or shown in account tables. The account detail view reveals
the password only after an explicit user action. A blank password during edit preserves the saved
password.

## Archive behavior

Archiving preserves the record and makes it eligible for deletion only when it has no linked
history. Users can create or restore any number of accounts, regardless of account status.

Accounts are never hard-deleted as the normal removal action. The delete endpoint requires an
archived record; future financial-history relations must prevent deletion with a restrictive
foreign key. Import reversal is available only when every account from that import is unchanged
and still unarchived; reversal archives those accounts rather than deleting them.

## Pages

- **Dashboard:** total, active, and archived account counts.
- **Account list:** server-side search, filters, pagination, a virtualized desktop table, and
  readable mobile cards.
- **Add, edit, and details:** validated account fields, lifecycle actions, and owner-protected
  password reveal.
- **Bulk import and import history:** column mapping, row-by-row preview, confirmation, reports,
  and safe reversal where possible.

The interface uses the fixed light palette, readable text, visible focus, and 44px minimum
interactive targets. Mobile cards supplement the desktop table without requiring horizontal
scrolling for ordinary account details.

## Search and pagination

Holder searches are case-insensitive prefix searches. Filters include account status, archived
state, and creation-date bounds. The API returns at most 100 records per
page; the UI requests 50 at a time. Sorting is newest first with a stable ID tie-breaker.

## Authorization and privacy

Every page and endpoint requires a Supabase-authenticated user. The API derives `user_id` only
from the identity verified by Supabase Auth and uses the caller's JWT with the anon project key.
PostgreSQL RLS is the final ownership boundary. Clients cannot supply or update `user_id`.

The API encrypts passwords with AES-256-GCM using a deployment-managed 32-byte secret before
writing to the database. The password-reveal route verifies the caller and account owner, and
returns `Cache-Control: no-store`. The account page masks passwords by default. Configure and
protect `ACCOUNT_CREDENTIAL_ENCRYPTION_KEY`; losing it makes saved passwords unrecoverable. Do not
put passwords in notes or uploaded files.
