import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useOutlet, Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useToast } from "../ui/ToastContext";
import { LoadingState } from "../LoadingState";

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
    <div className="flex min-h-screen min-w-0 bg-canvas">
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
        <Header
          mobileMenuOpen={mobileMenuOpen}
          menuButtonRef={menuButtonRef}
          onMenuToggle={() => setMobileMenuOpen((open) => !open)}
        />
        <main
          id="main-content"
          className="w-full min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 animate-fade-in"
        >
          <div aria-hidden={drawerRoute || undefined}>
            {drawerRoute
              ? (backgroundRef.current ?? (
                  <section className="rounded-xl border border-border bg-white p-6">
                    <h1 className="text-2xl font-bold">Manage your records</h1>
                    <Link
                      className="text-action no-underline underline-offset-4 hover:underline visited:text-action"
                      to="/dashboard"
                    >
                      Back to dashboard
                    </Link>
                  </section>
                ))
              : outlet}
          </div>
          {drawerRoute && <div key={pathname}>{outlet}</div>}
        </main>
      </div>
    </div>
  );
}
