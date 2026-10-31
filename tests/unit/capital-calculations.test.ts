import { describe, expect, it } from "vitest";
import {
  calculateCapitalSummaries,
  type CapitalAllotment,
  type CapitalApplication,
  type CapitalLedgerEntry,
  type CapitalMandate,
} from "@ipo-mania/financial-engine";

const applications: CapitalApplication[] = [
  { id: "app-1", application_amount: "1500.00", currency: "INR" },
];
const mandates: CapitalMandate[] = [
  { mandate_amount: "1500.00", mandate_status: "APPROVED", currency: "INR" },
  { mandate_amount: "500.00", mandate_status: "PENDING", currency: "INR" },
];
const allotments: CapitalAllotment[] = [
  {
    application_id: "app-1",
    allotment_status: "PARTIAL_ALLOTMENT",
    allotted_shares: 10,
    allotment_price: "100.00",
    refund_amount: "500.00",
    currency: "INR",
  },
];

function event(
  transactionType: CapitalLedgerEntry["transaction_type"],
  amount: string,
  values: Partial<CapitalLedgerEntry> = {},
): CapitalLedgerEntry {
  return {
    application_id: "app-1",
    transaction_type: transactionType,
    amount,
    currency: "INR",
    quantity: null,
    unit_price: null,
    blocked_consumed: null,
    effective_at: "2026-10-31T10:00:00.000Z",
    created_at: "2026-10-31T10:00:00.000Z",
    ...values,
  };
}

describe("capital calculation fixtures", () => {
  it("reconciles blocked, released, actually debited and refunded capital separately", () => {
    const summary = calculateCapitalSummaries(applications, mandates, allotments, [
      event("CAPITAL_BLOCKED", "1500.00"),
      event("ACTUAL_DEBIT", "1500.00", { blocked_consumed: "1500.00" }),
      event("REFUND_RECEIVED", "300.00"),
      event("ALLOTMENT_DEBIT", "1000.00"),
    ])[0];

    expect(summary).toEqual({
      currency: "INR",
      total_application_value: "1500",
      approved_mandate_value: "1500",
      currently_blocked_capital: "0",
      released_capital: "0",
      actually_invested_capital: "1200",
      refunds_received: "300",
      outstanding_refunds: "200",
      realized_pnl: "0",
      unrealized_pnl: null,
    });
  });

  it("counts explicit releases separately from blocks consumed by actual debits", () => {
    const summary = calculateCapitalSummaries(
      applications,
      [],
      [],
      [
        event("CAPITAL_BLOCKED", "1500.00"),
        event("ACTUAL_DEBIT", "1000.00", { blocked_consumed: "1000.00" }),
        event("CAPITAL_RELEASED", "500.00"),
      ],
    )[0];
    expect(summary.currently_blocked_capital).toBe("0");
    expect(summary.released_capital).toBe("500");
    expect(summary.actually_invested_capital).toBe("1000");
  });

  it("does not treat an approved mandate as a completed debit or as a blocked ledger entry", () => {
    const summary = calculateCapitalSummaries(applications, mandates, allotments, [])[0];
    expect(summary.approved_mandate_value).toBe("1500");
    expect(summary.currently_blocked_capital).toBe("0");
    expect(summary.actually_invested_capital).toBe("0");
  });

  it("calculates realized and marked-to-market P&L only with allotment and price details", () => {
    const summary = calculateCapitalSummaries(applications, mandates, allotments, [
      event("LISTING_SALE", "600.00", {
        quantity: 4,
        unit_price: "150.00",
      }),
      event("LISTING_PRICE_UPDATE", "1080.00", {
        quantity: 6,
        unit_price: "180.00",
        effective_at: "2026-10-31T11:00:00.000Z",
      }),
    ])[0];

    expect(summary.realized_pnl).toBe("200");
    expect(summary.unrealized_pnl).toBe("480");
  });

  it("does not estimate unrealized P&L when remaining shares have no listing price", () => {
    const summary = calculateCapitalSummaries(applications, mandates, allotments, [])[0];
    expect(summary.unrealized_pnl).toBeNull();
  });

  it("uses decimal-safe arithmetic and keeps currencies separate", () => {
    const rows = calculateCapitalSummaries(
      [
        { id: "inr", application_amount: "0.10", currency: "INR" },
        { id: "usd", application_amount: "2.50", currency: "USD" },
      ],
      [],
      [],
      [
        event("ACTUAL_DEBIT", "0.03", { currency: "INR", blocked_consumed: "0" }),
        event("ACTUAL_DEBIT", "2.50", { currency: "USD", blocked_consumed: "0" }),
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        currency: "INR",
        total_application_value: "0.1",
        actually_invested_capital: "0.03",
      }),
      expect.objectContaining({
        currency: "USD",
        total_application_value: "2.5",
        actually_invested_capital: "2.5",
      }),
    ]);
  });

  it("rejects negative reconciliation balances instead of masking invalid ledger data", () => {
    expect(() =>
      calculateCapitalSummaries(applications, mandates, allotments, [
        event("CAPITAL_RELEASED", "1.00"),
      ]),
    ).toThrow(RangeError);
    expect(() =>
      calculateCapitalSummaries(applications, mandates, allotments, [
        event("REFUND_RECEIVED", "600.00"),
      ]),
    ).toThrow(RangeError);
  });
});
