import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../../auth/useAuth";

const applicationNavClass = ({ isActive }: { isActive: boolean }) =>
  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
  }`;

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
      className={`${
        mobileOpen ? "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)]" : "hidden"
      } min-w-0 shrink-0 flex-col overflow-y-auto border-r border-border bg-white px-4 py-4 md:static md:z-auto md:flex md:w-64 md:overflow-visible md:px-4 md:py-5`}
    >
      <div className="mb-5 flex min-h-touch items-center rounded-lg px-2 md:mb-8 md:px-3">
        <a
          className="flex min-h-touch min-w-0 flex-1 items-center gap-3 text-lg font-bold text-navy"
          href="/"
          aria-label="IPO Mania home"
        >
          <span aria-hidden="true" className="text-xl">
            IPO
          </span>{" "}
          <span>Mania</span>
        </a>
        <button
          ref={closeButtonRef}
          type="button"
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg text-muted hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy md:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <nav id="main-navigation" aria-label="Main navigation" onClick={onNavigate}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex min-h-touch items-center gap-3 rounded-lg px-3 text-base font-semibold ${
              isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
            }`
          }
        >
          <LayoutDashboard aria-hidden="true" size={20} />
          <span>Dashboard</span>
        </NavLink>
        {user ? (
          <>
            <NavLink
              to="/accounts"
              end
              className={({ isActive }) =>
                `mt-2 flex min-h-touch items-center gap-3 rounded-lg px-3 text-base font-semibold ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <BriefcaseBusiness aria-hidden="true" size={20} />
              <span>Demat accounts</span>
            </NavLink>
            <div className="pl-5">
              <NavLink
                to="/accounts/list"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Account list
              </NavLink>
              <NavLink
                to="/accounts/import"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Bulk import
              </NavLink>
              <NavLink
                to="/accounts/import-history"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Import history
              </NavLink>
            </div>
            <NavLink
              to="/applications"
              className={({ isActive }) =>
                `mt-2 flex min-h-touch items-center gap-3 rounded-lg px-3 text-base font-semibold ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <ClipboardList aria-hidden="true" size={20} />
              <span>Applications</span>
            </NavLink>
            <div className="pl-5">
              <NavLink to="/applications/list" className={applicationNavClass}>
                Application table
              </NavLink>
              <NavLink to="/applications/bulk" className={applicationNavClass}>
                Bulk entry
              </NavLink>
              <NavLink to="/applications/import" className={applicationNavClass}>
                Import wizard
              </NavLink>
              <NavLink to="/applications/import-history" className={applicationNavClass}>
                Import history
              </NavLink>
            </div>
            <NavLink
              to="/ipos"
              className={({ isActive }) =>
                `mt-2 flex min-h-touch items-center gap-3 rounded-lg px-3 text-base font-semibold ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <CalendarDays aria-hidden="true" size={20} />
              <span>IPOs</span>
            </NavLink>
            <div className="pl-5">
              <NavLink
                to="/ipo-calendar"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                IPO calendar
              </NavLink>
              <NavLink
                to="/quota-calculator"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Quota calculator
              </NavLink>
              <NavLink
                to="/mandates"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Mandate dashboard
              </NavLink>
              <NavLink
                to="/allotments"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Allotments
              </NavLink>
              <NavLink
                to="/capital"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Capital tracker
              </NavLink>
              <NavLink
                to="/capital/transactions"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Transaction history
              </NavLink>
              <NavLink
                to="/capital/refunds"
                className={({ isActive }) =>
                  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
                    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                  }`
                }
              >
                Refund tracker
              </NavLink>
            </div>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `mt-2 flex min-h-touch items-center gap-3 rounded-lg px-3 text-base font-semibold ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <UserRound aria-hidden="true" size={20} />
              <span>Profile</span>
            </NavLink>
          </>
        ) : (
          <div className="mt-2 space-y-1">
            <NavLink
              className="flex min-h-touch items-center rounded-lg px-3 font-semibold text-muted hover:bg-canvas"
              to="/login"
            >
              <span>Sign in</span>
            </NavLink>
            <NavLink
              className="flex min-h-touch items-center rounded-lg px-3 font-semibold text-muted hover:bg-canvas"
              to="/register"
            >
              <span>Create account</span>
            </NavLink>
          </div>
        )}
      </nav>
      {user ? (
        <button
          type="button"
          className="mt-auto flex min-h-touch items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
          onClick={() => {
            onNavigate();
            setSignOutError(false);
            void signOut().catch(() => setSignOutError(true));
          }}
        >
          <LogOut aria-hidden="true" size={20} />
          <span>Sign out</span>
        </button>
      ) : null}
      {signOutError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          Sign out failed. Please try again.
        </p>
      ) : null}
    </aside>
  );
}
