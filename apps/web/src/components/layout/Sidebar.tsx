import { LayoutDashboard } from "lucide-react";
import { NavLink } from "react-router-dom";

export function Sidebar() {
  return (
    <aside className="flex w-20 shrink-0 flex-col border-r border-border bg-white px-2 py-5 sm:w-64 sm:px-4">
      <a
        className="mb-8 flex min-h-touch items-center justify-center gap-3 rounded-lg px-2 text-center text-lg font-bold text-navy sm:justify-start sm:px-3"
        href="/"
        aria-label="IPO Mania home"
      >
        <span aria-hidden="true" className="text-xl">
          IPO
        </span>
        <span className="hidden sm:inline">IPO Mania</span>
      </a>
      <nav aria-label="Main navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex min-h-touch items-center justify-center gap-3 rounded-lg px-3 text-base font-semibold sm:justify-start ${
              isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
            }`
          }
        >
          <LayoutDashboard aria-hidden="true" size={20} />
          <span className="hidden sm:inline">Overview</span>
        </NavLink>
      </nav>
    </aside>
  );
}
