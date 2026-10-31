import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, user, sessionExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas" role="status">
        <p className="text-base font-medium text-muted">Checking your session…</p>
      </main>
    );
  }

  if (sessionExpired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5">
        <section className="w-full max-w-lg rounded-xl border border-border bg-white p-8 text-center">
          <h1 className="text-2xl font-bold text-navy">Your session has expired</h1>
          <p className="mt-3 text-muted">
            Sign in again to continue. Your account data has not been changed.
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex min-h-touch items-center justify-center rounded-lg bg-action px-5 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            Sign in
          </a>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
