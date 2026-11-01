import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { AuthPage } from "../auth/AuthPage";
import { Button } from "../components/ui/Button";
import { getSupabaseClient } from "../lib/supabase";

export function ConfirmEmailPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Verifying your email address…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!code) {
      setLoading(false);
      setFailed(true);
      setMessage(
        "This verification link is invalid or has expired. Please request a new link by registering again.",
      );
      return;
    }
    try {
      void getSupabaseClient()
        .auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          setLoading(false);
          if (error) throw error;
          setMessage(
            "Your email address has been successfully verified. You can now access your account.",
          );
        })
        .catch(() => {
          setLoading(false);
          setFailed(true);
          setMessage(
            "This verification link is invalid or has expired. Please request a new link by registering again.",
          );
        });
    } catch {
      setLoading(false);
      setFailed(true);
      setMessage("Email verification is not configured. Please contact support.");
    }
  }, []);

  return (
    <AuthPage
      title="Email Verification"
      subtitle="Securing your multi-account IPO portfolio workspace."
    >
      <div className="space-y-6">
        <div
          role={failed ? "alert" : "status"}
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${
            failed
              ? "border-danger/30 bg-danger/5 text-danger"
              : loading
                ? "border-action/20 bg-action/5 text-ink"
                : "border-action-emerald/30 bg-action-emerald/5 text-action-emerald"
          }`}
        >
          {loading ? (
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-action" />
          ) : failed ? (
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-action-emerald" />
          )}
          <span>{message}</span>
        </div>

        <Button asChild className="w-full shadow-xs">
          <Link to="/login" className="gap-2">
            <span>Continue to Sign In</span>
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </AuthPage>
  );
}
