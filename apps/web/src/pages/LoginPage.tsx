import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { Input, FormField } from "../components/ui/Input";
import { getSupabaseClient } from "../lib/supabase";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

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
      title="Welcome back"
      subtitle="Sign in to your IPO Mania account"
      footer={
        <>
          New to IPO Mania?{" "}
          <Link className="font-semibold text-action hover:underline" to="/register">
            Create an account
          </Link>
        </>
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
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
        </FormField>

        <div className="flex items-center justify-end">
          <Link className="text-sm font-semibold text-action hover:underline" to="/forgot-password">
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
