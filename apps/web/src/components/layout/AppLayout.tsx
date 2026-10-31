import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const pageContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) {
      pageContentRef.current?.setAttribute("inert", "");
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
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <div className="flex min-h-screen min-w-0 bg-canvas">
      {mobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onNavigate={() => setMobileMenuOpen(false)}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div ref={pageContentRef} className="flex min-w-0 flex-1 flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          menuButtonRef={menuButtonRef}
          onMenuToggle={() => setMobileMenuOpen((open) => !open)}
        />
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 sm:p-6 lg:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
