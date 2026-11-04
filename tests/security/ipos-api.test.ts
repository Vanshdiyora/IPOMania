import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const ipoId = "88888888-8888-4888-8888-888888888888";
const accountId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "ipo-owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const bindings = {
  RUNTIME_ENV: "test",
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_ANON_KEY: "public-anon-key-for-tests",
} as const;
const ipoInput = {
  company_name: "IPO Test Company",
  symbol: "IPOTEST",
  ipo_type: "Mainboard",
  exchange: "Test Exchange",
  issue_price_min: "10.00",
  issue_price_max: "20.00",
  cut_off_price: "20.00",
  lot_size: 10,
  issue_size: "100000.00",
  opening_date: "2026-11-01",
  closing_date: "2026-11-03",
  allotment_date: null,
  listing_date: null,
  status: "UPCOMING",
  data_source: "MANUAL",
  source_reference: null,
  last_verified_at: null,
};
const ipoRow = {
  ...ipoInput,
  id: ipoId,
  user_id: userId,
  created_at: "2026-10-31T12:00:00.000Z",
  updated_at: "2026-10-31T12:00:00.000Z",
  archived_at: null,
};
const catalogRow = {
  id: ipoId,
  provider_id: "test-provider-reference",
  company_name: "Admin Catalog Test Company",
  symbol: "CATALOG",
  issue_type: "mainboard",
  exchange: "NSE",
  price_band_min: 10,
  price_band_max: 20,
  issue_price: null,
  lot_size: 10,
  issue_size: null,
  bidding_start_date: null,
  bidding_end_date: null,
  allotment_date: null,
  listing_date: null,
  ipo_status: "upcoming",
  data_source: "IPO_GURU",
  source_reference: null,
  last_synced_at: "2026-11-01T12:00:00.000Z",
  archived_at: null,
};
const categoryRow = {
  id: categoryId,
  ipo_id: ipoId,
  category: "RETAIL",
  rule_version: 2,
  lot_limit_status: "CONFIGURED",
  default_lots: 1,
  minimum_lots: 1,
  maximum_lots: 2,
  lot_increment: 1,
  investment_limit_status: "CONFIGURED",
  minimum_investment: null,
  maximum_investment: "1000.00",
  reserved_shares: null,
  reserved_percentage: null,
  shareholder_record_date: null,
  minimum_shareholding: null,
  eligibility_conditions: [],
  allowed_price_types: ["BID"],
  minimum_price_increment: "0.05",
};

afterEach(() => vi.unstubAllGlobals());

function installSupabaseMock(
  handleRest: (request: Request) => Response | Promise<Response> = () =>
    new Response(JSON.stringify(ipoRow), { headers: { "Content-Type": "application/json" } }),
  authenticatedUser = user,
) {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (new URL(request.url).pathname.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify(authenticatedUser), {
          headers: { "Content-Type": "application/json" },
        });
      }
      requests.push(request.clone());
      return handleRest(request);
    }),
  );
  return requests;
}

function authHeaders() {
  return { Authorization: "Bearer user-session-token" };
}

describe("IPO management API", () => {
  it("lets a regular user read the shared catalog with their own JWT and filters", async () => {
    const requests = installSupabaseMock(
      () =>
        new Response(JSON.stringify([catalogRow]), {
          headers: { "Content-Type": "application/json", "Content-Range": "25-25/26" },
        }),
    );
    const response = await createApp().request(
      "/api/ipos/catalog?page=2&page_size=25&search=Catalog&status=UPCOMING",
      { headers: authHeaders() },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        ipos: [
          {
            company_name: catalogRow.company_name,
            status: "UPCOMING",
            issue_price_min: "10",
            issue_price_max: "20",
            issue_size: null,
            opening_date: null,
            source_reference: catalogRow.provider_id,
          },
        ],
        pagination: { page: 2, page_size: 25, total: 26, total_pages: 2 },
      },
    });
    const request = requests[0]!;
    const url = new URL(request.url);
    expect(url.pathname).toBe("/rest/v1/ipo_catalog");
    expect(url.searchParams.get("user_id")).toBeNull();
    expect(url.searchParams.get("archived_at")).toBe("is.null");
    expect(url.searchParams.get("ipo_status")).toBe("eq.upcoming");
    expect(url.searchParams.get("or")).toBe(
      '(company_name.ilike."%Catalog%",symbol.ilike."Catalog")',
    );
    expect(url.searchParams.get("offset")).toBe("25");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(request.headers.get("authorization")).toBe("Bearer user-session-token");
    expect(request.headers.get("apikey")).toBe(bindings.SUPABASE_ANON_KEY);
  });

  it("filters the shared IPO catalog by multiple statuses", async () => {
    const requests = installSupabaseMock(
      () => new Response("[]", { headers: { "Content-Type": "application/json" } }),
    );
    const response = await createApp().request(
      "/api/ipos/catalog?status=UPCOMING&status=CLOSED",
      { headers: authHeaders() },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(new URL(requests[0]!.url).searchParams.get("ipo_status")).toBe("in.(upcoming,closed)");
  });

  it("returns paginated personal IPOs and shared catalog metadata from the list endpoint", async () => {
    const requests = installSupabaseMock((request) =>
      new URL(request.url).pathname.endsWith("/ipo_catalog")
        ? new Response(JSON.stringify([catalogRow]), {
            headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
          })
        : new Response(JSON.stringify([ipoRow]), {
            headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
          }),
    );

    const response = await createApp().request(
      "/api/ipos?page=1&page_size=25",
      {
        headers: authHeaders(),
      },
      bindings,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        ipos: [{ id: ipoId, company_name: ipoInput.company_name }],
        catalog: [{ id: catalogRow.id, company_name: catalogRow.company_name, status: "UPCOMING" }],
        pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
        catalog_pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
      },
    });
    expect(requests).toHaveLength(2);
    const personalRequest = requests.find((request) =>
      new URL(request.url).pathname.endsWith("/ipos"),
    )!;
    const catalogRequest = requests.find((request) =>
      new URL(request.url).pathname.endsWith("/ipo_catalog"),
    )!;
    expect(new URL(personalRequest.url).pathname).toBe("/rest/v1/ipos");
    expect(new URL(personalRequest.url).searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(new URL(catalogRequest.url).searchParams.get("user_id")).toBeNull();
    expect(new URL(catalogRequest.url).searchParams.get("archived_at")).toBe("is.null");
    expect(personalRequest.headers.get("authorization")).toBe(authHeaders().Authorization);
    expect(catalogRequest.headers.get("authorization")).toBe(authHeaders().Authorization);
  });

  it("quotes catalog search punctuation and escapes literal wildcards", async () => {
    const requests = installSupabaseMock(
      () => new Response("[]", { headers: { "Content-Type": "application/json" } }),
    );
    const search = 'Test_%,"(Company)';
    const response = await createApp().request(
      `/api/ipos/catalog?search=${encodeURIComponent(search)}`,
      { headers: authHeaders() },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(new URL(requests[0]!.url).searchParams.get("or")).toBe(
      '(company_name.ilike."%Test\\\\_\\\\%,\\"(Company)%",symbol.ilike."Test\\\\_\\\\%,\\"(Company)")',
    );
  });

  it("returns shared IPO category rules to signed-in users", async () => {
    const sharedRule = {
      ...categoryRow,
      ipo_catalog_id: ipoId,
      source_reference: "https://issuer.example/rules",
      rule_source: "PUBLISHED_SOURCE",
      last_verified_at: "2026-11-02T12:00:00.000Z",
    };
    const requests = installSupabaseMock(
      () =>
        new Response(JSON.stringify([sharedRule]), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const response = await createApp().request(
      `/api/ipos/catalog/${ipoId}/categories`,
      { headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { configurations: [{ id: categoryId, category: "RETAIL", rule_version: 2 }] },
    });
    const request = requests[0]!;
    expect(new URL(request.url).pathname).toBe("/rest/v1/ipo_catalog_categories");
    expect(new URL(request.url).searchParams.get("ipo_catalog_id")).toBe(`eq.${ipoId}`);
    expect(new URL(request.url).searchParams.get("user_id")).toBeNull();
    expect(request.headers.get("authorization")).toBe(authHeaders().Authorization);
  });

  it("allows only verified admins to create shared category rules", async () => {
    let insertedRule: Record<string, unknown> | undefined;
    const adminUser = { ...user, email: "admin@gmail.com" };
    const requests = installSupabaseMock(async (request) => {
      const url = new URL(request.url);
      const table = url.pathname.split("/").pop();
      if (table === "profiles")
        return new Response(JSON.stringify({ role: "ADMIN" }), {
          headers: { "Content-Type": "application/json" },
        });
      if (table === "ipo_catalog")
        return new Response(JSON.stringify({ id: ipoId }), {
          headers: { "Content-Type": "application/json" },
        });
      if (table === "ipo_catalog_categories" && request.method === "POST") {
        insertedRule = (await request.json()) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...insertedRule, id: categoryId, rule_version: 1 }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    }, adminUser);
    const configuration = {
      category: "RETAIL",
      lot_limit_status: "UNCONFIGURED",
      default_lots: 1,
      minimum_lots: null,
      maximum_lots: null,
      lot_increment: 1,
      investment_limit_status: "UNCONFIGURED",
      minimum_investment: null,
      maximum_investment: null,
      reserved_shares: null,
      reserved_percentage: null,
      shareholder_record_date: null,
      minimum_shareholding: null,
      eligibility_conditions: [],
      allowed_price_types: ["BID"],
      minimum_price_increment: null,
      source_reference: "https://issuer.example/rules",
      rule_source: "PUBLISHED_SOURCE",
      last_verified_at: "2026-11-02T12:00:00.000Z",
    };
    const response = await createApp().request(
      `/api/admin/ipos/catalog/${ipoId}/categories`,
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(configuration),
      },
      bindings,
    );

    expect(response.status).toBe(201);
    expect(insertedRule).toMatchObject({
      ipo_catalog_id: ipoId,
      category: "RETAIL",
      source_reference: "https://issuer.example/rules",
    });
    expect(insertedRule).not.toHaveProperty("rule_version");
    expect(
      requests.some(
        (request) =>
          new URL(request.url).pathname === "/rest/v1/ipo_catalog_categories" &&
          request.headers.get("authorization") === authHeaders().Authorization,
      ),
    ).toBe(true);

    const nonAdminRequests = installSupabaseMock();
    const denied = await createApp().request(
      `/api/admin/ipos/catalog/${ipoId}/categories`,
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(configuration),
      },
      bindings,
    );
    expect(denied.status).toBe(403);
    expect(nonAdminRequests).toHaveLength(0);
  });

  it("copies shared IPO data and latest category rules into the user's IPO record", async () => {
    const completeCatalogRow = {
      ...catalogRow,
      symbol: null,
      exchange: "NSE",
      issue_size: 100000,
      bidding_start_date: "2026-11-01",
      bidding_end_date: "2026-11-03",
      last_synced_at: "2026-11-02T12:00:00.000Z",
    };
    const sharedRule = {
      ...categoryRow,
      ipo_catalog_id: ipoId,
      source_reference: "https://issuer.example/rules",
      rule_source: "PUBLISHED_SOURCE",
      last_verified_at: "2026-11-02T12:00:00.000Z",
    };
    let insertedIpo: Record<string, unknown> | undefined;
    let insertedCategories: Array<Record<string, unknown>> = [];
    const requests = installSupabaseMock(async (request) => {
      const url = new URL(request.url);
      const table = url.pathname.split("/").pop();
      if (table === "ipos" && request.method === "GET") {
        if (url.searchParams.has("source_catalog_id")) return new Response("null");
        return new Response(JSON.stringify(ipoRow), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (table === "ipo_catalog") {
        return new Response(JSON.stringify(completeCatalogRow), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (table === "ipos" && request.method === "POST") {
        insertedIpo = (await request.json()) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...ipoRow,
            ...insertedIpo,
            id: "99999999-9999-4999-8999-999999999999",
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (table === "ipo_catalog_categories") {
        return new Response(JSON.stringify([sharedRule]), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (table === "ipo_categories" && request.method === "GET") return new Response("[]");
      if (table === "ipo_categories" && request.method === "POST") {
        const body = await request.json();
        insertedCategories = Array.isArray(body) ? body : [body];
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });

    const response = await createApp().request(
      `/api/ipos/catalog/${ipoId}/import`,
      { method: "POST", headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    expect(insertedIpo).toMatchObject({
      user_id: userId,
      source_catalog_id: ipoId,
      symbol: null,
      data_source: "PUBLISHED_SOURCE",
    });
    expect(insertedCategories).toHaveLength(1);
    expect(insertedCategories[0]).toMatchObject({
      user_id: userId,
      ipo_id: "99999999-9999-4999-8999-999999999999",
      source_catalog_rule_id: categoryId,
      category: "RETAIL",
      source_reference: "https://issuer.example/rules",
    });
    expect(
      requests.some(
        (request) =>
          new URL(request.url).pathname === "/rest/v1/ipo_categories" && request.method === "POST",
      ),
    ).toBe(true);
  });

  it("does not fabricate missing issue values when importing a shared IPO", async () => {
    const requests = installSupabaseMock(async (request) => {
      const url = new URL(request.url);
      const table = url.pathname.split("/").pop();
      if (table === "ipos") return new Response("null");
      if (table === "ipo_catalog")
        return new Response(JSON.stringify(catalogRow), {
          headers: { "Content-Type": "application/json" },
        });
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });

    const response = await createApp().request(
      `/api/ipos/catalog/${ipoId}/import`,
      { method: "POST", headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "IPO_DATA_INCOMPLETE" },
    });
    expect(requests.some((request) => request.method === "POST")).toBe(false);
  });

  it("does not reuse an archived personal copy for an application", async () => {
    const requests = installSupabaseMock(
      () =>
        new Response(
          JSON.stringify({
            ...ipoRow,
            source_catalog_id: ipoId,
            archived_at: "2026-11-02T12:00:00.000Z",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );

    const response = await createApp().request(
      `/api/ipos/catalog/${ipoId}/import`,
      { method: "POST", headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "IPO_ARCHIVED" },
    });
    expect(requests).toHaveLength(1);
  });

  it("returns a duplicate IPO conflict when the user already has an unlinked matching symbol", async () => {
    const completeCatalogRow = {
      ...catalogRow,
      symbol: "CATALOG",
      exchange: "NSE",
      issue_size: 100000,
      bidding_start_date: "2026-11-01",
      bidding_end_date: "2026-11-03",
    };
    const requests = installSupabaseMock(async (request) => {
      const url = new URL(request.url);
      const table = url.pathname.split("/").pop();
      if (table === "ipos" && request.method === "GET") return new Response("null");
      if (table === "ipo_catalog")
        return new Response(JSON.stringify(completeCatalogRow), {
          headers: { "Content-Type": "application/json" },
        });
      if (table === "ipos" && request.method === "POST")
        return new Response(JSON.stringify({ code: "23505" }), { status: 409 });
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });

    const response = await createApp().request(
      `/api/ipos/catalog/${ipoId}/import`,
      { method: "POST", headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "DUPLICATE_IPO" },
    });
    expect(requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });

  it("rejects invalid catalog filters without querying the database", async () => {
    const requests = installSupabaseMock();
    for (const query of [
      "page=0",
      "page_size=101",
      "status=WITHDRAWN",
      "include_archived=true",
      `user_id=${otherUserId}`,
    ]) {
      const response = await createApp().request(
        `/api/ipos/catalog?${query}`,
        { headers: authHeaders() },
        bindings,
      );
      expect(response.status).toBe(400);
    }
    expect(requests).toHaveLength(0);
  });

  it("reads active catalog details without accessing personal IPOs", async () => {
    const requests = installSupabaseMock(
      () =>
        new Response(JSON.stringify(catalogRow), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const response = await createApp().request(
      `/api/ipos/catalog/${ipoId}`,
      { headers: authHeaders() },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { id: ipoId, company_name: catalogRow.company_name, status: "UPCOMING" },
    });
    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe("/rest/v1/ipo_catalog");
    expect(url.searchParams.get("id")).toBe(`eq.${ipoId}`);
    expect(url.searchParams.get("archived_at")).toBe("is.null");
    expect(requests[0]!.headers.get("authorization")).toBe("Bearer user-session-token");
  });

  it("returns not found for missing or archived catalog details and validates IDs", async () => {
    const requests = installSupabaseMock(
      () => new Response("null", { headers: { "Content-Type": "application/json" } }),
    );
    for (const id of [ipoId, "invalid-id"]) {
      const response = await createApp().request(
        `/api/ipos/catalog/${id}`,
        { headers: authHeaders() },
        bindings,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "IPO_NOT_FOUND", message: "The IPO record was not found." },
      });
    }
    expect(requests).toHaveLength(1);
  });

  it("requires authentication for catalog reads and does not expose catalog writes", async () => {
    const requests = installSupabaseMock();
    for (const path of ["/api/ipos/catalog", `/api/ipos/catalog/${ipoId}`]) {
      expect((await createApp().request(path, {}, bindings)).status).toBe(401);
    }
    for (const method of ["PATCH", "DELETE", "POST"]) {
      expect(
        (
          await createApp().request(
            `/api/ipos/catalog/${ipoId}`,
            { method, headers: authHeaders() },
            bindings,
          )
        ).status,
      ).toBe(404);
    }
    expect(requests).toHaveLength(0);
  });

  it("adds an IPO to the shared catalog under the verified submitter and rejects supplied ownership", async () => {
    let inserted: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      inserted = (await request.json()) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          ...catalogRow,
          ...inserted,
          id: ipoId,
          issue_type: "mainboard",
          ipo_status: "upcoming",
          created_at: ipoRow.created_at,
          updated_at: ipoRow.updated_at,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    const response = await createApp().request(
      "/api/ipos",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(ipoInput),
      },
      bindings,
    );

    expect(response.status).toBe(201);
    expect(inserted).toMatchObject({
      submitted_by: userId,
      company_name: ipoInput.company_name,
      symbol: ipoInput.symbol,
      data_source: "USER_SUBMITTED",
      source_reference: null,
    });
    expect(inserted?.user_id).toBeUndefined();
    expect(new URL(requests[0]!.url).pathname).toBe("/rest/v1/ipo_catalog");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer user-session-token");

    const forgedRequests = installSupabaseMock();
    const forgedResponse = await createApp().request(
      "/api/ipos",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...ipoInput, user_id: otherUserId }),
      },
      bindings,
    );
    expect(forgedResponse.status).toBe(400);
    expect(forgedRequests).toHaveLength(0);
  });

  it("rejects statuses that cannot be represented in the shared catalog", async () => {
    const requests = installSupabaseMock();
    const response = await createApp().request(
      "/api/ipos",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...ipoInput, status: "WITHDRAWN" }),
      },
      bindings,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(requests).toHaveLength(0);
  });

  it("filters IPO lists by the verified owner, status, and exact symbol", async () => {
    const requests = installSupabaseMock(
      async (request) =>
        new Response(
          JSON.stringify(new URL(request.url).pathname.endsWith("/ipo_catalog") ? [] : [ipoRow]),
          {
            headers: { "Content-Type": "application/json", "Content-Range": "0-24/1" },
          },
        ),
    );
    const response = await createApp().request(
      "/api/ipos?status=UPCOMING&search=IPOTEST",
      { headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    const query = new URL(requests[0]!.url).searchParams;
    expect(query.get("user_id")).toBe(`eq.${userId}`);
    expect(query.get("status")).toBe("eq.UPCOMING");
    expect(query.get("symbol")).toBe("ilike.IPOTEST");
  });

  it("uses the requested server-side IPO sort and defaults to newest dates first", async () => {
    const requests = installSupabaseMock(
      async (request) =>
        new Response(
          JSON.stringify(new URL(request.url).pathname.endsWith("/ipo_catalog") ? [] : [ipoRow]),
          {
            headers: { "Content-Type": "application/json", "Content-Range": "0-24/1" },
          },
        ),
    );
    const sorts = [
      ["", "opening_date.desc.nullslast,company_name.asc,id.asc"],
      ["?sort=date_asc", "opening_date.asc.nullslast,company_name.asc,id.asc"],
      ["?sort=price_asc", "issue_price_min.asc.nullslast,company_name.asc,id.asc"],
      ["?sort=price_desc", "issue_price_min.desc.nullslast,company_name.asc,id.asc"],
      ["?sort=name_asc", "company_name.asc.nullslast,id.asc"],
      ["?sort=name_desc", "company_name.desc.nullslast,id.asc"],
    ] as const;
    for (const [queryString] of sorts) {
      const response = await createApp().request(
        `/api/ipos${queryString}`,
        { headers: authHeaders() },
        bindings,
      );
      expect(response.status).toBe(200);
    }
    expect(
      requests
        .filter((request) => new URL(request.url).pathname.endsWith("/ipos"))
        .map((request) => new URL(request.url).searchParams.get("order")),
    ).toEqual(sorts.map(([, order]) => order));
  });

  it("creates a category rule version without accepting a client-assigned version", async () => {
    let inserted: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      const table = new URL(request.url).pathname.split("/").pop();
      if (table === "ipos") {
        return new Response(JSON.stringify(ipoRow), {
          headers: { "Content-Type": "application/json" },
        });
      }
      inserted = (await request.json()) as Record<string, unknown>;
      return new Response(JSON.stringify({ ...categoryRow, ...inserted, rule_version: 3 }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    const configuration = {
      category: "RETAIL",
      lot_limit_status: "CONFIGURED",
      default_lots: 1,
      minimum_lots: 1,
      maximum_lots: 3,
      lot_increment: 1,
      investment_limit_status: "UNCONFIGURED",
      minimum_investment: null,
      maximum_investment: null,
      reserved_shares: null,
      reserved_percentage: null,
      shareholder_record_date: null,
      minimum_shareholding: null,
      eligibility_conditions: [{ id: "published_rule", description: "Test-only condition." }],
      allowed_price_types: ["BID"],
      minimum_price_increment: null,
      source_reference: null,
      rule_source: "MANUAL",
      last_verified_at: null,
    };
    const response = await createApp().request(
      `/api/ipos/${ipoId}/categories`,
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(configuration),
      },
      bindings,
    );

    expect(response.status).toBe(201);
    expect(inserted?.user_id).toBe(userId);
    expect(inserted?.rule_version).toBeUndefined();
    expect(inserted?.default_lots).toBe(1);
    expect(inserted?.eligibility_conditions).toEqual(configuration.eligibility_conditions);
    expect(
      requests.some(
        (request) => new URL(request.url).searchParams.get("user_id") === `eq.${userId}`,
      ),
    ).toBe(true);
  });

  it("calculates with the latest issue rules and writes an owner-scoped reproducibility snapshot", async () => {
    let calculationInsert: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      const table = new URL(request.url).pathname.split("/").pop();
      if (table === "ipos") {
        return new Response(
          JSON.stringify({
            ...ipoRow,
            ...{
              issue_price_min: "10.00",
              issue_price_max: "20.00",
              cut_off_price: "20.00",
              lot_size: 10,
              archived_at: null,
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (table === "demat_accounts") {
        return new Response(JSON.stringify({ id: accountId }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (table === "ipo_categories") {
        return new Response(JSON.stringify(categoryRow), {
          headers: { "Content-Type": "application/json" },
        });
      }
      calculationInsert = (await request.json()) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          calculation_timestamp: "2026-10-31T12:30:00Z",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    });
    const response = await createApp().request(
      "/api/quota/calculate",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ipo_id: ipoId,
          demat_account_id: accountId,
          category: "RETAIL",
          lots: 1,
          price_type: "BID",
          price: "10.00",
          shareholder_shares: null,
          eligibility_answers: {},
        }),
      },
      bindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        eligible: true,
        total_shares: 10,
        application_amount: "100",
        rule_version: 2,
        eligibility_verified: false,
      },
    });
    expect(calculationInsert?.user_id).toBe(userId);
    expect(calculationInsert?.demat_account_id).toBe(accountId);
    expect(calculationInsert?.rule_version).toBe(2);
    expect(calculationInsert?.input_snapshot).toMatchObject({
      ipo: { issue_price_min: "10.00", lot_size: 10 },
      category_configuration: { rule_version: 2 },
      price: "10.00",
    });
    expect(
      requests.filter((request) =>
        new URL(request.url).pathname.endsWith("/ipo_quota_calculations"),
      ),
    ).toHaveLength(1);
    expect(
      requests.every(
        (request) => new URL(request.url).searchParams.get("user_id") !== `eq.${otherUserId}`,
      ),
    ).toBe(true);
  });

  it("does not save validation-only calculations or trust a foreign account", async () => {
    const requests = installSupabaseMock(async (request) => {
      const table = new URL(request.url).pathname.split("/").pop();
      if (table === "ipos") {
        return new Response(JSON.stringify({ ...ipoRow, archived_at: null }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (table === "demat_accounts")
        return new Response("null", { headers: { "Content-Type": "application/json" } });
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    });
    const response = await createApp().request(
      "/api/quota/validate",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ipo_id: ipoId,
          demat_account_id: accountId,
          category: "RETAIL",
          lots: 1,
          price_type: "BID",
          price: "10.00",
          shareholder_shares: null,
          eligibility_answers: {},
        }),
      },
      bindings,
    );

    expect(response.status).toBe(404);
    expect(
      requests.some((request) => new URL(request.url).pathname.endsWith("/ipo_quota_calculations")),
    ).toBe(false);
    const accountRequest = requests.find((request) =>
      new URL(request.url).pathname.endsWith("/demat_accounts"),
    );
    expect(new URL(accountRequest!.url).searchParams.get("user_id")).toBe(`eq.${userId}`);
  });
});
