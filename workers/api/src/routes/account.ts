import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import type { User } from "@supabase/supabase-js";
import { validateEnvironment, type EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";

export const accountRoutes = new Hono<{
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User };
}>();

accountRoutes.delete("/", authenticate, async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = validateEnvironment(context.env ?? {});
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return context.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Account deletion is not configured." } },
      503,
    );
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await admin.auth.admin.deleteUser(context.get("authenticatedUser").id);

  if (error) {
    throw error;
  }

  return context.json({ data: { deleted: true } });
});
