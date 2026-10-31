import { Hono } from "hono";
import { preferencesUpdateSchema, profileUpdateSchema } from "@ipo-mania/validation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";
import { validateJson } from "../middleware/validate-json";

export const meRoutes = new Hono<{
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
}>();

meRoutes.use("*", authenticate);

meRoutes.get("/profile", async (context) => {
  const supabase = context.get("rlsSupabase");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, updated_at")
    .eq("id", context.get("authenticatedUser").id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return context.json({ data });
});

meRoutes.patch("/profile", validateJson(profileUpdateSchema), async (context) => {
  const user = context.get("authenticatedUser");
  const { full_name } = context.req.valid("json");
  const supabase = context.get("rlsSupabase");
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name })
    .eq("id", user.id)
    .select("id, full_name, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return context.json({ data });
});

meRoutes.get("/preferences", async (context) => {
  const supabase = context.get("rlsSupabase");
  const { data, error } = await supabase
    .from("user_preferences")
    .select("user_id, email_notifications, timezone, created_at, updated_at")
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return context.json({ data });
});

meRoutes.patch("/preferences", validateJson(preferencesUpdateSchema), async (context) => {
  const user = context.get("authenticatedUser");
  const preferences = context.req.valid("json");
  const supabase = context.get("rlsSupabase");
  const { data, error } = await supabase
    .from("user_preferences")
    .update(preferences)
    .eq("user_id", user.id)
    .select("user_id, email_notifications, timezone, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return context.json({ data });
});
