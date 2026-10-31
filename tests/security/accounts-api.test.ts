import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "account-owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const bindings = {
  RUNTIME_ENV: "test",
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_ANON_KEY: "public-anon-key-for-tests",
} as const;
const account = {
  holder_name: "Account Owner",
  broker_name: "Example Broker",
  broker_code: null,
  depository_type: "NSDL",
  masked_demat_identifier: "XXXX1234",
  masked_client_reference: null,
  account_status: "active",
  notes: null,
};

afterEach(() => vi.unstubAllGlobals());

function installSupabaseMock(
  handleRest: (request: Request) => Response | Promise<Response> = () =>
    new Response(
      JSON.stringify({ ...account, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: userId }),
    ),
) {
  const restRequests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (new URL(request.url).pathname.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify(user), {
          headers: { "Content-Type": "application/json" },
        });
      }
      restRequests.push(request.clone());
      return handleRest(request);
    }),
  );
  return restRequests;
}

function bearerHeaders() {
  return { Authorization: "Bearer test-caller-token" };
}

describe("demat account API", () => {
  it("creates an account using the verified caller ID, never a body-supplied owner", async () => {
    let inserted: Record<string, unknown> | undefined;
    const requests = installSupabaseMock(async (request) => {
      if (request.method === "POST") inserted = (await request.json()) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          ...account,
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          user_id: userId,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    });

    const response = await createApp().request(
      "/api/accounts",
      {
        method: "POST",
        headers: { ...bearerHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(account),
      },
      bindings,
    );

    expect(response.status).toBe(201);
    expect(inserted?.user_id).toBe(userId);
    expect(new URL(requests[0].url).searchParams.get("select")).toContain("user_id");
  });

  it.each([
    ["forged owner", { ...account, user_id: otherUserId }],
    ["unsupported depository", { ...account, depository_type: "OTHER" }],
    ["blank broker", { ...account, broker_name: "  " }],
  ])("rejects %s before touching account storage", async (_case, payload) => {
    const requests = installSupabaseMock();
    const response = await createApp().request(
      "/api/accounts",
      {
        method: "POST",
        headers: { ...bearerHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      bindings,
    );

    expect(response.status).toBe(400);
    expect(requests).toHaveLength(0);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("scopes account detail reads to the authenticated user", async () => {
    const requests = installSupabaseMock(
      async () =>
        new Response("[]", {
          headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
        }),
    );
    const response = await createApp().request(
      "/api/accounts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      { headers: bearerHeaders() },
      bindings,
    );

    expect(response.status).toBe(404);
    const query = new URL(requests[0].url).searchParams;
    expect(query.get("user_id")).toBe(`eq.${userId}`);
    expect(query.get("id")).toBe("eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(query.get("user_id")).not.toContain(otherUserId);
  });

  it("applies server-side search and pagination filters", async () => {
    const requests = installSupabaseMock(async (request) => {
      if (request.method === "HEAD") {
        return new Response(null, {
          headers: { "Content-Range": "*/520" },
        });
      }
      return new Response("[]", {
        headers: { "Content-Type": "application/json", "Content-Range": "50-99/520" },
      });
    });
    const response = await createApp().request(
      "/api/accounts?page=2&pageSize=50&holder_name=Ananya&broker=Example&depository=NSDL&status=active",
      { headers: bearerHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    const listRequest = requests.find((request) => request.method === "GET");
    expect(listRequest).toBeDefined();
    const query = new URL(listRequest!.url).searchParams;
    expect(query.get("holder_name")).toBe("ilike.Ananya%");
    expect(query.get("broker_name")).toBe("ilike.Example%");
    expect(query.get("depository_type")).toBe("eq.NSDL");
    expect(query.get("account_status")).toBe("eq.active");
    expect(query.get("offset")).toBe("50");
    expect(query.get("limit")).toBe("50");
    await expect(response.json()).resolves.toMatchObject({
      data: { pagination: { page: 2, pageSize: 50, total: 520, totalPages: 11 } },
    });
  });
});
