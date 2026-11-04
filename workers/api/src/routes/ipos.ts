import { Hono, type Context } from "hono";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  isIpoReadyForApplication,
  type IpoCatalogCategoryConfiguration,
  type IpoCategoryConfiguration,
  type IpoCatalogRecord,
  type IpoRecord,
} from "@ipo-mania/shared";
import {
  ipoCatalogListQuerySchema,
  ipoCategoryConfigurationSchema,
  ipoListQuerySchema,
  ipoSchema,
  ipoUpdateSchema,
  z,
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
  "id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max, cut_off_price, lot_size, issue_size, opening_date, closing_date, allotment_date, listing_date, status, data_source, source_reference, last_verified_at, source_catalog_id, created_at, updated_at, archived_at";
const categoryColumns =
  "id, ipo_id, category, rule_version, lot_limit_status, default_lots, minimum_lots, maximum_lots, lot_increment, investment_limit_status, minimum_investment, maximum_investment, reserved_shares, reserved_percentage, shareholder_record_date, minimum_shareholding, eligibility_conditions, allowed_price_types, minimum_price_increment, source_reference, source_catalog_rule_id, rule_source, last_verified_at, created_at";
const catalogCategoryColumns =
  "id, ipo_catalog_id, category, rule_version, lot_limit_status, default_lots, minimum_lots, maximum_lots, lot_increment, investment_limit_status, minimum_investment, maximum_investment, reserved_shares, reserved_percentage, shareholder_record_date, minimum_shareholding, eligibility_conditions, allowed_price_types, minimum_price_increment, source_reference, rule_source, last_verified_at, created_at";
const catalogColumns =
  "id,provider_id,company_name,symbol,issue_type,exchange,price_band_min,price_band_max,issue_price,lot_size,issue_size,bidding_start_date,bidding_end_date,allotment_date,listing_date,ipo_status,data_source,source_reference,last_synced_at,created_at,updated_at,archived_at";

function queryWithStatuses(context: IpoRouteContext) {
  const query = context.req.query();
  const statuses = new URL(context.req.url).searchParams.getAll("status");
  return statuses.length > 1 ? { ...query, status: statuses } : query;
}

type IpoCatalogDatabaseRow = {
  id: string;
  provider_id: string | null;
  company_name: string;
  symbol: string | null;
  issue_type: string;
  exchange: string | null;
  price_band_min: number | string | null;
  price_band_max: number | string | null;
  issue_price: number | string | null;
  lot_size: number | null;
  issue_size: number | string | null;
  bidding_start_date: string | null;
  bidding_end_date: string | null;
  allotment_date: string | null;
  listing_date: string | null;
  ipo_status: string;
  data_source: string;
  source_reference: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

function catalogRecord(row: IpoCatalogDatabaseRow): IpoCatalogRecord {
  const decimal = (value: unknown) => (value == null ? null : String(value));
  const statuses: Record<string, IpoCatalogRecord["status"]> = {
    upcoming: "UPCOMING",
    open: "OPEN",
    closed: "CLOSED",
    listed: "LISTED",
  };
  const status = statuses[row.ipo_status];
  if (!status) throw new Error("The shared IPO status is invalid.");
  return {
    id: row.id,
    company_name: row.company_name,
    symbol: row.symbol,
    exchange: row.exchange,
    lot_size: row.lot_size,
    data_source: row.data_source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    allotment_date: row.allotment_date,
    listing_date: row.listing_date,
    ipo_type: row.issue_type === "SME" ? "SME" : "MAINBOARD",
    issue_price_min: decimal(row.price_band_min ?? row.issue_price),
    issue_price_max: decimal(row.price_band_max ?? row.issue_price),
    cut_off_price: decimal(row.issue_price),
    issue_size: decimal(row.issue_size),
    opening_date: row.bidding_start_date,
    closing_date: row.bidding_end_date,
    status,
    source_reference: row.source_reference ?? row.provider_id ?? null,
    last_verified_at: row.last_synced_at,
  };
}

type ApplicationAwareIpo<T extends IpoRecord | IpoCatalogRecord> = T & {
  source: "PERSONAL" | "CATALOG";
  alreadyApplied: boolean;
  applicationStatus: string | null;
};

async function hydrateApplicationFlags(
  supabase: SupabaseClient,
  userId: string,
  personalIpos: IpoRecord[],
  catalogIpos: Array<IpoCatalogRecord & { source: "CATALOG" }>,
) {
  const ownedApplicationIds = personalIpos.map((ipo) => ipo.id);
  if (ownedApplicationIds.length === 0) {
    return {
      personal: personalIpos.map((ipo) => ({ ...ipo, alreadyApplied: false, applicationStatus: null })),
      catalog: catalogIpos.map((ipo) => ({ ...ipo, alreadyApplied: false, applicationStatus: null })),
    };
  }
  const { data, error } = await supabase
    .from("applications")
    .select("ipo_id, application_status")
    .eq("user_id", userId)
    .in("ipo_id", ownedApplicationIds)
    .is("archived_at", null);
  if (error) throw error;
  const statusByOwnedIpoId = new Map(
    (data ?? []).map((application) => [application.ipo_id, application.application_status]),
  );
  const appliedCatalogIds = new Set(
    personalIpos
      .filter(
        (ipo) =>
          typeof ipo.source_catalog_id === "string" && statusByOwnedIpoId.has(ipo.id),
      )
      .map((ipo) => ipo.source_catalog_id as string),
  );
  const catalogStatusByCatalogId = new Map<string, string>();
  for (const ipo of personalIpos) {
    if (typeof ipo.source_catalog_id === "string" && statusByOwnedIpoId.has(ipo.id)) {
      catalogStatusByCatalogId.set(ipo.source_catalog_id, statusByOwnedIpoId.get(ipo.id)!);
    }
  }
  const hydratedPersonal: ApplicationAwareIpo<IpoRecord>[] = personalIpos.map((ipo) => ({
    ...ipo,
    source: "PERSONAL",
    alreadyApplied: statusByOwnedIpoId.has(ipo.id),
    applicationStatus: statusByOwnedIpoId.get(ipo.id) ?? null,
  }));
  const hydratedCatalog: ApplicationAwareIpo<IpoCatalogRecord>[] = catalogIpos.map((ipo) => ({
    ...ipo,
    source: "CATALOG",
    alreadyApplied: appliedCatalogIds.has(ipo.id),
    applicationStatus: catalogStatusByCatalogId.get(ipo.id) ?? null,
  }));
  return { personal: hydratedPersonal, catalog: hydratedCatalog };
}

export const iposRoutes = new Hono<IpoContext>();
iposRoutes.use("*", authenticate);

iposRoutes.get("/catalog", async (context) => {
  const parsed = ipoCatalogListQuerySchema.safeParse(queryWithStatuses(context));
  if (!parsed.success) return validationError(context);
  const query = parsed.data;
  const sortColumn =
    query.sort === "opening_asc" || query.sort.startsWith("date_")
      ? "bidding_start_date"
      : query.sort.startsWith("price_")
        ? "price_band_min"
        : "company_name";
  const sortAscending = query.sort.endsWith("_asc");
  let request = context
    .get("rlsSupabase")
    .from("ipo_catalog")
    .select(catalogColumns, { count: "exact" })
    .is("archived_at", null)
    .order(sortColumn, { ascending: sortAscending, nullsFirst: false });
  if (sortColumn !== "company_name") request = request.order("company_name", { ascending: true });
  request = request.order("id", { ascending: true });
  const selectedStatuses = Array.isArray(query.status)
    ? query.status
    : query.status
      ? [query.status]
      : [];
  if (selectedStatuses.length === 1) {
    request = request.eq("ipo_status", selectedStatuses[0]!.toLowerCase());
  } else if (selectedStatuses.length > 1) {
    request = request.in(
      "ipo_status",
      selectedStatuses.map((status) => status.toLowerCase()),
    );
  }
  if (query.search) {
    // Quote PostgREST values so punctuation cannot introduce extra filter expressions.
    const term = escapeLike(query.search).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    request = request.or(`company_name.ilike."%${term}%",symbol.ilike."${term}"`);
  }
  const { data, error, count } = await request.range(
    (query.page - 1) * query.page_size,
    query.page * query.page_size - 1,
  );
  if (error) throw error;
  const catalogRows = (data ?? []).map(catalogRecord);
  if (catalogRows.length === 0) {
    return context.json({
      data: {
        ipos: [],
        pagination: {
          page: query.page,
          page_size: query.page_size,
          total: count ?? 0,
          total_pages: Math.ceil((count ?? 0) / query.page_size),
        },
      },
    });
  }
  const userOwnedRows = await context
    .get("rlsSupabase")
    .from("ipos")
    .select(ipoColumns)
    .eq("user_id", context.get("authenticatedUser").id)
    .in(
      "source_catalog_id",
      catalogRows.map((ipo) => ipo.id),
    )
    .is("archived_at", null);
  if (userOwnedRows.error) throw userOwnedRows.error;
  const sourceCatalogIds = new Set(
    (userOwnedRows.data ?? [])
      .map((ipo) => ipo.source_catalog_id)
      .filter((sourceCatalogId): sourceCatalogId is string => typeof sourceCatalogId === "string"),
  );
  const userApplications = await context
    .get("rlsSupabase")
    .from("applications")
    .select("ipo_id, application_status")
    .eq("user_id", context.get("authenticatedUser").id)
    .in(
      "ipo_id",
      (userOwnedRows.data ?? []).map((ipo) => ipo.id),
    )
    .is("archived_at", null);
  if (userApplications.error) throw userApplications.error;
  const applicationStatusByOwnedIpoId = new Map(
    (userApplications.data ?? []).map((application) => [application.ipo_id, application.application_status]),
  );
  const statusByCatalogId = new Map<string, string>();
  for (const ipo of userOwnedRows.data ?? []) {
    if (typeof ipo.source_catalog_id === "string" && applicationStatusByOwnedIpoId.has(ipo.id)) {
      statusByCatalogId.set(ipo.source_catalog_id, applicationStatusByOwnedIpoId.get(ipo.id)!);
    }
  }
  return context.json({
    data: {
      ipos: catalogRows.map((ipo) => ({
        ...ipo,
        alreadyApplied: sourceCatalogIds.has(ipo.id),
        applicationStatus: statusByCatalogId.get(ipo.id) ?? null,
      })),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / query.page_size),
      },
    },
  });
});

iposRoutes.get("/catalog/:ipoId", async (context) => {
  const parsed = z.uuid().safeParse(context.req.param("ipoId"));
  if (!parsed.success) return ipoNotFound(context);
  const ipoId = parsed.data;
  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipo_catalog")
    .select(catalogColumns)
    .eq("id", ipoId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return ipoNotFound(context);
  return context.json({ data: catalogRecord(data) });
});

iposRoutes.get("/catalog/:ipoId/categories", async (context) => {
  const parsed = z.uuid().safeParse(context.req.param("ipoId"));
  if (!parsed.success) return ipoNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipo_catalog_categories")
    .select(catalogCategoryColumns)
    .eq("ipo_catalog_id", parsed.data)
    .order("category", { ascending: true })
    .order("rule_version", { ascending: false });
  if (error) throw error;
  return context.json({
    data: { configurations: (data ?? []) as IpoCatalogCategoryConfiguration[] },
  });
});

iposRoutes.post("/catalog/:ipoId/import", async (context) => {
  const parsed = z.uuid().safeParse(context.req.param("ipoId"));
  if (!parsed.success) return ipoNotFound(context);
  const supabase = context.get("rlsSupabase");
  const userId = context.get("authenticatedUser").id;
  const catalogIpoId = parsed.data;
  const { data: existingOwnedIpo, error } = await supabase
    .from("ipos")
    .select(ipoColumns)
    .eq("user_id", userId)
    .eq("source_catalog_id", catalogIpoId)
    .maybeSingle();
  if (error) throw error;
  let ownedIpo = existingOwnedIpo;

  if (!ownedIpo) {
    const catalogResult = await supabase
      .from("ipo_catalog")
      .select(catalogColumns)
      .eq("id", catalogIpoId)
      .is("archived_at", null)
      .maybeSingle();
    if (catalogResult.error) throw catalogResult.error;
    if (!catalogResult.data) return ipoNotFound(context);
    const row = catalogResult.data;
    const issue = catalogRecord(row);
    if (!isIpoReadyForApplication(issue)) {
      return context.json(
        {
          error: {
            code: "IPO_DATA_INCOMPLETE",
            message: "This shared IPO is missing issue data required for application calculations.",
          },
        },
        422,
      );
    }

    const { data, error: insertError } = await supabase
      .from("ipos")
      .insert({
        user_id: userId,
        source_catalog_id: catalogIpoId,
        company_name: issue.company_name.trim(),
        symbol: issue.symbol?.trim().toUpperCase() ?? null,
        ipo_type: issue.ipo_type,
        exchange: issue.exchange.trim(),
        issue_price_min: issue.issue_price_min,
        issue_price_max: issue.issue_price_max,
        cut_off_price:
          issue.cut_off_price &&
          Number(issue.cut_off_price) >= Number(issue.issue_price_min) &&
          Number(issue.cut_off_price) <= Number(issue.issue_price_max)
            ? issue.cut_off_price
            : null,
        lot_size: issue.lot_size,
        issue_size: issue.issue_size,
        opening_date: issue.opening_date,
        closing_date: issue.closing_date,
        allotment_date: issue.allotment_date,
        listing_date: issue.listing_date,
        status: issue.status,
        data_source: row.data_source === "MANUAL" ? "MANUAL" : "PUBLISHED_SOURCE",
        source_reference: row.provider_id,
        last_verified_at: row.last_synced_at,
      })
      .select(ipoColumns)
      .single();
    if (insertError?.code === "23505") {
      const existing = await supabase
        .from("ipos")
        .select(ipoColumns)
        .eq("user_id", userId)
        .eq("source_catalog_id", catalogIpoId)
        .maybeSingle();
      if (existing.error) throw existing.error;
      ownedIpo = existing.data;
      if (!ownedIpo) return ipoDatabaseError(context, insertError);
    } else if (insertError) {
      return ipoDatabaseError(context, insertError);
    } else {
      ownedIpo = data;
    }
    if (!ownedIpo) return ipoNotFound(context);
  }

  if (ownedIpo.archived_at) {
    return context.json(
      {
        error: {
          code: "IPO_ARCHIVED",
          message: "This IPO is archived in My IPOs. Restore it before recording an application.",
        },
      },
      409,
    );
  }

  const copyError = await copyLatestCatalogRules(supabase, userId, ownedIpo.id, catalogIpoId);
  if (copyError) throw copyError;
  return context.json({ data: ownedIpo });
});

iposRoutes.get("/", async (context) => {
  const parsed = ipoListQuerySchema.safeParse(queryWithStatuses(context));
  if (!parsed.success) return validationError(context);

  const query = parsed.data;
  const userId = context.get("authenticatedUser").id;
  const supabase = context.get("rlsSupabase");
  const offset = (query.page - 1) * query.page_size;
  const pageEnd = offset + query.page_size - 1;
  const combinedList = query.source === "all";
  const rangeStart = combinedList ? 0 : offset;
  const rangeEnd = pageEnd;
  const sortColumn = query.sort.startsWith("date_")
    ? "opening_date"
    : query.sort.startsWith("price_")
      ? "issue_price_min"
      : "company_name";
  const sortAscending = query.sort.endsWith("_asc");
  const selectedStatuses = Array.isArray(query.status)
    ? query.status
    : query.status
      ? [query.status]
      : [];

  let ownedIpos: IpoRecord[] = [];
  let ownedCount = 0;
  if (query.source !== "catalog") {
    let request = supabase
      .from("ipos")
      .select(ipoColumns, { count: "exact" })
      .eq("user_id", userId)
      .order(sortColumn, { ascending: sortAscending, nullsFirst: false });
    if (sortColumn !== "company_name") request = request.order("company_name", { ascending: true });
    request = request.order("id", { ascending: true });

    if (query.include_archived === "false") request = request.is("archived_at", null);
    if (query.include_archived === "true") request = request.not("archived_at", "is", null);
    if (selectedStatuses.length === 1) {
      request = request.eq("status", selectedStatuses[0]!);
    } else if (selectedStatuses.length > 1) {
      request = request.in("status", selectedStatuses);
    }
    if (query.exchange) request = request.ilike("exchange", query.exchange);
    if (query.opening_from) request = request.gte("opening_date", query.opening_from);
    if (query.opening_to) request = request.lte("opening_date", query.opening_to);
    if (query.search) {
      const search = query.search.trim();
      request = /^[A-Za-z0-9._-]+$/.test(search)
        ? request.ilike("symbol", search)
        : request.ilike("company_name", `%${escapeLike(search)}%`);
    }

    const result = await request.range(rangeStart, rangeEnd);
    if (result.error) throw result.error;
    ownedIpos = (result.data ?? []) as IpoRecord[];
    ownedCount = result.count ?? 0;
  }

  const catalogStatuses = selectedStatuses.filter((status) =>
    ["UPCOMING", "OPEN", "CLOSED", "LISTED"].includes(status),
  );
  let catalog: IpoCatalogDatabaseRow[] = [];
  let catalogCount = 0;
  if (selectedStatuses.length === 0 || catalogStatuses.length > 0) {
    let catalogRequest = supabase
      .from("ipo_catalog")
      .select(catalogColumns, { count: "exact" })
      .is("archived_at", null)
      .order(
        sortColumn === "opening_date"
          ? "bidding_start_date"
          : sortColumn === "issue_price_min"
            ? "price_band_min"
            : "company_name",
        { ascending: sortAscending, nullsFirst: false },
      );
    if (sortColumn !== "company_name")
      catalogRequest = catalogRequest.order("company_name", { ascending: true });
    catalogRequest = catalogRequest.order("id", { ascending: true });
    if (catalogStatuses.length === 1) {
      catalogRequest = catalogRequest.eq("ipo_status", catalogStatuses[0]!.toLowerCase());
    } else if (catalogStatuses.length > 1) {
      catalogRequest = catalogRequest.in(
        "ipo_status",
        catalogStatuses.map((status) => status.toLowerCase()),
      );
    }
    if (query.exchange) catalogRequest = catalogRequest.ilike("exchange", query.exchange);
    if (query.opening_from)
      catalogRequest = catalogRequest.gte("bidding_start_date", query.opening_from);
    if (query.opening_to)
      catalogRequest = catalogRequest.lte("bidding_start_date", query.opening_to);
    if (query.search) {
      const term = escapeLike(query.search).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      catalogRequest = catalogRequest.or(`company_name.ilike."%${term}%",symbol.ilike."${term}"`);
    }
    const catalogResult = await catalogRequest.range(rangeStart, rangeEnd);
    if (catalogResult.error) throw catalogResult.error;
    catalog = (catalogResult.data ?? []) as IpoCatalogDatabaseRow[];
    catalogCount = catalogResult.count ?? 0;
  }

  const personalIpos = ownedIpos.map((ipo) => ({ ...ipo, source: "PERSONAL" as const }));
  const catalogIpos = catalog.map((ipo) => ({ ...catalogRecord(ipo), source: "CATALOG" as const }));
  const hydrated = await hydrateApplicationFlags(
    supabase,
    userId,
    personalIpos,
    catalogIpos,
  );
  const combinedIpos = [...hydrated.personal, ...hydrated.catalog] as unknown as Array<{
    id: string;
    company_name: string;
    opening_date: string | null;
    issue_price_min: string | null;
    source: "PERSONAL" | "CATALOG";
  }>;
  if (combinedList) {
    const compareNullable = (left: string | null, right: string | null) => {
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
    };
    const compareValue = (left: string | null, right: string | null) => {
      if (left === null || right === null) return compareNullable(left, right);
      if (sortColumn === "issue_price_min") {
        return Number(left) - Number(right);
      }
      return compareNullable(left, right);
    };
    combinedIpos.sort((left, right) => {
      const leftValue =
        sortColumn === "opening_date"
          ? left.opening_date
          : sortColumn === "issue_price_min"
            ? left.issue_price_min
            : left.company_name;
      const rightValue =
        sortColumn === "opening_date"
          ? right.opening_date
          : sortColumn === "issue_price_min"
            ? right.issue_price_min
            : right.company_name;
      const primary = compareValue(leftValue, rightValue);
      if (primary !== 0) return sortAscending ? primary : -primary;
      if (sortColumn !== "company_name") {
        const name = compareNullable(left.company_name, right.company_name);
        if (name !== 0) return name;
      }
      const id = left.id.localeCompare(right.id);
      return id !== 0 ? id : left.source.localeCompare(right.source);
    });
  }

  const total =
    query.source === "all"
      ? ownedCount + catalogCount
      : query.source === "catalog"
        ? catalogCount
        : ownedCount;
  const listedIpos = combinedList
    ? combinedIpos.slice(offset, pageEnd + 1)
    : query.source === "catalog"
      ? hydrated.catalog
      : hydrated.personal;
  return context.json({
    data: {
      ipos: listedIpos,
      catalog: catalog.map(catalogRecord),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
      catalog_pagination: {
        page: query.page,
        page_size: query.page_size,
        total: catalogCount,
        total_pages: Math.ceil(catalogCount / query.page_size),
      },
    },
  });
});

iposRoutes.post("/", validateJson(ipoSchema), async (context) => {
  const submittedIpo = context.req.valid("json");
  if (!(["UPCOMING", "OPEN", "CLOSED", "LISTED"] as string[]).includes(submittedIpo.status)) {
    return context.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Shared catalog IPOs must use Upcoming, Open, Closed, or Listed status.",
        },
      },
      400,
    );
  }
  const { data, error } = await context
    .get("rlsSupabase")
    .from("ipo_catalog")
    .insert({
      submitted_by: context.get("authenticatedUser").id,
      company_name: submittedIpo.company_name,
      symbol: submittedIpo.symbol,
      issue_type: submittedIpo.ipo_type.toUpperCase() === "SME" ? "SME" : "mainboard",
      exchange: submittedIpo.exchange,
      price_band_min: submittedIpo.issue_price_min,
      price_band_max: submittedIpo.issue_price_max,
      issue_price: submittedIpo.cut_off_price,
      lot_size: submittedIpo.lot_size,
      issue_size: submittedIpo.issue_size,
      bidding_start_date: submittedIpo.opening_date,
      bidding_end_date: submittedIpo.closing_date,
      allotment_date: submittedIpo.allotment_date,
      listing_date: submittedIpo.listing_date,
      ipo_status: submittedIpo.status.toLowerCase(),
      data_source: "USER_SUBMITTED",
      source_reference: submittedIpo.source_reference,
      source_last_updated_at: submittedIpo.last_verified_at,
      manual_override_fields: [],
    })
    .select(catalogColumns)
    .single();

  if (error?.code === "23505") {
    return context.json(
      {
        error: {
          code: "DUPLICATE_IPO",
          message: "An active shared catalog IPO already uses this symbol and exchange.",
        },
      },
      409,
    );
  }
  if (error) return ipoDatabaseError(context, error);
  return context.json({ data: catalogRecord(data as IpoCatalogDatabaseRow) }, 201);
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

async function copyLatestCatalogRules(
  supabase: SupabaseClient,
  userId: string,
  ipoId: string,
  catalogIpoId: string,
) {
  const { data: catalogRules, error: catalogError } = await supabase
    .from("ipo_catalog_categories")
    .select(catalogCategoryColumns)
    .eq("ipo_catalog_id", catalogIpoId)
    .order("category", { ascending: true })
    .order("rule_version", { ascending: false });
  if (catalogError) return catalogError;

  const latest = new Map<string, Record<string, unknown>>();
  for (const rule of catalogRules ?? []) {
    if (!latest.has(String(rule.category))) latest.set(String(rule.category), rule);
  }
  if (latest.size === 0) return null;

  const { data: existingRules, error: existingError } = await supabase
    .from("ipo_categories")
    .select("category, rule_version, source_catalog_rule_id")
    .eq("user_id", userId)
    .eq("ipo_id", ipoId);
  if (existingError) return existingError;
  const currentByCategory = new Map<
    string,
    { rule_version: number; source_catalog_rule_id: string | null }
  >();
  for (const existing of existingRules ?? []) {
    const current = currentByCategory.get(existing.category);
    if (!current || existing.rule_version > current.rule_version) {
      currentByCategory.set(existing.category, {
        rule_version: existing.rule_version,
        source_catalog_rule_id: existing.source_catalog_rule_id,
      });
    }
  }
  const missingRules = Array.from(latest.values()).filter((rule) => {
    const current = currentByCategory.get(String(rule.category));
    return (
      !current ||
      (current.source_catalog_rule_id !== null && current.source_catalog_rule_id !== rule.id)
    );
  });
  if (missingRules.length === 0) return null;

  const { error } = await supabase.from("ipo_categories").insert(
    missingRules.map((rule) => ({
      user_id: userId,
      ipo_id: ipoId,
      source_catalog_rule_id: rule.id,
      category: rule.category,
      lot_limit_status: rule.lot_limit_status,
      default_lots: rule.default_lots,
      minimum_lots: rule.minimum_lots,
      maximum_lots: rule.maximum_lots,
      lot_increment: rule.lot_increment,
      investment_limit_status: rule.investment_limit_status,
      minimum_investment: rule.minimum_investment,
      maximum_investment: rule.maximum_investment,
      reserved_shares: rule.reserved_shares,
      reserved_percentage: rule.reserved_percentage,
      shareholder_record_date: rule.shareholder_record_date,
      minimum_shareholding: rule.minimum_shareholding,
      eligibility_conditions: rule.eligibility_conditions,
      allowed_price_types: rule.allowed_price_types,
      minimum_price_increment: rule.minimum_price_increment,
      source_reference: rule.source_reference,
      rule_source: rule.rule_source,
      last_verified_at: rule.last_verified_at,
    })),
  );
  return error;
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
