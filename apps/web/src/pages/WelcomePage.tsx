import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

export function WelcomePage() {
  const { user } = useAuth();

  return (
    <div className="relative -mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-light/40 via-canvas to-canvas px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="absolute inset-0 bg-grid pointer-events-none opacity-40" />
        <div className="relative mx-auto max-w-5xl text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-action/20 bg-action/5 px-4 py-1.5 text-xs font-semibold text-action shadow-xs animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-action animate-pulse" />
            <span>Private Multi-Account IPO Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-navy sm:text-5xl lg:text-6xl">
            Orchestrate IPO applications <br className="hidden sm:inline" />
            <span className="text-action">across all demat accounts.</span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            A purpose-built investment workspace for multi-account retail &amp; HNI investors. Track
            bids, monitor UPI mandate blocks, compute category quotas, and reconcile allotments.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {user ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-muted">Signed in as {user.email}.</p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button asChild size="lg">
                    <Link to="/accounts" className="gap-2">
                      <span>Open Demat Dashboard</span>
                      <ArrowRight size={18} />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/profile">Manage Profile</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button asChild size="lg" className="shadow-md">
                  <Link to="/register" className="gap-2">
                    <span>Create an account</span>
                    <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>

          {/* Feature Highlights Ticker */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-action-emerald" />
              Row-Level Security Isolation
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={16} className="text-action-emerald" />
              Non-Custodial Tracking
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={16} className="text-action-emerald" />
              Multi-Demat Family Accounts
            </span>
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet size={16} className="text-action-emerald" />
              CSV Bulk Import &amp; Export
            </span>
          </div>

          {/* Interactive UI Preview Showcase Card */}
          <div className="mt-16 overflow-hidden rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-xl text-left">
            {/* Window bar */}
            <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-mono text-muted">
                  ipo-mania.platform / portfolio-view
                </span>
              </div>
              <Badge variant="success" dot>
                Live Sync Ready
              </Badge>
            </div>

            {/* Mock Dashboard metrics preview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
              <div className="rounded-xl border border-border/70 bg-canvas/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Capital Blocked</span>
                  <CreditCard size={15} className="text-action" />
                </div>
                <p className="mt-2 text-xl font-bold tabular text-navy sm:text-2xl">₹1,47,800</p>
                <span className="mt-1 inline-block text-[11px] font-medium text-action-emerald">
                  Across 3 active IPOs
                </span>
              </div>

              <div className="rounded-xl border border-border/70 bg-canvas/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Active Applications</span>
                  <ClipboardList size={15} className="text-action" />
                </div>
                <p className="mt-2 text-xl font-bold tabular text-navy sm:text-2xl">8 Bids</p>
                <span className="mt-1 inline-block text-[11px] font-medium text-muted">
                  4 Retail • 4 HNI (sNII)
                </span>
              </div>

              <div className="rounded-xl border border-border/70 bg-canvas/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Configured Demats</span>
                  <BriefcaseBusiness size={15} className="text-action" />
                </div>
                <p className="mt-2 text-xl font-bold tabular text-navy sm:text-2xl">6 Accounts</p>
                <span className="mt-1 inline-block text-[11px] font-medium text-muted">
                  Zerodha, Groww, Angel
                </span>
              </div>

              <div className="rounded-xl border border-border/70 bg-canvas/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Historical Allotments</span>
                  <TrendingUp size={15} className="text-action" />
                </div>
                <p className="mt-2 text-xl font-bold tabular text-navy sm:text-2xl">24.5%</p>
                <span className="mt-1 inline-block text-[11px] font-medium text-action-emerald">
                  Allotment rate (L12M)
                </span>
              </div>
            </div>

            {/* Mock recent table preview */}
            <div className="rounded-xl border border-border/70 bg-canvas/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 text-xs font-semibold text-muted uppercase tracking-wider">
                <span>Recent Applications</span>
                <span className="hidden sm:inline">Category &amp; Amount</span>
              </div>
              <div className="divide-y divide-border/50 text-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy font-bold text-xs">
                      BL
                    </span>
                    <div>
                      <p className="font-semibold text-ink">Bharat Lights Ltd.</p>
                      <p className="text-xs text-muted">Demat: Primary HUF (Zerodha)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="primary">sNII • ₹2,09,300</Badge>
                    <Badge variant="warning" dot>
                      Blocked
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy font-bold text-xs">
                      ST
                    </span>
                    <div>
                      <p className="font-semibold text-ink">Solaris Tech Solutions</p>
                      <p className="text-xs text-muted">Demat: Individual (Groww)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">Retail • ₹14,950</Badge>
                    <Badge variant="success" dot>
                      Allotted
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pillars / Capabilities Grid ─────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-8 sm:py-20 lg:px-12 bg-surface border-y border-border">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-action">
              Platform Pillars
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">
              Engineered for sophisticated IPO participation
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted">
              Everything required to scale and audit multi-account bids with pinpoint precision.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <div className="rounded-xl border border-border bg-canvas/50 p-6 transition-all duration-200 hover:border-action/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-action/10 text-action">
                <BriefcaseBusiness size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">Multi-Demat Account Hub</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Maintain structured records of all personal, family, and entity demat accounts.
                Record DP IDs, client codes, and broker mappings in one secure registry.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-xl border border-border bg-canvas/50 p-6 transition-all duration-200 hover:border-action/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-action/10 text-action">
                <Calculator size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">Quota &amp; Lot Calculator</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Calculate accurate maximum bid amounts for Retail, small HNI (₹2L - ₹5L), big HNI
                (&gt;₹5L), and Shareholder quotas with auto lot sizing before application.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-xl border border-border bg-canvas/50 p-6 transition-all duration-200 hover:border-action/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-action/10 text-action">
                <CreditCard size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">UPI Mandate &amp; Capital Tracker</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Monitor capital status lifecycle: Blocked funds, Bank debits upon allotment, and
                unblocked refunds with exact transaction histories.
              </p>
            </div>

            {/* Card 4 */}
            <div className="rounded-xl border border-border bg-canvas/50 p-6 transition-all duration-200 hover:border-action/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-action/10 text-action">
                <ClipboardList size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">Batch Bidding &amp; Imports</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Streamline operations with CSV bulk imports and batch application builders designed
                for quick multi-demat application logging during heavy issue days.
              </p>
            </div>

            {/* Card 5 */}
            <div className="rounded-xl border border-border bg-canvas/50 p-6 transition-all duration-200 hover:border-action/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-action/10 text-action">
                <BarChart3 size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">Deep Portfolio Analytics</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Visualize capital utilization curves, application outcomes by issue, category-wise
                distributions, and demat performance metrics with interactive charts.
              </p>
            </div>

            {/* Card 6 */}
            <div className="rounded-xl border border-border bg-canvas/50 p-6 transition-all duration-200 hover:border-action/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-action/10 text-action">
                <ShieldCheck size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">Privacy-First Architecture</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Row-Level Security (RLS) ensures only verified identities access their records. Zero
                broker credentials, zero shared pools, zero data leakage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Workflow Section ────────────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-8 sm:py-20 lg:px-12 bg-canvas">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-action">How It Works</h2>
            <p className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">
              From announcement to allotment in 4 steps
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative rounded-xl border border-border bg-surface p-5 shadow-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                1
              </span>
              <h3 className="mt-4 font-bold text-ink">Register Accounts</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Add all your demat accounts with holder names and broker details for quick
                reference.
              </p>
            </div>

            <div className="relative rounded-xl border border-border bg-surface p-5 shadow-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                2
              </span>
              <h3 className="mt-4 font-bold text-ink">Calculate &amp; Bid</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Use the Quota Calculator to compute optimal lots and submit bids through your broker
                app.
              </p>
            </div>

            <div className="relative rounded-xl border border-border bg-surface p-5 shadow-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                3
              </span>
              <h3 className="mt-4 font-bold text-ink">Track UPI Mandates</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Record applications in IPO Mania to keep tabs on blocked funds across banks.
              </p>
            </div>

            <div className="relative rounded-xl border border-border bg-surface p-5 shadow-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                4
              </span>
              <h3 className="mt-4 font-bold text-ink">Reconcile Allotments</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Log allotment results, verify unblocked amounts, and analyze historical hit rates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-8 sm:py-20 lg:px-12 bg-navy text-white text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl text-white">
            Ready to upgrade your IPO workflow?
          </h2>
          <p className="mt-4 text-base text-slate-300">
            Join disciplined investors who track their multi-demat bids with institutional
            precision.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-action text-white hover:bg-action/90 shadow-lg">
              <Link to="/register" className="gap-2">
                <span>Create Free Account</span>
                <ChevronRight size={18} />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10"
            >
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
