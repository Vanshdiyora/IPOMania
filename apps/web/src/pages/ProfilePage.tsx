import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { profileUpdateSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { FormField, Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/ToastContext";
import { ApiRequestError, apiRequest } from "../lib/api";
import { SkeletonFormFields } from "../components/ui/Skeleton";
import { queryKeys } from "../lib/queryKeys";

type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};
type ProfileResponse = { data: Profile | null };
type ProfileValues = z.infer<typeof profileUpdateSchema>;

export function ProfilePage() {
  const { session, user, markSessionExpired, signOut } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileUpdateSchema) });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(user?.id),
    enabled: Boolean(session),
    queryFn: ({ signal }) => apiRequest<ProfileResponse>("/api/me/profile", session!, { signal }),
  });
  const profile = profileQuery.data?.data;
  useEffect(() => {
    if (profileQuery.error instanceof ApiRequestError && profileQuery.error.status === 401) {
      markSessionExpired();
    }
  }, [markSessionExpired, profileQuery.error]);
  useEffect(() => {
    if (profileQuery.isSuccess) reset({ full_name: profile?.full_name ?? "" });
  }, [profileQuery.isSuccess, profile, reset]);
  const saveMutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      apiRequest<ProfileResponse>("/api/me/profile", session!, {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.profile(user?.id), result);
      notify({ title: "Profile updated", tone: "success" });
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
      else notify({ title: "Profile could not be saved", description: "Please try again.", tone: "error" });
    },
  });

  async function deleteAccount() {
    if (!session) return;
    setDeleting(true);
    try {
      await apiRequest("/api/auth/account", session, { method: "DELETE" });
      notify({ title: "Account deleted", tone: "success" });
      await signOut("local");
    } catch {
      notify({
        title: "Account could not be deleted",
        description: "Please try again or contact support.",
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  const initial = user?.email?.charAt(0).toUpperCase() ?? "U";

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Account Settings"
        title="Your Profile"
        subtitle="Manage the personal credentials and preferences associated with your account."
      />

      {/* Account Info Card */}
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-action to-navy text-xl font-bold text-white shadow-sm">
              {initial}
            </div>
            <div>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Primary identity linked to your portfolio data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/70 bg-canvas/40 p-4 mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Registered Email
            </span>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">{user?.email}</p>
            {profile?.created_at && (
              <p className="mt-2 text-xs text-muted">
                Member since{" "}
                {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
                  new Date(profile.created_at),
                )}
              </p>
            )}
          </div>

          {profileQuery.isPending ? (
            <div role="status" aria-label="Loading profile" aria-busy="true">
              <span className="sr-only">Loading profile…</span>
              <SkeletonFormFields fields={1} />
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate>
              <FormField label="Full Name" htmlFor="full_name" error={errors.full_name?.message}>
                <Input
                  id="full_name"
                  autoComplete="name"
                  placeholder="e.g. Rahul Sharma"
                  aria-invalid={Boolean(errors.full_name)}
                  {...register("full_name")}
                />
              </FormField>

              <Button type="submit" loading={isSubmitting || saveMutation.isPending} className="shadow-xs">
                {isSubmitting || saveMutation.isPending ? "Saving changes…" : "Save changes"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone: Account Deletion */}
      <Card className="border-danger/30 bg-danger/5">
        <CardHeader>
          <div className="flex items-center gap-2 text-danger">
            <ShieldAlert size={20} />
            <CardTitle className="text-danger">Danger Zone: Delete Account</CardTitle>
          </div>
          <CardDescription className="text-danger/80">
            Permanently erase your identity, demat account configurations, and application logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-relaxed text-muted">
            This action cannot be undone. All active applications, historical ledger records, and
            demat credentials will be permanently removed in compliance with data privacy standards.
          </p>

          <label className="flex items-start gap-3 rounded-xl border border-danger/20 bg-surface p-3 text-xs text-ink cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border text-danger focus:ring-danger"
              checked={confirmDeletion}
              onChange={(event) => setConfirmDeletion(event.target.checked)}
            />
            <span className="font-medium">
              I understand this action is permanent and all my portfolio tracking data will be
              deleted immediately.
            </span>
          </label>

          <Button
            type="button"
            variant="danger"
            disabled={!confirmDeletion || deleting}
            onClick={() => void deleteAccount()}
            className="gap-2"
          >
            <Trash2 size={16} />
            <span>{deleting ? "Deleting account…" : "Delete my account permanently"}</span>
          </Button>
        </CardContent>
      </Card>

      {profileQuery.isError && (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm font-medium text-danger"
            role="alert"
          >
            <AlertTriangle size={16} />
            <span>We could not load your profile. Please try again.</span>
          </div>
          <Button variant="outline" onClick={() => void profileQuery.refetch()}>
            Retry profile
          </Button>
        </div>
      )}
    </div>
  );
}
