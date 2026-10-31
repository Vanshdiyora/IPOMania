import { Hono, type Context } from "hono";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { IpoCategoryConfiguration, IpoRecord } from "@ipo-mania/shared";
import {
  ipoCategoryConfigurationSchema,
  ipoListQuerySchema,
  ipoSchema,
  ipoUpdateSchema,
} from "@ipo-mania/validation";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";
import { validateJson } from "../middleware/validate-json";

type IpoContext = {
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
};
type IpoRouteContext = Context<IpoContext>;

const ipoColumns =
  "id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max, cut_off_price, lot_size, issue_size, opening_date, closing_date, allotment_date, listing_date, status, data_source, source_reference, last_verified_at, created_at, updated_at, archived_at";
const categoryColumns =
  "id, ipo_id, category, rule_version, lot_limit_status, minimum_lots, maximum_lots, lot_increment, investment_limit_status, minimum_investment, maximum_investment, reserved_shares, reserved_percentage, shareholder_record_date, minimum_shareholding, eligibility_conditions, allowed_price_types, minimum_price_increment, source_reference, rule_source, last_verified_at, created_at";

export const iposRoutes = new Hono<IpoContext>();
iposRoutes.use("*", authenticate);

iposRoutes.get("/", async (context) => {
  const parsed = ipoListQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);

  const query = parsed.data;
  const userId = context.get("authenticatedUser").id;
  let request = context
    .get("rlsSupabase")
    .from("ipos")
    .select(ipoColumns, { count: "exact" })
    .eq("user_id", userId)
    .order("opening_date", { ascending: true })
    .order("id", { ascending: true });

  if (query.include_archived === "false") request = request.is("archived_at", null);
  if (query.include_archived === "true") request = request.not("archived_at", "is", null);
  if (query.status) request = request.eq("status", query.status);
  if (query.exchange) request = request.ilike("exchange", query.exchange);
  if (query.opening_from) request = request.gte("opening_date", query.opening_from);
  if (query.opening_to) request = request.lte("opening_date", query.opening_to);
  if (query.search) {
    const search = query.search.trim();
    request = /^[A-Za-z0-9._-]+$/.test(search)
      ? request.ilike("symbol", search)
      : request.ilike("company_name", `%${escapeLike(search)}%`);
  }

  const { data, error, count } = await request.range(
    (query.page - 1) * query.page_size,
    query.page * query.page_size - 1,
  );
  if (error) throw error;

  return context.json({
    data: {
      ipos: (data ?? []) as IpoRecord[],
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / query.page_size),
      },
    },
  });
});

iposRoutes.post("/", validateJson(ipoSchema), async (context) => {
  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipos")
    .insert({
      ...context.req.valid("json"),
      user_id: context.get("authenticatedUser").id,
    })
    .select(ipoColumns)
    .single();

  if (error) return ipoDatabaseError(context, error);
  return context.json({ data: data as IpoRecord }, 201);
});

iposRoutes.get("/:ipoId/categories", async (context) => {
  const ipoId = context.req.param("ipoId");
  if (!isUuid(ipoId)) return ipoNotFound(context);
  const ipo = await getOwnedIpo(context, ipoId);
  if (!ipo) return ipoNotFound(context);

  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipo_categories")
    .select(categoryColumns)
    .eq("ipo_id", ipoId)
    .eq("user_id", context.get("authenticatedUser").id)
    .order("category", { ascending: true })
    .order("rule_version", { ascending: false });
  if (error) throw error;
  return context.json({ data: { configurations: (data ?? []) as IpoCategoryConfiguration[] } });
});

iposRoutes.post(
  "/:ipoId/categories",
  validateJson(ipoCategoryConfigurationSchema),
  async (context) => {
    const ipoId = context.req.param("ipoId");
    if (!isUuid(ipoId)) return ipoNotFound(context);
    const ipo = await getOwnedIpo(context, ipoId);
    if (!ipo || ipo.archived_at) return ipoNotFound(context);

    const configuration = context.req.valid("json");
    const supabase = context.get("rlsSupabase");
    const { data, error } = await supabase
      .from("ipo_categories")
      .insert({
        ...configuration,
        ipo_id: ipoId,
        user_id: context.get("authenticatedUser").id,
      })
      .select(categoryColumns)
      .single();

    if (error) return ipoDatabaseError(context, error);
    return context.json({ data: data as IpoCategoryConfiguration }, 201);
  },
);

iposRoutes.get("/:ipoId", async (context) => {
  const ipoId = context.req.param("ipoId");
  if (!isUuid(ipoId)) return ipoNotFound(context);
  const ipo = await getOwnedIpo(context, ipoId);
  if (!ipo) return ipoNotFound(context);
  return context.json({ data: ipo });
});

iposRoutes.patch("/:ipoId", validateJson(ipoUpdateSchema), async (context) => {
  const ipoId = context.req.param("ipoId");
  if (!isUuid(ipoId)) return ipoNotFound(context);
  const updates = context.req.valid("json");
  if (Object.keys(updates).length === 0) return validationError(context);

  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipos")
    .update(updates)
    .eq("id", ipoId)
    .eq("user_id", context.get("authenticatedUser").id)
    .is("archived_at", null)
    .select(ipoColumns)
    .maybeSingle();
  if (error) return ipoDatabaseError(context, error);
  if (!data) return ipoNotFound(context);
  return context.json({ data: data as IpoRecord });
});

iposRoutes.post("/:ipoId/archive", async (context) => {
  const ipoId = context.req.param("ipoId");
  if (!isUuid(ipoId)) return ipoNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", ipoId)
    .eq("user_id", context.get("authenticatedUser").id)
    .is("archived_at", null)
    .select(ipoColumns)
    .maybeSingle();
  if (error) return ipoDatabaseError(context, error);
  if (!data) return ipoNotFound(context);
  return context.json({ data: data as IpoRecord });
});

async function getOwnedIpo(context: IpoRouteContext, ipoId: string): Promise<IpoRecord | null> {
  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipos")
    .select(ipoColumns)
    .eq("id", ipoId)
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();
  if (error) throw error;
  return data as IpoRecord | null;
}

function validationError(context: IpoRouteContext) {
  return context.json(
    { error: { code: "VALIDATION_ERROR", message: "The IPO request is invalid." } },
    400,
  );
}

function ipoNotFound(context: IpoRouteContext) {
  return context.json(
    { error: { code: "IPO_NOT_FOUND", message: "The IPO record was not found." } },
    404,
  );
}

function ipoDatabaseError(context: IpoRouteContext, error: { code?: string }) {
  if (error.code === "23505") {
    return context.json(
      { error: { code: "DUPLICATE_IPO", message: "An IPO with this symbol already exists." } },
      409,
    );
  }
  if (error.code === "23503") return ipoNotFound(context);
  if (error.code === "23514" || error.code === "22P02") return validationError(context);
  throw error;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
