import type {
  CapitalAllotment,
  CapitalApplication,
  CapitalLedgerEntry,
  CapitalMandate,
} from "@ipo-mania/financial-engine";

export const testIds = {
  userA: "11111111-1111-4111-8111-111111111111",
  userB: "22222222-2222-4222-8222-222222222222",
  ipo: "33333333-3333-4333-8333-333333333333",
  account: "44444444-4444-4444-8444-444444444444",
  application: "55555555-5555-4555-8555-555555555555",
} as const;

export function createCapitalApplication(
  overrides: Partial<CapitalApplication> = {},
): CapitalApplication {
  return {
    id: testIds.application,
    application_amount: "1000.000001",
    currency: "INR",
    ...overrides,
  };
}

export function createCapitalMandate(overrides: Partial<CapitalMandate> = {}): CapitalMandate {
  return {
    mandate_amount: "1000.000001",
    mandate_status: "PENDING",
    currency: "INR",
    ...overrides,
  };
}

export function createCapitalAllotment(
  overrides: Partial<CapitalAllotment> = {},
): CapitalAllotment {
  return {
    application_id: testIds.application,
    allotment_status: "NOT_ALLOTTED",
    allotted_shares: 0,
    allotment_price: null,
    refund_amount: "1000.000001",
    currency: "INR",
    ...overrides,
  };
}

export function createCapitalLedgerEntry(
  overrides: Partial<CapitalLedgerEntry> = {},
): CapitalLedgerEntry {
  return {
    application_id: testIds.application,
    transaction_type: "APPLICATION_RECORDED",
    amount: "1000.000001",
    currency: "INR",
    quantity: null,
    unit_price: null,
    blocked_consumed: "0",
    effective_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
