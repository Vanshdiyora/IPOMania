import {
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../../auth/useAuth";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/ToastContext";

// ─── NavItem (top-level) ─────────────────────────────────────────────────────
function NavItem({
  to,
  icon,
  label,
  end = false,
  activePrefixes,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  activePrefixes?: string[];
  onClick?: () => void;
}) {
  const { pathname } = useLocation();
  const sectionActive = activePrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false;

  if (activePrefixes) {
    return (
      <Link
        to={to}
        onClick={onClick}
        aria-current={sectionActive ? "page" : undefined}
        className={cn(
          "flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
          "transition-colors duration-150",
          sectionActive
            ? "bg-action-light text-action font-semibold"
            : "text-muted hover:bg-canvas hover:text-ink",
        )}
      >
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      aria-current={sectionActive ? "page" : undefined}
      className={({ isActive }) =>
        cn(
          "flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
          "transition-colors duration-150",
          isActive || sectionActive
            ? "bg-action-light text-action font-semibold"
            : "text-muted hover:bg-canvas hover:text-ink",
        )
      }
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export function Sidebar({
  mobileOpen,
  onNavigate,
  onClose,
}: {
  mobileOpen: boolean;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const { user, signOut } = useAuth();
  const { notify } = useToast();
  const [signOutError, setSignOutError] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mobileOpen) closeButtonRef.current?.focus();
  }, [mobileOpen]);

  function keepFocusInDrawer(event: KeyboardEvent<HTMLElement>) {
    if (!mobileOpen || event.key !== "Tab" || !sidebarRef.current) return;
    const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <aside
      ref={sidebarRef}
      role={mobileOpen ? "dialog" : undefined}
      aria-modal={mobileOpen ? true : undefined}
      aria-label={mobileOpen ? "Mobile navigation" : undefined}
      onKeyDown={keepFocusInDrawer}
      className={cn(
        // Mobile: slide-in drawer
        mobileOpen
          ? "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] animate-slide-in-left"
          : "hidden",
        // Desktop: fixed sidebar
        "min-w-0 shrink-0 flex-col overflow-hidden bg-surface border-r border-border",
        "px-3 py-4",
        "md:fixed md:inset-y-0 md:left-0 md:z-auto md:flex md:h-screen md:w-64",
      )}
    >
      {/* Logo */}
      <div className="mb-4 flex shrink-0 items-center justify-between px-2">
        <Link to="/" className="flex items-center gap-2.5 min-h-touch">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-base font-bold tracking-tight text-ink">IPO Mania</span>
        </Link>
        <button
          ref={closeButtonRef}
          type="button"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-muted hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus md:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav
        id="main-navigation"
        aria-label="Main navigation"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-0.5 pr-1"
        onClick={onNavigate}
      >
        <NavItem
          to="/dashboard"
          end
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          onClick={onNavigate}
        />

        {user ? (
          <>
            <NavItem
              to="/accounts"
              activePrefixes={["/accounts"]}
              icon={<BriefcaseBusiness size={18} />}
              label="Demat Accounts"
              onClick={onNavigate}
            />
            <NavItem
              to="/applications"
              activePrefixes={["/applications"]}
              icon={<ClipboardList size={18} />}
              label="Applications"
              onClick={onNavigate}
            />
            <NavItem
              to="/ipos"
              activePrefixes={["/ipos", "/ipo-calendar", "/quota-calculator"]}
              icon={<TrendingUp size={18} />}
              label="IPOs"
              onClick={onNavigate}
            />

            {/* Divider */}
            <div className="my-2 h-px bg-border" />

            {/* Profile */}
            <NavItem
              to="/profile"
              icon={<UserRound size={18} />}
              label="Profile"
              onClick={onNavigate}
            />
          </>
        ) : (
          <div className="mt-2 space-y-0.5">
            <NavLink
              to="/login"
              className="flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-canvas hover:text-ink transition-colors duration-150"
            >
              Sign in
            </NavLink>
            <NavLink
              to="/register"
              className="flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-canvas hover:text-ink transition-colors duration-150"
            >
              Create account
            </NavLink>
          </div>
        )}
      </nav>

      {/* Bottom: Sign out + user */}
      {user && (
        <div className="mt-4 shrink-0 space-y-2 border-t border-border pt-3">
          {/* User identifier */}
          <div className="flex items-center gap-2.5 px-3 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-action-light text-action text-xs font-bold uppercase">
              {user.email?.[0] ?? "U"}
            </div>
            <p className="min-w-0 truncate text-xs font-medium text-muted">{user.email}</p>
          </div>

          {/* Sign out */}
          <button
            type="button"
            className="flex w-full min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-danger-bg hover:text-danger transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
            onClick={() => {
              onNavigate();
              setSignOutError(false);
              void signOut()
                .then(() => notify({ title: "Signed out", tone: "success" }))
                .catch(() => {
                  setSignOutError(true);
                  notify({ title: "Sign out failed", tone: "error" });
                });
            }}
          >
            <LogOut aria-hidden="true" size={18} />
            <span>Sign out</span>
          </button>

          {signOutError && (
            <p role="alert" className="px-3 text-xs text-danger">
              Sign out failed. Please try again.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
