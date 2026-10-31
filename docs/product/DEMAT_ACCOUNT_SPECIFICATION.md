# Demat account management specification

## Scope

The module lets an authenticated user record and manage their own demat accounts. It does not
store full demat identifiers, passwords, credentials, or broker login details. Account records
are not IPO applications and do not implement an IPO quota, allocation, or investment workflow.

## Account fields

| Field                   | Rule                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| Holder name             | Required, 1–160 trimmed characters                                         |
| Broker name             | Required, 1–120 trimmed characters; free text to support the user's broker |
| Broker code             | Optional, up to 40 characters                                              |
| Depository              | Required; `NSDL` or `CDSL`                                                 |
| Masked demat identifier | Required, 3–80 characters; masked value containing `X` or `*`              |
| Masked client reference | Optional, 3–80 characters; if provided, containing `X` or `*`              |
| Account status          | `active`, `inactive`, or `closed`                                          |
| Notes                   | Optional, up to 2,000 characters                                           |

The same user cannot register the same normalized masked demat identifier twice for the same
depository, including while an earlier record is archived. Masked client references are not used
as unique identity.

## Capacity and archive behavior

The limit is **500 unarchived accounts with `account_status = active` per user**. Inactive, closed,
and archived accounts do not consume capacity. This is both a product rule and a database
invariant. An atomic guarded update to a private per-user capacity-counter row serializes active
membership changes. Create, status changes, restore, and imports cannot bypass the limit through
simultaneous requests.

Archiving preserves the record and makes it eligible for deletion only when it has no linked
history. Restoring an active account is rejected if it would exceed the limit. Restoring an
inactive or closed account does not consume active capacity.

Accounts are never hard-deleted as the normal removal action. The delete endpoint requires an
archived record; future financial-history relations must prevent deletion with a restrictive
foreign key. Import reversal is available only when every account from that import is unchanged
and still unarchived; reversal archives those accounts rather than deleting them.

## Pages

- **Dashboard:** total, active, archived, and remaining active capacity.
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

Holder and broker searches are case-insensitive prefix searches. Filters include depository,
account status, archived state, and creation-date bounds. The API returns at most 100 records per
page; the UI requests 50 at a time. Sorting is newest first with a stable ID tie-breaker.

## Authorization and privacy

Every page and endpoint requires a Supabase-authenticated user. The API derives `user_id` only
from the identity verified by Supabase Auth and uses the caller's JWT with the anon project key.
PostgreSQL RLS is the final ownership boundary. Clients cannot supply or update `user_id`.

Only masked identifiers should be entered. Validation is performed in the browser and API, with
database constraints as the final shape and capacity guard. Do not put credentials or unmasked
account identifiers in notes or uploaded files.
