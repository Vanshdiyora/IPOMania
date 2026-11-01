import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage, FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { Input, FormField } from "../components/ui/Input";
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
      subtitle="Enter your email and we'll send reset instructions"
      footer={
        <Link className="font-semibold text-action hover:underline" to="/login">
          Return to sign in
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
          >
            {errorMessage}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="rounded-lg border border-success-border bg-success-bg p-3 text-sm text-success"
          >
            {message}
          </div>
        )}

        <FormField label="Email address" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset instructions"}
        </Button>
      </form>
    </AuthPage>
  );
}
