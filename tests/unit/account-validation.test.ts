import { describe, expect, it } from "vitest";
import {
  accountListQuerySchema,
  dematAccountSchema,
  dematAccountUpdateSchema,
} from "@ipo-mania/validation";

const validAccount = {
  holder_name: "  Ananya Rao ",
  broker_name: "  Example Securities ",
  broker_code: "EX123",
  depository_type: "NSDL",
  masked_demat_identifier: "XXXX1234",
  masked_client_reference: "XXXX5678",
  account_status: "active",
  notes: "Primary account",
};

describe("demat account validation", () => {
  it("trims and accepts a valid account", () => {
    expect(dematAccountSchema.parse(validAccount)).toMatchObject({
      holder_name: "Ananya Rao",
      broker_name: "Example Securities",
      account_status: "active",
    });
  });

  it.each([
    ["blank broker", { ...validAccount, broker_name: "   " }],
    ["unknown depository", { ...validAccount, depository_type: "OTHER" }],
    ["missing masked identifier", { ...validAccount, masked_demat_identifier: "" }],
    ["unmasked identifier", { ...validAccount, masked_demat_identifier: "123456789" }],
    ["client-supplied owner", { ...validAccount, user_id: "11111111-1111-4111-8111-111111111111" }],
  ])("rejects %s", (_description, account) => {
    expect(dematAccountSchema.safeParse(account).success).toBe(false);
  });

  it("allows only valid fields in partial updates", () => {
    expect(dematAccountUpdateSchema.safeParse({ broker_name: "Updated Broker" }).success).toBe(
      true,
    );
    expect(
      dematAccountUpdateSchema.safeParse({ archived_at: new Date().toISOString() }).success,
    ).toBe(false);
    expect(dematAccountUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("validates server-side pagination and date filter order", () => {
    expect(accountListQuerySchema.parse({ page: "3", pageSize: "50" })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
    expect(accountListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(
      accountListQuerySchema.safeParse({
        created_from: "2026-03-02T00:00:00.000Z",
        created_to: "2026-03-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
