import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { Button } from "../components/ui/Button";
import { Clock, LogIn } from "lucide-react";
import { LoadingState } from "../components/LoadingState";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, user, sessionExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Checking your session" fullPage />;
  }

  if (sessionExpired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-bg text-warning">
            <Clock size={26} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Your session has expired</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in again to continue. Your account data has not been changed.
          </p>
          <a href="/login">
            <Button className="mt-6 w-full" size="md">
              <LogIn size={16} aria-hidden="true" />
              Sign in
            </Button>
          </a>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
