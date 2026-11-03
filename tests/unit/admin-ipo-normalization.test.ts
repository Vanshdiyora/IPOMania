import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeProviderIpo,
  ProviderRequestError,
  runIpoSync,
} from "../../workers/api/src/routes/admin-ipos";

function createSupabaseMock(catalogLookup: {
  data: { id: string; manual_override_fields: string[] } | null;
  error: { message: string } | null;
}) {
  const catalogUpdates: Record<string, unknown>[] = [];
  const catalogInserts: Record<string, unknown>[] = [];

  function query(table: string) {
    let operation = "select";
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      gte() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      insert(value: Record<string, unknown>) {
        operation = "insert";
        if (table === "ipo_catalog") catalogInserts.push(value);
        return this;
      },
      update(value: Record<string, unknown>) {
        operation = "update";
        if (table === "ipo_catalog") catalogUpdates.push(value);
        return this;
      },
      maybeSingle() {
        if (table === "ipo_catalog") return Promise.resolve(catalogLookup);
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return Promise.resolve({ data: { id: "sync-log-id" }, error: null });
      },
      then(resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        const result =
          table === "ipo_sync_logs" && operation === "select"
            ? { data: [], error: null }
            : { data: null, error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
  }

  return {
    client: { from: query } as unknown as SupabaseClient,
    catalogUpdates,
    catalogInserts,
  };
}

describe("admin IPO provider normalization", () => {
  it("normalizes a mainboard provider record", () => {
    const normalized = normalizeProviderIpo({
      id: "provider-123",
      companyName: "Example Industries Limited",
      status: "OPEN",
      issue_type: "MAINBOARD",
      min_price: "100",
      max_price: "120",
      lotSize: "10",
      issue_open_date: "2026-11-10T00:00:00.000Z",
    });
    expect(normalized).toMatchObject({
      provider_id: "provider-123",
      company_name: "Example Industries Limited",
      ipo_status: "open",
      issue_type: "mainboard",
      price_band_min: 100,
      price_band_max: 120,
      lot_size: 10,
      bidding_start_date: "2026-11-10",
    });
  });

  it("rejects records without a stable provider identifier", () => {
    expect(normalizeProviderIpo({ company_name: "Missing Identifier" })).toBeNull();
  });

  it("preserves the provider HTTP status for structured sync errors", () => {
    const error = new ProviderRequestError(429);
    expect(error.status).toBe(429);
    expect(error.message).toContain("status 429");
  });

  it("updates a matching provider record instead of inserting another catalog row", async () => {
    const mock = createSupabaseMock({
      data: { id: "catalog-123", manual_override_fields: [] },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ id: "provider-123", company_name: "Example IPO" }]), {
          status: 200,
        }),
      ),
    );

    const result = await runIpoSync(mock.client, "scheduled", { IPO_GURU_API_KEY: "test-key" });

    expect(result.status).toBe(200);
    expect(mock.catalogUpdates).toHaveLength(1);
    expect(mock.catalogUpdates[0]).toMatchObject({
      provider_id: "provider-123",
      company_name: "Example IPO",
    });
    expect(mock.catalogInserts).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("does not insert a provider record when its database lookup fails", async () => {
    const mock = createSupabaseMock({
      data: null,
      error: { message: "database unavailable" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ id: "provider-123", company_name: "Example IPO" }]), {
          status: 200,
        }),
      ),
    );

    const result = await runIpoSync(mock.client, "scheduled", { IPO_GURU_API_KEY: "test-key" });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      data: { status: "partial", recordsFailed: 1, recordsInserted: 0 },
    });
    expect(mock.catalogInserts).toHaveLength(0);
    expect(mock.catalogUpdates).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
