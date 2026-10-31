import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { cors } from "hono/cors";
import type { ApiErrorResponse, ApiSuccessResponse, HealthStatus } from "@ipo-mania/shared";
import { validateEnvironment, type EnvironmentBindings } from "./env";
import { meRoutes } from "./routes/me";
import { accountRoutes } from "./routes/account";
import { accountsRoutes } from "./routes/accounts";
import { iposRoutes } from "./routes/ipos";
import { quotaRoutes } from "./routes/quota";
import { capitalRoutes } from "./routes/capital";
import { analyticsRoutes } from "./routes/analytics";
import { applicationImportRoutes, applicationsRoutes } from "./routes/applications";
import { adminIpoRoutes } from "./routes/admin-ipos";

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
      exposeHeaders: ["Content-Disposition"],
      maxAge: 600,
    }),
  );

  app.route("/api/me", meRoutes);
  app.route("/api/auth/account", accountRoutes);
  app.route("/api/accounts", accountsRoutes);
  app.route("/api/ipos", iposRoutes);
  app.route("/api/quota", quotaRoutes);
  app.route("/api", capitalRoutes);
  app.route("/api/analytics", analyticsRoutes);
  app.route("/api/applications", applicationsRoutes);
  app.route("/api/imports", applicationImportRoutes);
  app.route("/api/admin/ipos", adminIpoRoutes());

  app.get("/api/public/ipos", async (context) => {
    const environment = validateEnvironment(context.env ?? {});
    if (!environment.SUPABASE_URL || !environment.SUPABASE_ANON_KEY) {
      return context.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Public IPO data is not configured." } },
        503,
      );
    }
    const supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_ANON_KEY);
    const status = context.req.query("status")?.toLowerCase();
    let request = supabase
      .from("ipo_catalog")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (["upcoming", "open", "closed", "listed"].includes(status ?? ""))
      request = request.eq("ipo_status", status);
    const { data, error } = await request;
    if (error)
      return context.json(
        { error: { code: "DATABASE_ERROR", message: "IPO data could not be loaded." } },
        500,
      );
    return context.json({ data: data ?? [] }, 200, {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
    });
  });

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
