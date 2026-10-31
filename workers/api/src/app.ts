import { Hono } from "hono";
import type { ApiErrorResponse, ApiSuccessResponse, HealthStatus } from "@ipo-mania/shared";
import { validateEnvironment, type EnvironmentBindings } from "./env";

const apiVersion = "1.0.0";

export function createApp() {
  const app = new Hono<{ Bindings: EnvironmentBindings }>();

  app.get("/api/health", (context) => {
    const environment = validateEnvironment(context.env ?? {});
    const body: ApiSuccessResponse<HealthStatus> = {
      data: {
        status: "ok",
        version: apiVersion,
        environment: environment.RUNTIME_ENV,
      },
    };

    return context.json(body, 200);
  });

  app.notFound((context) => {
    const body: ApiErrorResponse = {
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
      },
    };
    return context.json(body, 404);
  });

  app.onError((error, context) => {
    console.error("Unhandled API error", {
      message: error.message,
      method: context.req.method,
      path: context.req.path,
    });
    const body: ApiErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    };
    return context.json(body, 500);
  });

  return app;
}
