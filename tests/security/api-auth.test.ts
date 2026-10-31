import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const validUser = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "user-a@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const bindings = {
  RUNTIME_ENV: "test",
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_ANON_KEY: "public-anon-key-for-tests",
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("protected API authentication", () => {
  it.each([
    "/api/me/profile",
    "/api/me/preferences",
    "/api/accounts",
    "/api/ipos",
    "/api/applications",
    "/api/capital/summary",
  ])("rejects an unauthenticated request to %s", async (path) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await createApp().request(path, undefined, bindings);

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing bearer token without contacting Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await createApp().request("/api/me/profile", undefined, bindings);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "A valid bearer token is required." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid", "invalid signature"],
    ["expired", "expired"],
  ])("rejects an %s token when Supabase Auth rejects it", async (_case, reason) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: "bad_jwt", msg: reason }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const response = await createApp().request(
      "/api/me/profile",
      { headers: { Authorization: "Bearer not-a-real-token" } },
      bindings,
    );

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({
      error: { code: "UNAUTHORIZED", message: "The bearer token is invalid or expired." },
    });
    expect(body).not.toContain("not-a-real-token");
  });

  it("reports an authentication provider outage as service unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ msg: "temporarily unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const response = await createApp().request(
      "/api/me/profile",
      { headers: { Authorization: "Bearer verification-test-token" } },
      bindings,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Authentication could not be verified.",
      },
    });
  });

  it("uses the verified Supabase identity and ignores a forged user_id query", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requestedUrls.push(url);
        if (url.includes("/auth/v1/user")) {
          return new Response(JSON.stringify(validUser), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            id: userId,
            full_name: "User A",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const response = await createApp().request(
      `/api/me/profile?user_id=${otherUserId}`,
      { headers: { Authorization: "Bearer verified-test-token" } },
      bindings,
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ data: { id: userId } });
    expect(requestedUrls.some((url) => url.includes(`id=eq.${userId}`))).toBe(true);
    expect(requestedUrls.some((url) => url.includes(otherUserId))).toBe(false);
    expect(body).not.toContain("service_role");
    expect(body).not.toContain("secret");
  });

  it("rejects a forged user_id in profile updates before database access", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requestedUrls.push(url);
        return new Response(JSON.stringify(validUser), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const response = await createApp().request(
      "/api/me/profile",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer verified-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ full_name: "Changed", user_id: otherUserId }),
      },
      bindings,
    );

    expect(response.status).toBe(400);
    expect(requestedUrls.every((url) => url.includes("/auth/v1/user"))).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
