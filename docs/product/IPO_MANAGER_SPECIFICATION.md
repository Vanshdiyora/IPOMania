# IPO manager specification

## Scope and ownership

New IPO issue records are shared catalog data entered or synchronized by administrators. Regular
users browse the shared catalog; IPO creation and maintenance are restricted to administrators.
User-owned IPO rows remain private application snapshots copied from that catalog, not a second
source of issue facts. The catalog must not expose user-specific notes or calculation inputs, and it
must not create fabricated market data.

The manager stores manually entered IPO facts and issue-specific category rules. An eligible saved
quota calculation may be recorded as a private application-tracking record; this does not submit
an application to an exchange or issuer. The application does not provide investment
advice, promise allocation, or import fabricated market data.

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

- **IPO list:** search the shared catalog by company or exact symbol, filter by status and
  exchange/date, and navigate pages. Private application snapshots are not shown as a separate user
  IPO list.
- **IPO details:** review catalog prices, dates, and source/provenance before preparing a private
  application snapshot.
- **Create and edit:** administrators maintain shared catalog records through the admin IPO module.
- **Archive:** administrators soft-archive shared records; calculations retain their historical
  snapshots.
- **Category configuration:** add a new immutable version for each category instead of changing an
  existing version.
- **Quota calculator:** select an owned IPO and demat account, enter category, lot count, price,
  shareholder inputs, and explicit answers to published conditions.
- **Application tracking:** record an eligible saved calculation for private mandate, allotment, and
  capital tracking. The IPO selector uses shared catalog issue data directly, defaults the editable
  price to the published maximum, and updates total shares and amount as inputs change. A private
  snapshot is created only when saving so application facts remain tied to their saved issue/rule
  snapshot.

An archived IPO cannot be used for a new calculation. Existing calculation snapshots remain
retained and owner-scoped.

## Data quality

External request bodies are strict Zod objects. Decimal values arrive as decimal strings; dates
use ISO calendar dates. IPO data and category rules remain unverified unless a user explicitly
records a source and verification timestamp. The interface labels manual and unverified values.

No sample IPO or category rule is seeded as authoritative evidence. Tests use clearly synthetic
arithmetic values only.
