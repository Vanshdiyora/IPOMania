import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const applicationId = "33333333-3333-4333-8333-333333333333";
const calculationId = "44444444-4444-4444-8444-444444444444";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "capital-owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const bindings = {
  RUNTIME_ENV: "test",
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_ANON_KEY: "public-anon-key-for-tests",
} as const;

afterEach(() => vi.unstubAllGlobals());

function installSupabaseMock(
  handleRest: (request: Request) => Response | Promise<Response> = () =>
    new Response("[]", {
      headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
    }),
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
  return { Authorization: "Bearer capital-api-test-token" };
}

describe("capital-management API", () => {
  it("keeps the mandate list owner-scoped and applies IPO/account/category/date filters", async () => {
    const requests = installSupabaseMock();
    const response = await createApp().request(
      `/api/mandates?ipo_id=${applicationId}&account_id=${calculationId}&category=RETAIL&date_from=2026-10-01&broker=Demo`,
      { headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    const query = new URL(requests[0]!.url).searchParams;
    expect(query.get("user_id")).toBe(`eq.${userId}`);
    expect(query.get("application.ipo_id")).toBe(`eq.${applicationId}`);
    expect(query.get("application.demat_account_id")).toBe(`eq.${calculationId}`);
    expect(query.get("application.category")).toBe("eq.RETAIL");
    expect(query.get("application.demat_account.broker_name")).toBe("ilike.Demo%");
    expect(query.get("created_at")).toBe("gte.2026-10-01T00:00:00.000Z");
    expect(query.get("user_id")).not.toContain(otherUserId);
  });

  it("creates mandates as pending and derives ownership from the verified caller", async () => {
    let inserted: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      inserted = (await request.json()) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "55555555-5555-4555-8555-555555555555",
          user_id: userId,
          application_id: applicationId,
          mandate_reference: "MANDATE-100",
          mandate_amount: "1250.00",
          mandate_status: "PENDING",
          blocked_at: null,
          released_at: null,
          updated_at: "2026-10-31T12:00:00.000Z",
          created_at: "2026-10-31T12:00:00.000Z",
          notes: null,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    });
    const response = await createApp().request(
      "/api/mandates",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          mandate_reference: "MANDATE-100",
          mandate_amount: "1250.00",
        }),
      },
      bindings,
    );

    expect(response.status).toBe(201);
    expect(inserted?.user_id).toBe(userId);
    expect(inserted?.mandate_status).toBe("PENDING");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer capital-api-test-token");

    const forgedRequests = installSupabaseMock();
    const forgedResponse = await createApp().request(
      "/api/mandates",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          mandate_reference: "MANDATE-101",
          mandate_amount: "1250.00",
          user_id: otherUserId,
        }),
      },
      bindings,
    );
    expect(forgedResponse.status).toBe(400);
    expect(forgedRequests).toHaveLength(0);
  });

  it("returns an explicit conflict for invalid mandate transitions", async () => {
    installSupabaseMock(
      async () =>
        new Response(
          JSON.stringify({ code: "23514", message: "Invalid mandate status transition." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    const response = await createApp().request(
      `/api/mandates/${applicationId}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ mandate_status: "APPROVED" }),
      },
      bindings,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_MANDATE_TRANSITION" },
    });
  });

  it("records applications only from the caller's saved eligible calculation", async () => {
    let inserted: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      const table = new URL(request.url).pathname.split("/").pop();
      if (table === "ipo_quota_calculations") {
        return new Response(
          JSON.stringify({
            id: calculationId,
            ipo_id: "66666666-6666-4666-8666-666666666666",
            category_configuration_id: "77777777-7777-4777-8777-777777777777",
            demat_account_id: "88888888-8888-4888-8888-888888888888",
            category: "RETAIL",
            rule_version: 2,
            input_snapshot: {
              lots: 2,
              price_type: "BID",
              price: "25.50",
              ipo: {
                lot_size: 10,
                issue_price_min: 10,
                issue_price_max: 30,
                cut_off_price: null,
              },
              category_configuration: {
                id: "77777777-7777-4777-8777-777777777777",
                rule_version: 2,
              },
            },
            result_snapshot: {
              eligible: true,
              total_shares: 20,
              application_amount: "510",
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      inserted = (await request.json()) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "99999999-9999-4999-8999-999999999999",
          user_id: userId,
          ...inserted,
          created_at: "2026-10-31T12:00:00.000Z",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    });
    const response = await createApp().request(
      "/api/applications",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ calculation_id: calculationId }),
      },
      bindings,
    );

    expect(response.status).toBe(201);
    expect(inserted?.user_id).toBe(userId);
    expect(inserted?.calculation_id).toBeUndefined();
    expect(inserted?.quota_calculation_id).toBe(calculationId);
    expect(inserted?.application_amount).toBe("510");
    expect(inserted?.lot_size).toBe(10);
    expect(inserted?.issue_price_min).toBe("10");
    expect(new URL(requests[0]!.url).searchParams.get("user_id")).toBe(`eq.${userId}`);
  });

  it("writes manual ledger events with a caller-derived owner and reports duplicate events", async () => {
    let inserted: Record<string, unknown> | undefined;
    let postCount = 0;
    let existingLedger: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      if (request.method === "POST") {
        postCount += 1;
        if (postCount > 1) {
          return new Response(JSON.stringify({ code: "23505", message: "duplicate key" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }
        inserted = (await request.json()) as Record<string, unknown>;
        existingLedger = {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          ...inserted,
          blocked_consumed: "0",
          quantity: null,
          unit_price: null,
          adjustment_direction: null,
          created_at: "2026-10-31T12:00:00.000Z",
        };
        return new Response(JSON.stringify(existingLedger), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(existingLedger), {
        headers: { "Content-Type": "application/json" },
      });
    });
    const body = {
      application_id: applicationId,
      transaction_type: "CAPITAL_BLOCKED",
      amount: "1000.00",
      currency: "INR",
      effective_at: "2026-10-31T12:00:00.000Z",
      audit_reference: "BANK-REF-100",
      idempotency_key: "bank-block-100",
    };
    const response = await createApp().request(
      "/api/capital/ledger",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      bindings,
    );
    expect(response.status).toBe(201);
    expect(inserted?.user_id).toBe(userId);
    expect(inserted?.source).toBe("MANUAL");
    expect(requests[0]!.headers.get("authorization")).toBe("Bearer capital-api-test-token");

    const replayResponse = await createApp().request(
      "/api/capital/ledger",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      bindings,
    );
    expect(replayResponse.status).toBe(200);
    await expect(replayResponse.json()).resolves.toMatchObject({
      data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });

    const conflictingResponse = await createApp().request(
      "/api/capital/ledger",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, amount: "900.00" }),
      },
      bindings,
    );
    expect(conflictingResponse.status).toBe(409);
    await expect(conflictingResponse.json()).resolves.toMatchObject({
      error: { code: "DUPLICATE_FINANCIAL_EVENT" },
    });
  });
});
