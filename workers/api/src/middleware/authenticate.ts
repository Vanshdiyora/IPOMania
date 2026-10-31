import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import { validateEnvironment, type EnvironmentBindings } from "../env";
import { createRlsSupabaseClient } from "../db/supabase";

type Variables = {
  authenticatedUser: User;
  rlsSupabase: SupabaseClient;
};

export const authenticate = createMiddleware<{
  Bindings: EnvironmentBindings;
  Variables: Variables;
}>(async (context, next) => {
  const authorization = context.req.header("Authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return context.json(
      { error: { code: "UNAUTHORIZED", message: "A valid bearer token is required." } },
      401,
    );
  }

  const environment = validateEnvironment(context.env ?? {});
  if (!environment.SUPABASE_URL || !environment.SUPABASE_ANON_KEY) {
    return context.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Authentication is not configured." } },
      503,
    );
  }

  const supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(match[1]);

  if (error) {
    if (error.status === 401 || error.status === 403) {
      return context.json(
        { error: { code: "UNAUTHORIZED", message: "The bearer token is invalid or expired." } },
        401,
      );
    }

    console.error("Supabase token verification failed", { name: error.name });
    return context.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Authentication could not be verified." } },
      503,
    );
  }

  if (!data.user) {
    return context.json(
      { error: { code: "UNAUTHORIZED", message: "The bearer token is invalid or expired." } },
      401,
    );
  }

  context.set("authenticatedUser", data.user);
  context.set("rlsSupabase", createRlsSupabaseClient(context.req.raw, environment));
  await next();
});
