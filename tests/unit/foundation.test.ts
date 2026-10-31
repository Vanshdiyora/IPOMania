import { describe, expect, it } from "vitest";
import { createApp } from "../../workers/api/src/app";

describe("API foundation", () => {
  it("reports health and the non-secret runtime environment", async () => {
    const response = await createApp().request("/api/health", undefined, {
      RUNTIME_ENV: "test",
      SUPABASE_ANON_KEY: "not-returned",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: "ok", version: "1.0.0", environment: "test" },
    });
  });

  it("returns a structured not-found response", async () => {
    const response = await createApp().request("/missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "The requested resource was not found." },
    });
  });
});
