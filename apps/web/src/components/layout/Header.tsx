import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

export function Header({
  mobileMenuOpen,
  onMenuToggle,
}: {
  mobileMenuOpen: boolean;
  onMenuToggle: () => void;
}) {
  const { user } = useAuth();

  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border bg-white px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg text-navy hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy md:hidden"
        aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileMenuOpen}
        aria-controls="main-navigation"
        onClick={onMenuToggle}
      >
        {mobileMenuOpen ? (
          <X aria-hidden="true" size={22} />
        ) : (
          <Menu aria-hidden="true" size={22} />
        )}
      </button>
      <p className="truncate text-base font-medium text-muted">IPO Mania</p>
      {user ? (
        <span className="ml-auto max-w-[55%] truncate text-right text-sm text-muted">
          {user.email}
        </span>
      ) : (
        <Link
          className="ml-auto inline-flex min-h-touch items-center font-semibold text-action underline"
          to="/login"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
