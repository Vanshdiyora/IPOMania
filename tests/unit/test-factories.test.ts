import { calculateCapitalSummaries } from "@ipo-mania/financial-engine";
import { describe, expect, it } from "vitest";
import {
  createCapitalAllotment,
  createCapitalApplication,
  createCapitalLedgerEntry,
} from "../helpers/factories";

describe("synthetic financial test factories", () => {
  it("supports exact financial regression cases through the existing engine", () => {
    const application = createCapitalApplication();
    const allotment = createCapitalAllotment({
      allotment_status: "PARTIAL_ALLOTMENT",
      allotted_shares: 10,
      allotment_price: "10.000000",
      refund_amount: "900.000001",
    });
    const summary = calculateCapitalSummaries(
      [application],
      [],
      [allotment],
      [
        createCapitalLedgerEntry({
          transaction_type: "CAPITAL_BLOCKED",
          amount: "1000.000001",
        }),
        createCapitalLedgerEntry({
          transaction_type: "ACTUAL_DEBIT",
          amount: "1000.000001",
          blocked_consumed: "1000.000001",
        }),
        createCapitalLedgerEntry({
          transaction_type: "ALLOTMENT_DEBIT",
          amount: "100.000000",
        }),
        createCapitalLedgerEntry({
          transaction_type: "REFUND_RECEIVED",
          amount: "900.000001",
        }),
      ],
    );

    expect(summary).toEqual([
      expect.objectContaining({
        currency: "INR",
        currently_blocked_capital: "0",
        actually_invested_capital: "100",
        refunds_received: "900.000001",
        outstanding_refunds: "0",
      }),
    ]);
  });
});
