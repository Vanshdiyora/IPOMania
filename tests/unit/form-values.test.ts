import { describe, expect, it } from "vitest";
import {
  toIsoDateTime,
  toLocalDateTime,
  formValuesFromRecord,
} from "../../apps/web/src/lib/formValues";
import { adminIpoSchema } from "../../packages/validation/src/index";

describe("form dates", () => {
  it("does not throw while an optional date is empty or incomplete", () => {
    expect(toIsoDateTime("")).toBeNull();
    expect(toIsoDateTime("2026-11-")).toBe("2026-11-");
    expect(toIsoDateTime("invalid")).toBe("invalid");
    expect(toIsoDateTime("2026-11-02T10:30:00Z")).toBe("2026-11-02T10:30:00.000Z");
    expect(toLocalDateTime("invalid")).toBe("");
  });
});

describe("shared admin editor boundary", () => {
  const base = { company_name: " Test company ", issue_type: "mainboard", ipo_status: "upcoming" };
  it("preserves unknown optional values as null and normalizes real input", () => {
    expect(
      adminIpoSchema.parse({ ...base, lot_size: "10", listing_price: null, listing_date: null }),
    ).toMatchObject({
      company_name: "Test company",
      lot_size: 10,
      listing_price: null,
      listing_date: null,
    });
  });
  it.each([
    { company_name: " " },
    { issue_price: "abc" },
    { lot_size: "1.5" },
    { listing_date: "2026-11-" },
    { ipo_status: "unknown" },
  ])("rejects invalid editor input %j", (invalid) => {
    expect(adminIpoSchema.safeParse({ ...base, ...invalid }).success).toBe(false);
  });
});

it("loads editable fields without leaking API record metadata into strict form validation", () => {
  const record = { name: "Existing", optional: null, id: "server-id", user_id: "owner" };
  expect(formValuesFromRecord({ name: "", optional: "" as string | null }, record)).toEqual({
    name: "Existing",
    optional: null,
  });
});
