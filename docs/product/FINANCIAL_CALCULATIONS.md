# Financial calculations

## Numeric representation

All monetary inputs are decimal strings and all multiplication/comparison is performed with
`decimal.js` in `packages/financial-engine`. JavaScript floating-point arithmetic is not used for
money. API and database numeric precision is bounded and validated at the boundary. Amounts are
returned as decimal strings without currency conversion or rounding to a display currency.

## Supported calculations

1. **Total shares:** `lots × IPO lot size`. Both operands must be positive safe integers, and the
   product must remain a safe integer.
2. **Application amount:** `total shares × selected price`. Decimal multiplication preserves the
   decimal input exactly.
3. **Lot validation:** checks positive whole lots, configured min/max bounds, and the configured
   step. The first permitted count is the configured minimum, or one when no minimum is recorded.
4. **Price validation:** checks the IPO issue-price range, allowed price type, cut-off equality,
   and configured price increment.
5. **Category/eligibility validation:** checks the selected issue-specific configuration,
   configured investment boundaries, shareholder record-date inputs, and each required
   user-confirmed published condition.
6. **Maximum eligible lots:** uses an explicitly configured maximum-lot rule and/or maximum
   investment rule. It returns `null` when the available issue-specific rules cannot establish a
   finite maximum.

Bounds are inclusive. No limit is invented when a value is missing. `UNCONFIGURED` limits produce
validation errors rather than an eligible result.

## Result semantics

The result includes `eligible`, shares, application amount, category, rule version, calculation
details, and all validation messages. `eligible: true` means the entered values satisfy the
recorded issue-specific rules. It does **not** mean an exchange or issuer verified eligibility or
that an application will receive an allotment. Shareholder and other attestations remain
unverified.

## Historical reproducibility

The API persists the rule version, issue pricing and lot size, category, selected price, lots,
demat-account reference, eligibility inputs, result, and calculation timestamp. Category rule
versions are append-only. IPO records and calculation snapshots are user-scoped. The calculation
engine is deterministic for the same captured inputs and rule version.

## Evidence

No official IPO rule example was available in the repository when this module was implemented.
Automated tests use synthetic values solely to test arithmetic and validation boundaries; they are
not represented as official or authoritative rule fixtures.
