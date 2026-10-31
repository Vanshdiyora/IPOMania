import { describe, expect, it } from "vitest";
import {
  calculateApplicationAmount,
  calculateMaximumEligibleLots,
  calculateTotalShares,
  checkShareholderEligibility,
  validateApplicationConfiguration,
  validateCategory,
  validateLotCount,
  validatePrice,
  type CalculationInput,
  type CategoryRules,
} from "@ipo-mania/financial-engine";

const baseRules: CategoryRules = {
  category: "RETAIL",
  rule_version: 1,
  lot_limit_status: "CONFIGURED",
  minimum_lots: 1,
  maximum_lots: 3,
  lot_increment: 1,
  investment_limit_status: "CONFIGURED",
  minimum_investment: null,
  maximum_investment: "1000",
  shareholder_record_date: null,
  minimum_shareholding: null,
  eligibility_conditions: [],
  allowed_price_types: ["BID", "CUT_OFF"],
  minimum_price_increment: "0.05",
};

function makeInput(
  category: CategoryRules["category"] = "RETAIL",
  rules: CategoryRules = { ...baseRules, category },
): CalculationInput {
  return {
    ipo: {
      issue_price_min: "10.00",
      issue_price_max: "20.00",
      cut_off_price: "20.00",
      lot_size: 10,
    },
    category,
    rules,
    lots: 1,
    price_type: "BID",
    price: "10.05",
    shareholder_shares: null,
    eligibility_answers: {},
  };
}

describe("financial engine", () => {
  it.each(["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"] as const)(
    "evaluates an issue-specific %s configuration",
    (category) => {
      const rules: CategoryRules = {
        ...baseRules,
        category,
        shareholder_record_date: category === "SHAREHOLDER" ? "2026-01-15" : null,
        minimum_shareholding: null,
      };
      const input = makeInput(category, rules);
      const result = validateApplicationConfiguration(input);
      expect(result.rule_version).toBe(1);
      expect(result.eligible).toBe(category !== "SHAREHOLDER");
      expect(result.eligibility_verified).toBe(false);
    },
  );

  it("calculates shares and money with decimal arithmetic", () => {
    expect(calculateTotalShares(3, 25)).toBe(75);
    expect(calculateApplicationAmount(3, "0.10")).toBe("0.3");
    expect(calculateApplicationAmount(3, "0.07")).toBe("0.21");
  });

  it("rejects zero, fractional, and unsafe lot sizes", () => {
    expect(validateLotCount(1, 0, baseRules)[0]?.code).toBe("INVALID_LOT_SIZE");
    expect(() => calculateTotalShares(1, 0)).toThrow(RangeError);
    expect(() => calculateTotalShares(1.5, 10)).toThrow(RangeError);
    expect(() => calculateTotalShares(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });

  it("accepts lot and investment boundaries and explains out-of-bound values", () => {
    const rules = { ...baseRules, minimum_lots: 2, maximum_lots: 4, maximum_investment: "402" };
    expect(validateLotCount(2, 10, rules)).toEqual([]);
    expect(validateLotCount(5, 10, rules)[0]?.code).toBe("ABOVE_MAXIMUM_LOTS");

    const atLimit = validateApplicationConfiguration({
      ...makeInput("RETAIL", rules),
      lots: 4,
      price: "10.05",
    });
    expect(atLimit.eligible).toBe(true);
    const aboveLimit = validateApplicationConfiguration({
      ...makeInput("RETAIL", rules),
      lots: 4,
      price: "10.10",
    });
    expect(aboveLimit.eligible).toBe(false);
    expect(aboveLimit.validation_errors.map(({ code }) => code)).toContain(
      "ABOVE_MAXIMUM_INVESTMENT",
    );
  });

  it("rejects a lot quantity that violates the configured increment", () => {
    const rules = { ...baseRules, lot_increment: 2 };
    expect(validateLotCount(2, 10, rules).map(({ code }) => code)).toContain(
      "INVALID_LOT_INCREMENT",
    );
  });

  it("rejects out-of-band, disallowed, and incorrectly incremented prices", () => {
    const input = makeInput();
    expect(validatePrice(input.ipo, "BID", "20.05", input.rules)[0]?.code).toBe(
      "PRICE_OUTSIDE_ISSUE_RANGE",
    );
    expect(validatePrice(input.ipo, "BID", "10.03", input.rules)[0]?.code).toBe(
      "INVALID_PRICE_INCREMENT",
    );
    expect(validatePrice(input.ipo, "CUT_OFF", "19.95", input.rules)[0]?.code).toBe(
      "CUT_OFF_PRICE_MISMATCH",
    );
    expect(validatePrice(input.ipo, "CUT_OFF", "20.00", {
      ...input.rules,
      allowed_price_types: ["BID"],
    }).map(({ code }) => code)).toContain("PRICE_TYPE_NOT_ALLOWED");
  });

  it("requires a configured category and rejects unknown categories", () => {
    expect(validateCategory("OTHER", null)[0]?.code).toBe("INVALID_CATEGORY");
    expect(validateCategory("RETAIL", null)[0]?.code).toBe("CATEGORY_RULES_NOT_FOUND");
    expect(validateCategory("SHNI", baseRules)[0]?.code).toBe("CATEGORY_RULES_NOT_FOUND");
  });

  it("does not treat unknown limits as unlimited", () => {
    const rules: CategoryRules = {
      ...baseRules,
      lot_limit_status: "UNCONFIGURED",
      minimum_lots: null,
      maximum_lots: null,
      investment_limit_status: "UNCONFIGURED",
      maximum_investment: null,
    };
    const result = validateApplicationConfiguration(makeInput("RETAIL", rules));
    expect(result.eligible).toBe(false);
    expect(result.validation_errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["LOT_RULES_UNCONFIGURED", "INVESTMENT_RULES_UNCONFIGURED"]),
    );
    expect(calculateMaximumEligibleLots(makeInput().ipo, rules, "10.05")).toBeNull();
  });

  it("checks shareholder record-date holding criteria without inferring eligibility", () => {
    const rules: CategoryRules = {
      ...baseRules,
      category: "SHAREHOLDER",
      shareholder_record_date: "2026-01-15",
      minimum_shareholding: 5,
    };
    expect(checkShareholderEligibility(rules, null)[0]?.code).toBe(
      "SHAREHOLDER_ELIGIBILITY_UNCONFIRMED",
    );
    expect(checkShareholderEligibility(rules, 4)[0]?.code).toBe(
      "SHAREHOLDER_HOLDING_BELOW_MINIMUM",
    );
    expect(checkShareholderEligibility(rules, 5)).toEqual([]);
  });

  it("requires explicit answers to published issue-specific eligibility conditions", () => {
    const rules = {
      ...baseRules,
      eligibility_conditions: [{ id: "residency", description: "Published test condition." }],
    };
    const result = validateApplicationConfiguration(makeInput("RETAIL", rules));
    expect(result.validation_errors[0]?.code).toBe("ELIGIBILITY_CONDITION_UNCONFIRMED");
    expect(
      validateApplicationConfiguration({
        ...makeInput("RETAIL", rules),
        eligibility_answers: { residency: true },
      }).eligible,
    ).toBe(true);
  });

  it("returns no finite maximum when issue-specific rules contain no maximum", () => {
    const rules = {
      ...baseRules,
      lot_limit_status: "NO_PUBLISHED_LIMIT" as const,
      minimum_lots: null,
      maximum_lots: null,
      investment_limit_status: "NO_PUBLISHED_LIMIT" as const,
      maximum_investment: null,
    };
    expect(calculateMaximumEligibleLots(makeInput().ipo, rules, "10.05")).toBeNull();
  });

  it("reproduces a historical result from its immutable rule and pricing snapshot", () => {
    const historicalInput = structuredClone({ ...makeInput(), lots: 2 });
    const historicalResult = validateApplicationConfiguration(historicalInput);
    const revisedInput = makeInput("RETAIL", {
      ...baseRules,
      rule_version: 2,
      maximum_lots: 1,
      maximum_investment: "300",
    });
    revisedInput.lots = 2;
    const revisedResult = validateApplicationConfiguration(revisedInput);

    expect(historicalResult.rule_version).toBe(1);
    expect(historicalResult.eligible).toBe(true);
    expect(revisedResult.rule_version).toBe(2);
    expect(revisedResult.eligible).toBe(false);
    expect(revisedResult.validation_errors.map(({ code }) => code)).toContain(
      "ABOVE_MAXIMUM_LOTS",
    );
    expect(validateApplicationConfiguration(historicalInput)).toEqual(historicalResult);
  });
});
