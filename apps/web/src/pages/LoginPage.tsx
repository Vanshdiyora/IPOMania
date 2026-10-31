import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage, FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { getSupabaseClient } from "../lib/supabase";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? "/profile";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function submit(values: LoginValues) {
    setErrorMessage("");
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword(values);
      if (error) throw error;
      navigate(destination, { replace: true });
    } catch {
      setErrorMessage("Email or password is incorrect. Check your details and try again.");
    }
  }

  return (
    <AuthPage
      title="Sign in"
      footer={
        <>
          New to IPO Mania?{" "}
          <Link className="font-semibold text-action underline" to="/register">
            Create an account
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
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          className="min-h-touch w-full rounded-lg border border-border px-3"
          {...register("password")}
        />
        <FieldError id="password-error" message={errors.password?.message} />
        <div className="text-right">
          <Link className="font-semibold text-action underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthPage>
  );
}
