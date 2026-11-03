import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Outlet, useLocation, useOutlet, Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { Sidebar } from "./Sidebar";
import { useToast } from "../ui/ToastContext";
import { LoadingState } from "../LoadingState";
import { DrawerRouteHost } from "./DrawerRouteHost";
import { DrawerRouteProvider } from "../ui/FormDrawer";

export function AppLayout() {
  const { loading, user } = useAuth();
  const location = useLocation();
  const { pathname, state } = location;
  const navigate = useNavigate();
  const { notify } = useToast();
  const successMessage = (state as { successMessage?: unknown } | null)?.successMessage;
  const outlet = useOutlet();
  const drawerRoute =
    /^\/(accounts|ipos|applications)\/(new|[^/]+\/edit)$/.test(pathname) ||
    /^\/ipos\/[^/]+\/categories$/.test(pathname);
  const backgroundRef = useRef(drawerRoute ? null : outlet);
  if (!drawerRoute) backgroundRef.current = outlet;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const [localDrawerPath, setLocalDrawerPath] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${getPageTitle(pathname)} | IPO Mania`;
  }, [pathname]);

  useEffect(() => {
    setLocalDrawerPath(null);
  }, [location.key]);

  useEffect(() => {
    if (typeof successMessage !== "string") return;
    notify({ title: successMessage, tone: "success" });
    navigate(`${pathname}${location.search}${location.hash}`, { replace: true, state: null });
  }, [location.hash, location.search, navigate, notify, pathname, successMessage]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileMenuOpen) {
      pageContentRef.current?.setAttribute("inert", "");
      document.body.style.overflow = "hidden";
    } else {
      pageContentRef.current?.removeAttribute("inert");
    }

    if (!mobileMenuOpen) {
      if (menuWasOpen.current) menuButtonRef.current?.focus();
      menuWasOpen.current = false;
      return;
    }

    menuWasOpen.current = true;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  if (pathname === "/" && loading) {
    return <LoadingState label="Restoring your session" fullPage />;
  }

  if (pathname === "/" && !user) {
    return (
      <main id="main-content" className="min-h-screen min-w-0 bg-canvas">
        <Outlet />
      </main>
    );
  }

  return (
    <DrawerRouteProvider
      value={{
        open: setLocalDrawerPath,
        close: () => setLocalDrawerPath(null),
        isLocal: Boolean(localDrawerPath),
      }}
    >
      <div className="relative flex min-h-screen min-w-0 bg-canvas">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm md:hidden"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onNavigate={() => setMobileMenuOpen(false)}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main content */}
        <div ref={pageContentRef} className="flex min-w-0 flex-1 flex-col md:ml-64">
          <main
            id="main-content"
            className="relative w-full min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 animate-fade-in"
          >
            <button
              ref={menuButtonRef}
              type="button"
              className="fixed left-4 top-4 z-30 inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl border border-border bg-surface/95 text-muted shadow-card backdrop-blur transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus md:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileMenuOpen}
              aria-controls="main-navigation"
              tabIndex={mobileMenuOpen ? -1 : undefined}
              onClick={() => setMobileMenuOpen((current) => !current)}
            >
              <Menu aria-hidden="true" size={20} />
            </button>
            <div aria-hidden={drawerRoute || undefined}>
              {drawerRoute
                ? (backgroundRef.current ?? (
                    <section className="rounded-xl border border-border bg-white p-6">
                      <h1 className="text-2xl font-bold">Manage your records</h1>
                      <Link
                        className="text-action no-underline transition-colors hover:text-navy visited:text-action"
                        to="/dashboard"
                      >
                        Back to dashboard
                      </Link>
                    </section>
                  ))
                : outlet}
            </div>
            {drawerRoute && <div key={pathname}>{outlet}</div>}
            <DrawerRouteHost path={localDrawerPath} />
          </main>
        </div>
      </div>
    </DrawerRouteProvider>
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
