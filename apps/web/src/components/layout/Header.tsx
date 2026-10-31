import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="flex min-h-16 items-center border-b border-border bg-white px-5 sm:px-8">
      <p className="text-base font-medium text-muted">IPO Mania</p>
      {user ? (
        <span className="ml-auto max-w-[50%] truncate text-sm text-muted">{user.email}</span>
      ) : (
        <Link
          className="ml-auto min-h-touch content-center font-semibold text-action underline"
          to="/login"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
