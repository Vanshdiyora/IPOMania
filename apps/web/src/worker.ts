interface WorkerEnvironment {
  API: {
    fetch(request: Request): Promise<Response>;
  };
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export async function handleRequest(request: Request, environment: WorkerEnvironment) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/")) {
    try {
      return await environment.API.fetch(request);
    } catch (error) {
      console.error("API Worker service binding request failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        method: request.method,
        path: pathname,
      });
      return Response.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "The API service is unavailable." } },
        { status: 502 },
      );
    }
  }

  return environment.ASSETS.fetch(request);
}

export default {
  fetch(request: Request, environment: WorkerEnvironment) {
    return handleRequest(request, environment);
  },
};
