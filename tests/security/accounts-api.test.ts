import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";
import { encryptAccountPassword } from "../../workers/api/src/lib/account-credentials";
import { createSupabaseFetchMock } from "../helpers/supabase";

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
  ACCOUNT_CREDENTIAL_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
} as const;
const account = {
  holder_name: "Account Owner",
  bank_name: "Example Bank",
  username: "account-owner",
  account_status: "active",
  notes: null,
};
const accountInput = { ...account, password: "example-sensitive-password" };

afterEach(() => vi.unstubAllGlobals());

function installSupabaseMock(
  handleRest: (request: Request) => Response | Promise<Response> = () =>
    new Response(
      JSON.stringify({ ...account, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: userId }),
    ),
) {
  return createSupabaseFetchMock(user, handleRest).restRequests;
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
          holder_name: account.holder_name,
          bank_name: account.bank_name,
          username: account.username,
          password_encrypted: inserted?.password_encrypted,
          account_status: account.account_status,
          notes: account.notes,
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
        body: JSON.stringify(accountInput),
      },
      bindings,
    );

    expect(response.status).toBe(201);
    expect(inserted?.user_id).toBe(userId);
    expect(inserted?.password).toBeUndefined();
    const encryptedPassword = String(inserted?.password_encrypted);
    expect(encryptedPassword).toMatch(/^v1\./);
    const responseBody = await response.text();
    expect(responseBody).not.toContain(accountInput.password);
    expect(responseBody).not.toContain(encryptedPassword);
    expect(responseBody).toContain('"password_saved":true');
    expect(new URL(requests[0].url).searchParams.get("select")).toContain("user_id");
  });

  it.each([
    ["forged owner", { ...accountInput, user_id: otherUserId }],
    ["removed demat fields", { ...accountInput, depository_type: "NSDL" }],
    ["removed broker field", { ...accountInput, broker_name: "Example Broker" }],
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

  it("reveals a password only through the authenticated owner-scoped endpoint", async () => {
    const secret = "bank-login-password";
    const encrypted = await encryptAccountPassword(
      secret,
      bindings.ACCOUNT_CREDENTIAL_ENCRYPTION_KEY,
      userId,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(encrypted).not.toBeNull();
    const requests = installSupabaseMock(
      async () =>
        new Response(JSON.stringify({ password_encrypted: encrypted }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const response = await createApp().request(
      "/api/accounts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/password",
      { headers: bearerHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: { password: secret } });
    expect(new URL(requests[0].url).searchParams.get("user_id")).toBe(`eq.${userId}`);
  });

  it("refuses password writes when the encryption key is unavailable", async () => {
    const requests = installSupabaseMock();
    const response = await createApp().request(
      "/api/accounts",
      {
        method: "POST",
        headers: { ...bearerHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(accountInput),
      },
      { ...bindings, ACCOUNT_CREDENTIAL_ENCRYPTION_KEY: undefined },
    );

    expect(response.status).toBe(503);
    expect(requests).toHaveLength(0);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CREDENTIAL_ENCRYPTION_UNAVAILABLE" },
    });
  });

  it("reports account totals without a remaining capacity", async () => {
    installSupabaseMock(async (request) => {
      const count =
        new URL(request.url).searchParams.get("archived_at") === "not.is.null" ? 0 : 501;
      return request.method === "HEAD"
        ? new Response(null, { headers: { "Content-Range": `*/${count}` } })
        : new Response("[]", {
            headers: { "Content-Type": "application/json", "Content-Range": `*/${count}` },
          });
    });
    const response = await createApp().request(
      "/api/accounts",
      { headers: bearerHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { summary: Record<string, number> } };
    expect(body.data.summary).toEqual({ total: 501, active: 501, archived: 0 });
    expect(body.data.summary).not.toHaveProperty("remainingCapacity");
  });

  it("omits encrypted password data from account list responses", async () => {
    const ciphertext = "v1.dGVzdC1jaXBoZXJ0ZXh0";
    installSupabaseMock(async (request) =>
      request.method === "HEAD"
        ? new Response(null, { headers: { "Content-Range": "*/1" } })
        : new Response(
            JSON.stringify([
              {
                ...account,
                password_encrypted: ciphertext,
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                user_id: userId,
              },
            ]),
            {
              headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
            },
          ),
    );
    const response = await createApp().request(
      "/api/accounts",
      { headers: bearerHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain(ciphertext);
    expect(body).not.toContain('"password":');
    expect(body).toContain('"password_saved":true');
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

      it("treats SQL-like search syntax as a literal PostgREST filter value", async () => {
        const requests = installSupabaseMock(
          async () =>
            new Response("[]", {
              headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
            }),
        );
        const response = await createApp().request(
          "/api/accounts?holder_name=%25_%27%20OR%201%3D1%20--",
          { headers: bearerHeaders() },
          bindings,
        );

        expect(response.status).toBe(200);
        const listRequest = requests.find((request) => request.method === "GET");
        const query = new URL(listRequest!.url).searchParams;
        expect(query.get("holder_name")).toBe("ilike.\\%\\_' OR 1=1 --%");
        expect(query.get("or")).toBeNull();
      });
    });
    const response = await createApp().request(
      "/api/accounts?page=2&pageSize=50&holder_name=Ananya&status=active",
      { headers: bearerHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    const listRequest = requests.find((request) => request.method === "GET");
    expect(listRequest).toBeDefined();
    const query = new URL(listRequest!.url).searchParams;
    expect(query.get("holder_name")).toBe("ilike.Ananya%");
    expect(query.get("broker_name")).toBeNull();
    expect(query.get("bank_name")).toBeNull();
    expect(query.get("account_status")).toBe("eq.active");
    expect(query.get("offset")).toBe("50");
    expect(query.get("limit")).toBe("50");
    await expect(response.json()).resolves.toMatchObject({
      data: { pagination: { page: 2, pageSize: 50, total: 520, totalPages: 11 } },
    });
  });
});
