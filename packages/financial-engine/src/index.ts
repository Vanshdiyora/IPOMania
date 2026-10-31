import DecimalJs from "decimal.js";

const ExactDecimal = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_UP,
});
type Decimal = InstanceType<typeof ExactDecimal>;

export type IpoCategory = "RETAIL" | "SHNI" | "BHNI" | "SHAREHOLDER";
export type IpoPriceType = "BID" | "CUT_OFF";

export interface IpoPricingInput {
  issue_price_min: string;
  issue_price_max: string;
  cut_off_price: string | null;
  lot_size: number;
}

export interface CategoryRules {
  category: IpoCategory;
  rule_version: number;
  lot_limit_status: "CONFIGURED" | "NO_PUBLISHED_LIMIT" | "UNCONFIGURED";
  minimum_lots: number | null;
  maximum_lots: number | null;
  lot_increment: number;
  investment_limit_status: "CONFIGURED" | "NO_PUBLISHED_LIMIT" | "UNCONFIGURED";
  minimum_investment: string | null;
  maximum_investment: string | null;
  shareholder_record_date: string | null;
  minimum_shareholding: number | null;
  eligibility_conditions: Array<{ id: string; description: string }>;
  allowed_price_types: IpoPriceType[];
  minimum_price_increment: string | null;
}

export interface CalculationInput {
  ipo: IpoPricingInput;
  category: IpoCategory;
  rules: CategoryRules;
  lots: number;
  price_type: IpoPriceType;
  price: string;
  shareholder_shares: number | null;
  eligibility_answers: Record<string, boolean | null>;
}

export interface CalculationError {
  code: string;
  message: string;
}

export interface CalculationResult {
  eligible: boolean;
  total_shares: number | null;
  application_amount: string | null;
  category: IpoCategory;
  rule_version: number;
  eligibility_verified: false;
  calculation_details: {
    lots: number;
    lot_size: number;
    total_shares: number | null;
    price_type: IpoPriceType;
    price: string;
    formula: string;
  };
  validation_errors: CalculationError[];
}

export function calculateTotalShares(lots: number, lotSize: number): number {
  if (!Number.isSafeInteger(lots) || lots <= 0) {
    throw new RangeError("Lots must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(lotSize) || lotSize <= 0) {
    throw new RangeError("Lot size must be a positive safe integer.");
  }
  const shares = lots * lotSize;
  if (!Number.isSafeInteger(shares)) {
    throw new RangeError("Total shares exceed the safe integer range.");
  }
  return shares;
}

export function calculateApplicationAmount(shares: number, price: string): string {
  if (!Number.isSafeInteger(shares) || shares <= 0) {
    throw new RangeError("Shares must be a positive safe integer.");
  }
  const amount = parsePositiveDecimal(price);
  return amount.mul(shares).toFixed();
}

export function validateLotCount(lots: number, lotSize: number, rules: CategoryRules) {
  const errors: CalculationError[] = [];
  if (!Number.isSafeInteger(lots) || lots <= 0) {
    errors.push({ code: "INVALID_LOT_COUNT", message: "Lots must be a positive whole number." });
    return errors;
  }
  if (!Number.isSafeInteger(lotSize) || lotSize <= 0) {
    errors.push({
      code: "INVALID_LOT_SIZE",
      message: "IPO lot size must be a positive whole number.",
    });
    return errors;
  }
  if (rules.lot_limit_status === "UNCONFIGURED") {
    errors.push({
      code: "LOT_RULES_UNCONFIGURED",
      message: "Lot limits are not configured for this IPO category.",
    });
  } else {
    if (rules.minimum_lots !== null && lots < rules.minimum_lots) {
      errors.push({
        code: "BELOW_MINIMUM_LOTS",
        message: `Choose at least ${rules.minimum_lots} lot(s).`,
      });
    }
    if (rules.maximum_lots !== null && lots > rules.maximum_lots) {
      errors.push({
        code: "ABOVE_MAXIMUM_LOTS",
        message: `Choose no more than ${rules.maximum_lots} lot(s).`,
      });
    }
  }
  if (!Number.isSafeInteger(rules.lot_increment) || rules.lot_increment < 1) {
    errors.push({
      code: "INVALID_LOT_INCREMENT",
      message: "The configured lot increment is invalid.",
    });
  } else if ((lots - (rules.minimum_lots ?? 1)) % rules.lot_increment !== 0) {
    errors.push({
      code: "INVALID_LOT_INCREMENT",
      message: `Lot quantity must be a multiple of ${rules.lot_increment}.`,
    });
  }
  return errors;
}

export function validatePrice(
  ipo: IpoPricingInput,
  priceType: IpoPriceType,
  priceValue: string,
  rules: CategoryRules,
) {
  const errors: CalculationError[] = [];
  let price: Decimal;
  try {
    price = parsePositiveDecimal(priceValue);
  } catch {
    return [{ code: "INVALID_PRICE", message: "Enter a valid positive price." }];
  }
  let minimum: Decimal;
  let maximum: Decimal;
  try {
    minimum = parsePositiveDecimal(ipo.issue_price_min);
    maximum = parsePositiveDecimal(ipo.issue_price_max);
  } catch {
    return [{ code: "INVALID_ISSUE_PRICE_RANGE", message: "The issue price range is invalid." }];
  }
  if (minimum.greaterThan(maximum)) {
    errors.push({
      code: "INVALID_ISSUE_PRICE_RANGE",
      message: "The issue price range is invalid.",
    });
  } else if (price.lessThan(minimum) || price.greaterThan(maximum)) {
    errors.push({
      code: "PRICE_OUTSIDE_ISSUE_RANGE",
      message: `Price must be between ${minimum.toString()} and ${maximum.toString()}.`,
    });
  }
  if (!rules.allowed_price_types.includes(priceType)) {
    errors.push({
      code: "PRICE_TYPE_NOT_ALLOWED",
      message: "This price type is not allowed by the configured IPO category rules.",
    });
  }
  if (priceType === "CUT_OFF") {
    if (ipo.cut_off_price === null) {
      errors.push({
        code: "CUT_OFF_PRICE_UNAVAILABLE",
        message: "No cut-off price is configured.",
      });
    } else if (!price.eq(parsePositiveDecimal(ipo.cut_off_price))) {
      errors.push({
        code: "CUT_OFF_PRICE_MISMATCH",
        message: "Cut-off applications must use the configured cut-off price.",
      });
    }
  }
  if (rules.minimum_price_increment !== null) {
    let increment: Decimal;
    try {
      increment = parsePositiveDecimal(rules.minimum_price_increment);
    } catch {
      errors.push({
        code: "INVALID_PRICE_INCREMENT",
        message: "The configured price increment is invalid.",
      });
      return errors;
    }
    if (!price.mod(increment).isZero()) {
      errors.push({
        code: "INVALID_PRICE_INCREMENT",
        message: `Price must follow the configured increment of ${increment.toString()}.`,
      });
    }
  }
  return errors;
}

export function validateCategory(
  category: string,
  rules: CategoryRules | null,
): CalculationError[] {
  if (!isIpoCategory(category)) {
    return [{ code: "INVALID_CATEGORY", message: "Choose a supported IPO category." }];
  }
  if (!rules || rules.category !== category) {
    return [
      {
        code: "CATEGORY_RULES_NOT_FOUND",
        message: "No issue-specific rules are configured for this category.",
      },
    ];
  }
  return [];
}

export function validateCategoryLimits(
  lots: number,
  applicationAmount: string,
  rules: CategoryRules,
): CalculationError[] {
  const errors: CalculationError[] = [];
  if (rules.investment_limit_status === "UNCONFIGURED") {
    errors.push({
      code: "INVESTMENT_RULES_UNCONFIGURED",
      message: "Investment limits are not configured for this IPO category.",
    });
    return errors;
  }
  const amount = parsePositiveDecimal(applicationAmount);
  if (
    rules.minimum_investment !== null &&
    amount.lessThan(parsePositiveDecimal(rules.minimum_investment))
  ) {
    errors.push({
      code: "BELOW_MINIMUM_INVESTMENT",
      message: `Application amount must be at least ${rules.minimum_investment}.`,
    });
  }
  if (
    rules.maximum_investment !== null &&
    amount.greaterThan(parsePositiveDecimal(rules.maximum_investment))
  ) {
    errors.push({
      code: "ABOVE_MAXIMUM_INVESTMENT",
      message: `Application amount must not exceed ${rules.maximum_investment}.`,
    });
  }
  if (!Number.isSafeInteger(lots) || lots < 1) {
    errors.push({ code: "INVALID_LOT_COUNT", message: "Lots must be a positive whole number." });
  }
  return errors;
}

export function checkShareholderEligibility(
  rules: CategoryRules,
  shareholderShares: number | null,
): CalculationError[] {
  if (rules.category !== "SHAREHOLDER") return [];
  if (rules.shareholder_record_date === null) {
    return [
      {
        code: "SHAREHOLDER_RECORD_DATE_MISSING",
        message: "Shareholder record-date criteria are not configured.",
      },
    ];
  }
  if (shareholderShares === null || !Number.isSafeInteger(shareholderShares)) {
    return [
      {
        code: "SHAREHOLDER_ELIGIBILITY_UNCONFIRMED",
        message: "Provide the eligible shareholding for the issue's record date.",
      },
    ];
  }
  if (shareholderShares < 1) {
    return [
      {
        code: "SHAREHOLDER_HOLDING_REQUIRED",
        message:
          "The provided holding does not include shares eligible for the shareholder category.",
      },
    ];
  }
  if (rules.minimum_shareholding !== null && shareholderShares < rules.minimum_shareholding) {
    return [
      {
        code: "SHAREHOLDER_HOLDING_BELOW_MINIMUM",
        message: `The provided holding is below the configured ${rules.minimum_shareholding}-share minimum.`,
      },
    ];
  }
  return [];
}

export function calculateMaximumEligibleLots(
  ipo: IpoPricingInput,
  rules: CategoryRules,
  price: string,
): number | null {
  if (
    !Number.isSafeInteger(ipo.lot_size) ||
    ipo.lot_size < 1 ||
    !Number.isSafeInteger(rules.lot_increment) ||
    rules.lot_increment < 1 ||
    (rules.maximum_lots !== null && !Number.isSafeInteger(rules.maximum_lots))
  ) {
    return null;
  }
  const validPrice = parsePositiveDecimal(price);
  if (
    rules.lot_limit_status === "UNCONFIGURED" ||
    rules.investment_limit_status === "UNCONFIGURED"
  ) {
    return null;
  }
  let maximum: number | null = rules.maximum_lots;
  if (rules.maximum_investment !== null) {
    const investmentMaximum = parsePositiveDecimal(rules.maximum_investment);
    const amountPerLot = validPrice.mul(ipo.lot_size);
    const investmentLotsDecimal = investmentMaximum.dividedToIntegerBy(amountPerLot);
    if (investmentLotsDecimal.greaterThan(Number.MAX_SAFE_INTEGER)) return null;
    const investmentLots = investmentLotsDecimal.toNumber();
    maximum = maximum === null ? investmentLots : Math.min(maximum, investmentLots);
  }
  if (maximum === null) return null;
  const increment = rules.lot_increment;
  const firstAllowedLots = rules.minimum_lots ?? 1;
  if (maximum < firstAllowedLots) return 0;
  const eligibleMaximum =
    firstAllowedLots + Math.floor((maximum - firstAllowedLots) / increment) * increment;
  return eligibleMaximum < firstAllowedLots ? 0 : eligibleMaximum;
}

export function validateApplicationConfiguration(input: CalculationInput): CalculationResult {
  const errors = validateCategory(input.category, input.rules);
  if (errors.length > 0) return makeResult(input, errors, null, null);
  errors.push(...validateLotCount(input.lots, input.ipo.lot_size, input.rules));
  errors.push(...validatePrice(input.ipo, input.price_type, input.price, input.rules));
  const priceErrors = errors.filter(
    ({ code }) => code === "INVALID_PRICE" || code === "INVALID_ISSUE_PRICE_RANGE",
  );
  let totalShares: number | null = null;
  let amount: string | null = null;
  if (priceErrors.length === 0 && Number.isSafeInteger(input.lots) && input.lots > 0) {
    try {
      totalShares = calculateTotalShares(input.lots, input.ipo.lot_size);
      amount = calculateApplicationAmount(totalShares, input.price);
      errors.push(...validateCategoryLimits(input.lots, amount, input.rules));
    } catch (error) {
      errors.push({
        code: "INVALID_CALCULATION_INPUT",
        message: error instanceof Error ? error.message : "The calculation input is invalid.",
      });
    }
  }
  errors.push(...checkShareholderEligibility(input.rules, input.shareholder_shares));
  for (const condition of input.rules.eligibility_conditions) {
    if (input.eligibility_answers[condition.id] !== true) {
      errors.push({
        code: "ELIGIBILITY_CONDITION_UNCONFIRMED",
        message: `Confirm this published condition: ${condition.description}`,
      });
    }
  }
  return makeResult(input, errors, totalShares, amount);
}

function makeResult(
  input: CalculationInput,
  errors: CalculationError[],
  totalShares: number | null,
  amount: string | null,
): CalculationResult {
  return {
    eligible: errors.length === 0,
    total_shares: totalShares,
    application_amount: amount,
    category: input.category,
    rule_version: input.rules.rule_version,
    eligibility_verified: false,
    calculation_details: {
      lots: input.lots,
      lot_size: input.ipo.lot_size,
      total_shares: totalShares,
      price_type: input.price_type,
      price: input.price,
      formula: "lots × lot size = total shares; total shares × price = application amount",
    },
    validation_errors: errors,
  };
}

function isIpoCategory(value: string): value is IpoCategory {
  return ["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"].includes(value);
}

function parsePositiveDecimal(value: string): Decimal {
  if (typeof value !== "string" || value.length > 64 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new RangeError("Amount must be a valid decimal string.");
  }
  const decimal = new ExactDecimal(value);
  if (!decimal.isFinite() || !decimal.greaterThan(0)) {
    throw new RangeError("Amount must be greater than zero.");
  }
  return decimal;
}
