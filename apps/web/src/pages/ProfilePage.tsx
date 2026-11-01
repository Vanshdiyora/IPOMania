import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { profileUpdateSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AlertTriangle, CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { FormField, Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { ApiRequestError, apiRequest } from "../lib/api";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileUpdateSchema) });

  useEffect(() => {
    if (!session) return;
    let active = true;
    void apiRequest<ProfileResponse>("/api/me/profile", session)
      .then(({ data }) => {
        if (!active) return;
        setProfile(data);
        reset({ full_name: data?.full_name ?? "" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          markSessionExpired();
        } else {
          setErrorMessage("We could not load your profile. Please try again.");
        }
      });
    return () => {
      active = false;
    };
  }, [session, reset, markSessionExpired]);

  async function save(values: ProfileValues) {
    if (!session) return;
    setStatus("");
    setErrorMessage("");
    try {
      const { data } = await apiRequest<ProfileResponse>("/api/me/profile", session, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setProfile(data);
      setStatus("Profile updated successfully.");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        markSessionExpired();
      } else {
        setErrorMessage("We could not save your profile. Please try again.");
      }
    }
  }

  async function deleteAccount() {
    if (!session) return;
    setDeleting(true);
    setErrorMessage("");
    try {
      await apiRequest("/api/auth/account", session, { method: "DELETE" });
      await signOut("local");
    } catch {
      setErrorMessage("We could not delete your account. Please try again or contact support.");
    } finally {
      setDeleting(false);
    }
  }

  const initial = user?.email?.charAt(0).toUpperCase() ?? "U";

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-in">
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

          <form className="space-y-4" onSubmit={handleSubmit(save)} noValidate>
            <FormField label="Full Name" htmlFor="full_name" error={errors.full_name?.message}>
              <Input
                id="full_name"
                autoComplete="name"
                placeholder="e.g. Rahul Sharma"
                aria-invalid={Boolean(errors.full_name)}
                {...register("full_name")}
              />
            </FormField>

            {status && (
              <div
                className="flex items-center gap-2 rounded-xl border border-action-emerald/30 bg-action-emerald/5 p-3.5 text-sm font-medium text-action-emerald"
                role="status"
              >
                <CheckCircle2 size={16} />
                <span>{status}</span>
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="shadow-xs">
              {isSubmitting ? "Saving changes…" : "Save changes"}
            </Button>
          </form>
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

      {errorMessage && (
        <div
          className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm font-medium text-danger"
          role="alert"
        >
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
