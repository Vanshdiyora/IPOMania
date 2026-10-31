import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { registerSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage, FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { getAuthRedirectUrl } from "../lib/authRedirect";
import { getSupabaseClient } from "../lib/supabase";

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  async function submit(values: RegisterValues) {
    setErrorMessage("");
    setMessage("");
    try {
      const { error } = await getSupabaseClient().auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName },
          emailRedirectTo: getAuthRedirectUrl("/auth/confirm", window.location.origin),
        },
      });
      if (error) throw error;
      setMessage("Check your email for a verification link to finish creating your account.");
    } catch {
      setErrorMessage("We could not create your account. Check the details and try again.");
    }
  }

  return (
    <AuthPage
      title="Create your account"
      footer={
        <>
          Already registered?{" "}
          <Link className="font-semibold text-action underline" to="/login">
            Sign in
          </Link>
        </>
      }
    >
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
        <label className="block text-sm font-semibold text-ink" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          autoComplete="name"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
          className="min-h-touch w-full rounded-lg border border-border px-3"
          {...register("fullName")}
        />
        <FieldError id="fullName-error" message={errors.fullName?.message} />
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
        <label className="block text-sm font-semibold text-ink" htmlFor="password">
          Password
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
          Confirm password
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthPage>
  );
}
