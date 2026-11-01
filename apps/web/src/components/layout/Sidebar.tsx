import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../../auth/useAuth";
import { cn } from "../../lib/utils";

// ─── NavItem (top-level) ─────────────────────────────────────────────────────
function NavItem({
  to,
  icon,
  label,
  end = false,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
          "transition-colors duration-150",
          isActive
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

// ─── NavGroup with collapsible children ───────────────────────────────────────
function NavGroup({
  icon,
  label,
  basePath,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  basePath: string;
  children: React.ReactNode;
}) {
  // Auto-expand if on a matching route
  const isActive = typeof window !== "undefined" && window.location.pathname.startsWith(basePath);
  const [open, setOpen] = useState(isActive);

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex w-full min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
          "transition-colors duration-150",
          isActive ? "text-action font-semibold" : "text-muted hover:bg-canvas hover:text-ink",
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown
          size={14}
          className={cn("shrink-0 transition-transform duration-200", open ? "rotate-180" : "")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-3 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Sub-NavItem ──────────────────────────────────────────────────────────────
function SubNavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex min-h-9 items-center rounded-md px-2 py-1.5 text-sm",
          "transition-colors duration-150",
          isActive
            ? "font-semibold text-action bg-action-light"
            : "font-medium text-muted hover:bg-canvas hover:text-ink",
        )
      }
    >
      {label}
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
        // Desktop: static sidebar
        "min-w-0 shrink-0 flex-col overflow-y-auto bg-surface border-r border-border",
        "px-3 py-4",
        "md:static md:z-auto md:flex md:w-64 md:overflow-y-auto",
      )}
    >
      {/* Logo */}
      <div className="mb-4 flex items-center justify-between px-2">
        <Link to="/" className="flex items-center gap-2.5 min-h-touch">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-action text-white font-bold text-sm">
            IM
          </div>
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
        className="flex-1 space-y-0.5"
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
            {/* Demat Accounts Group */}
            <NavGroup
              icon={<BriefcaseBusiness size={18} />}
              label="Demat Accounts"
              basePath="/accounts"
            >
              <SubNavItem to="/accounts" label="Account dashboard" onClick={onNavigate} />
              <SubNavItem to="/accounts/list" label="Account list" onClick={onNavigate} />
              <SubNavItem to="/accounts/import" label="Bulk import" onClick={onNavigate} />
              <SubNavItem
                to="/accounts/import-history"
                label="Import history"
                onClick={onNavigate}
              />
            </NavGroup>

            {/* Applications Group */}
            <NavGroup
              icon={<ClipboardList size={18} />}
              label="Applications"
              basePath="/applications"
            >
              <SubNavItem to="/applications" label="App dashboard" onClick={onNavigate} />
              <SubNavItem to="/applications/list" label="Application table" onClick={onNavigate} />
              <SubNavItem to="/applications/bulk" label="Bulk entry" onClick={onNavigate} />
              <SubNavItem to="/applications/import" label="Import wizard" onClick={onNavigate} />
              <SubNavItem
                to="/applications/import-history"
                label="Import history"
                onClick={onNavigate}
              />
            </NavGroup>

            {/* IPOs Group */}
            <NavGroup icon={<TrendingUp size={18} />} label="IPOs" basePath="/ipos">
              <SubNavItem to="/ipos" label="IPO list" onClick={onNavigate} />
              <SubNavItem to="/ipo-calendar" label="IPO calendar" onClick={onNavigate} />
              <SubNavItem to="/quota-calculator" label="Quota calculator" onClick={onNavigate} />
            </NavGroup>

            {/* Capital Group */}
            <NavGroup icon={<BarChart3 size={18} />} label="Capital" basePath="/capital">
              <SubNavItem to="/capital" label="Capital tracker" onClick={onNavigate} />
              <SubNavItem
                to="/capital/transactions"
                label="Transaction history"
                onClick={onNavigate}
              />
              <SubNavItem to="/capital/refunds" label="Refund tracker" onClick={onNavigate} />
            </NavGroup>

            {/* Mandates Group */}
            <NavGroup icon={<CreditCard size={18} />} label="Mandates" basePath="/mandates">
              <SubNavItem to="/mandates" label="Mandate dashboard" onClick={onNavigate} />
            </NavGroup>

            {/* Allotments */}
            <NavGroup icon={<CalendarDays size={18} />} label="Allotments" basePath="/allotments">
              <SubNavItem to="/allotments" label="Allotment dashboard" onClick={onNavigate} />
            </NavGroup>

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
        <div className="mt-4 space-y-2 border-t border-border pt-3">
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
              void signOut().catch(() => setSignOutError(true));
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
