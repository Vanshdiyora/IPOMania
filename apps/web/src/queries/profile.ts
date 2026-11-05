import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { queryKeys } from "../lib/queryKeys";
import { deleteProfile, getProfile, updateProfile, type ProfileValues } from "../services/profile";

export function useProfileQuery(session: Session | null) {
  return useQuery({
    queryKey: queryKeys.profile(session?.user?.id),
    enabled: Boolean(session),
    queryFn: ({ signal }) => getProfile(session!, signal),
  });
}

export function useUpdateProfileMutation(session: Session | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: ProfileValues) => updateProfile(session!, values),
    onSuccess: (result) => client.setQueryData(queryKeys.profile(session?.user?.id), result),
  });
}

export function useDeleteProfileMutation(session: Session | null) {
  return useMutation({
    mutationFn: () => deleteProfile(session!),
  });
}
