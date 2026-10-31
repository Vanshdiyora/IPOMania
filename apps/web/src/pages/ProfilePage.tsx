import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { profileUpdateSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { useAuth } from "../auth/useAuth";
import { FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
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
      setStatus("Profile updated.");
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Your profile</h1>
        <p className="mt-2 text-muted">Manage the personal details associated with your account.</p>
      </header>
      <Card>
        <h2 className="text-xl font-bold text-ink">Account details</h2>
        <p className="mt-3 text-sm text-muted">Email</p>
        <p className="font-medium text-ink">{user?.email}</p>
        {profile ? (
          <p className="mt-2 text-xs text-muted">
            Member since {new Date(profile.created_at).toLocaleDateString()}
          </p>
        ) : null}
        <form className="mt-5 space-y-3" onSubmit={handleSubmit(save)} noValidate>
          <label className="block text-sm font-semibold text-ink" htmlFor="full_name">
            Full name
          </label>
          <input
            id="full_name"
            autoComplete="name"
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? "full-name-error" : undefined}
            className="min-h-touch w-full rounded-lg border border-border px-3"
            {...register("full_name")}
          />
          <FieldError id="full-name-error" message={errors.full_name?.message} />
          {status ? (
            <p role="status" className="text-sm text-success">
              {status}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
      <Card>
        <h2 className="text-xl font-bold text-danger">Delete account</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Deleting your account permanently removes your authentication account, profile, and
          preferences.
        </p>
        <label className="mt-4 flex min-h-touch items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={confirmDeletion}
            onChange={(event) => setConfirmDeletion(event.target.checked)}
          />
          I understand this action cannot be undone.
        </label>
        <Button
          type="button"
          variant="outline"
          className="mt-3 border-danger text-danger"
          disabled={!confirmDeletion || deleting}
          onClick={() => void deleteAccount()}
        >
          {deleting ? "Deleting account…" : "Delete my account"}
        </Button>
      </Card>
      {errorMessage ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
