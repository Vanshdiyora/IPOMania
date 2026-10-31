import { vi } from "vitest";

export type RestRequestHandler = (request: Request) => Response | Promise<Response>;

export function createSupabaseFetchMock(
  authenticatedUser: object,
  handleRest: RestRequestHandler = () =>
    new Response("[]", {
      headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
    }),
) {
  const restRequests: Request[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (new URL(request.url).pathname.endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify(authenticatedUser), {
        headers: { "Content-Type": "application/json" },
      });
    }

    restRequests.push(request.clone());
    return handleRest(request);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, restRequests };
}
