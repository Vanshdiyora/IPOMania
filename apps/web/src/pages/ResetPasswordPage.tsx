import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { resetPasswordSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage, FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { getSupabaseClient } from "../lib/supabase";

type ResetValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!code) {
      setErrorMessage("This password reset link is invalid or has expired. Request a new one.");
      return;
    }
    try {
      void getSupabaseClient()
        .auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) throw error;
          setReady(true);
        })
        .catch(() =>
          setErrorMessage("This password reset link is invalid or has expired. Request a new one."),
        );
    } catch {
      setErrorMessage("Password reset is not configured. Please contact support.");
    }
  }, []);

  async function submit(values: ResetValues) {
    setErrorMessage("");
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password: values.password });
      if (error) throw error;
      setSuccess(true);
    } catch {
      setErrorMessage("We could not update your password. Request a new reset link and try again.");
    }
  }

  return (
    <AuthPage title="Choose a new password">
      {errorMessage ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
      {success ? (
        <div role="status" className="space-y-4">
          <p className="text-sm text-success">Your password has been updated.</p>
          <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
            Return to sign in
          </Button>
        </div>
      ) : ready ? (
        <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <label className="block text-sm font-semibold text-ink" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="min-h-touch w-full rounded-lg border border-border px-3"
            {...register("password")}
          />
          <FieldError id="password-error" message={errors.password?.message} />
          <label className="block text-sm font-semibold text-ink" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            className="min-h-touch w-full rounded-lg border border-border px-3"
            {...register("confirmPassword")}
          />
          <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      ) : !errorMessage ? (
        <p role="status" className="text-sm text-muted">
          Verifying your reset link…
        </p>
      ) : null}
      <p className="mt-5 text-sm">
        <Link className="font-semibold text-action underline" to="/forgot-password">
          Request another reset link
        </Link>
      </p>
    </AuthPage>
  );
}
