import type { RefObject } from "react";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

export function Header({
  mobileMenuOpen,
  menuButtonRef,
  onMenuToggle,
}: {
  mobileMenuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement>;
  onMenuToggle: () => void;
}) {
  const { user } = useAuth();

  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border bg-white px-4 sm:px-6 lg:px-8">
      <button
        ref={menuButtonRef}
        type="button"
        className={`${mobileMenuOpen ? "hidden" : "inline-flex"} min-h-touch min-w-touch items-center justify-center rounded-lg text-navy hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy md:hidden`}
        aria-label="Open navigation"
        aria-expanded={mobileMenuOpen}
        aria-controls="main-navigation"
        tabIndex={mobileMenuOpen ? -1 : undefined}
        onClick={onMenuToggle}
      >
        <Menu aria-hidden="true" size={22} />
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
