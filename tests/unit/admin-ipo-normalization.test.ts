import { describe, expect, it } from "vitest";
import { normalizeProviderIpo } from "../../workers/api/src/routes/admin-ipos";

describe("admin IPO provider normalization", () => {
  it("normalizes a mainboard provider record", () => {
    const normalized = normalizeProviderIpo({
      id: "provider-123",
      companyName: "Example Industries Limited",
      status: "OPEN",
      issue_type: "MAINBOARD",
      min_price: "100",
      max_price: "120",
      lotSize: "10",
      issue_open_date: "2026-11-10T00:00:00.000Z",
    });
    expect(normalized).toMatchObject({
      provider_id: "provider-123",
      company_name: "Example Industries Limited",
      ipo_status: "open",
      issue_type: "mainboard",
      price_band_min: 100,
      price_band_max: 120,
      lot_size: 10,
      bidding_start_date: "2026-11-10",
    });
  });

  it("rejects records without a stable provider identifier", () => {
    expect(normalizeProviderIpo({ company_name: "Missing Identifier" })).toBeNull();
  });
});
