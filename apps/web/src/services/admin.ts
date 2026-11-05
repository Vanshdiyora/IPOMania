import { getSupabaseClient } from "../lib/supabase";

export async function getAdminRole(userId: string, signal?: AbortSignal): Promise<boolean> {
  const request = getSupabaseClient().from("profiles").select("role").eq("id", userId);
  const { data, error } = await (signal ? request.abortSignal(signal) : request).maybeSingle();
  if (error) throw error;
  return data?.role === "ADMIN";
}
