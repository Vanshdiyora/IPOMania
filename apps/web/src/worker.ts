interface WorkerEnvironment {
  API: {
    fetch(request: Request): Promise<Response>;
  };
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export function handleRequest(request: Request, environment: WorkerEnvironment) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/")) {
    return environment.API.fetch(request);
  }

  return environment.ASSETS.fetch(request);
}

export default {
  fetch(request: Request, environment: WorkerEnvironment) {
    return handleRequest(request, environment);
  },
};
