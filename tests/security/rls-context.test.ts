import { afterEach, describe, expect, it, vi } from "vitest";
import { createRlsSupabaseClient } from "../../workers/api/src/db/supabase";

const userToken = "synthetic-caller-token";
const serviceRoleSentinel = "synthetic-service-role-secret";

afterEach(() => vi.unstubAllGlobals());

describe("RLS database client", () => {
  it("uses the anon key and forwards only the caller bearer token to PostgREST", async () => {
    const requests: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        requests.push(request);
        return new Response("[]", {
          headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
        });
      }),
    );

    const client = createRlsSupabaseClient(
      new Request("https://api.example.test/api/accounts", {
        headers: { Authorization: `Bearer ${userToken}` },
      }),
      {
        RUNTIME_ENV: "test",
        SUPABASE_URL: "https://project.example.test",
        SUPABASE_ANON_KEY: "synthetic-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleSentinel,
      },
    );
    await client.from("profiles").select("id");

    const postgrestRequest = requests.find((request) =>
      new URL(request.url).pathname.endsWith("/rest/v1/profiles"),
    );
    expect(postgrestRequest?.headers.get("apikey")).toBe("synthetic-anon-key");
    expect(postgrestRequest?.headers.get("authorization")).toBe(`Bearer ${userToken}`);
    expect(postgrestRequest?.headers.get("authorization")).not.toContain(serviceRoleSentinel);
    expect(postgrestRequest?.headers.get("apikey")).not.toContain(serviceRoleSentinel);
  });

  it("refuses database access without a caller token", () => {
    expect(() =>
      createRlsSupabaseClient(new Request("https://api.example.test/api/accounts"), {
        RUNTIME_ENV: "test",
        SUPABASE_URL: "https://project.example.test",
        SUPABASE_ANON_KEY: "synthetic-anon-key",
      }),
    ).toThrow("A caller bearer token is required");
  });
});
