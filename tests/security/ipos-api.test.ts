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
const categoryRow = {
  id: categoryId,
  ipo_id: ipoId,
  category: "RETAIL",
  rule_version: 2,
  lot_limit_status: "CONFIGURED",
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
) {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (new URL(request.url).pathname.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify(user), {
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
  it("creates an IPO under the verified owner and rejects request-supplied ownership", async () => {
    let inserted: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      inserted = (await request.json()) as Record<string, unknown>;
      return new Response(JSON.stringify(ipoRow), {
        headers: { "Content-Type": "application/json" },
      });
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
    expect(inserted?.user_id).toBe(userId);
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

  it("filters IPO lists by the verified owner, status, and exact symbol", async () => {
    const requests = installSupabaseMock(
      async () =>
        new Response(JSON.stringify([ipoRow]), {
          headers: { "Content-Type": "application/json", "Content-Range": "0-24/1" },
        }),
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
