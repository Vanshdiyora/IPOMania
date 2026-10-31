# IPO quota rules and category configuration

## Rule source

Category rules are **issue-specific**. The system has no built-in quota limits, category
allocations, investment caps, reserved percentages, or shareholder criteria. Users must record
values from an issue-specific published source or leave the corresponding rule unconfigured.
There are no category-specific defaults.

The supported category identifiers are `RETAIL`, `SHNI`, `BHNI`, and `SHAREHOLDER`. A category
record is linked to exactly one user-owned IPO. Every saved configuration gets a monotonically
assigned rule version; configurations are append-only and historical versions are not edited.

## Configuration fields

| Field | Meaning |
| --- | --- |
| `lot_limit_status` | `CONFIGURED` means one or both lot bounds are known; `NO_PUBLISHED_LIMIT` means the source explicitly has no published lot bound; `UNCONFIGURED` means the rule is unknown and calculations must stop. |
| `minimum_lots` | Inclusive minimum lot count when configured; null when no bound is published or the rule is unconfigured. |
| `maximum_lots` | Inclusive maximum lot count when configured; null when no bound is published or the rule is unconfigured. |
| `lot_increment` | Allowed step between lot counts. The first allowed count is the configured minimum, or one when no minimum is configured. |
| `investment_limit_status` | Separately distinguishes configured amount bounds, an explicitly absent published bound, and unknown rules. |
| `minimum_investment` / `maximum_investment` | Inclusive application-amount bounds; values are decimal strings in the same units as issue prices. |
| `reserved_shares` | Published reserved quantity when expressed as a share count. |
| `reserved_percentage` | Published reservation percentage, from 0 through 100. The application does not infer a value from the share count. |
| `shareholder_record_date` | Issue-specific date against which user-provided holdings are assessed. |
| `minimum_shareholding` | Published minimum holding, if one is stated. Null does not imply a verified shareholder status. |
| `eligibility_conditions` | A strict list of unique condition IDs and the published condition text. Applicants must explicitly attest to each condition; the application does not independently verify them. |
| `allowed_price_types` | Explicitly allowed `BID` and/or `CUT_OFF` application pricing modes. |
| `minimum_price_increment` | Published price increment used to validate an entered bid. |
| `rule_source`, `source_reference`, `last_verified_at` | Provenance and user-entered verification metadata. No value is automatically verified. |

Unknown rules are not equivalent to unlimited rules. A calculation is rejected if the lot or
investment limit status is `UNCONFIGURED`. A null bound is treated as absent only when its status
explicitly says `NO_PUBLISHED_LIMIT` or when a configured status has a different bound present.

## Eligibility behavior

Shareholder qualification requires a configured record date and a user-provided holding value.
When a published minimum holding is configured, the provided amount must meet it. The system also
requires a positive provided holding for the shareholder category. A demat account record alone
does not prove ownership on the record date, beneficial ownership, holding duration, or any other
published criterion.

Additional published criteria are stored as individual strict `{ id, description }` records. The
applicant must explicitly confirm each one. The result always reports
`eligibility_verified: false`; it means only that supplied information satisfied the configured
checks. No brokerage, depository, exchange, or issuer confirmation is performed.

## Change control

Saving a changed category configuration creates the next database-assigned version under a
transaction lock. Historical calculations store the selected version plus the complete pricing,
lot-size, input, and result snapshot. Updating the IPO's current price or rules cannot rewrite an
earlier calculation.
