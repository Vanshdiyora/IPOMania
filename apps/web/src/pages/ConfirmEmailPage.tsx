import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthPage } from "../auth/AuthPage";
import { getSupabaseClient } from "../lib/supabase";

export function ConfirmEmailPage() {
  const [message, setMessage] = useState("Verifying your email address…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!code) {
      setFailed(true);
      setMessage(
        "This verification link is invalid or has expired. Request a new link by registering again.",
      );
      return;
    }
    try {
      void getSupabaseClient()
        .auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) throw error;
          setMessage("Your email address is verified. You can now sign in.");
        })
        .catch(() => {
          setFailed(true);
          setMessage(
            "This verification link is invalid or has expired. Request a new link by registering again.",
          );
        });
    } catch {
      setFailed(true);
      setMessage("Email verification is not configured. Please contact support.");
    }
  }, []);

  return (
    <AuthPage title="Email verification">
      <p
        role={failed ? "alert" : "status"}
        className={failed ? "text-sm text-danger" : "text-sm text-muted"}
      >
        {message}
      </p>
      <p className="mt-5 text-sm">
        <Link className="font-semibold text-action underline" to="/login">
          Continue to sign in
        </Link>
      </p>
    </AuthPage>
  );
}
