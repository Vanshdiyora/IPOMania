# UPI mandate management

## Scope

Mandates are user-entered records attached to an owned, manually recorded IPO application.
Creating or editing a mandate never invokes UPI, initiates a payment, or approves an authorization.
Future authorized integrations must be explicitly configured and must not bypass owner-scoped RLS.

## Fields and status

Each mandate has an application, external mandate reference, decimal amount, status, optional notes,
blocked/released timestamps, and creation/update timestamps. A new mandate always starts as
`PENDING`. Allowed manual transitions are:

| From       | To                                           |
| ---------- | -------------------------------------------- |
| `PENDING`  | `APPROVED`, `REJECTED`, `REVOKED`, `EXPIRED` |
| `APPROVED` | `REVOKED`, `EXPIRED`, `RELEASED`             |

Terminal states cannot be reopened. Database triggers enforce the transition rules. `blocked_at`
is set only when a separate `CAPITAL_BLOCKED` ledger event is recorded. `released_at` is set when
the user records the `RELEASED` mandate state. Approval records an informational ledger event;
it is not evidence of a debit and does not increase invested capital.

## Interfaces

- Mandate dashboard and details are available at `/mandates` and `/mandates/:mandateId`.
- `POST /api/mandates` records a pending mandate.
- `PATCH /api/mandates/:mandateId` applies a permitted manual update.
- `GET /api/mandates` supports IPO, account, broker, category, date, and status filters.

The application reference must belong to the authenticated user. Mandate references are unique
per user. Repeating the same create request returns the existing record; a conflicting reference
returns an explicit `409` error.
