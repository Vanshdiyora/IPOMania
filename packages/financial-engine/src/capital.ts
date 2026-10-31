import DecimalJs from "decimal.js";

const ExactDecimal = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_UP,
});
type Decimal = InstanceType<typeof ExactDecimal>;

export type CapitalTransactionType =
  | "APPLICATION_RECORDED"
  | "MANDATE_APPROVED"
  | "CAPITAL_BLOCKED"
  | "CAPITAL_RELEASED"
  | "ACTUAL_DEBIT"
  | "ALLOTMENT_DEBIT"
  | "REFUND_RECEIVED"
  | "LISTING_SALE"
  | "LISTING_PRICE_UPDATE"
  | "ADJUSTMENT";

export interface CapitalApplication {
  id: string;
  application_amount: string;
  currency: string;
}

export interface CapitalMandate {
  mandate_amount: string;
  mandate_status: string;
  currency: string;
}

export interface CapitalAllotment {
  application_id: string;
  allotment_status: string;
  allotted_shares: number;
  allotment_price: string | null;
  refund_amount: string;
  currency: string;
}

export interface CapitalLedgerEntry {
  application_id: string | null;
  transaction_type: CapitalTransactionType;
  amount: string;
  currency: string;
  quantity: number | null;
  unit_price: string | null;
  blocked_consumed: string | null;
  adjustment_direction?: "DEBIT" | "CREDIT" | null;
  effective_at: string;
  created_at: string;
}

export interface CapitalSummary {
  currency: string;
  total_application_value: string;
  approved_mandate_value: string;
  currently_blocked_capital: string;
  released_capital: string;
  actually_invested_capital: string;
  refunds_received: string;
  outstanding_refunds: string;
  realized_pnl: string;
  unrealized_pnl: string | null;
}

export function calculateCapitalSummaries(
  applications: CapitalApplication[],
  mandates: CapitalMandate[],
  allotments: CapitalAllotment[],
  ledger: CapitalLedgerEntry[],
): CapitalSummary[] {
  const currencies = new Set([
    ...applications.map(({ currency }) => currency),
    ...mandates.map(({ currency }) => currency),
    ...allotments.map(({ currency }) => currency),
    ...ledger.map(({ currency }) => currency),
  ]);
  return [...currencies].sort().map((currency) => {
    const appRows = applications.filter((row) => row.currency === currency);
    const mandateRows = mandates.filter(
      (row) => row.currency === currency && row.mandate_status === "APPROVED",
    );
    const allotmentRows = allotments.filter((row) => row.currency === currency);
    const ledgerRows = ledger.filter((row) => row.currency === currency);
    const refundsByApplication = sumByApplication(ledgerRows, "REFUND_RECEIVED");
    const expectedRefunds = allotmentRows.reduce((total, row) => {
      const received = refundsByApplication.get(row.application_id) ?? zero();
      const outstanding = decimal(row.refund_amount).minus(received);
      if (outstanding.lessThan(0)) {
        throw new RangeError("Refund receipts cannot exceed the expected refund.");
      }
      return total.plus(outstanding);
    }, zero());

    const allotmentByApplication = new Map(allotmentRows.map((row) => [row.application_id, row]));
    const salesByApplication = new Map<string, number>();
    let realizedPnl = zero();
    for (const entry of ledgerRows) {
      if (entry.transaction_type !== "LISTING_SALE" || !entry.application_id) continue;
      const allotment = allotmentByApplication.get(entry.application_id);
      if (!allotment || !entry.quantity || !allotment.allotment_price) continue;
      realizedPnl = realizedPnl
        .plus(decimal(entry.amount))
        .minus(decimal(allotment.allotment_price).mul(entry.quantity));
      salesByApplication.set(
        entry.application_id,
        (salesByApplication.get(entry.application_id) ?? 0) + entry.quantity,
      );
    }

    const latestValuations = new Map<string, CapitalLedgerEntry>();
    for (const entry of ledgerRows) {
      if (entry.transaction_type !== "LISTING_PRICE_UPDATE" || !entry.application_id) continue;
      const previous = latestValuations.get(entry.application_id);
      if (
        !previous ||
        entry.effective_at > previous.effective_at ||
        (entry.effective_at === previous.effective_at && entry.created_at > previous.created_at)
      ) {
        latestValuations.set(entry.application_id, entry);
      }
    }

    let unrealizedPnl = zero();
    let missingValuation = false;
    for (const allotment of allotmentRows) {
      if (!allotment.allotment_price || allotment.allotted_shares <= 0) continue;
      const remainingShares =
        allotment.allotted_shares - (salesByApplication.get(allotment.application_id) ?? 0);
      if (remainingShares <= 0) continue;
      const valuation = latestValuations.get(allotment.application_id);
      if (!valuation?.unit_price) {
        missingValuation = true;
        continue;
      }
      unrealizedPnl = unrealizedPnl.plus(
        decimal(valuation.unit_price).minus(allotment.allotment_price).mul(remainingShares),
      );
    }

    const currentlyBlocked = sum(
      ledgerRows
        .filter(({ transaction_type }) => transaction_type === "CAPITAL_BLOCKED")
        .map(({ amount }) => amount),
    )
      .minus(
        sum(
          ledgerRows
            .filter(({ transaction_type }) => transaction_type === "CAPITAL_RELEASED")
            .map(({ amount }) => amount),
        ),
      )
      .minus(sum(ledgerRows.map(({ blocked_consumed }) => blocked_consumed ?? "0")));
    if (currentlyBlocked.lessThan(0)) {
      throw new RangeError("Capital releases and debits cannot exceed blocked capital.");
    }

    const actualDebits = ledgerRows
      .filter(
        ({ transaction_type, adjustment_direction }) =>
          transaction_type === "ACTUAL_DEBIT" ||
          (transaction_type === "ADJUSTMENT" && adjustment_direction === "DEBIT"),
      )
      .map(({ amount }) => amount);
    const actualCredits = ledgerRows
      .filter(
        ({ transaction_type, adjustment_direction }) =>
          transaction_type === "REFUND_RECEIVED" ||
          (transaction_type === "ADJUSTMENT" && adjustment_direction === "CREDIT"),
      )
      .map(({ amount }) => amount);
    const actualInvested = sum(actualDebits).minus(sum(actualCredits));
    if (actualInvested.lessThan(0)) {
      throw new RangeError("Capital refunds and credits cannot exceed actual debits.");
    }

    return {
      currency,
      total_application_value: sum(
        appRows.map(({ application_amount }) => application_amount),
      ).toFixed(),
      approved_mandate_value: sum(
        mandateRows.map(({ mandate_amount }) => mandate_amount),
      ).toFixed(),
      currently_blocked_capital: currentlyBlocked.toFixed(),
      released_capital: sum(
        ledgerRows
          .filter(({ transaction_type }) => transaction_type === "CAPITAL_RELEASED")
          .map(({ amount }) => amount),
      ).toFixed(),
      actually_invested_capital: actualInvested.toFixed(),
      refunds_received: sum(
        ledgerRows
          .filter(({ transaction_type }) => transaction_type === "REFUND_RECEIVED")
          .map(({ amount }) => amount),
      ).toFixed(),
      outstanding_refunds: expectedRefunds.toFixed(),
      realized_pnl: realizedPnl.toFixed(),
      unrealized_pnl: missingValuation ? null : unrealizedPnl.toFixed(),
    };
  });
}

function sumByApplication(
  entries: CapitalLedgerEntry[],
  transactionType: CapitalTransactionType,
): Map<string, Decimal> {
  const totals = new Map<string, Decimal>();
  for (const entry of entries) {
    if (entry.transaction_type !== transactionType || !entry.application_id) continue;
    totals.set(
      entry.application_id,
      (totals.get(entry.application_id) ?? zero()).plus(decimal(entry.amount)),
    );
  }
  return totals;
}

function sum(values: string[]): Decimal {
  return values.reduce((total, value) => total.plus(decimal(value)), zero());
}

function decimal(value: string): Decimal {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
  ) {
    throw new RangeError("Financial amounts must be decimal strings.");
  }
  const parsed = new ExactDecimal(value);
  if (!parsed.isFinite()) throw new RangeError("Financial amounts must be finite.");
  return parsed;
}

function zero(): Decimal {
  return new ExactDecimal(0);
}
