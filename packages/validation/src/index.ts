export { z } from "zod";

import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address."),
    fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120),
  })
  .strict();

function compareDecimalStrings(left: string, right: string): number {
  if (typeof left !== "string" || typeof right !== "string") return 0;
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const normalizedLeftWhole = leftWhole.replace(/^0+(?=\d)/, "");
  const normalizedRightWhole = rightWhole.replace(/^0+(?=\d)/, "");
  if (normalizedLeftWhole.length !== normalizedRightWhole.length) {
    return normalizedLeftWhole.length < normalizedRightWhole.length ? -1 : 1;
  }
  if (normalizedLeftWhole !== normalizedRightWhole) {
    return normalizedLeftWhole < normalizedRightWhole ? -1 : 1;
  }
  const precision = Math.max(leftFraction.length, rightFraction.length);
  const normalizedLeftFraction = leftFraction.padEnd(precision, "0");
  const normalizedRightFraction = rightFraction.padEnd(precision, "0");
  if (normalizedLeftFraction === normalizedRightFraction) return 0;
  return normalizedLeftFraction < normalizedRightFraction ? -1 : 1;
}

export const preferencesUpdateSchema = z
  .object({
    email_notifications: z.boolean(),
    timezone: z.string().trim().min(1).max(64),
  })
  .strict();

export const depositoryTypeSchema = z.enum(["NSDL", "CDSL"]);
export const accountStatusSchema = z.enum(["active", "inactive", "closed"]);

export const dematAccountSchema = z
  .object({
    holder_name: z.string().trim().min(1).max(160),
    broker_name: z.string().trim().min(1).max(120),
    broker_code: z.string().trim().min(1).max(40).nullable().optional(),
    depository_type: depositoryTypeSchema,
    masked_demat_identifier: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/[xX*]/, "Use a masked identifier containing X or * characters."),
    masked_client_reference: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/[xX*]/, "Use a masked reference containing X or * characters.")
      .nullable()
      .optional(),
    account_status: accountStatusSchema.default("active"),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const dematAccountUpdateSchema = dematAccountSchema.partial().strict();

export const accountListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    holder_name: z.string().trim().max(160).optional(),
    broker: z.string().trim().max(120).optional(),
    depository: depositoryTypeSchema.optional(),
    status: accountStatusSchema.optional(),
    created_from: z.iso.datetime().optional(),
    created_to: z.iso.datetime().optional(),
    archived: z.enum(["true", "false", "all"]).default("false"),
  })
  .strict()
  .refine(
    (query) =>
      !query.created_from ||
      !query.created_to ||
      new Date(query.created_from) <= new Date(query.created_to),
    { message: "created_from must be earlier than created_to.", path: ["created_from"] },
  );

export const accountImportRowSchema = dematAccountSchema.extend({
  row_number: z.number().int().min(1).max(500),
});

export const accountImportPreviewSchema = z
  .object({
    file_name: z.string().trim().min(1).max(255),
    file_type: z.enum([
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
    rows: z.array(z.unknown()).min(1).max(500),
  })
  .strict();

export const ipoStatusSchema = z.enum([
  "UPCOMING",
  "OPEN",
  "CLOSED",
  "ALLOTMENT_PENDING",
  "LISTED",
  "WITHDRAWN",
]);
export const ipoCategorySchema = z.enum(["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"]);

const priceDecimalSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,6})?$/, "Enter a price with at most 12 integer and 6 decimal digits.");
const amountDecimalSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,20}(?:\.\d{1,4})?$/,
    "Enter an amount with at most 20 integer and 4 decimal digits.",
  );
const decimalStringSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,20}(?:\.\d{1,6})?$/,
    "Enter a decimal amount with at most 20 integer and 6 decimal digits.",
  );
const positivePriceSchema = priceDecimalSchema.refine((value) => /[1-9]/.test(value));
const positiveAmountSchema = amountDecimalSchema.refine((value) => /[1-9]/.test(value));
const optionalDateSchema = z.iso.date().nullable();

const ipoObjectSchema = z
  .object({
    company_name: z.string().trim().min(1).max(160),
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(24)
      .regex(/^[A-Z0-9._-]+$/),
    ipo_type: z.string().trim().min(1).max(40),
    exchange: z.string().trim().min(1).max(40),
    issue_price_min: positivePriceSchema,
    issue_price_max: positivePriceSchema,
    cut_off_price: positivePriceSchema.nullable(),
    lot_size: z.number().int().positive().max(1_000_000),
    issue_size: positiveAmountSchema,
    opening_date: z.iso.date(),
    closing_date: z.iso.date(),
    allotment_date: optionalDateSchema,
    listing_date: optionalDateSchema,
    status: ipoStatusSchema,
    data_source: z.enum(["MANUAL", "PUBLISHED_SOURCE"]).default("MANUAL"),
    source_reference: z.string().trim().max(1000).nullable(),
    last_verified_at: z.iso.datetime().nullable(),
  })
  .strict();

export const ipoSchema = ipoObjectSchema.superRefine((ipo, context) => {
  if (
    ipo.issue_price_min &&
    ipo.issue_price_max &&
    compareDecimalStrings(ipo.issue_price_min, ipo.issue_price_max) > 0
  ) {
    context.addIssue({
      code: "custom",
      message: "Minimum issue price cannot exceed maximum issue price.",
      path: ["issue_price_min"],
    });
  }
  if (
    ipo.cut_off_price !== null &&
    ipo.cut_off_price !== undefined &&
    ipo.issue_price_min &&
    ipo.issue_price_max &&
    (compareDecimalStrings(ipo.cut_off_price, ipo.issue_price_min) < 0 ||
      compareDecimalStrings(ipo.cut_off_price, ipo.issue_price_max) > 0)
  ) {
    context.addIssue({
      code: "custom",
      message: "Cut-off price must be within the issue price range.",
      path: ["cut_off_price"],
    });
  }
  if (ipo.opening_date && ipo.closing_date && ipo.opening_date > ipo.closing_date) {
    context.addIssue({
      code: "custom",
      message: "Opening date must not be after closing date.",
      path: ["opening_date"],
    });
  }
});

export const ipoUpdateSchema = ipoObjectSchema.partial().superRefine((ipo, context) => {
  if (
    ipo.issue_price_min &&
    ipo.issue_price_max &&
    compareDecimalStrings(ipo.issue_price_min, ipo.issue_price_max) > 0
  ) {
    context.addIssue({
      code: "custom",
      message: "Minimum issue price cannot exceed maximum issue price.",
      path: ["issue_price_min"],
    });
  }
  if (
    ipo.cut_off_price &&
    ipo.issue_price_min &&
    ipo.issue_price_max &&
    (compareDecimalStrings(ipo.cut_off_price, ipo.issue_price_min) < 0 ||
      compareDecimalStrings(ipo.cut_off_price, ipo.issue_price_max) > 0)
  ) {
    context.addIssue({
      code: "custom",
      message: "Cut-off price must be within the issue price range.",
      path: ["cut_off_price"],
    });
  }
  if (ipo.opening_date && ipo.closing_date && ipo.opening_date > ipo.closing_date) {
    context.addIssue({
      code: "custom",
      message: "Opening date must not be after closing date.",
      path: ["opening_date"],
    });
  }
});

export const ipoListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).optional(),
    status: ipoStatusSchema.optional(),
    exchange: z.string().trim().max(40).optional(),
    opening_from: z.iso.date().optional(),
    opening_to: z.iso.date().optional(),
    include_archived: z.enum(["true", "false"]).default("false"),
  })
  .strict()
  .refine(
    (query) => !query.opening_from || !query.opening_to || query.opening_from <= query.opening_to,
    { message: "opening_from must not be after opening_to.", path: ["opening_from"] },
  );

const eligibilityConditionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/),
    description: z.string().trim().min(1).max(500),
  })
  .strict();

export const ipoCategoryConfigurationSchema = z
  .object({
    category: ipoCategorySchema,
    lot_limit_status: z.enum(["CONFIGURED", "NO_PUBLISHED_LIMIT", "UNCONFIGURED"]),
    minimum_lots: z.number().int().positive().max(2_147_483_647).nullable(),
    maximum_lots: z.number().int().positive().max(2_147_483_647).nullable(),
    lot_increment: z.number().int().positive().max(2_147_483_647),
    investment_limit_status: z.enum(["CONFIGURED", "NO_PUBLISHED_LIMIT", "UNCONFIGURED"]),
    minimum_investment: positiveAmountSchema.nullable(),
    maximum_investment: positiveAmountSchema.nullable(),
    reserved_shares: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    reserved_percentage: decimalStringSchema
      .refine(
        (value) => compareDecimalStrings(value, "100") <= 0,
        "Reserved percentage cannot exceed 100.",
      )
      .nullable(),
    shareholder_record_date: optionalDateSchema,
    minimum_shareholding: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    eligibility_conditions: z.array(eligibilityConditionSchema).max(20),
    allowed_price_types: z
      .array(z.enum(["BID", "CUT_OFF"]))
      .min(1)
      .max(2),
    minimum_price_increment: positivePriceSchema.nullable(),
    source_reference: z.string().trim().max(1000).nullable(),
    rule_source: z.enum(["MANUAL", "PUBLISHED_SOURCE"]).default("MANUAL"),
    last_verified_at: z.iso.datetime().nullable(),
  })
  .strict()
  .superRefine((configuration, context) => {
    if (
      configuration.lot_limit_status === "CONFIGURED" &&
      configuration.minimum_lots === null &&
      configuration.maximum_lots === null
    ) {
      context.addIssue({
        code: "custom",
        message: "A configured lot limit must include a minimum or maximum.",
        path: ["minimum_lots"],
      });
    }
    if (
      configuration.lot_limit_status !== "CONFIGURED" &&
      (configuration.minimum_lots !== null || configuration.maximum_lots !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Lot bounds are only allowed when lot limits are configured.",
        path: ["lot_limit_status"],
      });
    }
    if (
      configuration.investment_limit_status === "CONFIGURED" &&
      configuration.minimum_investment === null &&
      configuration.maximum_investment === null
    ) {
      context.addIssue({
        code: "custom",
        message: "A configured investment limit must include a minimum or maximum.",
        path: ["minimum_investment"],
      });
    }
    if (
      configuration.investment_limit_status !== "CONFIGURED" &&
      (configuration.minimum_investment !== null || configuration.maximum_investment !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Investment bounds are only allowed when investment limits are configured.",
        path: ["investment_limit_status"],
      });
    }
    if (
      configuration.minimum_lots !== null &&
      configuration.maximum_lots !== null &&
      configuration.minimum_lots > configuration.maximum_lots
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum lots cannot exceed maximum lots.",
        path: ["minimum_lots"],
      });
    }
    if (
      configuration.minimum_investment !== null &&
      configuration.maximum_investment !== null &&
      compareDecimalStrings(configuration.minimum_investment, configuration.maximum_investment) > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum investment cannot exceed maximum investment.",
        path: ["minimum_investment"],
      });
    }
    if (
      configuration.minimum_shareholding !== null &&
      configuration.shareholder_record_date === null
    ) {
      context.addIssue({
        code: "custom",
        message: "A record date is required when a minimum shareholder holding is configured.",
        path: ["shareholder_record_date"],
      });
    }
    if (
      new Set(configuration.eligibility_conditions.map(({ id }) => id)).size !==
      configuration.eligibility_conditions.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Eligibility condition IDs must be unique.",
        path: ["eligibility_conditions"],
      });
    }
    if (
      new Set(configuration.allowed_price_types).size !== configuration.allowed_price_types.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Allowed price types must not contain duplicates.",
        path: ["allowed_price_types"],
      });
    }
  });

export const ipoCalculationSchema = z
  .object({
    ipo_id: z.uuid(),
    demat_account_id: z.uuid(),
    category: ipoCategorySchema,
    lots: z.number().int().positive().max(1_000_000),
    price_type: z.enum(["BID", "CUT_OFF"]),
    price: positivePriceSchema,
    shareholder_shares: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    eligibility_answers: z.record(z.string(), z.boolean().nullable()),
  })
  .strict();

export const applicationRecordSchema = z
  .object({
    calculation_id: z.uuid(),
  })
  .strict();

const financialAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,32}(?:\.\d{1,6})?$/,
    "Enter an amount with at most 32 integer and 6 decimal digits.",
  )
  .refine((value) => /[1-9]/.test(value), "Enter an amount greater than zero.");
const nonNegativeFinancialAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,32}(?:\.\d{1,6})?$/,
    "Enter an amount with at most 32 integer and 6 decimal digits.",
  );

export const mandateStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REVOKED",
  "EXPIRED",
  "RELEASED",
]);
export const allotmentStatusSchema = z.enum(["ALLOTTED", "NOT_ALLOTTED", "PARTIAL_ALLOTMENT"]);
export const refundStatusSchema = z.enum(["NOT_REQUIRED", "PENDING", "COMPLETED"]);
export const capitalTransactionTypeSchema = z.enum([
  "CAPITAL_BLOCKED",
  "CAPITAL_RELEASED",
  "ACTUAL_DEBIT",
  "ALLOTMENT_DEBIT",
  "REFUND_RECEIVED",
  "LISTING_SALE",
  "LISTING_PRICE_UPDATE",
  "ADJUSTMENT",
]);

export const mandateSchema = z
  .object({
    application_id: z.uuid(),
    mandate_reference: z.string().trim().min(1).max(160),
    mandate_amount: financialAmountSchema,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const mandateUpdateSchema = z
  .object({
    mandate_reference: z.string().trim().min(1).max(160),
    mandate_amount: financialAmountSchema,
    mandate_status: mandateStatusSchema,
    notes: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one mandate update.");

export const allotmentSchema = z
  .object({
    application_id: z.uuid(),
    allotment_status: allotmentStatusSchema,
    allotted_lots: z.number().int().min(0).max(1_000_000),
    allotted_shares: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    allotment_price: priceDecimalSchema.nullable(),
    refund_amount: nonNegativeFinancialAmountSchema,
    allotment_date: optionalDateSchema.optional(),
  })
  .strict()
  .superRefine(validateAllotmentShape);

export const allotmentUpdateSchema = z
  .object({
    allotment_status: allotmentStatusSchema,
    allotted_lots: z.number().int().min(0).max(1_000_000),
    allotted_shares: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    allotment_price: priceDecimalSchema.nullable(),
    refund_amount: nonNegativeFinancialAmountSchema,
    allotment_date: optionalDateSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one allotment update.")
  .superRefine(validateAllotmentShape);

function validateAllotmentShape(
  allotment: {
    allotment_status?: "ALLOTTED" | "NOT_ALLOTTED" | "PARTIAL_ALLOTMENT";
    allotted_lots?: number;
    allotted_shares?: number;
    allotment_price?: string | null;
  },
  context: z.RefinementCtx,
) {
  if (
    allotment.allotment_status === "NOT_ALLOTTED" &&
    ((allotment.allotted_lots !== undefined && allotment.allotted_lots !== 0) ||
      (allotment.allotted_shares !== undefined && allotment.allotted_shares !== 0) ||
      (allotment.allotment_price !== undefined && allotment.allotment_price !== null))
  ) {
    context.addIssue({
      code: "custom",
      message: "A not-allotted application cannot have shares or an allotment price.",
      path: ["allotment_status"],
    });
  }
  if (
    allotment.allotment_status !== undefined &&
    allotment.allotment_status !== "NOT_ALLOTTED" &&
    ((allotment.allotted_lots !== undefined && allotment.allotted_lots < 1) ||
      (allotment.allotted_shares !== undefined && allotment.allotted_shares < 1) ||
      allotment.allotment_price === null)
  ) {
    context.addIssue({
      code: "custom",
      message: "An allotment requires positive lots, shares, and price.",
      path: ["allotment_status"],
    });
  }
}

const managementFilterFields = {
  ipo_id: z.uuid().optional(),
  account_id: z.uuid().optional(),
  broker: z.string().trim().min(1).max(120).optional(),
  category: ipoCategorySchema.optional(),
  date_from: z.iso.date().optional(),
  date_to: z.iso.date().optional(),
};
const managementListQueryFields = {
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  ...managementFilterFields,
};

function validateDateRange(
  query: { date_from?: string; date_to?: string },
  context: z.RefinementCtx,
) {
  if (query.date_from && query.date_to && query.date_from > query.date_to) {
    context.addIssue({
      code: "custom",
      message: "date_from must not be after date_to.",
      path: ["date_from"],
    });
  }
}

export const mandateListQuerySchema = z
  .object({
    ...managementListQueryFields,
    status: mandateStatusSchema.optional(),
  })
  .strict()
  .superRefine(validateDateRange);

export const allotmentListQuerySchema = z
  .object({
    ...managementListQueryFields,
    status: allotmentStatusSchema.optional(),
    refund_status: refundStatusSchema.optional(),
  })
  .strict()
  .superRefine(validateDateRange);

export const capitalLedgerListQuerySchema = z
  .object({
    ...managementListQueryFields,
    transaction_type: capitalTransactionTypeSchema.optional(),
  })
  .strict()
  .superRefine(validateDateRange);

export const capitalSummaryQuerySchema = z
  .object(managementFilterFields)
  .strict()
  .superRefine(validateDateRange);

export const capitalLedgerEntrySchema = z
  .object({
    application_id: z.uuid().nullable().optional(),
    transaction_type: capitalTransactionTypeSchema,
    amount: financialAmountSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
    effective_at: z.iso.datetime(),
    audit_reference: z.string().trim().min(1).max(200),
    idempotency_key: z.string().trim().min(1).max(200),
    quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
    unit_price: priceDecimalSchema.nullable().optional(),
    adjustment_direction: z.enum(["DEBIT", "CREDIT"]).nullable().optional(),
  })
  .strict()
  .superRefine((entry, context) => {
    const listing = ["LISTING_SALE", "LISTING_PRICE_UPDATE"].includes(entry.transaction_type);
    if (listing !== (entry.quantity !== undefined && entry.quantity !== null)) {
      context.addIssue({
        code: "custom",
        message: "Listing events require a positive quantity.",
        path: ["quantity"],
      });
    }
    if (listing !== (entry.unit_price !== undefined && entry.unit_price !== null)) {
      context.addIssue({
        code: "custom",
        message: "Listing events require a unit price.",
        path: ["unit_price"],
      });
    }
    if (entry.transaction_type === "ADJUSTMENT" && !entry.adjustment_direction) {
      context.addIssue({
        code: "custom",
        message: "Adjustments must declare whether they are a debit or credit.",
        path: ["adjustment_direction"],
      });
    }
    if (entry.transaction_type !== "ADJUSTMENT" && entry.adjustment_direction) {
      context.addIssue({
        code: "custom",
        message: "Adjustment direction is only valid for adjustment events.",
        path: ["adjustment_direction"],
      });
    }
    if (
      listing &&
      entry.quantity !== undefined &&
      entry.quantity !== null &&
      entry.unit_price &&
      compareDecimalStrings(
        entry.amount,
        multiplyDecimalString(entry.unit_price, entry.quantity),
      ) !== 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Listing amount must equal quantity multiplied by unit price.",
        path: ["amount"],
      });
    }
  });

function multiplyDecimalString(value: string, quantity: number): string {
  const [whole, fraction = ""] = value.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const product = (BigInt(digits) * BigInt(quantity)).toString();
  const padded = product.padStart(fraction.length + 1, "0");
  if (fraction.length === 0) return padded;
  const wholePart = padded.slice(0, -fraction.length);
  const fractionalPart = padded.slice(-fraction.length);
  return `${wholePart}.${fractionalPart}`.replace(/\.?0+$/, "");
}

export const capitalApplicationListQuerySchema = z
  .object({
    ...managementListQueryFields,
  })
  .strict()
  .superRefine(validateDateRange);
export const applicationStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_PROCESSING",
  "REJECTED",
  "FAILED",
  "COMPLETED",
]);
export const applicationMandateStatusSchema = z.enum([
  "UNKNOWN",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "FAILED",
  "NOT_REQUIRED",
]);
export const applicationAllotmentStatusSchema = z.enum([
  "UNKNOWN",
  "PENDING",
  "ALLOTTED",
  "PARTIALLY_ALLOTTED",
  "NOT_ALLOTTED",
]);

const applicationFieldsSchema = z
  .object({
    ipo_id: z.uuid(),
    demat_account_id: z.uuid(),
    category_id: z.uuid(),
    lots: z.number().int().positive().max(1_000_000),
    price_type: z.enum(["BID", "CUT_OFF"]),
    price: positivePriceSchema,
    shareholder_shares: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    eligibility_answers: z.record(z.string(), z.boolean().nullable()),
    application_number: z.string().trim().max(120).nullable().default(null),
    external_reference: z.string().trim().min(1).max(200).nullable().default(null),
    submission_date: z.iso.datetime().nullable().default(null),
    application_status: applicationStatusSchema.default("DRAFT"),
    mandate_status: applicationMandateStatusSchema.default("UNKNOWN"),
    allotment_status: applicationAllotmentStatusSchema.default("UNKNOWN"),
    notes: z.string().trim().max(2000).nullable().default(null),
  })
  .strict();

export const applicationCreateSchema = applicationFieldsSchema;
export const applicationBulkCreateSchema = z
  .object({
    applications: z.array(applicationFieldsSchema).min(1).max(500),
  })
  .strict();
export const applicationUpdateSchema = z
  .object({
    application_number: z.string().trim().max(120).nullable().optional(),
    external_reference: z.string().trim().min(1).max(200).nullable().optional(),
    submission_date: z.iso.datetime().nullable().optional(),
    application_status: applicationStatusSchema.optional(),
    mandate_status: applicationMandateStatusSchema.optional(),
    allotment_status: applicationAllotmentStatusSchema.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
export const applicationBulkStatusSchema = z
  .object({
    application_ids: z.array(z.uuid()).min(1).max(500),
    application_status: applicationStatusSchema.optional(),
    mandate_status: applicationMandateStatusSchema.optional(),
    allotment_status: applicationAllotmentStatusSchema.optional(),
  })
  .strict()
  .refine(
    ({ application_status, mandate_status, allotment_status }) =>
      application_status !== undefined ||
      mandate_status !== undefined ||
      allotment_status !== undefined,
    { message: "Provide at least one status to update." },
  );
export const applicationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(25),
    ipo_id: z.uuid().optional(),
    demat_account_id: z.uuid().optional(),
    broker: z.string().trim().max(120).optional(),
    category_id: z.uuid().optional(),
    application_status: applicationStatusSchema.optional(),
    mandate_status: applicationMandateStatusSchema.optional(),
    submission_from: z.iso.date().optional(),
    submission_to: z.iso.date().optional(),
    search: z.string().trim().max(160).optional(),
    include_archived: z.enum(["true", "false"]).default("false"),
  })
  .strict()
  .refine(
    (query) =>
      !query.submission_from ||
      !query.submission_to ||
      query.submission_from <= query.submission_to,
    { message: "submission_from must not be after submission_to.", path: ["submission_from"] },
  );
