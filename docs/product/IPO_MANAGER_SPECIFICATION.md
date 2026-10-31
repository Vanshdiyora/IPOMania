# IPO manager specification

## Scope and ownership

IPO records are **user-specific**, not shared master data. Every IPO row belongs to the
authenticated user who created it. This is the deliberate Phase 4 choice because the project has
no trusted publisher, editorial workflow, or administrator role for maintaining a shared IPO
catalog. RLS prevents another user from reading or changing the record. A future shared catalog
requires an explicit publishing and review design; it must not expose user-specific notes or
calculation inputs.

The manager stores manually entered IPO facts and issue-specific category rules. It does not create
IPO applications, provide investment advice, promise allocation, or import fabricated market
data.

## IPO fields

Each active record stores:

- Company name, symbol, issue type, and exchange.
- Minimum and maximum issue price, optional cut-off price, lot size, and issue size.
- Opening, closing, allotment, and listing dates.
- One of `UPCOMING`, `OPEN`, `CLOSED`, `ALLOTMENT_PENDING`, `LISTED`, or `WITHDRAWN`.
- Data source (`MANUAL` or `PUBLISHED_SOURCE`), optional source reference, and optional
  `last_verified_at`.
- Owner ID, creation/update timestamps, and a nullable archive timestamp.

`PUBLISHED_SOURCE` means the user entered a reference to published material; it does not mean the
application fetched or verified that material. The application never fills a verification
timestamp automatically. Status is selected by the user and is not inferred from dates.

## User experience

- **IPO list:** search by company or exact symbol, filter by status and exchange/date, and navigate
  pages.
- **IPO details:** review prices, dates, source/provenance, archive state, and category rule
  versions.
- **Add/edit:** validate the record before saving; edits cannot change its owner.
- **Archive:** soft-archive the record; calculations retain their historical snapshots.
- **Category configuration:** add a new immutable version for each category instead of changing an
  existing version.
- **IPO calendar:** show records in opening-date order.
- **Quota calculator:** select an owned IPO and demat account, enter category, lot count, price,
  shareholder inputs, and explicit answers to published conditions.

An archived IPO cannot be used for a new calculation. Existing calculation snapshots remain
retained and owner-scoped.

## Data quality

External request bodies are strict Zod objects. Decimal values arrive as decimal strings; dates
use ISO calendar dates. IPO data and category rules remain unverified unless a user explicitly
records a source and verification timestamp. The interface labels manual and unverified values.

No sample IPO or category rule is seeded as authoritative evidence. Tests use clearly synthetic
arithmetic values only.
