# IPO schema

Migrations: `supabase/migrations/20261031140000_ipo_manager_quota_engine.sql`,
`supabase/migrations/20261031160000_capital_management.sql`, and
`supabase/migrations/20261103130000_shared_ipo_category_rules.sql`.

## Ownership decision

Personal IPO records are owner-scoped snapshots. The shared catalog is the source of truth for new
IPO issue data: signed-in users may submit a complete `USER_SUBMITTED` catalog entry under their
verified identity, and administrators manage catalog data and category rules thereafter.
User-owned IPO notes, shareholder inputs, calculations, and application snapshots remain private.

## `public.ipos`

Stores company name, symbol, issue type, exchange, numeric issue-price bounds and optional cut-off,
lot size, issue size, issue lifecycle dates/status, data source, source reference, optional
verification timestamp, owner, timestamps, and `archived_at`. A user cannot change `user_id`.
`(user_id, symbol)` is unique. `source_catalog_id` optionally records the shared IPO copied to this
personal record and is unique per user. Date, price-range, cut-off, and positive-value constraints
are database-enforced. Archiving preserves the row and its linked rule/calculation history.

## `public.ipo_categories`

Stores immutable issue/category rule versions. It includes:

- Category and database-assigned version.
- Configured initial lots, plus explicit lot and investment limit states and their bounds.
- Lot increment; reserved shares/percentage.
- Shareholder record date and minimum shareholding.
- Allowed price modes, minimum price increment, source and verification metadata.
- A JSON array of eligibility conditions constrained by a strict database validator to unique
  `{ "id": string, "description": string }` objects; API Zod validation enforces the same schema.

Unknown limits are stored as `UNCONFIGURED`, not interpreted as unlimited. A database advisory
transaction lock assigns sequential versions for the same user/IPO/category. Authenticated users
can select and insert rule versions but cannot update or delete existing versions.

## Shared catalog rules

`public.ipo_catalog_categories` stores immutable, admin-managed versions for shared catalog IPOs.
Admins can insert rules, signed-in users can read rules for active catalog records, and database
triggers assign versions. User imports copy the latest source rule per category into their own
`ipo_categories` rows and retain the source rule ID for idempotent future imports. Imported rules
remain private copies governed by the existing user-owned RLS and application foreign keys.

## Shared catalog submissions

`public.ipo_catalog.submitted_by` records the verified user who submitted a `USER_SUBMITTED`
catalog entry, and `source_reference` preserves an optional source supplied with it. RLS allows a
signed-in user to insert only a `USER_SUBMITTED` row tied to their own identity; users cannot edit
or archive catalog rows. The active-symbol/exchange unique index prevents duplicate active issues.
Administrators retain catalog-management access.

## `public.ipo_quota_calculations`

Stores owner, IPO, category-rule version, optional demat-account ID, category, rule version,
timestamp, exact input snapshot, and result snapshot. Composite foreign keys ensure that IPO,
category configuration, and demat account all belong to the same user. Calculation snapshots are
readable and insertable only by their owner and cannot be changed through authenticated grants.
`ON DELETE RESTRICT` preserves linked audit history.

## Manual application records

`public.applications` stores an immutable, user-owned record copied only from one of that user's
eligible quota calculation snapshots. Composite foreign keys bind its IPO, demat account, category
rule version, and calculation to the same owner. The database rechecks issue lot, price, rule, and
amount constraints. Recording an application does not submit it to an exchange or issuer.
Mandates, allotments, and the capital ledger link to this record using owner-bound foreign keys;
their details and RLS are documented in [CAPITAL_LEDGER.md](./CAPITAL_LEDGER.md).

## RLS and privileges

RLS is enabled and forced on personal and shared IPO tables. Personal IPO operations are
owner-filtered; shared catalog rules are publicly readable only for active catalog IPOs and
admin-writable. Each category rule stores an initial lot quantity constrained by its lot bounds
and increment. The IPO record's `lot_size` stores shares in one lot; application calculations
derive total shares and amount from lots, share price, and that issue-level lot size. Personal
category and calculation records inherit ownership through
`(record_id, user_id)` foreign keys. The API
authenticates with Supabase Auth and uses the caller's JWT with the anon key. It never uses the
service-role key for user-scoped access.

## Verification

`supabase/tests/ipo_manager.test.sql` and
`supabase/tests/ipo_catalog_categories.test.sql` exercise RLS, owner-bound foreign keys,
immutable rule versions, restricted columns, and audit snapshot isolation. They run with
`supabase test db` against local PostgreSQL.
