# Demat account management specification

## Scope

The module lets an authenticated user record and manage their own demat accounts. It does not
store full demat identifiers, passwords, or credentials. Account records
are not IPO applications and do not implement an IPO quota, allocation, or investment workflow.

## Account fields

| Field                   | Rule                                                          |
| ----------------------- | ------------------------------------------------------------- |
| Holder name             | Required, 1–160 trimmed characters                            |
| Depository              | Required; `NSDL` or `CDSL`                                    |
| Masked demat identifier | Required, 3–80 characters; masked value containing `X` or `*` |
| Masked client reference | Optional, 3–80 characters; if provided, containing `X` or `*` |
| Account status          | `active`, `inactive`, or `closed`                             |
| Notes                   | Optional, up to 2,000 characters                              |

The same user cannot register the same normalized masked demat identifier twice for the same
depository, including while an earlier record is archived. Masked client references are not used
as unique identity.

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
- **Add, edit, and details:** validated masked account fields, lifecycle actions, and ownership
  protected detail display.
- **Bulk import and import history:** column mapping, row-by-row preview, confirmation, reports,
  and safe reversal where possible.

The interface uses the fixed light palette, readable text, visible focus, and 44px minimum
interactive targets. Mobile cards supplement the desktop table without requiring horizontal
scrolling for ordinary account details.

## Search and pagination

Holder searches are case-insensitive prefix searches. Filters include depository,
account status, archived state, and creation-date bounds. The API returns at most 100 records per
page; the UI requests 50 at a time. Sorting is newest first with a stable ID tie-breaker.

## Authorization and privacy

Every page and endpoint requires a Supabase-authenticated user. The API derives `user_id` only
from the identity verified by Supabase Auth and uses the caller's JWT with the anon project key.
PostgreSQL RLS is the final ownership boundary. Clients cannot supply or update `user_id`.

Only masked identifiers should be entered. Validation is performed in the browser and API, with
database constraints as the final shape guard. Do not put credentials or unmasked
account identifiers in notes or uploaded files.
