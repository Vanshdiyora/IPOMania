import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage, FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { getAuthRedirectUrl } from "../lib/authRedirect";
import { getSupabaseClient } from "../lib/supabase";

type ForgotValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function submit({ email }: ForgotValues) {
    setErrorMessage("");
    setMessage("");
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("/reset-password", window.location.origin),
      });
      if (error) throw error;
      setMessage("If an account exists for that email, password reset instructions will be sent.");
    } catch {
      setErrorMessage("We could not send the reset request. Please try again.");
    }
  }

  return (
    <AuthPage
      title="Reset your password"
      footer={
        <Link className="font-semibold text-action underline" to="/login">
          Return to sign in
        </Link>
      }
    >
      <p className="mb-4 text-sm leading-6 text-muted">
        Enter your account email and we’ll send password reset instructions.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        {errorMessage ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-success">
            {message}
          </p>
        ) : null}
        <label className="block text-sm font-semibold text-ink" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="min-h-touch w-full rounded-lg border border-border px-3"
          {...register("email")}
        />
        <FieldError id="email-error" message={errors.email?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset instructions"}
        </Button>
      </form>
    </AuthPage>
  );
}
