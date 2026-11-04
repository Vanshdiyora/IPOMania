import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/Button";

const capabilities = [
  {
    title: "Multi-demat account hub",
    description: "Keep personal, family, and entity demat account records in one secure registry.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Issue quota calculator",
    description: "Review issue-specific lots and category rules before recording your application.",
    icon: Calculator,
  },
  {
    title: "Application tracking",
    description: "Maintain a clear history of your actual application records and their status.",
    icon: ClipboardList,
  },
  {
    title: "Portfolio insights",
    description: "See your own application activity by issue, category, and demat account.",
    icon: BarChart3,
  },
];

export function WelcomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div>
        <section className="relative overflow-hidden px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.09),transparent_28rem)]"
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-action-border bg-action-light px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-action">
              <ShieldCheck size={14} aria-hidden="true" />
              Private IPO record management
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-navy sm:text-5xl lg:text-6xl">
              A clearer way to manage your IPO records.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              Organize demat accounts, record applications, and calculate issue-specific quotas in a
              private workspace built for careful review.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted">Signed in as {user.email}.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild size="lg">
                      <Link to="/dashboard" className="gap-2">
                        Open dashboard <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link to="/profile">Manage profile</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link to="/register" className="gap-2">
                      Create an account <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted">
              <li className="flex items-center gap-2">
                <Lock size={16} className="text-action-emerald" aria-hidden="true" />
                No third-party credentials
              </li>
              <li className="flex items-center gap-2">
                <Users size={16} className="text-action-emerald" aria-hidden="true" />
                Multi-account support
              </li>
              <li className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-action-emerald" aria-hidden="true" />
                Import and export tools
              </li>
            </ul>
          </div>
        </section>

        <section className="border-y border-border bg-surface px-4 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-action">
                Built for review
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                Practical tools without invented market data.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">
                IPO Mania presents the records and catalog information available to your account,
                with clear source and verification context.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-action-light text-action">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {[
              ["1", "Add accounts", "Store the demat accounts you want to organize."],
              [
                "2",
                "Review an issue",
                "Use catalog or personal IPO records with their published status.",
              ],
              ["3", "Record activity", "Track applications and calculations for later review."],
            ].map(([number, title, description]) => (
              <article
                key={number}
                className="rounded-2xl border border-border bg-surface p-6 shadow-card"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-sm font-bold text-white">
                  {number}
                </span>
                <h2 className="mt-5 text-lg font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
