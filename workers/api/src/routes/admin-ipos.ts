import { Hono } from "hono";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "@ipo-mania/validation";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";
import { authorizeAdmin } from "../middleware/authorize-admin";
import { validateEnvironment } from "../env";

const manualIpoSchema = z.object({
  company_name: z.string().trim().min(1).max(160),
  provider_id: z.string().trim().min(1).max(160).nullable().optional(),
  slug: z.string().trim().min(1).max(160).nullable().optional(),
  display_name: z.string().trim().max(160).nullable().optional(),
  symbol: z.string().trim().max(24).nullable().optional(),
  isin: z.string().trim().max(24).nullable().optional(),
  issue_type: z.enum(["mainboard", "SME"]),
  ipo_status: z.enum(["upcoming", "open", "closed", "listed"]),
  exchange: z.string().trim().max(40).nullable().optional(),
  bidding_start_date: z.string().date().nullable().optional(),
  bidding_end_date: z.string().date().nullable().optional(),
  allotment_date: z.string().date().nullable().optional(),
  listing_date: z.string().date().nullable().optional(),
  listing_price: z.coerce.number().positive().nullable().optional(),
  issue_price: z.coerce.number().positive().nullable().optional(),
  price_band_min: z.coerce.number().positive().nullable().optional(),
  price_band_max: z.coerce.number().positive().nullable().optional(),
  lot_size: z.coerce.number().int().positive().nullable().optional(),
  issue_size: z.coerce.number().positive().nullable().optional(),
  data_source: z.string().trim().max(80).default("MANUAL"),
});

const normalizedRows = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload))
    return payload.filter(
      (row): row is Record<string, unknown> => typeof row === "object" && row !== null,
    );
  if (typeof payload !== "object" || payload === null) return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "ipo", "ipos", "results"]) {
    if (Array.isArray(record[key])) return record[key] as Record<string, unknown>[];
  }
  return [];
};

const first = (...values: unknown[]) =>
  values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : value == null ? null : String(value);
const number = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const date = (value: unknown) => {
  const parsed = text(value);
  if (!parsed) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(parsed)?.[0];
  return iso ?? null;
};

export function normalizeProviderIpo(row: Record<string, unknown>) {
  const companyName = first(row.company_name, row.companyName, row.company, row.name);
  const providerId = first(row.provider_id, row.providerId, row.slug, row.id, row.uuid);
  if (!companyName || !providerId) return null;
  const statusText = String(
    first(row.status, row.ipo_status, row.lifecycle_status, "upcoming"),
  ).toLowerCase();
  const ipoStatus =
    row.is_listed === true
      ? "listed"
      : ((["upcoming", "open", "closed", "listed"] as const).find((status) =>
          statusText.includes(status),
        ) ?? "upcoming");
  const issueTypeText = String(first(row.issue_type, row.type, "MAINBOARD")).toLowerCase();
  const issueType = issueTypeText.includes("sme") ? "SME" : "mainboard";
  return {
    provider_id: String(providerId),
    slug: String(first(row.slug, providerId))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    company_name: String(companyName),
    display_name: text(first(row.display_name, row.companyName, companyName)),
    symbol: text(first(row.symbol, row.ticker)),
    isin: text(row.isin),
    issue_type: issueType,
    ipo_status: ipoStatus,
    exchange: text(first(row.exchange, row.listing_exchange)) ?? "NSE",
    issue_size: number(first(row.issue_size, row.issueSize)),
    face_value: number(first(row.face_value, row.faceValue)),
    price_band_min: number(first(row.price_band_min, row.min_price, row.priceMin)),
    price_band_max: number(first(row.price_band_max, row.max_price, row.priceMax)),
    issue_price: number(first(row.issue_price, row.issuePrice, row.final_price)),
    lot_size: number(first(row.lot_size, row.lotSize)),
    minimum_quantity: number(first(row.minimum_quantity, row.minimumQuantity)),
    bidding_start_date: date(first(row.bidding_start_date, row.open_date, row.issue_open_date)),
    bidding_end_date: date(first(row.bidding_end_date, row.close_date, row.issue_close_date)),
    allotment_date: date(first(row.allotment_date, row.finalisation_date)),
    listing_date: date(first(row.listing_date, row.listedDate)),
    listing_price: number(first(row.listing_price, row.listingPrice)),
    data_source: "IPO_GURU",
    source_last_updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };
}

async function fetchProvider(env: EnvironmentBindings) {
  const environment = validateEnvironment(env);
  if (!environment.IPO_GURU_API_KEY)
    return { configured: false, rows: [] as Record<string, unknown>[] };
  const response = await fetch(environment.IPO_GURU_API_URL, {
    headers: {
      "X-API-KEY": environment.IPO_GURU_API_KEY,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`IPO Guru request failed with status ${response.status}`);
  return { configured: true, rows: normalizedRows(await response.json()) };
}

function istDayBounds(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const start = new Date(Date.UTC(y, m, d) - 330 * 60_000);
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function runIpoSync(
  supabase: SupabaseClient,
  triggerType: "scheduled" | "manual",
  env: EnvironmentBindings,
) {
  const environment = validateEnvironment(env);
  const { data: running, error: runningError } = await supabase
    .from("ipo_sync_logs")
    .select("id")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .limit(1)
    .maybeSingle();
  if (runningError) throw new Error("Unable to verify synchronization lock");
  if (running)
    return {
      status: 409,
      body: { error: { code: "SYNC_RUNNING", message: "A synchronization is already running." } },
    };

  const { start } = istDayBounds();
  const { data: todayLogs } = await supabase
    .from("ipo_sync_logs")
    .select("id, trigger_type")
    .gte("started_at", start);
  const manualCount = todayLogs?.filter((row) => row.trigger_type === "manual").length ?? 0;
  if (triggerType === "manual" && manualCount >= 1) {
    return {
      status: 429,
      body: {
        error: {
          code: "SYNC_LIMIT",
          message: "The additional manual synchronization limit for today has been reached.",
        },
      },
    };
  }

  const { data: latestProviderCall } = await supabase
    .from("ipo_sync_logs")
    .select("started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestProviderCall?.started_at) {
    const nextAllowedAt =
      new Date(latestProviderCall.started_at).getTime() +
      environment.IPO_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
    if (nextAllowedAt > Date.now()) {
      return {
        status: 429,
        body: {
          error: {
            code: "SYNC_INTERVAL",
            message: `IPO Guru calls are limited to once every ${environment.IPO_SYNC_INTERVAL_HOURS} hours.`,
          },
          nextAllowedAt: new Date(nextAllowedAt).toISOString(),
        },
      };
    }
  }

  let provider: { configured: boolean; rows: Record<string, unknown>[] };
  try {
    provider = await fetchProvider(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "IPO Guru request failed";
    await supabase.from("ipo_sync_logs").insert({
      trigger_type: triggerType,
      provider: "IPO_GURU",
      status: "failed",
      error_message: message,
      execution_summary: { step: "Fetching IPO list" },
      completed_at: new Date().toISOString(),
    });
    return {
      status: 502,
      body: {
        error: { code: "SYNC_FAILED", message: "The IPO Guru synchronization request failed." },
      },
    };
  }
  if (!provider.configured) {
    const { data: log } = await supabase
      .from("ipo_sync_logs")
      .insert({
        trigger_type: triggerType,
        provider: "IPO_GURU",
        status: "failed",
        error_message: "IPO_GURU_API_KEY is not configured.",
        execution_summary: { configured: false },
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    return {
      status: 503,
      body: {
        error: {
          code: "PROVIDER_NOT_CONFIGURED",
          message: "Configure IPO_GURU_API_KEY in the existing Worker secrets.",
        },
        logId: log?.id,
      },
    };
  }

  const { data: log } = await supabase
    .from("ipo_sync_logs")
    .insert({
      trigger_type: triggerType,
      provider: "IPO_GURU",
      status: "running",
      execution_summary: { steps: ["Fetching IPO list"] },
    })
    .select("id")
    .single();

  const fetched = provider.rows.length;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  try {
    for (const sourceRow of provider.rows) {
      const normalized = normalizeProviderIpo(sourceRow);
      if (!normalized) {
        failed++;
        continue;
      }
      const { data: existing } = await supabase
        .from("ipo_catalog")
        .select("id, manual_override_fields")
        .eq("provider_id", normalized.provider_id)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("ipo_catalog").insert(normalized);
        if (error) failed++;
        else inserted++;
      } else {
        const overrides = new Set(existing.manual_override_fields ?? []);
        const next = Object.fromEntries(
          Object.entries(normalized).filter(([key]) => !overrides.has(key)),
        );
        const { error } = await supabase.from("ipo_catalog").update(next).eq("id", existing.id);
        if (error) failed++;
        else {
          updated++;
        }
      }
    }
    skipped = Math.max(0, fetched - inserted - updated - failed);
    await supabase
      .from("ipo_sync_logs")
      .update({
        status: failed ? "partial" : "success",
        completed_at: new Date().toISOString(),
        records_fetched: fetched,
        records_inserted: inserted,
        records_updated: updated,
        records_skipped: skipped,
        records_failed: failed,
        execution_summary: {
          steps: ["Fetching IPO list", "Normalizing records", "Saving records", "Completed"],
        },
      })
      .eq("id", log?.id);
    return {
      status: 200,
      body: {
        data: {
          status: failed ? "partial" : "success",
          recordsFetched: fetched,
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          recordsFailed: failed,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider synchronization failed";
    await supabase
      .from("ipo_sync_logs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        records_fetched: fetched,
        records_failed: failed + 1,
        error_message: message,
      })
      .eq("id", log?.id);
    return {
      status: 502,
      body: {
        error: {
          code: "SYNC_FAILED",
          message: "The provider synchronization failed. Existing catalog data was preserved.",
        },
      },
    };
  }
}

export function adminIpoRoutes() {
  const app = new Hono<{
    Bindings: EnvironmentBindings;
    Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
  }>();
  app.use("/*", authenticate, authorizeAdmin);

  app.get("/overview", async (context) => {
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const { data: ipos } = await supabase
      .from("ipo_catalog")
      .select("ipo_status,issue_type,listing_date")
      .is("archived_at", null);
    const counts = (ipos ?? []).reduce<Record<string, number>>((result, row) => {
      result.total = (result.total ?? 0) + 1;
      result[row.ipo_status] = (result[row.ipo_status] ?? 0) + 1;
      return result;
    }, {});
    const { data: logs } = await supabase
      .from("ipo_sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    return context.json({ data: { counts, recentSyncs: logs ?? [] } });
  });

  app.get("/catalog", async (context) => {
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const { data, error } = await supabase
      .from("ipo_catalog")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error)
      return context.json(
        { error: { code: "DATABASE_ERROR", message: "IPO records could not be loaded." } },
        500,
      );
    return context.json({ data: data ?? [] });
  });

  app.post("/catalog", async (context) => {
    const parsed = manualIpoSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success)
      return context.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "The IPO data is invalid.",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const body = {
      ...parsed.data,
      manual_override_fields: Object.keys(parsed.data).filter((key) => key !== "data_source"),
    };
    const { data, error } = await supabase.from("ipo_catalog").insert(body).select().single();
    if (error)
      return context.json(
        { error: { code: "DATABASE_ERROR", message: "The IPO could not be created." } },
        400,
      );
    return context.json({ data }, 201);
  });

  app.patch("/catalog/:id", async (context) => {
    const parsed = manualIpoSchema.partial().safeParse(await context.req.json().catch(() => null));
    if (!parsed.success)
      return context.json(
        { error: { code: "VALIDATION_ERROR", message: "The IPO data is invalid." } },
        400,
      );
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const overrideFields = Object.keys(parsed.data);
    const { data: existing } = await supabase
      .from("ipo_catalog")
      .select("manual_override_fields")
      .eq("id", context.req.param("id"))
      .single();
    const overrides = [
      ...new Set([...(existing?.manual_override_fields ?? []), ...overrideFields]),
    ];
    const { data, error } = await supabase
      .from("ipo_catalog")
      .update({ ...parsed.data, manual_override_fields: overrides })
      .eq("id", context.req.param("id"))
      .select()
      .single();
    if (error)
      return context.json(
        { error: { code: "DATABASE_ERROR", message: "The IPO could not be updated." } },
        400,
      );
    return context.json({ data });
  });

  app.delete("/catalog/:id", async (context) => {
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const { error } = await supabase
      .from("ipo_catalog")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", context.req.param("id"));
    if (error)
      return context.json(
        { error: { code: "DATABASE_ERROR", message: "The IPO could not be archived." } },
        400,
      );
    return context.body(null, 204);
  });

  app.get("/sync/status", async (context) => {
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const { data: running } = await supabase
      .from("ipo_sync_logs")
      .select("*")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: latest } = await supabase
      .from("ipo_sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: today } = await supabase
      .from("ipo_sync_logs")
      .select("id,trigger_type")
      .gte("started_at", istDayBounds().start);
    const environment = validateEnvironment(context.env);
    const nextAllowedAt = latest?.started_at
      ? new Date(
          new Date(latest.started_at).getTime() +
            environment.IPO_SYNC_INTERVAL_HOURS * 60 * 60 * 1000,
        ).toISOString()
      : null;
    return context.json({
      data: {
        running,
        latest,
        provider: "IPO_GURU",
        providerConfigured: Boolean(environment.IPO_GURU_API_KEY),
        syncIntervalHours: environment.IPO_SYNC_INTERVAL_HOURS,
        nextAllowedAt,
        runsUsedToday: today?.length ?? 0,
        remainingManualRuns: Math.max(
          0,
          1 - (today?.filter((row) => row.trigger_type === "manual").length ?? 0),
        ),
      },
    });
  });

  app.get("/sync/history", async (context) => {
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const { data, error } = await supabase
      .from("ipo_sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    if (error)
      return context.json(
        { error: { code: "DATABASE_ERROR", message: "Sync history could not be loaded." } },
        500,
      );
    return context.json({ data: data ?? [] });
  });

  app.post("/sync", async (context) => {
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const result = await runIpoSync(supabase, "manual", context.env);
    return context.json(result.body, result.status as 200 | 429 | 503 | 409 | 502);
  });

  app.get("/settings", async (context) => {
    const supabase = context.get("rlsSupabase") as SupabaseClient;
    const { data } = await supabase.from("admin_settings").select("*");
    const environment = validateEnvironment(context.env);
    return context.json({
      data: { settings: data ?? [], providerConfigured: Boolean(environment.IPO_GURU_API_KEY) },
    });
  });

  return app;
}
