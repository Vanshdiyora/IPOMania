import type { Session } from "@supabase/supabase-js";
import type { z } from "@ipo-mania/validation";
import type { profileUpdateSchema } from "@ipo-mania/validation";
import { apiRequest } from "../lib/api";

export type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};
export type ProfileResponse = { data: Profile | null };
export type ProfileValues = z.infer<typeof profileUpdateSchema>;

export function getProfile(session: Session, signal?: AbortSignal) {
  return apiRequest<ProfileResponse>("/api/me/profile", session, { signal });
}

export function updateProfile(session: Session, values: ProfileValues) {
  return apiRequest<ProfileResponse>("/api/me/profile", session, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export function deleteProfile(session: Session) {
  return apiRequest("/api/auth/account", session, { method: "DELETE" });
}
