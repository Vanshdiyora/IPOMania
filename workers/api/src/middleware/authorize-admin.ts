import { createMiddleware } from "hono/factory";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type AdminVariables = {
  authenticatedUser: User;
  rlsSupabase: SupabaseClient;
};

export const authorizeAdmin = createMiddleware<{ Variables: AdminVariables }>(
  async (context, next) => {
    const rlsSupabase = context.get("rlsSupabase");
    const { data, error } = await rlsSupabase
      .from("profiles")
      .select("role")
      .eq("id", context.get("authenticatedUser").id)
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
