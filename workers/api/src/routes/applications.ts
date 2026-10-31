import { Hono, type Context } from "hono";
import * as XLSX from "@e965/xlsx";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  applicationBulkCreateSchema,
  applicationBulkStatusSchema,
  applicationCreateSchema,
  applicationListQuerySchema,
  applicationUpdateSchema,
} from "@ipo-mania/validation";
import {
  validateApplicationConfiguration,
  type CategoryRules,
  type CalculationInput,
} from "@ipo-mania/financial-engine";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";
import { validateJson } from "../middleware/validate-json";

const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const maxUploadBytes = 5 * 1024 * 1024;
const maxImportRows = 500;
const applicationColumns =
  "id, user_id, ipo_id, demat_account_id, category_id, lots, total_shares, application_amount, application_number, external_reference, submission_date, application_status, mandate_status, allotment_status, notes, rule_version, calculation_snapshot, created_at, updated_at, archived_at";

type ApplicationContext = {
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
};
type RouteContext = Context<ApplicationContext>;
type ApplicationInput = ReturnType<typeof applicationCreateSchema.parse>;
type ImportMapping = Partial<Record<ImportField, string>>;
type ImportField =
  | "ipo"
  | "demat_account"
  | "category"
  | "lots"
  | "price"
  | "price_type"
  | "application_number"
  | "external_reference"
  | "submission_date"
  | "application_status"
  | "mandate_status"
  | "allotment_status"
  | "notes";
type ApplicationIpoData = {
  id: string;
  issue_price_min: string;
  issue_price_max: string;
  cut_off_price: string | null;
  lot_size: number;
  archived_at?: string | null;
};
type ApplicationAccountData = {
  id: string;
  account_status: string;
  archived_at: string | null;
};
type ApplicationRuleData = {
  id: string;
  ipo_id: string;
  category: string;
  rule_version: number;
  lot_limit_status: string;
  minimum_lots: number | null;
  maximum_lots: number | null;
  lot_increment: number;
  investment_limit_status: string;
  minimum_investment: string | null;
  maximum_investment: string | null;
  shareholder_record_date: string | null;
  minimum_shareholding: number | null;
  eligibility_conditions: unknown;
  allowed_price_types: unknown;
  minimum_price_increment: string | null;
};
type ApplicationPreparationCache = {
  ipos: Map<string, ApplicationIpoData>;
  accounts: Map<string, ApplicationAccountData>;
  categories: Map<string, ApplicationRuleData>;
  existingApplications: Array<{
    ipo_id: string;
    demat_account_id: string;
    category_id: string;
    application_number: string | null;
    external_reference: string | null;
  }>;
  duplicateExternalReferences: Set<string>;
};

export const applicationsRoutes = new Hono<ApplicationContext>();
applicationsRoutes.use("*", authenticate);

applicationsRoutes.get("/summary", async (context) => {
  const supabase = context.get("rlsSupabase");
  const userId = context.get("authenticatedUser").id;
  const applicationStatuses = [
    "DRAFT",
    "SUBMITTED",
    "UNDER_PROCESSING",
    "REJECTED",
    "FAILED",
    "COMPLETED",
  ] as const;
  const [totalResult, ...statusResults] = await Promise.all([
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("archived_at", null),
    ...applicationStatuses.map((status) =>
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("application_status", status)
        .is("archived_at", null),
    ),
  ]);
  if (totalResult.error) throw totalResult.error;
  for (const result of statusResults) if (result.error) throw result.error;
  return context.json({
    data: {
      total: totalResult.count ?? 0,
      application_status_counts: Object.fromEntries(
        applicationStatuses.map((status, index) => [status, statusResults[index]?.count ?? 0]),
      ),
    },
  });
});

export const applicationImportRoutes = new Hono<ApplicationContext>();
applicationImportRoutes.use("*", authenticate);
applicationImportRoutes.post("/preview", previewImport);
applicationImportRoutes.post("/confirm", async (context) => {
  const body = await context.req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("import_id" in body) || !isUuid(body.import_id)) {
    return validationError(context, "A valid import_id is required.");
  }
  const { data, error } = await context
    .get("rlsSupabase")
    .rpc("confirm_application_import", { p_import_id: body.import_id });
  if (error) return databaseError(context, error);
  return context.json({ data });
});
applicationImportRoutes.get("/history", listImportHistory);
applicationImportRoutes.get("/:importId/report", getImportReport);
applicationImportRoutes.post("/:importId/reverse", reverseImport);

applicationsRoutes.get("/", async (context) => {
  const parsed = applicationListQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context, "Application filters are invalid.");
  const filters = parsed.data;
  const userId = context.get("authenticatedUser").id;
  const supabase = context.get("rlsSupabase");
  let query = supabase
    .from("applications")
    .select(
      `${applicationColumns}, ipos(company_name, symbol), demat_accounts(holder_name, broker_name), ipo_categories(category)`,
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (filters.include_archived === "false") query = query.is("archived_at", null);
  if (filters.include_archived === "true") query = query.not("archived_at", "is", null);
  if (filters.ipo_id) query = query.eq("ipo_id", filters.ipo_id);
  if (filters.demat_account_id) query = query.eq("demat_account_id", filters.demat_account_id);
  if (filters.category_id) query = query.eq("category_id", filters.category_id);
  if (filters.application_status)
    query = query.eq("application_status", filters.application_status);
  if (filters.mandate_status) query = query.eq("mandate_status", filters.mandate_status);
  if (filters.submission_from) query = query.gte("submission_date", filters.submission_from);
  if (filters.submission_to)
    query = query.lte("submission_date", `${filters.submission_to}T23:59:59.999Z`);
  if (filters.broker)
    query = query.ilike("demat_accounts.broker_name", `${escapeLike(filters.broker)}%`);
  if (filters.search) {
    const search = escapeOrFilter(filters.search);
    query = query.or(`application_number.ilike.%${search}%,external_reference.ilike.%${search}%`);
  }
  const { data, error, count } = await query.range(
    (filters.page - 1) * filters.page_size,
    filters.page * filters.page_size - 1,
  );
  if (error) throw error;
  return context.json({
    data: {
      applications: data,
      pagination: {
        page: filters.page,
        page_size: filters.page_size,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / filters.page_size),
      },
    },
  });
});

applicationsRoutes.get("/export", async (context) => {
  const parsed = applicationListQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context, "Application filters are invalid.");
  const filters = parsed.data;
  const supabase = context.get("rlsSupabase");
  let query = supabase
    .from("applications")
    .select(
      `${applicationColumns}, ipos(symbol, company_name), demat_accounts(masked_demat_identifier, broker_name), ipo_categories(category)`,
      { count: "exact" },
    )
    .eq("user_id", context.get("authenticatedUser").id)
    .order("created_at", { ascending: false });
  if (filters.include_archived === "false") query = query.is("archived_at", null);
  if (filters.include_archived === "true") query = query.not("archived_at", "is", null);
  if (filters.ipo_id) query = query.eq("ipo_id", filters.ipo_id);
  if (filters.demat_account_id) query = query.eq("demat_account_id", filters.demat_account_id);
  if (filters.category_id) query = query.eq("category_id", filters.category_id);
  if (filters.application_status)
    query = query.eq("application_status", filters.application_status);
  if (filters.mandate_status) query = query.eq("mandate_status", filters.mandate_status);
  if (filters.submission_from) query = query.gte("submission_date", filters.submission_from);
  if (filters.submission_to)
    query = query.lte("submission_date", `${filters.submission_to}T23:59:59.999Z`);
  if (filters.broker)
    query = query.ilike("demat_accounts.broker_name", `${escapeLike(filters.broker)}%`);
  if (filters.search) {
    const search = escapeOrFilter(filters.search);
    query = query.or(`application_number.ilike.%${search}%,external_reference.ilike.%${search}%`);
  }
  const { data: firstPage, count, error: countError } = await query.range(0, 999);
  if (countError) throw countError;
  const total = count ?? 0;
  if (total > 50_000) {
    return context.json(
      {
        error: { code: "EXPORT_TOO_LARGE", message: "Export up to 50,000 applications at a time." },
      },
      413,
    );
  }
  const rows = [...(firstPage ?? [])];
  for (let from = 1000; from < total; from += 1000) {
    const { data, error } = await query.range(from, Math.min(from + 999, total - 1));
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  const fields = [
    "IPO symbol",
    "Company",
    "Demat account",
    "Broker",
    "Category",
    "Lots",
    "Total shares",
    "Application amount",
    "Application number",
    "External reference",
    "Submission date",
    "Application status",
    "Mandate status",
    "Allotment status",
    "Rule version",
    "Created at",
  ];
  const csvRows = rows.map((row) => {
    const ipo = row.ipos as { symbol?: string; company_name?: string } | null;
    const account = row.demat_accounts as {
      masked_demat_identifier?: string;
      broker_name?: string;
    } | null;
    const category = row.ipo_categories as { category?: string } | null;
    return [
      ipo?.symbol,
      ipo?.company_name,
      account?.masked_demat_identifier,
      account?.broker_name,
      category?.category,
      row.lots,
      row.total_shares,
      row.application_amount,
      row.application_number,
      row.external_reference,
      row.submission_date,
      row.application_status,
      row.mandate_status,
      row.allotment_status,
      row.rule_version,
      row.created_at,
    ].map(csvCell);
  });
  return new Response(
    [fields.map(csvCell).join(","), ...csvRows.map((row) => row.join(","))].join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ipo-applications.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
});

applicationsRoutes.post("/preview", validateJson(applicationCreateSchema), async (context) => {
  const prepared = await prepareApplication(context, context.req.valid("json"));
  if (!prepared.ok) return context.json({ error: prepared.error }, 422);
  return context.json({
    data: {
      total_shares: prepared.record.total_shares,
      application_amount: prepared.record.application_amount,
      rule_version: prepared.record.rule_version,
      warnings: prepared.warnings,
    },
  });
});

applicationsRoutes.post(
  "/bulk/preview",
  validateJson(applicationBulkCreateSchema),
  async (context) => {
    const records = context.req.valid("json").applications;
    const rows = await Promise.all(records.map((record) => prepareApplication(context, record)));
    return context.json({
      data: {
        rows: rows.map((row, index) => ({
          index,
          demat_account_id: records[index]?.demat_account_id,
          ready: row.ok,
          errors: row.ok ? [] : [row.error],
          warnings: row.ok ? row.warnings : [],
          application_amount: row.ok ? row.record.application_amount : null,
        })),
        ready: rows.filter((row) => row.ok).length,
        invalid: rows.filter((row) => !row.ok).length,
      },
    });
  },
);

applicationsRoutes.patch(
  "/bulk/status",
  validateJson(applicationBulkStatusSchema),
  async (context) => {
    const { application_ids: ids, ...updates } = context.req.valid("json");
    const { data, error } = await context
      .get("rlsSupabase")
      .from("applications")
      .update(updates)
      .eq("user_id", context.get("authenticatedUser").id)
      .is("archived_at", null)
      .in("id", ids)
      .select("id, application_status, mandate_status, allotment_status");
    if (error) throw error;
    if (data?.length !== new Set(ids).size) {
      return context.json(
        {
          error: {
            code: "APPLICATIONS_NOT_FOUND",
            message: "Some selected applications are missing, archived, or not owned by you.",
          },
        },
        404,
      );
    }
    return context.json({ data: { updated: data?.length ?? 0, applications: data } });
  },
);

applicationsRoutes.post("/", validateJson(applicationCreateSchema), async (context) => {
  const prepared = await prepareApplication(context, context.req.valid("json"));
  if (!prepared.ok) return context.json({ error: prepared.error }, 422);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("applications")
    .insert(prepared.record)
    .select(applicationColumns)
    .single();
  if (error) return databaseError(context, error);
  return context.json({ data, warnings: prepared.warnings }, 201);
});

applicationsRoutes.post("/bulk", validateJson(applicationBulkCreateSchema), async (context) => {
  const records = context.req.valid("json").applications;
  const preparedRows = await Promise.all(
    records.map((record) => prepareApplication(context, record)),
  );
  const invalid = preparedRows.flatMap((row, index) =>
    row.ok ? [] : [{ index, demat_account_id: records[index]?.demat_account_id, ...row.error }],
  );
  if (invalid.length) {
    return context.json(
      {
        error: {
          code: "BULK_VALIDATION_FAILED",
          message: "Review account-specific errors before creating these applications.",
        },
        data: { errors: invalid },
      },
      422,
    );
  }
  const validRows = preparedRows.filter((row) => row.ok);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("applications")
    .insert(validRows.map((row) => row.record))
    .select(applicationColumns);
  if (error) return databaseError(context, error);
  return context.json(
    {
      data: {
        applications: data,
        warnings: validRows.flatMap((row, index) =>
          row.warnings.map((message) => ({ index, message })),
        ),
      },
    },
    201,
  );
});

applicationsRoutes.get("/:applicationId", async (context) => {
  const applicationId = context.req.param("applicationId");
  if (!isUuid(applicationId)) return applicationNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("applications")
    .select(
      `${applicationColumns}, ipos(company_name, symbol), demat_accounts(holder_name, broker_name, masked_demat_identifier), ipo_categories(category)`,
    )
    .eq("id", applicationId)
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return applicationNotFound(context);
  return context.json({ data });
});

applicationsRoutes.patch(
  "/:applicationId",
  validateJson(applicationUpdateSchema),
  async (context) => {
    const applicationId = context.req.param("applicationId");
    const updates = context.req.valid("json");
    if (!isUuid(applicationId)) return applicationNotFound(context);
    if (!Object.keys(updates).length)
      return validationError(context, "Provide at least one field.");
    const { data, error } = await context
      .get("rlsSupabase")
      .from("applications")
      .update(updates)
      .eq("id", applicationId)
      .eq("user_id", context.get("authenticatedUser").id)
      .is("archived_at", null)
      .select(applicationColumns)
      .maybeSingle();
    if (error) return databaseError(context, error);
    if (!data) return applicationNotFound(context);
    return context.json({ data });
  },
);

applicationsRoutes.delete("/:applicationId", async (context) => {
  const applicationId = context.req.param("applicationId");
  if (!isUuid(applicationId)) return applicationNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("applications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("user_id", context.get("authenticatedUser").id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return applicationNotFound(context);
  return context.json({ data: { archived: true } });
});

applicationsRoutes.post("/imports/preview", previewImport);
applicationsRoutes.post("/imports/confirm", async (context) => {
  const body = await context.req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("import_id" in body) || !isUuid(body.import_id)) {
    return validationError(context, "A valid import_id is required.");
  }
  const { data, error } = await context
    .get("rlsSupabase")
    .rpc("confirm_application_import", { p_import_id: body.import_id });
  if (error) return databaseError(context, error);
  return context.json({ data });
});

applicationsRoutes.get("/imports/history", listImportHistory);
applicationsRoutes.get("/imports/:importId/report", getImportReport);
applicationsRoutes.post("/imports/:importId/reverse", reverseImport);

async function listImportHistory(context: RouteContext) {
  const { data, error, count } = await context
    .get("rlsSupabase")
    .from("application_imports")
    .select(
      "id, file_name, file_type, status, total_rows, imported_rows, created_at, confirmed_at, reversed_at",
      {
        count: "exact",
      },
    )
    .eq("user_id", context.get("authenticatedUser").id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return context.json({ data: { imports: data, total: count ?? 0 } });
}

async function getImportReport(context: RouteContext) {
  const importId = context.req.param("importId");
  if (!isUuid(importId)) return importNotFound(context);
  const supabase = context.get("rlsSupabase");
  const { data: importRecord, error: importError } = await supabase
    .from("application_imports")
    .select(
      "id, file_name, file_type, status, total_rows, imported_rows, created_at, confirmed_at, reversed_at",
    )
    .eq("id", importId)
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();
  if (importError) throw importError;
  if (!importRecord) return importNotFound(context);
  const { data: rows, error: rowsError } = await supabase
    .from("application_import_rows")
    .select("row_number, row_status, record, errors, warnings, created_application_id")
    .eq("import_id", importId)
    .order("row_number");
  if (rowsError) throw rowsError;
  return context.json({ data: { import: importRecord, rows } });
}

async function reverseImport(context: RouteContext) {
  const importId = context.req.param("importId");
  if (!isUuid(importId)) return importNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .rpc("reverse_application_import", { p_import_id: importId });
  if (error) return databaseError(context, error);
  return context.json({ data });
}

async function prepareApplication(
  context: RouteContext,
  input: ApplicationInput,
  cache?: ApplicationPreparationCache,
) {
  const userId = context.get("authenticatedUser").id;
  const supabase = context.get("rlsSupabase");
  let ipo: ApplicationIpoData | null;
  let account: ApplicationAccountData | null;
  let rule: ApplicationRuleData | null;
  if (cache) {
    ipo = cache.ipos.get(input.ipo_id) ?? null;
    account = cache.accounts.get(input.demat_account_id) ?? null;
    rule = cache.categories.get(input.category_id) ?? null;
  } else {
    const [ipoResult, accountResult, categoryResult] = await Promise.all([
      supabase
        .from("ipos")
        .select("id, issue_price_min, issue_price_max, cut_off_price, lot_size, archived_at")
        .eq("id", input.ipo_id)
        .eq("user_id", userId)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("demat_accounts")
        .select("id, account_status, archived_at")
        .eq("id", input.demat_account_id)
        .eq("user_id", userId)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("ipo_categories")
        .select(
          "id, ipo_id, category, rule_version, lot_limit_status, minimum_lots, maximum_lots, lot_increment, investment_limit_status, minimum_investment, maximum_investment, shareholder_record_date, minimum_shareholding, eligibility_conditions, allowed_price_types, minimum_price_increment",
        )
        .eq("id", input.category_id)
        .eq("ipo_id", input.ipo_id)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (ipoResult.error) throw ipoResult.error;
    if (accountResult.error) throw accountResult.error;
    if (categoryResult.error) throw categoryResult.error;
    ipo = ipoResult.data;
    account = accountResult.data;
    rule = categoryResult.data;
  }
  if (!ipo || ipo.archived_at)
    return failed("IPO_NOT_FOUND", "The IPO was not found or is archived.");
  if (!account || account.account_status !== "active" || account.archived_at) {
    return failed("INVALID_DEMAT_ACCOUNT", "Select an active, unarchived demat account you own.");
  }
  if (!rule || rule.ipo_id !== input.ipo_id) {
    return failed("CATEGORY_NOT_FOUND", "The category configuration does not belong to this IPO.");
  }

  const rules: CategoryRules = {
    category: rule.category as CategoryRules["category"],
    rule_version: rule.rule_version,
    lot_limit_status: rule.lot_limit_status as CategoryRules["lot_limit_status"],
    minimum_lots: rule.minimum_lots,
    maximum_lots: rule.maximum_lots,
    lot_increment: rule.lot_increment,
    investment_limit_status:
      rule.investment_limit_status as CategoryRules["investment_limit_status"],
    minimum_investment: rule.minimum_investment,
    maximum_investment: rule.maximum_investment,
    shareholder_record_date: rule.shareholder_record_date,
    minimum_shareholding: rule.minimum_shareholding,
    eligibility_conditions: rule.eligibility_conditions as CategoryRules["eligibility_conditions"],
    allowed_price_types: rule.allowed_price_types as CategoryRules["allowed_price_types"],
    minimum_price_increment: rule.minimum_price_increment,
  };
  const calculationInput: CalculationInput = {
    ipo: {
      issue_price_min: ipo.issue_price_min,
      issue_price_max: ipo.issue_price_max,
      cut_off_price: ipo.cut_off_price,
      lot_size: ipo.lot_size,
    },
    category: rules.category,
    rules,
    lots: input.lots,
    price_type: input.price_type,
    price: input.price,
    shareholder_shares: input.shareholder_shares,
    eligibility_answers: input.eligibility_answers,
  };
  const calculation = validateApplicationConfiguration(calculationInput);
  if (!calculation.eligible) {
    return {
      ok: false as const,
      error: {
        code: "APPLICATION_NOT_ELIGIBLE",
        message: calculation.validation_errors.map((issue) => issue.message).join(" "),
      },
    };
  }
  const snapshot = {
    captured_at: new Date().toISOString(),
    ipo: calculationInput.ipo,
    category_configuration: rule,
    demat_account_id: input.demat_account_id,
    calculation_input: calculationInput,
    calculation_result: calculation,
  };
  const record = {
    user_id: userId,
    ipo_id: input.ipo_id,
    demat_account_id: input.demat_account_id,
    category_id: input.category_id,
    lots: input.lots,
    total_shares: calculation.total_shares,
    application_amount: calculation.application_amount,
    application_number: input.application_number,
    external_reference: input.external_reference,
    submission_date: input.submission_date,
    application_status: input.application_status,
    mandate_status: input.mandate_status,
    allotment_status: input.allotment_status,
    notes: input.notes,
    rule_version: rules.rule_version,
    calculation_snapshot: snapshot,
  };
  return {
    ok: true as const,
    record,
    warnings: cache
      ? findCachedDuplicateWarnings(cache, input)
      : await findDuplicateWarnings(context, input),
  };
}

async function findDuplicateWarnings(context: RouteContext, input: ApplicationInput) {
  const supabase = context.get("rlsSupabase");
  const [identity, number, externalReference] = await Promise.all([
    supabase
      .from("applications")
      .select("id")
      .eq("user_id", context.get("authenticatedUser").id)
      .eq("ipo_id", input.ipo_id)
      .eq("demat_account_id", input.demat_account_id)
      .eq("category_id", input.category_id)
      .is("archived_at", null)
      .limit(1),
    input.application_number
      ? supabase
          .from("applications")
          .select("id")
          .eq("user_id", context.get("authenticatedUser").id)
          .eq("ipo_id", input.ipo_id)
          .eq("application_number", input.application_number)
          .is("archived_at", null)
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
    input.external_reference
      ? supabase
          .from("applications")
          .select("id")
          .eq("user_id", context.get("authenticatedUser").id)
          .eq("external_reference", input.external_reference)
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (identity.error) throw identity.error;
  if (number.error) throw number.error;
  if (externalReference.error) throw externalReference.error;
  return identity.data?.length || number.data?.length || externalReference.data?.length
    ? ["A matching IPO, account, category, or reference already exists; review before confirming."]
    : [];
}

async function previewImport(context: RouteContext) {
  const form = await context.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return validationError(context, "Choose a CSV or XLSX file.");
  if (file.size < 1 || file.size > maxUploadBytes) {
    return context.json(
      {
        error: { code: "FILE_TOO_LARGE", message: "Import files must be between 1 byte and 5 MB." },
      },
      413,
    );
  }
  const csv = file.type === "text/csv" && file.name.toLowerCase().endsWith(".csv");
  const xlsx = file.type === xlsxMime && file.name.toLowerCase().endsWith(".xlsx");
  if (!csv && !xlsx) {
    return context.json(
      { error: { code: "UNSUPPORTED_FILE_TYPE", message: "Upload a CSV or XLSX spreadsheet." } },
      415,
    );
  }
  let table: string[][];
  try {
    table = csv
      ? parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()))
      : parseXlsx(await file.arrayBuffer());
  } catch {
    return context.json(
      { error: { code: "INVALID_FILE", message: "The spreadsheet could not be read." } },
      400,
    );
  }
  if (table.length < 2 || table.length - 1 > maxImportRows) {
    return context.json(
      { error: { code: "INVALID_ROW_COUNT", message: "Use 1–500 data rows." } },
      400,
    );
  }
  const headers = table[0]!.map((header) => header.trim());
  if (
    headers.length > 30 ||
    headers.some((header) => !header) ||
    new Set(headers).size !== headers.length
  ) {
    return context.json(
      { error: { code: "INVALID_HEADERS", message: "Use 1–30 unique, non-empty headers." } },
      400,
    );
  }
  const rawRows = table.slice(1).map((cells, index) => ({
    row_number: index + 2,
    values: Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""])),
  }));
  const mappingField = form.get("mapping");
  if (typeof mappingField !== "string") {
    return context.json({
      data: { requires_mapping: true, headers, sample_rows: rawRows.slice(0, 5) },
    });
  }
  let mappingValue: unknown;
  try {
    mappingValue = JSON.parse(mappingField);
  } catch {
    return validationError(context, "The column mapping is invalid.");
  }
  const mapping = parseImportMapping(mappingValue, headers);
  if (!mapping) return validationError(context, "Map IPO, demat account, category, and lots.");

  const supabase = context.get("rlsSupabase");
  const userId = context.get("authenticatedUser").id;
  const [
    { data: ipos, error: ipoError },
    { data: accounts, error: accountError },
    { data: categories, error: categoryError },
    { data: existingApplications, error: applicationError },
  ] = await Promise.all([
    supabase
      .from("ipos")
      .select("id, symbol, issue_price_min, issue_price_max, cut_off_price, lot_size")
      .eq("user_id", userId)
      .is("archived_at", null),
    supabase
      .from("demat_accounts")
      .select("id, account_status, archived_at, masked_demat_identifier, masked_client_reference")
      .eq("user_id", userId)
      .is("archived_at", null),
    supabase
      .from("ipo_categories")
      .select(
        "id, ipo_id, category, rule_version, lot_limit_status, minimum_lots, maximum_lots, lot_increment, investment_limit_status, minimum_investment, maximum_investment, shareholder_record_date, minimum_shareholding, eligibility_conditions, allowed_price_types, minimum_price_increment",
      )
      .eq("user_id", userId)
      .order("rule_version", { ascending: false }),
    supabase
      .from("applications")
      .select("ipo_id, demat_account_id, category_id, application_number, external_reference")
      .eq("user_id", userId)
      .is("archived_at", null)
      .limit(5000),
  ]);
  if (ipoError) throw ipoError;
  if (accountError) throw accountError;
  if (categoryError) throw categoryError;
  if (applicationError) throw applicationError;
  const importCache: ApplicationPreparationCache = {
    ipos: new Map((ipos ?? []).map((item) => [item.id, item])),
    accounts: new Map((accounts ?? []).map((item) => [item.id, item])),
    categories: new Map((categories ?? []).map((item) => [item.id, item])),
    existingApplications: existingApplications ?? [],
    duplicateExternalReferences: new Set(
      (existingApplications ?? []).flatMap((item) =>
        item.external_reference ? [item.external_reference.toLowerCase()] : [],
      ),
    ),
  };

  const seenExternalReferences = new Set<string>();
  const seenApplicationCombinations = new Set<string>();
  const prepared = await Promise.all(
    rawRows.map(async ({ row_number, values }) => {
      const raw = Object.fromEntries(
        Object.entries(mapping).flatMap(([target, source]) =>
          source ? [[target, values[source] ?? ""]] : [],
        ),
      );
      const errors: string[] = [];
      const warnings: string[] = [];
      const ipoRef = String(raw.ipo ?? "").trim();
      const accountRef = String(raw.demat_account ?? "").trim();
      const ipo = ipos?.find(
        (row) =>
          row.id.toLowerCase() === ipoRef.toLowerCase() ||
          row.symbol.toLowerCase() === ipoRef.toLowerCase(),
      );
      const accountMatches = (accounts ?? []).filter(
        (row) =>
          row.id.toLowerCase() === accountRef.toLowerCase() ||
          row.masked_demat_identifier.toLowerCase() === accountRef.toLowerCase() ||
          row.masked_client_reference?.toLowerCase() === accountRef.toLowerCase(),
      );
      const account = accountMatches.length === 1 ? accountMatches[0] : null;
      if (!ipo) errors.push("IPO could not be matched by ID or symbol.");
      if (accountMatches.length !== 1)
        errors.push("Demat account reference is missing or ambiguous.");
      if (account?.account_status !== "active") errors.push("Demat account is not active.");
      const categoryText = String(raw.category ?? "")
        .trim()
        .toUpperCase();
      const category = (categories ?? []).find(
        (row) =>
          row.ipo_id === ipo?.id &&
          (row.id.toLowerCase() === categoryText.toLowerCase() || row.category === categoryText),
      );
      if (!category) errors.push("Category does not have a configured rule for this IPO.");
      const lots = Number(raw.lots);
      if (!Number.isSafeInteger(lots) || lots <= 0)
        errors.push("Lots must be a positive whole number.");
      if (!ipo || !account || !category || errors.length) {
        return { row_number, record: raw, row_status: "invalid", errors, warnings };
      }
      const priceType = String(raw.price_type ?? "").toUpperCase();
      const price = String(raw.price ?? "");
      const parsedInput = applicationCreateSchema.safeParse({
        ipo_id: ipo.id,
        demat_account_id: account.id,
        category_id: category.id,
        lots,
        price_type: priceType,
        price,
        shareholder_shares: null,
        eligibility_answers: {},
        application_number: nullableString(raw.application_number),
        external_reference: nullableString(raw.external_reference),
        submission_date: parseImportDate(raw.submission_date),
        application_status: normalizeStatus(raw.application_status, "DRAFT"),
        mandate_status: normalizeStatus(raw.mandate_status, "UNKNOWN"),
        allotment_status: normalizeStatus(raw.allotment_status, "UNKNOWN"),
        notes: nullableString(raw.notes),
      });
      if (!parsedInput.success) {
        errors.push(...parsedInput.error.issues.map((issue) => issue.message));
        return { row_number, record: raw, row_status: "invalid", errors, warnings };
      }
      const externalReference = parsedInput.data.external_reference?.toLowerCase();
      if (externalReference && importCache.duplicateExternalReferences.has(externalReference)) {
        errors.push("This external reference is already used by another application.");
        return { row_number, record: raw, row_status: "invalid", errors, warnings };
      }
      if (externalReference && seenExternalReferences.has(externalReference)) {
        errors.push("This external reference appears more than once in the file.");
        return { row_number, record: raw, row_status: "invalid", errors, warnings };
      }
      if (externalReference) seenExternalReferences.add(externalReference);
      const applicationCombination = [
        parsedInput.data.ipo_id,
        parsedInput.data.demat_account_id,
        parsedInput.data.category_id,
        parsedInput.data.application_number ?? "",
      ].join(":");
      const duplicateInFile = seenApplicationCombinations.has(applicationCombination);
      seenApplicationCombinations.add(applicationCombination);
      if (duplicateInFile) {
        warnings.push(
          "A matching IPO, account, category, and application number appears in this file.",
        );
      }
      const result = await prepareApplication(context, parsedInput.data, importCache);
      if (!result.ok) {
        errors.push(result.error.message);
        return { row_number, record: raw, row_status: "invalid", errors, warnings };
      }
      warnings.push(...result.warnings);
      if (!mapping.application_status || !String(raw.application_status ?? "").trim()) {
        warnings.push("Imported rows default to DRAFT; import does not imply submission.");
      }
      return {
        row_number,
        record: result.record,
        row_status: result.warnings.length || duplicateInFile ? "duplicate" : "ready",
        errors,
        warnings,
      };
    }),
  );

  const { data: importRecord, error: importError } = await supabase
    .from("application_imports")
    .insert({
      user_id: userId,
      file_name: file.name.slice(0, 255),
      file_type: file.type,
      total_rows: prepared.length,
    })
    .select("id, file_name, file_type, status, total_rows, imported_rows, created_at")
    .single();
  if (importError) throw importError;
  const { error: rowsError } = await supabase.from("application_import_rows").insert(
    prepared.map((row) => ({
      import_id: importRecord.id,
      row_number: row.row_number,
      record: row.record,
      row_status: row.row_status,
      errors: row.errors,
      warnings: row.warnings,
    })),
  );
  if (rowsError) {
    const { error: cleanupError } = await supabase
      .from("application_imports")
      .delete()
      .eq("id", importRecord.id)
      .eq("user_id", userId);
    if (cleanupError) throw cleanupError;
    throw rowsError;
  }
  return context.json({
    data: {
      import: importRecord,
      rows: prepared,
      summary: {
        total: prepared.length,
        ready: prepared.filter((row) => row.row_status === "ready").length,
        duplicate: prepared.filter((row) => row.row_status === "duplicate").length,
        invalid: prepared.filter((row) => row.row_status === "invalid").length,
      },
    },
  });
}

function parseImportMapping(value: unknown, headers: string[]): ImportMapping | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed: ImportField[] = [
    "ipo",
    "demat_account",
    "category",
    "lots",
    "price",
    "price_type",
    "application_number",
    "external_reference",
    "submission_date",
    "application_status",
    "mandate_status",
    "allotment_status",
    "notes",
  ];
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowed.includes(key as ImportField))) return null;
  const mapping: ImportMapping = {};
  for (const [field, header] of Object.entries(input)) {
    if (typeof header !== "string" || !headers.includes(header)) return null;
    mapping[field as ImportField] = header;
  }
  return mapping.ipo &&
    mapping.demat_account &&
    mapping.category &&
    mapping.lots &&
    mapping.price &&
    mapping.price_type
    ? mapping
    : null;
}

function parseImportDate(value: unknown) {
  const normalized = nullableString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? normalized : date.toISOString();
}

function nullableString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeStatus(value: unknown, fallback: string) {
  const text = nullableString(value);
  return text ? text.toUpperCase().replace(/[\s-]+/g, "_") : fallback;
}

function failed(code: string, message: string) {
  return { ok: false as const, error: { code, message } };
}

function validationError(context: RouteContext, message: string) {
  return context.json({ error: { code: "VALIDATION_ERROR", message } }, 400);
}

function applicationNotFound(context: RouteContext) {
  return context.json(
    { error: { code: "APPLICATION_NOT_FOUND", message: "The application was not found." } },
    404,
  );
}

function importNotFound(context: RouteContext) {
  return context.json(
    { error: { code: "IMPORT_NOT_FOUND", message: "The import was not found." } },
    404,
  );
}

function databaseError(context: RouteContext, error: { code?: string; message: string }) {
  if (error.code === "23505" && error.message.includes("applications_external_reference_unique")) {
    return context.json(
      {
        error: {
          code: "DUPLICATE_EXTERNAL_REFERENCE",
          message: "This external reference already exists.",
        },
      },
      409,
    );
  }
  if (error.code === "P0002" && error.message.includes("APPLICATION_IMPORT_NOT_FOUND")) {
    return importNotFound(context);
  }
  if (error.code === "23514" && error.message.includes("APPLICATION_IMPORT_REVERSAL_BLOCKED")) {
    return context.json(
      {
        error: {
          code: "IMPORT_REVERSAL_BLOCKED",
          message: "An imported application changed and cannot be reversed.",
        },
      },
      409,
    );
  }
  if (error.code === "23514" && error.message.includes("APPLICATION_IMPORT_NOT_REVERSIBLE")) {
    return context.json(
      {
        error: {
          code: "IMPORT_NOT_REVERSIBLE",
          message: "Only confirmed imports can be reversed.",
        },
      },
      409,
    );
  }
  throw error;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function escapeOrFilter(value: string) {
  return value.replace(/[\\%_(),]/g, "\\$&");
}

function findCachedDuplicateWarnings(cache: ApplicationPreparationCache, input: ApplicationInput) {
  const identity = cache.existingApplications.some(
    (item) =>
      item.ipo_id === input.ipo_id &&
      item.demat_account_id === input.demat_account_id &&
      item.category_id === input.category_id,
  );
  const applicationNumber = input.application_number
    ? cache.existingApplications.some(
        (item) =>
          item.ipo_id === input.ipo_id &&
          item.demat_account_id === input.demat_account_id &&
          item.category_id === input.category_id &&
          item.application_number === input.application_number,
      )
    : false;
  return identity || applicationNumber
    ? [
        "A matching IPO, account, category, or application number already exists; review before confirming.",
      ]
    : [];
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      if (rows.length > maxImportRows + 1) throw new Error("Too many rows.");
    } else if (character === '"') throw new Error("Malformed CSV quoting.");
    else field += character;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (field || row.length || (input.length > 0 && !/[\r\n]$/.test(input))) {
    row.push(field);
    rows.push(row);
  }
  if (rows[0]?.[0]?.startsWith("\uFEFF")) rows[0][0] = rows[0][0].slice(1);
  if (rows.length > maxImportRows + 1) throw new Error("Too many rows.");
  const width = Math.max(...rows.map((entry) => entry.length));
  if (width > 30) throw new Error("Too many columns.");
  return rows.map((entry) => [...entry, ...Array(Math.max(0, width - entry.length)).fill("")]);
}

function parseXlsx(bytes: ArrayBuffer): string[][] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  if (workbook.SheetNames.length !== 1) throw new Error("Use exactly one worksheet.");
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) throw new Error("Worksheet not found.");
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  if (range.e.r - range.s.r + 1 > maxImportRows + 1 || range.e.c - range.s.c + 1 > 30) {
    throw new Error("Spreadsheet exceeds limits.");
  }
  return XLSX.utils
    .sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
    })
    .map((row) => row.map((cell) => String(cell ?? "")));
}
