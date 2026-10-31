import { describe, expect, it } from "vitest";
import {
  dashboardAnalyticsExportQuerySchema,
  dashboardAnalyticsQuerySchema,
} from "@ipo-mania/validation";

describe("dashboard analytics query validation", () => {
  it("accepts bounded date and owner-scoped analytics filters", () => {
    expect(
      dashboardAnalyticsQuerySchema.parse({
        date_from: "2026-10-01",
        date_to: "2026-10-31",
        ipo_id: "88888888-8888-4888-8888-888888888888",
        category: "SHAREHOLDER",
        account_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        limit: "20",
      }),
    ).toMatchObject({
      date_from: "2026-10-01",
      date_to: "2026-10-31",
      category: "SHAREHOLDER",
      limit: 20,
    });
  });

  it("rejects inverted dates, oversized date ranges, and invalid limits", () => {
    expect(
      dashboardAnalyticsQuerySchema.safeParse({
        date_from: "2026-10-31",
        date_to: "2026-10-01",
      }).success,
    ).toBe(false);
    expect(
      dashboardAnalyticsQuerySchema.safeParse({
        date_from: "2016-01-01",
        date_to: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(dashboardAnalyticsQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it("rejects unrecognized parameters and defaults exports to CSV", () => {
    expect(
      dashboardAnalyticsQuerySchema.safeParse({ user_id: "22222222-2222-4222-8222-222222222222" })
        .success,
    ).toBe(false);
    expect(dashboardAnalyticsExportQuerySchema.parse({}).format).toBe("csv");
    expect(dashboardAnalyticsExportQuerySchema.safeParse({ format: "pdf" }).success).toBe(false);
  });
});
