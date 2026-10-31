import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../auth/useAuth";

const applicationNavClass = ({ isActive }: { isActive: boolean }) =>
  `mt-1 flex min-h-touch items-center rounded-lg px-3 text-sm font-semibold ${
    isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
  }`;

export function Sidebar() {
  const { user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState(false);

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
          <span className="hidden sm:inline">Dashboard</span>
        </NavLink>
        {user ? (
          <>
            <NavLink
              to="/accounts"
              end
              aria-label="Demat account dashboard"
              className={({ isActive }) =>
                `mt-2 flex min-h-touch items-center justify-center gap-3 rounded-lg px-3 text-base font-semibold sm:justify-start ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <BriefcaseBusiness aria-hidden="true" size={20} />
              <span className="hidden sm:inline">Demat accounts</span>
            </NavLink>
            <div className="hidden pl-5 sm:block">
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
              aria-label="IPO application manager"
              className={({ isActive }) =>
                `mt-2 flex min-h-touch items-center justify-center gap-3 rounded-lg px-3 text-base font-semibold sm:justify-start ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <ClipboardList aria-hidden="true" size={20} />
              <span className="hidden sm:inline">Applications</span>
            </NavLink>
            <div className="hidden pl-5 sm:block">
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
              aria-label="IPO management"
              className={({ isActive }) =>
                `mt-2 flex min-h-touch items-center justify-center gap-3 rounded-lg px-3 text-base font-semibold sm:justify-start ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <CalendarDays aria-hidden="true" size={20} />
              <span className="hidden sm:inline">IPOs</span>
            </NavLink>
            <div className="hidden pl-5 sm:block">
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
                `mt-2 flex min-h-touch items-center justify-center gap-3 rounded-lg px-3 text-base font-semibold sm:justify-start ${
                  isActive ? "bg-[#EAF0F6] text-navy" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <UserRound aria-hidden="true" size={20} />
              <span className="hidden sm:inline">Profile</span>
            </NavLink>
          </>
        ) : (
          <div className="mt-2 space-y-1">
            <NavLink
              className="flex min-h-touch items-center justify-center rounded-lg px-3 font-semibold text-muted hover:bg-canvas sm:justify-start"
              to="/login"
            >
              <span>Sign in</span>
            </NavLink>
            <NavLink
              className="flex min-h-touch items-center justify-center rounded-lg px-3 font-semibold text-muted hover:bg-canvas sm:justify-start"
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
          className="mt-auto flex min-h-touch items-center justify-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy sm:justify-start"
          onClick={() => {
            setSignOutError(false);
            void signOut().catch(() => setSignOutError(true));
          }}
        >
          <LogOut aria-hidden="true" size={20} />
          <span className="hidden sm:inline">Sign out</span>
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
