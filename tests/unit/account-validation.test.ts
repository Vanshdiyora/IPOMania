import { describe, expect, it } from "vitest";
import {
  accountListQuerySchema,
  dematAccountSchema,
  dematAccountUpdateSchema,
} from "@ipo-mania/validation";

const validAccount = {
  holder_name: "  Ananya Rao ",
  bank_name: "  Example Bank ",
  username: "ananya.rao",
  password: "  caseSensitive password  ",
  account_status: "active",
  notes: "Primary account",
};

describe("demat account validation", () => {
  it("trims and accepts a valid account", () => {
    expect(dematAccountSchema.parse(validAccount)).toMatchObject({
      holder_name: "Ananya Rao",
      bank_name: "Example Bank",
      password: "  caseSensitive password  ",
      account_status: "active",
    });
  });

  it.each([
    ["unknown field", { ...validAccount, broker_name: "Example Securities" }],
    ["removed depository field", { ...validAccount, depository_type: "NSDL" }],
    ["empty bank name", { ...validAccount, bank_name: "" }],
    ["empty username", { ...validAccount, username: "" }],
    ["empty password", { ...validAccount, password: "" }],
    ["client-supplied owner", { ...validAccount, user_id: "11111111-1111-4111-8111-111111111111" }],
  ])("rejects %s", (_description, account) => {
    expect(dematAccountSchema.safeParse(account).success).toBe(false);
  });

  it("allows only valid fields in partial updates", () => {
    expect(dematAccountUpdateSchema.safeParse({ holder_name: "Updated Holder" }).success).toBe(
      true,
    );
    expect(dematAccountUpdateSchema.safeParse({ password: "new secret" }).success).toBe(true);
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
    expect(accountListQuerySchema.safeParse({ depository: "NSDL" }).success).toBe(false);
    expect(
      accountListQuerySchema.safeParse({
        created_from: "2026-03-02T00:00:00.000Z",
        created_to: "2026-03-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
