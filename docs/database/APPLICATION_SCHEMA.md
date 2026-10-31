# Application database schema

Migration: `supabase/migrations/20261031150000_application_manager.sql`.

## `public.applications`

Each row has a generated UUID and an immutable `user_id` linked to `auth.users`. Composite
restrictive foreign keys require its IPO, demat account, and issue-specific category rule to belong
to the same owner; the category must belong to that IPO. Deleting any referenced financial source
record is restricted. Financial inputs are server-derived: lots, total shares, exact numeric amount,
rule version, and JSON calculation snapshot. The snapshot captures the issue terms, category rule,
calculation input/result, and time so later edits to an IPO or rules cannot rewrite earlier
calculations.

Application, mandate, and allotment statuses are constrained independently. Applications can be
soft archived. The client cannot update shares, amount, rule version, snapshot, or owner columns.
Historical snapshots are never editable through authenticated grants.

`external_reference`, when present, is unique per user case-insensitively after trimming. It is the
stable key used to prevent importing an external record twice. There is deliberately no uniqueness
constraint on the IPO/account/category/application-number combination: real records may permit
multiple applications. The API reports those combinations as potential duplicates for review.

## Import history

`application_imports` stores the owner, file label/type, batch lifecycle, counts, result, and
timestamps. `application_import_rows` stores each source-row report and prepared calculation
snapshot; `(import_id, row_number)` is report identity only, not a retry key. The row references the
created application for audit/reversal.

`confirm_application_import(uuid)` locks an owned preview, atomically creates ready and reviewed
potential-duplicate records, records links and outcome, and returns the saved result when retried.
Invalid rows are not created. `reverse_application_import(uuid)` archives unchanged
import-created applications atomically and refuses a partial reversal if any record changed.
Both fixed `SECURITY DEFINER` routines have an empty `search_path`, use `auth.uid()`, accept no owner
argument, and are callable with the user's JWT; they do not require a service-role key.

## RLS and privileges

RLS is enabled and forced on applications and both import tables. Policies scope direct access to
the verified owner; import rows inherit access only through the owned import. Authenticated grants
are column-limited. Import state transitions and application snapshot edits are not granted to
clients. New application data uses the caller-JWT/anon-key client and is additionally checked in
the API before insert.

## Verification

`supabase/tests/applications.test.sql` exercises forced RLS, two-user isolation, owner binding,
status separation, snapshot preservation, stable-reference uniqueness, confirmation retry, and
reversal. It requires the repository's local Supabase/PostgreSQL test environment; see
`TASKS.md` for current execution status.
