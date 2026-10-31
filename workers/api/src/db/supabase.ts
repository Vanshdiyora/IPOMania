import { createClient } from "@supabase/supabase-js";
import { validateEnvironment, type EnvironmentBindings } from "../env";

export function createServiceSupabaseClient(bindings: EnvironmentBindings) {
  const environment = validateEnvironment(bindings);
  if (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for scheduled synchronization.",
    );
  }
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createRlsSupabaseClient(request: Request, bindings: EnvironmentBindings) {
  const environment = validateEnvironment(bindings);
  if (!environment.SUPABASE_URL || !environment.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be configured for database access.");
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new Error("A caller bearer token is required for RLS-protected database access.");
  }

  return createClient(environment.SUPABASE_URL, environment.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  });
}
