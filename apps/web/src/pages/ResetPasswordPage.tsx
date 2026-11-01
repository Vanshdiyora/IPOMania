import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { resetPasswordSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage, FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { Input, FormField } from "../components/ui/Input";
import { getSupabaseClient } from "../lib/supabase";
import { CheckCircle } from "lucide-react";

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
      const { error } = await getSupabaseClient().auth.updateUser({
        password: values.password,
      });
      if (error) throw error;
      setSuccess(true);
    } catch {
      setErrorMessage("We could not update your password. Request a new reset link and try again.");
    }
  }

  return (
    <AuthPage title="Choose a new password" subtitle="Enter your new password below">
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
        >
          {errorMessage}
        </div>
      )}

      {success ? (
        <div role="status" className="space-y-5 text-center">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
              <CheckCircle size={28} />
            </div>
          </div>
          <div>
            <p className="font-semibold text-ink">Password updated</p>
            <p className="mt-1 text-sm text-muted">Your password has been changed successfully.</p>
          </div>
          <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
            Continue to sign in
          </Button>
        </div>
      ) : ready ? (
        <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
          <FormField label="New password" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            <FieldError id="password-error" message={errors.password?.message} />
          </FormField>

          <FormField
            label="Confirm new password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your new password"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              {...register("confirmPassword")}
            />
            <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
          </FormField>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      ) : !errorMessage ? (
        <p role="status" className="text-sm text-muted">
          Verifying your reset link…
        </p>
      ) : null}

      <p className="mt-5 text-center text-sm">
        <Link className="font-semibold text-action hover:underline" to="/forgot-password">
          Request another reset link
        </Link>
      </p>
    </AuthPage>
  );
}
