import { createMiddleware } from "hono/factory";
import { isAdminEmail } from "@ipo-mania/shared";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type AdminVariables = {
  authenticatedUser: User;
  rlsSupabase: SupabaseClient;
};

export const authorizeAdmin = createMiddleware<{ Variables: AdminVariables }>(
  async (context, next) => {
    const authenticatedUser = context.get("authenticatedUser");
    if (!isAdminEmail(authenticatedUser.email)) {
      return context.json(
        { error: { code: "FORBIDDEN", message: "Administrator access is required." } },
        403,
      );
    }

    const rlsSupabase = context.get("rlsSupabase");
    const { data, error } = await rlsSupabase
      .from("profiles")
      .select("role")
      .eq("id", authenticatedUser.id)
      .maybeSingle();

    if (error) {
      return context.json(
        { error: { code: "FORBIDDEN", message: "Administrator access could not be verified." } },
        403,
      );
    }

    if (data?.role !== "ADMIN") {
      return context.json(
        { error: { code: "FORBIDDEN", message: "Administrator access is required." } },
        403,
      );
    }

    await next();
  },
);
