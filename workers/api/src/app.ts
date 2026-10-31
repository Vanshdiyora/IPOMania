import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiErrorResponse, ApiSuccessResponse, HealthStatus } from "@ipo-mania/shared";
import { validateEnvironment, type EnvironmentBindings } from "./env";
import { meRoutes } from "./routes/me";
import { accountRoutes } from "./routes/account";
import { accountsRoutes } from "./routes/accounts";
import { iposRoutes } from "./routes/ipos";
import { quotaRoutes } from "./routes/quota";

const apiVersion = "1.0.0";

export function createApp() {
  const app = new Hono<{ Bindings: EnvironmentBindings }>();

  app.use(
    "/api/*",
    cors({
      origin: (origin, context) => {
        const configuredOrigin = context.env?.WEB_APP_ORIGIN;
        const allowedOrigins = new Set([
          ...(context.env?.RUNTIME_ENV === "production"
            ? []
            : ["http://127.0.0.1:4175", "http://localhost:4175"]),
          ...(configuredOrigin ? [configuredOrigin] : []),
        ]);
        return origin && allowedOrigins.has(origin) ? origin : undefined;
      },
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 600,
    }),
  );

  app.route("/api/me", meRoutes);
  app.route("/api/auth/account", accountRoutes);
  app.route("/api/accounts", accountsRoutes);
  app.route("/api/ipos", iposRoutes);
  app.route("/api/quota", quotaRoutes);

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
      name: error.name,
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
