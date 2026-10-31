import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "../../apps/web/src/worker";

describe("frontend Worker routing", () => {
  it("forwards API requests to the API Worker", async () => {
    const request = new Request("https://ipo-mania-web.example.workers.dev/api/health");
    const apiFetch = vi.fn(async () => new Response("api"));
    const assetsFetch = vi.fn(async () => new Response("asset"));

    const response = await handleRequest(request, {
      API: { fetch: apiFetch },
      ASSETS: { fetch: assetsFetch },
    });

    expect(await response.text()).toBe("api");
    expect(apiFetch).toHaveBeenCalledWith(request);
    expect(assetsFetch).not.toHaveBeenCalled();
  });

  it("serves non-API requests from static assets", async () => {
    const request = new Request("https://ipo-mania-web.example.workers.dev/accounts");
    const apiFetch = vi.fn(async () => new Response("api"));
    const assetsFetch = vi.fn(async () => new Response("asset"));

    const response = await handleRequest(request, {
      API: { fetch: apiFetch },
      ASSETS: { fetch: assetsFetch },
    });

    expect(await response.text()).toBe("asset");
    expect(assetsFetch).toHaveBeenCalledWith(request);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
