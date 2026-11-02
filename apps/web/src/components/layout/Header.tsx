import { useEffect, type RefObject } from "react";
import { Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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
  const { pathname } = useLocation();
  const pageTitle = getPageTitle(pathname);
  useEffect(() => {
    document.title = `${pageTitle} | IPO Mania`;
  }, [pageTitle]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        "flex min-h-16 items-center gap-3",
        "border-b border-indigo-100/80 bg-white/90 shadow-[0_8px_30px_-24px_rgba(49,46,129,0.45)] backdrop-blur-xl",
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
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy sm:text-base">{pageTitle}</p>
          <p className="hidden text-[11px] font-medium text-muted sm:block">
            IPO management workspace
          </p>
        </div>
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
                "h-10 w-10 bg-gradient-to-br from-action-light to-teal-50 text-action text-xs font-bold uppercase ring-1 ring-indigo-100",
                "hover:scale-[1.03] hover:ring-indigo-200 transition-all duration-150",
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

function getPageTitle(pathname: string) {
  if (pathname === "/" || pathname === "/dashboard") return "Dashboard";
  if (pathname === "/accounts") return "Demat Accounts";
  if (pathname.startsWith("/accounts/import-history")) return "Account import history";
  if (pathname === "/accounts/import") return "Import accounts";
  if (/^\/accounts\/[^/]+\/edit$/.test(pathname)) return "Edit account";
  if (/^\/accounts\/[^/]+$/.test(pathname)) return "Account details";
  if (pathname === "/accounts/new") return "Add account";
  if (pathname === "/applications") return "Applications";
  if (pathname === "/applications/bulk") return "Bulk applications";
  if (pathname === "/applications/import") return "Import applications";
  if (pathname.startsWith("/applications/import-history")) return "Application import history";
  if (/^\/applications\/[^/]+\/edit$/.test(pathname)) return "Edit application";
  if (/^\/applications\/[^/]+$/.test(pathname)) return "Application details";
  if (pathname === "/applications/new") return "Add application";
  if (pathname === "/ipos") return "IPOs";
  if (pathname === "/ipo-calendar") return "IPO calendar";
  if (pathname === "/quota-calculator") return "Quota calculator";
  if (/^\/ipos\/[^/]+\/categories$/.test(pathname)) return "IPO categories";
  if (/^\/ipos\/[^/]+\/edit$/.test(pathname)) return "Edit IPO";
  if (/^\/ipos\/catalog/.test(pathname)) return "IPO catalog";
  if (/^\/ipos\/[^/]+$/.test(pathname)) return "IPO details";
  if (pathname === "/ipos/new") return "Add IPO";
  if (pathname === "/admin") return "Admin overview";
  if (pathname === "/admin/ipos") return "IPO catalog";
  if (pathname === "/admin/sync") return "IPO synchronization";
  if (pathname === "/admin/ipo-sync-history") return "Synchronization history";
  if (pathname === "/admin/settings") return "Admin settings";
  if (pathname === "/profile") return "Profile";
  return "IPO Mania";
}
