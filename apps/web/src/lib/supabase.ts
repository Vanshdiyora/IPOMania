import { createClient } from "@supabase/supabase-js";
import { createThirtyDayAuthStorage } from "./authStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authStorage =
  typeof window === "undefined" ? undefined : createThirtyDayAuthStorage(window.localStorage);

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storage: authStorage,
        },
      })
    : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Authentication is not configured. Set the public Supabase URL and anon key.");
  }
  return supabase;
}
