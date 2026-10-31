import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { registerSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage, FieldError } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { Input, FormField } from "../components/ui/Input";
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
        },
      });
      if (error) throw error;
      setMessage("Account created successfully. Check your email to confirm, then sign in.");
    } catch {
      setErrorMessage("We could not create your account. Check the details and try again.");
    }
  }

  return (
    <AuthPage
      title="Create your account"
      subtitle="Get started with IPO Mania in seconds"
      footer={
        <>
          Already registered?{" "}
          <Link className="font-semibold text-action hover:underline" to="/login">
            Sign in
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
        {message && (
          <div
            role="status"
            className="rounded-lg border border-success-border bg-success-bg p-3 text-sm text-success"
          >
            {message}
          </div>
        )}

        <FormField label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Your full name"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
            {...register("fullName")}
          />
          <FieldError id="fullName-error" message={errors.fullName?.message} />
        </FormField>

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

        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
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
          label="Confirm password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            {...register("confirmPassword")}
          />
          <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthPage>
  );
}
