import type { RefObject } from "react";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { cn } from "../../lib/utils";

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
    <header
      className={cn(
        "sticky top-0 z-30",
        "flex min-h-16 items-center gap-3",
        "border-b border-border bg-surface/95 backdrop-blur-sm",
        "px-4 sm:px-6",
      )}
    >
      {/* Mobile menu toggle */}
      <button
        ref={menuButtonRef}
        type="button"
        className={cn(
          mobileMenuOpen ? "hidden" : "inline-flex",
          "min-h-touch min-w-touch items-center justify-center rounded-lg",
          "text-muted hover:bg-canvas hover:text-ink",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus",
          "transition-colors duration-150",
          "md:hidden",
        )}
        aria-label="Open navigation"
        aria-expanded={mobileMenuOpen}
        aria-controls="main-navigation"
        tabIndex={mobileMenuOpen ? -1 : undefined}
        onClick={onMenuToggle}
      >
        <Menu aria-hidden="true" size={20} />
      </button>

      {/* Page title / breadcrumb area */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate hidden sm:block">IPO Mania</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {user ? (
          <>
            {/* User avatar */}
            <Link
              to="/profile"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                "bg-action-light text-action text-xs font-bold uppercase",
                "hover:bg-blue-100 transition-colors duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus",
              )}
              aria-label="View your profile"
              title={user.email}
            >
              {user.email?.[0] ?? "U"}
            </Link>
          </>
        ) : (
          <Link
            to="/login"
            className="inline-flex min-h-touch items-center rounded-lg px-4 py-2 text-sm font-semibold text-action hover:bg-action-light transition-colors duration-150"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
