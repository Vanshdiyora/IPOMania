import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { AuthPage } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { Input, FormField } from "../components/ui/Input";
import { useToast } from "../components/ui/ToastContext";
import { getAuthRedirectUrl } from "../lib/authRedirect";
import { getSupabaseClient } from "../lib/supabase";

type ForgotValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { notify } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function submit({ email }: ForgotValues) {
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("/reset-password", window.location.origin),
      });
      if (error) throw error;
      notify({
        title: "Reset instructions requested",
        description: "If an account exists for that email, instructions will be sent.",
        tone: "success",
      });
    } catch {
      notify({
        title: "Reset request failed",
        description: "We could not send the reset request. Please try again.",
        tone: "error",
      });
    }
  }

  return (
    <AuthPage
      title="Reset your password"
      subtitle="Enter your email and we'll send reset instructions"
      footer={
        <Link className="font-semibold text-action transition-colors hover:text-navy" to="/login">
          Return to sign in
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
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

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset instructions"}
        </Button>
      </form>
    </AuthPage>
  );
}
