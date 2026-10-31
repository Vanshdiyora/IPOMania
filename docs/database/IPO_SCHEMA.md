# IPO schema

Migration: `supabase/migrations/20261031140000_ipo_manager_quota_engine.sql`.

## Ownership decision

IPO records are user-specific because the project has no approved trusted publisher/editor role.
Every business table has an owner foreign key to `auth.users`, forced RLS, and authenticated-only
policies. No user's IPO notes, shareholder inputs, or calculations are shared with other users.
The IPO record does not expose a creator identity to other users because there are no shared
records.

## `public.ipos`

Stores company name, symbol, issue type, exchange, numeric issue-price bounds and optional cut-off,
lot size, issue size, issue lifecycle dates/status, data source, source reference, optional
verification timestamp, owner, timestamps, and `archived_at`. A user cannot change `user_id`.
`(user_id, symbol)` is unique. Date, price-range, cut-off, and positive-value constraints are
database-enforced. Archiving preserves the row and its linked rule/calculation history.

## `public.ipo_categories`

Stores immutable issue/category rule versions. It includes:

- Category and database-assigned version.
- Explicit lot and investment limit states plus their bounds.
- Lot increment; reserved shares/percentage.
- Shareholder record date and minimum shareholding.
- Allowed price modes, minimum price increment, source and verification metadata.
- A JSON array of eligibility conditions constrained by a strict database validator to unique
  `{ "id": string, "description": string }` objects; API Zod validation enforces the same schema.

Unknown limits are stored as `UNCONFIGURED`, not interpreted as unlimited. A database advisory
transaction lock assigns sequential versions for the same user/IPO/category. Authenticated users
can select and insert rule versions but cannot update or delete existing versions.

## `public.ipo_quota_calculations`

Stores owner, IPO, category-rule version, optional demat-account ID, category, rule version,
timestamp, exact input snapshot, and result snapshot. Composite foreign keys ensure that IPO,
category configuration, and demat account all belong to the same user. Calculation snapshots are
readable and insertable only by their owner and cannot be changed through authenticated grants.
`ON DELETE RESTRICT` preserves linked audit history.

## RLS and privileges

RLS is enabled and forced on all IPO tables. IPO operations are owner-filtered; category and
calculation records inherit ownership through `(record_id, user_id)` foreign keys. The API
authenticates with Supabase Auth and uses the caller's JWT with the anon key. It never uses the
service-role key for user-scoped access.

## Verification

`supabase/tests/ipo_manager.test.sql` exercises actual two-user RLS, owner-bound foreign keys,
immutable rule versions, restricted columns, and audit snapshot isolation. It is run with
`supabase test db` against local PostgreSQL.
