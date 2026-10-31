import { describe, expect, it } from "vitest";
import {
  allotmentSchema,
  allotmentUpdateSchema,
  capitalLedgerEntrySchema,
  mandateSchema,
  mandateUpdateSchema,
} from "@ipo-mania/validation";

const applicationId = "11111111-1111-4111-8111-111111111111";

describe("capital-management validation", () => {
  it("accepts a user-recorded pending mandate without a client-selected status", () => {
    expect(
      mandateSchema.safeParse({
        application_id: applicationId,
        mandate_reference: "UPI-REF-100",
        mandate_amount: "1250.500000",
        notes: null,
      }).success,
    ).toBe(true);
    expect(
      mandateSchema.safeParse({
        application_id: applicationId,
        mandate_reference: "UPI-REF-100",
        mandate_amount: "1250.50",
        mandate_status: "APPROVED",
      }).success,
    ).toBe(false);
  });

  it("rejects empty mandate updates and validates supported status values", () => {
    expect(mandateUpdateSchema.safeParse({}).success).toBe(false);
    expect(mandateUpdateSchema.safeParse({ mandate_status: "APPROVED" }).success).toBe(true);
    expect(mandateUpdateSchema.safeParse({ mandate_status: "SETTLED" }).success).toBe(false);
  });

  it("validates the shape of full and partial allotments before database issue checks", () => {
    const full = {
      application_id: applicationId,
      allotment_status: "ALLOTTED",
      allotted_lots: 2,
      allotted_shares: 20,
      allotment_price: "100.00",
      refund_amount: "0",
      allotment_date: "2026-10-31",
    };
    expect(allotmentSchema.safeParse(full).success).toBe(true);
    expect(
      allotmentSchema.safeParse({
        ...full,
        allotment_status: "PARTIAL_ALLOTMENT",
        allotted_lots: 1,
        allotted_shares: 10,
        refund_amount: "1000.00",
      }).success,
    ).toBe(true);
    expect(
      allotmentSchema.safeParse({
        ...full,
        allotment_status: "NOT_ALLOTTED",
        allotted_lots: 0,
        allotted_shares: 0,
        allotment_price: null,
      }).success,
    ).toBe(true);
    expect(
      allotmentSchema.safeParse({
        ...full,
        allotment_status: "NOT_ALLOTTED",
        allotted_lots: 1,
      }).success,
    ).toBe(false);
    expect(allotmentUpdateSchema.safeParse({ refund_amount: "250.00" }).success).toBe(true);
  });

  it("requires listing sale and valuation amounts to equal quantity times price", () => {
    const sale = {
      application_id: applicationId,
      transaction_type: "LISTING_SALE",
      amount: "375.00",
      currency: "INR",
      effective_at: "2026-10-31T12:00:00.000Z",
      audit_reference: "broker-fill-17",
      idempotency_key: "broker-fill-17",
      quantity: 3,
      unit_price: "125.00",
    };
    expect(capitalLedgerEntrySchema.safeParse(sale).success).toBe(true);
    expect(capitalLedgerEntrySchema.safeParse({ ...sale, amount: "374.99" }).success).toBe(false);
    expect(
      capitalLedgerEntrySchema.safeParse({
        ...sale,
        transaction_type: "ADJUSTMENT",
        quantity: undefined,
        unit_price: undefined,
        adjustment_direction: "CREDIT",
      }).success,
    ).toBe(true);
  });

  it("requires idempotency and audit fields and rejects client-controlled ownership/source", () => {
    const entry = {
      application_id: applicationId,
      transaction_type: "CAPITAL_BLOCKED",
      amount: "100.00",
      currency: "INR",
      effective_at: "2026-10-31T12:00:00.000Z",
      audit_reference: "bank-block-17",
      idempotency_key: "block-17",
    };
    expect(capitalLedgerEntrySchema.safeParse(entry).success).toBe(true);
    expect(capitalLedgerEntrySchema.safeParse({ ...entry, user_id: "forged" }).success).toBe(false);
    expect(capitalLedgerEntrySchema.safeParse({ ...entry, idempotency_key: "" }).success).toBe(
      false,
    );
    expect(
      capitalLedgerEntrySchema.safeParse({ ...entry, source: "AUTHORIZED_INTEGRATION" }).success,
    ).toBe(false);
  });
});
