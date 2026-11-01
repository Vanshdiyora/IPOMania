import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { loading, user } = useAuth();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const pageContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) {
      pageContentRef.current?.setAttribute("inert", "");
      document.body.style.overflow = "hidden";
    } else {
      pageContentRef.current?.removeAttribute("inert");
      document.body.style.overflow = "";
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
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  if (pathname === "/" && (loading || !user)) {
    return <Outlet />;
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
          className="mx-auto w-full max-w-7xl min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 animate-fade-in"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
