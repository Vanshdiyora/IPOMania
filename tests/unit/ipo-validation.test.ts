import { describe, expect, it } from "vitest";
import {
  ipoCatalogListQuerySchema,
  ipoCategoryConfigurationSchema,
  ipoCalculationSchema,
  ipoListQuerySchema,
  ipoSchema,
} from "@ipo-mania/validation";

const ipo = {
  company_name: "Example Test Company",
  symbol: "TEST",
  ipo_type: "Mainboard",
  exchange: "NSE",
  issue_price_min: "100.00",
  issue_price_max: "125.00",
  cut_off_price: "125.00",
  lot_size: 10,
  issue_size: "1000000.00",
  opening_date: "2026-11-01",
  closing_date: "2026-11-03",
  allotment_date: null,
  listing_date: null,
  status: "UPCOMING",
  data_source: "MANUAL",
  source_reference: null,
  last_verified_at: null,
};

const categoryRules = {
  category: "RETAIL",
  lot_limit_status: "CONFIGURED",
  default_lots: 1,
  minimum_lots: 1,
  maximum_lots: 4,
  lot_increment: 1,
  investment_limit_status: "CONFIGURED",
  minimum_investment: "100.00",
  maximum_investment: "5000.00",
  reserved_shares: null,
  reserved_percentage: null,
  shareholder_record_date: null,
  minimum_shareholding: null,
  eligibility_conditions: [],
  allowed_price_types: ["BID", "CUT_OFF"],
  minimum_price_increment: "0.05",
  source_reference: null,
  rule_source: "MANUAL",
  last_verified_at: null,
};

describe("IPO boundary validation", () => {
  it("validates catalog pagination and only accepts catalog statuses", () => {
    expect(ipoListQuerySchema.parse({})).toMatchObject({
      source: "personal",
      sort: "date_desc",
    });
    expect(ipoCatalogListQuerySchema.parse({})).toEqual({
      page: 1,
      page_size: 25,
      sort: "date_desc",
    });
    expect(
      ipoCatalogListQuerySchema.parse({
        page: "2",
        page_size: "100",
        status: "OPEN",
        search: " Company ",
      }),
    ).toEqual({ page: 2, page_size: 100, status: "OPEN", search: "Company", sort: "date_desc" });
    expect(ipoCatalogListQuerySchema.parse({ status: ["OPEN", "CLOSED"] }).status).toEqual([
      "OPEN",
      "CLOSED",
    ]);
    expect(ipoListQuerySchema.parse({ status: ["UPCOMING", "LISTED"] }).status).toEqual([
      "UPCOMING",
      "LISTED",
    ]);
    for (const sort of [
      "date_desc",
      "date_asc",
      "price_asc",
      "price_desc",
      "name_asc",
      "name_desc",
      "opening_asc",
    ]) {
      expect(ipoCatalogListQuerySchema.parse({ sort }).sort).toBe(sort);
    }
    for (const query of [
      { page: "0" },
      { page_size: "101" },
      { status: "WITHDRAWN" },
      { status: ["OPEN", "OPEN"] },
      { status: ["OPEN", "WITHDRAWN"] },
      { search: "a".repeat(161) },
      { include_archived: "true" },
      { user_id: "untrusted-owner" },
    ]) {
      expect(ipoCatalogListQuerySchema.safeParse(query).success).toBe(false);
    }
  });

  it("accepts manual IPO values without marking them verified", () => {
    expect(ipoSchema.parse(ipo)).toMatchObject({
      data_source: "MANUAL",
      last_verified_at: null,
    });
  });

  it("rejects invalid price ranges and dates", () => {
    expect(ipoSchema.safeParse({ ...ipo, issue_price_min: "130.00" }).success).toBe(false);
    expect(ipoSchema.safeParse({ ...ipo, closing_date: "2026-10-30" }).success).toBe(false);
  });

  it("requires explicit rule-limit states and rejects arbitrary rule properties", () => {
    expect(ipoCategoryConfigurationSchema.safeParse(categoryRules).success).toBe(true);
    expect(
      ipoCategoryConfigurationSchema.safeParse({
        ...categoryRules,
        category: "BHNI",
        maximum_lots: null,
        undocumented_rule: true,
      }).success,
    ).toBe(false);
    expect(
      ipoCategoryConfigurationSchema.safeParse({
        ...categoryRules,
        lot_limit_status: "UNCONFIGURED",
        minimum_lots: null,
        maximum_lots: null,
      }).success,
    ).toBe(true);
    expect(
      ipoCategoryConfigurationSchema.safeParse({
        ...categoryRules,
        minimum_lots: 2,
        default_lots: 1,
      }).success,
    ).toBe(false);
    expect(
      ipoCategoryConfigurationSchema.safeParse({
        ...categoryRules,
        minimum_lots: 2,
        maximum_lots: 8,
        lot_increment: 3,
        default_lots: 5,
      }).success,
    ).toBe(true);
    expect(
      ipoCategoryConfigurationSchema.safeParse({
        ...categoryRules,
        minimum_lots: 2,
        maximum_lots: 8,
        lot_increment: 3,
        default_lots: 4,
      }).success,
    ).toBe(false);
  });

  it("requires structured shareholder evidence inputs but does not claim verification", () => {
    expect(
      ipoCalculationSchema.safeParse({
        ipo_id: "8a59de8c-6731-4ab9-a67d-c7e8f4a17dfd",
        demat_account_id: "9959bdf1-04e2-487b-b73e-8a5972671471",
        category: "SHAREHOLDER",
        lots: 1,
        price_type: "CUT_OFF",
        price: "125.00",
        shareholder_shares: 0,
        eligibility_answers: {},
      }).success,
    ).toBe(true);
  });
});
