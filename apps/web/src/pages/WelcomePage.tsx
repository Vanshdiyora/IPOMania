import { Card } from "../components/ui/Card";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export function WelcomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-action">IPO Mania</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Welcome to IPO Mania</h1>
        <p className="mt-3 max-w-3xl text-lg leading-7 text-muted">
          Manage your profile and demat accounts. IPO application workflows remain out of scope for
          this phase.
        </p>
      </div>
      <Card>
        <h2 className="text-xl font-bold text-ink">Account access</h2>
        <p className="mt-2 text-base leading-7 text-muted">
          {user ? (
            <>
              Signed in as {user.email}.{" "}
              <Link className="font-semibold text-action underline" to="/accounts">
                Open demat account dashboard
              </Link>{" "}
              or{" "}
              <Link className="font-semibold text-action underline" to="/profile">
                manage your profile
              </Link>
              .
            </>
          ) : (
            <>
              Sign in or create an account to manage your profile.{" "}
              <Link className="font-semibold text-action underline" to="/register">
                Create an account
              </Link>
              .
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
