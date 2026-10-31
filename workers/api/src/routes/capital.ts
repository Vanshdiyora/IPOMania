import { Hono, type Context } from "hono";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  calculateCapitalSummaries,
  type CapitalAllotment,
  type CapitalApplication,
  type CapitalLedgerEntry as CalculationLedgerEntry,
  type CapitalMandate,
} from "@ipo-mania/financial-engine";
import type {
  CapitalLedgerEntry,
  CapitalApplication as CapitalApplicationRecord,
  IpoAllotment,
  IpoMandate,
} from "@ipo-mania/shared";
import {
  allotmentListQuerySchema,
  allotmentSchema,
  allotmentUpdateSchema,
  capitalApplicationListQuerySchema,
  applicationRecordSchema,
  capitalLedgerEntrySchema,
  capitalLedgerListQuerySchema,
  capitalSummaryQuerySchema,
  mandateListQuerySchema,
  mandateSchema,
  mandateUpdateSchema,
} from "@ipo-mania/validation";
import type { z } from "zod";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";
import { validateJson } from "../middleware/validate-json";

type CapitalContext = {
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
};
type CapitalRouteContext = Context<CapitalContext>;
type ApplicationRecordRequest = z.infer<typeof applicationRecordSchema>;

const applicationColumns =
  "id, user_id, ipo_id, demat_account_id, category_configuration_id, quota_calculation_id, category, rule_version, lot_size, issue_price_min, issue_price_max, cut_off_price, lots, shares, price_type, price, application_amount, currency, created_at";
const mandateColumns =
  "id, user_id, application_id, mandate_reference, mandate_amount, mandate_status, blocked_at, released_at, updated_at, notes, created_at";
const allotmentColumns =
  "id, user_id, application_id, allotment_status, allotted_lots, allotted_shares, allotment_price, refund_amount, refund_status, allotment_date, updated_at, created_at";
const ledgerColumns =
  "id, user_id, application_id, transaction_type, amount, currency, effective_at, created_at, source, audit_reference, idempotency_key, quantity, unit_price, adjustment_direction, blocked_consumed";
const applicationRelation =
  "application:applications!inner(id, ipo_id, demat_account_id, category, currency, created_at, ipo:ipos!applications_ipo_owner_fk(company_name, symbol), demat_account:demat_accounts!applications_account_owner_fk(id, holder_name, broker_name))";

export const capitalRoutes = new Hono<CapitalContext>();
for (const path of [
  "/capital/applications",
  "/capital/applications/*",
  "/mandates",
  "/mandates/*",
  "/allotments",
  "/allotments/*",
  "/capital/*",
]) {
  capitalRoutes.use(path, authenticate);
}

capitalRoutes.get("/capital/applications", async (context) => {
  const parsed = capitalApplicationListQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);

  const query = parsed.data;
  const userId = context.get("authenticatedUser").id;
  let request = context
    .get("rlsSupabase")
    .from("applications")
    .select(
      `${applicationColumns}, ipo:ipos!applications_ipo_owner_fk(company_name, symbol), demat_account:demat_accounts!applications_account_owner_fk(id, holder_name, broker_name)`,
      { count: "exact" },
    )
    .eq("user_id", userId)
    .not("quota_calculation_id", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (query.ipo_id) request = request.eq("ipo_id", query.ipo_id);
  if (query.account_id) request = request.eq("demat_account_id", query.account_id);
  if (query.category) request = request.eq("category", query.category);
  if (query.broker)
    request = request.ilike("demat_account.broker_name", `${escapeLike(query.broker)}%`);
  request = applyDateFilters(request, query.date_from, query.date_to);
  const { data, error, count } = await request.range(
    (query.page - 1) * query.page_size,
    query.page * query.page_size - 1,
  );
  if (error) throw error;
  return context.json({
    data: {
      applications: (data ?? []) as CapitalApplicationRecord[],
      pagination: pagination(query.page, query.page_size, count ?? 0),
    },
  });
});

capitalRoutes.get("/capital/applications/:applicationId", async (context) => {
  const applicationId = context.req.param("applicationId");
  if (!isUuid(applicationId)) return recordNotFound(context, "APPLICATION_NOT_FOUND");
  const { data, error } = await context
    .get("rlsSupabase")
    .from("applications")
    .select(
      `${applicationColumns}, ipo:ipos!applications_ipo_owner_fk(company_name, symbol), demat_account:demat_accounts!applications_account_owner_fk(id, holder_name, broker_name)`,
    )
    .eq("id", applicationId)
    .eq("user_id", context.get("authenticatedUser").id)
    .not("quota_calculation_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return recordNotFound(context, "APPLICATION_NOT_FOUND");
  return context.json({ data: data as CapitalApplicationRecord });
});

capitalRoutes.post(
  "/capital/applications",
  validateJson(applicationRecordSchema),
  async (context) => recordApplication(context, context.req.valid("json")),
);

capitalRoutes.get("/mandates", async (context) => {
  const parsed = mandateListQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);
  const query = parsed.data;
  const userId = context.get("authenticatedUser").id;
  let request = context
    .get("rlsSupabase")
    .from("mandates")
    .select(`${mandateColumns}, ${applicationRelation}`, { count: "exact" })
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true });
  if (query.status) request = request.eq("mandate_status", query.status);
  request = applyManagementFilters(request, query);
  const { data, error, count } = await request.range(
    (query.page - 1) * query.page_size,
    query.page * query.page_size - 1,
  );
  if (error) throw error;
  return context.json({
    data: {
      mandates: (data ?? []) as IpoMandate[],
      pagination: pagination(query.page, query.page_size, count ?? 0),
    },
  });
});

capitalRoutes.get("/mandates/:mandateId", async (context) => {
  const mandateId = context.req.param("mandateId");
  if (!isUuid(mandateId)) return recordNotFound(context, "MANDATE_NOT_FOUND");
  const { data, error } = await context
    .get("rlsSupabase")
    .from("mandates")
    .select(`${mandateColumns}, ${applicationRelation}`)
    .eq("id", mandateId)
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return recordNotFound(context, "MANDATE_NOT_FOUND");
  return context.json({ data: data as IpoMandate });
});

capitalRoutes.post("/mandates", validateJson(mandateSchema), async (context) => {
  const body = context.req.valid("json");
  const userId = context.get("authenticatedUser").id;
  const { data, error } = await context
    .get("rlsSupabase")
    .from("mandates")
    .insert({
      ...body,
      user_id: userId,
      mandate_status: "PENDING",
    })
    .select(mandateColumns)
    .single();
  if (error?.code === "23505") {
    const existing = await context
      .get("rlsSupabase")
      .from("mandates")
      .select(mandateColumns)
      .eq("user_id", userId)
      .eq("mandate_reference", body.mandate_reference)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && sameMandate(existing.data as IpoMandate, body)) {
      return context.json({ data: existing.data as IpoMandate }, 200);
    }
    return duplicateFinancialRecord(context, "DUPLICATE_MANDATE_REFERENCE");
  }
  if (error) return databaseError(context, error, "MANDATE");
  return context.json({ data: data as IpoMandate }, 201);
});

capitalRoutes.patch("/mandates/:mandateId", validateJson(mandateUpdateSchema), async (context) => {
  const mandateId = context.req.param("mandateId");
  if (!isUuid(mandateId)) return recordNotFound(context, "MANDATE_NOT_FOUND");
  const { data, error } = await context
    .get("rlsSupabase")
    .from("mandates")
    .update(context.req.valid("json"))
    .eq("id", mandateId)
    .eq("user_id", context.get("authenticatedUser").id)
    .select(mandateColumns)
    .maybeSingle();
  if (error) return databaseError(context, error, "MANDATE_UPDATE");
  if (!data) return recordNotFound(context, "MANDATE_NOT_FOUND");
  return context.json({ data: data as IpoMandate });
});

capitalRoutes.get("/allotments", async (context) => {
  const parsed = allotmentListQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);
  const query = parsed.data;
  const userId = context.get("authenticatedUser").id;
  let request = context
    .get("rlsSupabase")
    .from("allotments")
    .select(`${allotmentColumns}, ${applicationRelation}`, { count: "exact" })
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true });
  if (query.status) request = request.eq("allotment_status", query.status);
  if (query.refund_status) request = request.eq("refund_status", query.refund_status);
  request = applyManagementFilters(request, query);
  const { data, error, count } = await request.range(
    (query.page - 1) * query.page_size,
    query.page * query.page_size - 1,
  );
  if (error) throw error;
  return context.json({
    data: {
      allotments: (data ?? []) as IpoAllotment[],
      pagination: pagination(query.page, query.page_size, count ?? 0),
    },
  });
});

capitalRoutes.get("/allotments/:allotmentId", async (context) => {
  const allotmentId = context.req.param("allotmentId");
  if (!isUuid(allotmentId)) return recordNotFound(context, "ALLOTMENT_NOT_FOUND");
  const { data, error } = await context
    .get("rlsSupabase")
    .from("allotments")
    .select(`${allotmentColumns}, ${applicationRelation}`)
    .eq("id", allotmentId)
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return recordNotFound(context, "ALLOTMENT_NOT_FOUND");
  return context.json({ data: data as IpoAllotment });
});

capitalRoutes.post("/allotments", validateJson(allotmentSchema), async (context) => {
  const body = context.req.valid("json");
  const userId = context.get("authenticatedUser").id;
  const { data, error } = await context
    .get("rlsSupabase")
    .from("allotments")
    .insert({
      ...body,
      user_id: userId,
    })
    .select(allotmentColumns)
    .single();
  if (error?.code === "23505") {
    const existing = await context
      .get("rlsSupabase")
      .from("allotments")
      .select(allotmentColumns)
      .eq("user_id", userId)
      .eq("application_id", body.application_id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && sameAllotment(existing.data as IpoAllotment, body)) {
      return context.json({ data: existing.data as IpoAllotment }, 200);
    }
    return duplicateFinancialRecord(context, "ALLOTMENT_ALREADY_RECORDED");
  }
  if (error) return databaseError(context, error, "ALLOTMENT");
  return context.json({ data: data as IpoAllotment }, 201);
});

capitalRoutes.patch(
  "/allotments/:allotmentId",
  validateJson(allotmentUpdateSchema),
  async (context) => {
    const allotmentId = context.req.param("allotmentId");
    if (!isUuid(allotmentId)) return recordNotFound(context, "ALLOTMENT_NOT_FOUND");
    const { data, error } = await context
      .get("rlsSupabase")
      .from("allotments")
      .update(context.req.valid("json"))
      .eq("id", allotmentId)
      .eq("user_id", context.get("authenticatedUser").id)
      .select(allotmentColumns)
      .maybeSingle();
    if (error) return databaseError(context, error, "ALLOTMENT");
    if (!data) return recordNotFound(context, "ALLOTMENT_NOT_FOUND");
    return context.json({ data: data as IpoAllotment });
  },
);

capitalRoutes.get("/capital/summary", async (context) => {
  const parsed = capitalSummaryQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);
  const filters = parsed.data;
  const userId = context.get("authenticatedUser").id;
  const supabase = context.get("rlsSupabase");
  const [applications, mandateRecords, allotmentRecords, ledger] = await Promise.all([
    fetchAllPages<CapitalApplication>((from, to) => {
      let request = supabase
        .from("applications")
        .select(
          "id, application_amount, currency, ipo:ipos!applications_ipo_owner_fk(company_name), demat_account:demat_accounts!applications_account_owner_fk(broker_name)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      request = applyApplicationFilters(request, filters);
      return request.range(from, to);
    }),
    fetchAllPages<
      Omit<CapitalMandate, "currency"> & {
        application: { currency: string } | Array<{ currency: string }>;
      }
    >((from, to) =>
      applyManagementFilters(
        supabase
          .from("mandates")
          .select(
            "mandate_amount, mandate_status, application:applications!inner(currency, ipo_id, demat_account_id, category, demat_account:demat_accounts!applications_account_owner_fk(broker_name))",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        filters,
      ).range(from, to),
    ),
    fetchAllPages<
      Omit<CapitalAllotment, "currency"> & {
        application: { currency: string } | Array<{ currency: string }>;
      }
    >((from, to) =>
      applyManagementFilters(
        supabase
          .from("allotments")
          .select(
            "application_id, allotment_status, allotted_shares, allotment_price, refund_amount, application:applications!inner(currency, ipo_id, demat_account_id, category, demat_account:demat_accounts!applications_account_owner_fk(broker_name))",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        filters,
      ).range(from, to),
    ),
    fetchAllPages<CalculationLedgerEntry>((from, to) => {
      let request = supabase
        .from("capital_ledger")
        .select(
          "application_id, transaction_type, amount, currency, quantity, unit_price, blocked_consumed, effective_at, created_at, adjustment_direction, application:applications(ipo_id, demat_account_id, category, demat_account:demat_accounts!applications_account_owner_fk(broker_name))",
        )
        .eq("user_id", userId)
        .order("effective_at", { ascending: true });
      request = applyManagementFilters(request, filters, "effective_at");
      return request.range(from, to);
    }),
  ]);
  const mandates: CapitalMandate[] = mandateRecords.map(({ application, ...mandate }) => ({
    ...mandate,
    currency: relatedCurrency(application),
  }));
  const allotments: CapitalAllotment[] = allotmentRecords.map(({ application, ...allotment }) => ({
    ...allotment,
    currency: relatedCurrency(application),
  }));
  return context.json({
    data: { summaries: calculateCapitalSummaries(applications, mandates, allotments, ledger) },
  });
});

capitalRoutes.get("/capital/ledger", async (context) => {
  const parsed = capitalLedgerListQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);
  const query = parsed.data;
  const userId = context.get("authenticatedUser").id;
  let request = context
    .get("rlsSupabase")
    .from("capital_ledger")
    .select(`${ledgerColumns}, ${applicationRelation}`, { count: "exact" })
    .eq("user_id", userId)
    .order("effective_at", { ascending: false })
    .order("id", { ascending: true });
  if (query.transaction_type) request = request.eq("transaction_type", query.transaction_type);
  request = applyManagementFilters(request, query, "effective_at");
  const { data, error, count } = await request.range(
    (query.page - 1) * query.page_size,
    query.page * query.page_size - 1,
  );
  if (error) throw error;
  return context.json({
    data: {
      ledger: (data ?? []) as CapitalLedgerEntry[],
      pagination: pagination(query.page, query.page_size, count ?? 0),
    },
  });
});

capitalRoutes.post("/capital/ledger", validateJson(capitalLedgerEntrySchema), async (context) => {
  const body = context.req.valid("json");
  const userId = context.get("authenticatedUser").id;
  const { data, error } = await context
    .get("rlsSupabase")
    .from("capital_ledger")
    .insert({
      ...body,
      user_id: userId,
      source: "MANUAL",
    })
    .select(ledgerColumns)
    .single();
  if (error?.code === "23505") {
    const existing = await context
      .get("rlsSupabase")
      .from("capital_ledger")
      .select(ledgerColumns)
      .eq("user_id", userId)
      .eq("idempotency_key", body.idempotency_key)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && sameLedgerEntry(existing.data as CapitalLedgerEntry, body)) {
      return context.json({ data: existing.data as CapitalLedgerEntry }, 200);
    }
    return duplicateFinancialRecord(context, "DUPLICATE_FINANCIAL_EVENT");
  }
  if (error) return databaseError(context, error, "LEDGER");
  return context.json({ data: data as CapitalLedgerEntry }, 201);
});

async function recordApplication(context: CapitalRouteContext, request: ApplicationRecordRequest) {
  const userId = context.get("authenticatedUser").id;
  const { data: calculation, error: calculationError } = await context
    .get("rlsSupabase")
    .from("ipo_quota_calculations")
    .select(
      "id, ipo_id, category_configuration_id, demat_account_id, category, rule_version, input_snapshot, result_snapshot",
    )
    .eq("id", request.calculation_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (calculationError) throw calculationError;
  if (!calculation) return recordNotFound(context, "CALCULATION_NOT_FOUND");

  const input = asRecord(calculation.input_snapshot);
  const ipoInput = asRecord(input.ipo);
  const result = asRecord(calculation.result_snapshot);
  const issuePriceMin = decimalSnapshotString(ipoInput.issue_price_min);
  const issuePriceMax = decimalSnapshotString(ipoInput.issue_price_max);
  const cutOffPrice =
    ipoInput.cut_off_price === null ? null : decimalSnapshotString(ipoInput.cut_off_price);
  if (
    result.eligible !== true ||
    !Number.isSafeInteger(input.lots) ||
    typeof input.price !== "string" ||
    typeof input.price_type !== "string" ||
    !Number.isSafeInteger(ipoInput.lot_size) ||
    issuePriceMin === undefined ||
    issuePriceMax === undefined ||
    cutOffPrice === undefined ||
    !Number.isSafeInteger(result.total_shares) ||
    typeof result.application_amount !== "string"
  ) {
    return context.json(
      {
        error: {
          code: "APPLICATION_NOT_ELIGIBLE",
          message: "Only a complete eligible calculation can be recorded.",
        },
      },
      422,
    );
  }

  const { data, error } = await context
    .get("rlsSupabase")
    .from("applications")
    .insert({
      user_id: userId,
      ipo_id: calculation.ipo_id,
      demat_account_id: calculation.demat_account_id,
      category_configuration_id: calculation.category_configuration_id,
      quota_calculation_id: calculation.id,
      category: calculation.category,
      rule_version: calculation.rule_version,
      lot_size: ipoInput.lot_size,
      issue_price_min: issuePriceMin,
      issue_price_max: issuePriceMax,
      cut_off_price: cutOffPrice,
      lots: input.lots,
      shares: result.total_shares,
      price_type: input.price_type,
      price: input.price,
      application_amount: result.application_amount,
      currency: "INR",
    })
    .select(applicationColumns)
    .single();
  if (error?.code === "23505") {
    const existing = await context
      .get("rlsSupabase")
      .from("applications")
      .select(applicationColumns)
      .eq("user_id", userId)
      .eq("quota_calculation_id", calculation.id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data)
      return context.json({ data: existing.data as CapitalApplicationRecord }, 200);
  }
  if (error) return databaseError(context, error, "APPLICATION");
  return context.json({ data: data as CapitalApplicationRecord }, 201);
}

function applyManagementFilters<T>(
  request: T,
  query: {
    ipo_id?: string;
    account_id?: string;
    broker?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
  },
  dateColumn = "created_at",
): T {
  let filtered = request as T & {
    eq: (column: string, value: string) => T;
    ilike: (column: string, value: string) => T;
    gte: (column: string, value: string) => T;
    lte: (column: string, value: string) => T;
  };
  if (query.ipo_id) filtered = filtered.eq("application.ipo_id", query.ipo_id) as typeof filtered;
  if (query.account_id)
    filtered = filtered.eq("application.demat_account_id", query.account_id) as typeof filtered;
  if (query.broker)
    filtered = filtered.ilike(
      "application.demat_account.broker_name",
      `${escapeLike(query.broker)}%`,
    ) as typeof filtered;
  if (query.category)
    filtered = filtered.eq("application.category", query.category) as typeof filtered;
  if (query.date_from)
    filtered = filtered.gte(dateColumn, `${query.date_from}T00:00:00.000Z`) as typeof filtered;
  if (query.date_to)
    filtered = filtered.lte(dateColumn, `${query.date_to}T23:59:59.999Z`) as typeof filtered;
  return filtered;
}

function applyDateFilters<T>(request: T, dateFrom?: string, dateTo?: string): T {
  let filtered = request as T & {
    gte: (column: string, value: string) => T;
    lte: (column: string, value: string) => T;
  };
  if (dateFrom)
    filtered = filtered.gte("created_at", `${dateFrom}T00:00:00.000Z`) as typeof filtered;
  if (dateTo) filtered = filtered.lte("created_at", `${dateTo}T23:59:59.999Z`) as typeof filtered;
  return filtered;
}

function applyApplicationFilters<T>(
  request: T,
  query: {
    ipo_id?: string;
    account_id?: string;
    broker?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
  },
): T {
  let filtered = request as T & {
    eq: (column: string, value: string) => T;
    ilike: (column: string, value: string) => T;
    gte: (column: string, value: string) => T;
    lte: (column: string, value: string) => T;
  };
  if (query.ipo_id) filtered = filtered.eq("ipo_id", query.ipo_id) as typeof filtered;
  if (query.account_id)
    filtered = filtered.eq("demat_account_id", query.account_id) as typeof filtered;
  if (query.broker)
    filtered = filtered.ilike(
      "demat_account.broker_name",
      `${escapeLike(query.broker)}%`,
    ) as typeof filtered;
  if (query.category) filtered = filtered.eq("category", query.category) as typeof filtered;
  if (query.date_from)
    filtered = filtered.gte("created_at", `${query.date_from}T00:00:00.000Z`) as typeof filtered;
  if (query.date_to)
    filtered = filtered.lte("created_at", `${query.date_to}T23:59:59.999Z`) as typeof filtered;
  return filtered;
}

async function fetchAllPages<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) throw new Error(`Capital summary query failed: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function databaseError(
  context: CapitalRouteContext,
  error: { code?: string },
  resource: "APPLICATION" | "MANDATE" | "MANDATE_UPDATE" | "ALLOTMENT" | "LEDGER",
) {
  if (error.code === "23505") {
    const code =
      resource === "LEDGER"
        ? "DUPLICATE_FINANCIAL_EVENT"
        : resource === "APPLICATION"
          ? "APPLICATION_ALREADY_RECORDED"
          : resource === "MANDATE" || resource === "MANDATE_UPDATE"
            ? "DUPLICATE_MANDATE_REFERENCE"
            : "ALLOTMENT_ALREADY_RECORDED";
    return context.json(
      { error: { code, message: "The requested financial record already exists." } },
      409,
    );
  }
  if (error.code === "23503")
    return recordNotFound(
      context,
      resource === "APPLICATION" ? "CALCULATION_NOT_FOUND" : "APPLICATION_NOT_FOUND",
    );
  if (error.code === "23514" || error.code === "22P02") {
    if (resource === "MANDATE_UPDATE")
      return context.json(
        {
          error: {
            code: "INVALID_MANDATE_TRANSITION",
            message: "This mandate status transition or update is not valid.",
          },
        },
        409,
      );
    return context.json(
      {
        error: {
          code: "FINANCIAL_VALIDATION_ERROR",
          message: "The financial record does not match the recorded application or issue terms.",
        },
      },
      422,
    );
  }
  throw error;
}

function duplicateFinancialRecord(context: CapitalRouteContext, code: string) {
  return context.json(
    { error: { code, message: "A conflicting financial record already exists." } },
    409,
  );
}

function sameMandate(
  existing: IpoMandate,
  request: {
    application_id: string;
    mandate_reference: string;
    mandate_amount: string;
    notes?: string | null;
  },
): boolean {
  return (
    existing.application_id === request.application_id &&
    existing.mandate_reference === request.mandate_reference &&
    sameDecimal(existing.mandate_amount, request.mandate_amount) &&
    (existing.notes ?? null) === (request.notes ?? null)
  );
}

function sameAllotment(
  existing: IpoAllotment,
  request: {
    application_id: string;
    allotment_status: string;
    allotted_lots: number;
    allotted_shares: number;
    allotment_price: string | null;
    refund_amount: string;
    allotment_date?: string | null;
  },
): boolean {
  return (
    existing.application_id === request.application_id &&
    existing.allotment_status === request.allotment_status &&
    existing.allotted_lots === request.allotted_lots &&
    existing.allotted_shares === request.allotted_shares &&
    sameNullableDecimal(existing.allotment_price, request.allotment_price) &&
    sameDecimal(existing.refund_amount, request.refund_amount) &&
    existing.allotment_date === (request.allotment_date ?? null)
  );
}

function sameLedgerEntry(
  existing: CapitalLedgerEntry,
  request: {
    application_id?: string | null;
    transaction_type: string;
    amount: string;
    currency: string;
    effective_at: string;
    audit_reference: string;
    idempotency_key: string;
    quantity?: number | null;
    unit_price?: string | null;
    adjustment_direction?: string | null;
  },
): boolean {
  return (
    existing.application_id === (request.application_id ?? null) &&
    existing.transaction_type === request.transaction_type &&
    sameDecimal(existing.amount, request.amount) &&
    existing.currency === request.currency &&
    new Date(existing.effective_at).getTime() === new Date(request.effective_at).getTime() &&
    existing.audit_reference === request.audit_reference &&
    existing.idempotency_key === request.idempotency_key &&
    existing.quantity === (request.quantity ?? null) &&
    sameNullableDecimal(existing.unit_price, request.unit_price ?? null) &&
    existing.adjustment_direction === (request.adjustment_direction ?? null)
  );
}

function sameNullableDecimal(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  return sameDecimal(left, right);
}

function sameDecimal(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
    const normalizedFraction = fraction.replace(/0+$/, "");
    return `${normalizedWhole}${normalizedFraction ? `.${normalizedFraction}` : ""}`;
  };
  return normalize(left) === normalize(right);
}

function recordNotFound(context: CapitalRouteContext, code: string) {
  return context.json(
    { error: { code, message: "The requested financial record was not found." } },
    404,
  );
}

function validationError(context: CapitalRouteContext) {
  return context.json(
    { error: { code: "VALIDATION_ERROR", message: "The financial request is invalid." } },
    400,
  );
}

function pagination(page: number, pageSize: number, total: number) {
  return { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function decimalSnapshotString(value: unknown): string | undefined {
  const decimal = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  return typeof decimal === "string" && /^\d{1,20}(?:\.\d{1,6})?$/.test(decimal)
    ? decimal
    : undefined;
}

function relatedCurrency(application: { currency: string } | Array<{ currency: string }>): string {
  const currency = Array.isArray(application) ? application[0]?.currency : application.currency;
  if (!currency) throw new Error("Capital summary is missing an application currency.");
  return currency;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
