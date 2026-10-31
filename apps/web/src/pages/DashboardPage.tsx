import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Filter,
  Percent,
  RotateCcw,
  TrendingUp,
  X,
} from "lucide-react";
import type {
  CapitalSummary,
  DashboardAnalytics,
  DematAccount,
  IpoRecord,
} from "@ipo-mania/shared";
import { useAuth } from "../auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/LoadingState";
import { SkeletonStatCard } from "../components/ui/Skeleton";
import { ApiRequestError, apiRequest, downloadApiFile } from "../lib/api";
import { WelcomePage } from "./WelcomePage";

type AnalyticsResponse = { data: DashboardAnalytics };
type CapitalSummaryResponse = { data: { summaries: CapitalSummary[] } };
type IpoOptionsResponse = {
  data: { ipos: IpoRecord[]; pagination?: { page: number; total_pages: number } };
};
type AccountOptionsResponse = {
  data: {
    accounts: DematAccount[];
    pagination?: { page: number; totalPages: number };
  };
};
type Filters = {
  date_from: string;
  date_to: string;
  ipo_id: string;
  category: string;
  account_id: string;
};

const emptyFilters: Filters = {
  date_from: "",
  date_to: "",
  ipo_id: "",
  category: "",
  account_id: "",
};

const selectClass =
  "min-h-touch w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/20 focus-visible:border-action";
const inputClass =
  "min-h-touch w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/20 focus-visible:border-action";
const chartColors = ["#2563EB", "#059669", "#D97706", "#DC2626", "#64748B", "#1E3A8A"];

export function DashboardHomePage() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingState label="Restoring your session" />;
  return user ? <DashboardPage /> : <WelcomePage />;
}

export function DashboardPage() {
  const { session, markSessionExpired } = useAuth();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [exportError, setExportError] = useState("");
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [filters]);

  const analyticsQuery = useQuery({
    queryKey: ["analytics", queryString],
    enabled: Boolean(session),
    staleTime: 30_000,
    queryFn: () =>
      apiRequest<AnalyticsResponse>(
        `/api/analytics${queryString ? `?${queryString}` : ""}`,
        session!,
      ),
  });
  const capitalQuery = useQuery({
    queryKey: ["capital", "dashboard-summary", queryString],
    enabled: Boolean(session),
    staleTime: 30_000,
    queryFn: () =>
      apiRequest<CapitalSummaryResponse>(
        `/api/capital/summary${queryString ? `?${queryString}` : ""}`,
        session!,
      ),
  });
  const ipoOptionsQuery = useInfiniteQuery({
    queryKey: ["analytics", "ipo-options"],
    enabled: Boolean(session),
    staleTime: 60_000,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequest<IpoOptionsResponse>(`/api/ipos?page=${pageParam}&page_size=100`, session!),
    getNextPageParam: (lastPage) => {
      const { page, total_pages: totalPages } = lastPage.data.pagination ?? {};
      return page && totalPages && page < totalPages ? page + 1 : undefined;
    },
  });
  const accountOptionsQuery = useInfiniteQuery({
    queryKey: ["analytics", "account-options"],
    enabled: Boolean(session),
    staleTime: 60_000,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequest<AccountOptionsResponse>(`/api/accounts?page=${pageParam}&pageSize=100`, session!),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.pagination ?? {};
      return page && totalPages && page < totalPages ? page + 1 : undefined;
    },
  });
  const exportMutation = useMutation({
    mutationFn: (format: "csv" | "xlsx") => {
      const params = new URLSearchParams(queryString);
      params.set("format", format);
      return downloadApiFile(`/api/analytics/export?${params}`, session!);
    },
    onMutate: () => setExportError(""),
    onError: (error) =>
      setExportError(error instanceof Error ? error.message : "The report could not be exported."),
  });

  const queryError =
    analyticsQuery.error ??
    capitalQuery.error ??
    ipoOptionsQuery.error ??
    accountOptionsQuery.error;
  useEffect(() => {
    if (queryError instanceof ApiRequestError && queryError.status === 401) {
      markSessionExpired();
    }
  }, [markSessionExpired, queryError]);

  const analytics = analyticsQuery.data?.data;
  const ipoOptions = ipoOptionsQuery.data?.pages.flatMap((page) => page.data.ipos) ?? [];
  const accountOptions =
    accountOptionsQuery.data?.pages.flatMap((page) => page.data.accounts) ?? [];
  const capitalSummaries = capitalQuery.data?.data.summaries ?? [];
  const capitalEvents = analytics?.capital_event_totals ?? [];
  const currencies = [
    ...new Set([
      ...capitalSummaries.map((summary) => summary.currency),
      ...capitalEvents.map((entry) => entry.currency),
    ]),
  ].sort();
  const loading =
    analyticsQuery.isLoading ||
    capitalQuery.isLoading ||
    ipoOptionsQuery.isLoading ||
    accountOptionsQuery.isLoading;
  const optionsError = ipoOptionsQuery.error ?? accountOptionsQuery.error;

  const hasActiveFilters = Object.values(filters).some(Boolean);

  function analyticsCount(value: number | undefined): string {
    if (analyticsQuery.isLoading) return "Loading…";
    if (analyticsQuery.error || value === undefined) return "Unavailable";
    return String(value);
  }

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-semibold text-action mb-1.5">
            <TrendingUp size={13} />
            <span>PORTFOLIO INTELLIGENCE</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            Dashboard &amp; Analytics
          </h1>
          <p className="mt-1 text-sm text-muted">
            Unified view of applications, demat inventory, capital blocking, and allotments.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 bg-surface"
            disabled={exportMutation.isPending || !analytics}
            onClick={() => exportMutation.mutate("csv")}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2 shadow-xs"
            disabled={exportMutation.isPending || !analytics}
            onClick={() => exportMutation.mutate("xlsx")}
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* ─── Filter Bar ───────────────────────────────────────────────────── */}
      <Card noPadding className="border-border/80 bg-surface shadow-xs">
        <div className="border-b border-border/60 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-action" />
            <span className="text-sm font-semibold text-ink">Analytics Filters</span>
            {hasActiveFilters && (
              <Badge variant="primary" size="sm">
                Filtered
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
              onClick={() => setFilters(emptyFilters)}
            >
              <X size={13} />
              <span>Reset filters</span>
            </button>
          )}
        </div>
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">From date</label>
              <input
                aria-label="From date"
                className={inputClass}
                type="date"
                value={filters.date_from}
                onChange={(event) => updateFilter("date_from", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">To date</label>
              <input
                aria-label="To date"
                className={inputClass}
                type="date"
                value={filters.date_to}
                onChange={(event) => updateFilter("date_to", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">IPO Issue</label>
              <select
                aria-label="IPO filter"
                className={selectClass}
                value={filters.ipo_id}
                onChange={(event) => updateFilter("ipo_id", event.target.value)}
              >
                <option value="">All IPOs</option>
                {ipoOptions.map((ipo) => (
                  <option key={ipo.id} value={ipo.id}>
                    {ipo.company_name} ({ipo.symbol})
                  </option>
                ))}
              </select>
              {ipoOptionsQuery.hasNextPage ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-action hover:underline"
                  disabled={ipoOptionsQuery.isFetchingNextPage}
                  onClick={() => void ipoOptionsQuery.fetchNextPage()}
                >
                  {ipoOptionsQuery.isFetchingNextPage ? "Loading…" : "+ Load more IPOs"}
                </button>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Bid Category</label>
              <select
                aria-label="Category filter"
                className={selectClass}
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
              >
                <option value="">All categories</option>
                {["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"].map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Demat Account</label>
              <select
                aria-label="Demat account filter"
                className={selectClass}
                value={filters.account_id}
                onChange={(event) => updateFilter("account_id", event.target.value)}
              >
                <option value="">All accounts</option>
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.holder_name} · {account.masked_demat_identifier}
                  </option>
                ))}
              </select>
              {accountOptionsQuery.hasNextPage ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-action hover:underline"
                  disabled={accountOptionsQuery.isFetchingNextPage}
                  onClick={() => void accountOptionsQuery.fetchNextPage()}
                >
                  {accountOptionsQuery.isFetchingNextPage ? "Loading…" : "+ Load more accounts"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Date filters scope application submissions and capital movements. Current inventory is
            shown for accounts &amp; IPOs.
          </p>
        </div>
      </Card>

      {/* ─── Feedback Notices ────────────────────────────────────────────── */}
      {queryError ? <ErrorNotice error={queryError} /> : null}
      {optionsError && optionsError !== queryError ? <ErrorNotice error={optionsError} /> : null}
      {exportError ? (
        <div
          className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm font-medium text-danger"
          role="alert"
        >
          {exportError}
        </div>
      ) : null}

      {/* ─── Core KPI Metric Grid ────────────────────────────────────────── */}
      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        aria-label="Dashboard totals"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <MetricCard
              label="Applications"
              value={analyticsCount(analytics?.totals.applications)}
              detail="Active bid records"
              icon={<ClipboardList size={18} className="text-action" />}
            />
            <MetricCard
              label="Demat Accounts"
              value={analyticsCount(analytics?.totals.active_demat_accounts)}
              detail="Active demat units"
              icon={<BriefcaseBusiness size={18} className="text-action-emerald" />}
            />
            <MetricCard
              label="Tracked IPOs"
              value={analyticsCount(analytics?.totals.tracked_ipos)}
              detail="Available in catalog"
              icon={<TrendingUp size={18} className="text-action" />}
            />
            <MetricCard
              label="Allotments Logged"
              value={analyticsCount(analytics?.allotment_performance.total)}
              detail="Recorded outcomes"
              icon={<CheckCircle2 size={18} className="text-action-emerald" />}
            />
            <MetricCard
              label="Allotment Rate"
              value={
                loading
                  ? "Loading…"
                  : analytics?.allotment_performance.success_rate_percent === null ||
                      analytics?.allotment_performance.success_rate_percent === undefined
                    ? "Unavailable"
                    : `${analytics.allotment_performance.success_rate_percent}%`
              }
              detail={
                analytics?.allotment_performance.total
                  ? `${analytics.allotment_performance.successful} successful bids`
                  : "No recorded results"
              }
              icon={<Percent size={18} className="text-action-amber" />}
            />
            <MetricCard
              label="Pending Refunds"
              value={analyticsCount(analytics?.refund_performance.pending)}
              detail="Awaiting bank unblock"
              icon={<RotateCcw size={18} className="text-action" />}
            />
          </>
        )}
      </section>

      {/* ─── Capital Summary & Allotment Performance ─────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-2" aria-label="Capital summary">
        {currencies.length ? (
          currencies.map((currency) => {
            const summary = capitalSummaries.find((item) => item.currency === currency);
            const ledger = capitalEvents.find((item) => item.currency === currency);
            const listingEvents =
              (ledger?.listing_sales ?? 0) + (ledger?.listing_price_updates ?? 0);
            return (
              <Card key={currency} hoverable className="border-border/80">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard size={18} className="text-action" />
                        <span>Capital Ledger · {currency}</span>
                      </CardTitle>
                      <CardDescription>
                        Real-time fund blocks, debits, and refund lifecycle status.
                      </CardDescription>
                    </div>
                    <Badge variant="primary">{currency}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <MoneyMetric
                      label="Currently Blocked"
                      value={summary?.currently_blocked_capital}
                      currency={currency}
                      unavailable={!summary || !ledger?.capital_block_events}
                      accent="blocked"
                    />
                    <MoneyMetric
                      label="Actual Outflow (Debited)"
                      value={ledger?.actual_debit}
                      currency={currency}
                      unavailable={!ledger?.actual_debit_events}
                      accent="debit"
                    />
                    <MoneyMetric
                      label="Outstanding Refunds"
                      value={summary?.outstanding_refunds}
                      currency={currency}
                      unavailable={!summary || !analytics?.refund_performance.total}
                      accent="pending"
                    />
                    <MoneyMetric
                      label="Refunds Received"
                      value={summary?.refunds_received}
                      currency={currency}
                      unavailable={!summary || !analytics?.refund_performance.total}
                      accent="received"
                    />
                    <MoneyMetric
                      label="Realized Listing P&amp;L"
                      value={summary?.realized_pnl}
                      currency={currency}
                      unavailable={!summary || listingEvents === 0}
                    />
                    <MoneyMetric
                      label="Unrealized Listing P&amp;L"
                      value={summary?.unrealized_pnl}
                      currency={currency}
                      unavailable={
                        !summary || summary.unrealized_pnl === null || listingEvents === 0
                      }
                    />
                  </dl>
                  <div className="mt-4 rounded-lg bg-surface-subtle p-3 text-xs text-muted">
                    Blocked capital is held via UPI ASBA. Debits reflect successful allotment
                    settlement.
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Capital Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">
                {capitalQuery.isLoading
                  ? "Loading capital summary…"
                  : capitalQuery.error
                    ? "Unavailable: capital summary could not be loaded."
                    : "No capital records logged yet."}
              </p>
            </CardContent>
          </Card>
        )}

        <Card hoverable className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-action-emerald" />
              <span>Allotment &amp; Refund Outcomes</span>
            </CardTitle>
            <CardDescription>
              Historical breakdown of positive allotments vs. full refunds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.allotment_performance.total ? (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <OutcomeTile
                    label="Full Allotment"
                    value={analytics.allotment_performance.full}
                    variant="success"
                  />
                  <OutcomeTile
                    label="Partial"
                    value={analytics.allotment_performance.partial}
                    variant="info"
                  />
                  <OutcomeTile
                    label="No Allotment"
                    value={analytics.allotment_performance.none}
                    variant="muted"
                  />
                  <OutcomeTile
                    label="Refunds Done"
                    value={analytics.refund_performance.completed}
                    variant="action"
                  />
                </dl>

                {/* Progress bar visualizer */}
                <div className="rounded-lg bg-surface-subtle p-4">
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-ink">Allotment Distribution</span>
                    <span className="text-muted tabular">
                      {analytics.allotment_performance.total} Total Bids
                    </span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="bg-action-emerald transition-all duration-300"
                      style={{
                        width: `${((analytics.allotment_performance.full + analytics.allotment_performance.partial) / analytics.allotment_performance.total) * 100}%`,
                      }}
                      title="Allotted"
                    />
                    <div
                      className="bg-slate-400 transition-all duration-300"
                      style={{
                        width: `${(analytics.allotment_performance.none / analytics.allotment_performance.total) * 100}%`,
                      }}
                      title="No Allotment"
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-action-emerald" />
                      Allotted ({analytics.allotment_performance.successful})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      Unallotted ({analytics.allotment_performance.none})
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <AnalyticsStateMessage
                label="No allotment results are available for the selected filters."
                loading={analyticsQuery.isLoading}
                failed={Boolean(analyticsQuery.error)}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Visual Analytics Charts ──────────────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-2" aria-label="Application charts">
        <ChartCard title="Applications by Status" subtitle="Breakdown across active bid stages">
          {analytics?.applications_by_status.some((row) => row.count > 0) ? (
            <div role="img" aria-label="Applications grouped by status" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.applications_by_status.filter((row) => row.count > 0)}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={3}
                    label={({ name, value }) => `${humanize(String(name))}: ${value}`}
                  >
                    {analytics.applications_by_status
                      .filter((row) => row.count > 0)
                      .map((row, index) => (
                        <Cell
                          key={row.status}
                          fill={chartColors[index % chartColors.length]}
                          stroke="transparent"
                        />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderRadius: "10px",
                      borderColor: "var(--color-border)",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value) => [value, "Applications"]}
                  />
                  <Legend formatter={(value) => humanize(String(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No applications found for this filter."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>

        <ChartCard title="Applications by IPO" subtitle="Top issues with active demat applications">
          {analytics?.applications_by_ipo.length ? (
            <div role="img" aria-label="Top IPOs by application count" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.applications_by_ipo} margin={{ bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="symbol"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={55}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderRadius: "10px",
                      borderColor: "var(--color-border)",
                    }}
                    formatter={(value) => [value, "Applications"]}
                  />
                  <Bar dataKey="count" name="Applications" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No IPO application data available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Applications by Category"
          subtitle="Retail vs HNI (sNII / bNII) quota volume"
        >
          {analytics?.applications_by_category.length ? (
            <div role="img" aria-label="Applications by category" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.applications_by_category.map((row) => ({
                    ...row,
                    category_label: categoryLabel(row.category),
                  }))}
                  margin={{ bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="category_label"
                    angle={-15}
                    textAnchor="end"
                    height={55}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderRadius: "10px",
                      borderColor: "var(--color-border)",
                    }}
                    formatter={(value) => [value, "Applications"]}
                  />
                  <Bar dataKey="count" name="Applications" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No category distribution available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Monthly Application Trend"
          subtitle="Application creation cadence over time"
        >
          {analytics?.monthly_application_trends.some((row) => row.count > 0) ? (
            <div role="img" aria-label="Monthly application trend" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.monthly_application_trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderRadius: "10px",
                      borderColor: "var(--color-border)",
                    }}
                    formatter={(value) => [value, "Applications"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Applications"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#2563EB" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No application trends available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>
      </section>

      {/* ─── Capital Utilization & Demat Account Analytics ───────────────── */}
      <section className="grid gap-6 xl:grid-cols-2" aria-label="Capital utilization charts">
        {(analytics?.capital_utilization_trends ?? []).length ? (
          groupCapitalTrends(analytics!.capital_utilization_trends).map(([currency, rows]) => (
            <ChartCard
              key={currency}
              title={`Capital Utilization · ${currency}`}
              subtitle="Blocked, released, debited, and refunded ledger totals"
            >
              <div role="img" aria-label={`Capital movements in ${currency}`} className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows.map(chartCapitalValues)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        borderRadius: "10px",
                        borderColor: "var(--color-border)",
                      }}
                      formatter={(value) => [value, "Amount"]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="capital_blocked"
                      name="Blocked"
                      stroke="#D97706"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="capital_released"
                      name="Released"
                      stroke="#64748B"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual_debit"
                      name="Actual Debit"
                      stroke="#2563EB"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="refund_received"
                      name="Refund Received"
                      stroke="#059669"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted">
                Blocked funds are tracked via ASBA hold events. Debits are executed upon allotment.
              </p>
            </ChartCard>
          ))
        ) : (
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Capital Utilization Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalyticsStateMessage
                label="No capital ledger movements found for this filter."
                loading={analyticsQuery.isLoading}
                failed={Boolean(analyticsQuery.error)}
              />
            </CardContent>
          </Card>
        )}

        <ChartCard
          title="Applications by Demat Account"
          subtitle="Bid distribution across demat accounts"
        >
          {analytics?.applications_by_account.length ? (
            <div role="img" aria-label="Applications by demat account" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.applications_by_account} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="masked_demat_identifier"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={65}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderRadius: "10px",
                      borderColor: "var(--color-border)",
                    }}
                    formatter={(value) => [value, "Applications"]}
                  />
                  <Bar dataKey="count" name="Applications" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No demat-specific application data available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>
      </section>

      {/* ─── Operational Tables & Upcoming Activity ───────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-2" aria-label="Broker and upcoming activity">
        {/* Broker Breakdown */}
        <Card hoverable className="border-border/80">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-action" />
              <CardTitle>Broker-Wise Application Volume</CardTitle>
            </div>
            <CardDescription>Bids grouped by executing depository participant</CardDescription>
          </CardHeader>
          <CardContent noPadding>
            {analytics?.applications_by_broker.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas/40 text-xs font-semibold uppercase text-muted">
                      <th scope="col" className="px-5 py-3">
                        Broker
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Applications
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {analytics.applications_by_broker.map((row) => (
                      <tr key={row.broker_name} className="hover:bg-canvas/30 transition-colors">
                        <td className="px-5 py-3 font-semibold text-ink flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/5 text-xs font-bold text-navy">
                            {row.broker_name.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{row.broker_name}</span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular text-navy">
                          {row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <AnalyticsStateMessage
                  label="No broker data is available."
                  loading={analyticsQuery.isLoading}
                  failed={Boolean(analyticsQuery.error)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming IPOs */}
        <Card hoverable className="border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-action" />
                <CardTitle>Upcoming IPO Closing Dates</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/ipo-calendar">
                  <span>Calendar</span>
                  <ChevronRight size={13} />
                </Link>
              </Button>
            </div>
            <CardDescription>Active issues nearing their application deadline</CardDescription>
          </CardHeader>
          <CardContent noPadding>
            {analytics?.upcoming_ipos.length ? (
              <ul className="divide-y divide-border/60">
                {analytics.upcoming_ipos.map((ipo) => (
                  <li
                    key={ipo.ipo_id}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-canvas/30 transition-colors"
                  >
                    <div>
                      <Link
                        className="font-semibold text-ink hover:text-action transition-colors"
                        to={`/ipos/${ipo.ipo_id}`}
                      >
                        {ipo.company_name} ({ipo.symbol})
                      </Link>
                      <p className="mt-0.5 text-xs text-muted flex items-center gap-2">
                        <StatusBadge status={ipo.status} />
                        <span>·</span>
                        <span>
                          {ipo.data_source === "MANUAL" ? "Self-maintained" : "System record"}
                        </span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-md bg-action/10 px-2 py-1 text-xs font-semibold text-action tabular">
                        <Clock size={12} />
                        <span>{formatDate(ipo.closing_date)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <AnalyticsStateMessage
                  label="No upcoming IPO closing dates found."
                  loading={analyticsQuery.isLoading}
                  failed={Boolean(analyticsQuery.error)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Recent Application Activity ──────────────────────────────────── */}
      <Card hoverable className="border-border/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Recent Application Activity</CardTitle>
              <CardDescription>
                Newest active application submissions across your demats
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5 bg-surface text-xs">
              <Link to="/applications/list">
                <span>View all applications</span>
                <ChevronRight size={14} />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent noPadding>
          {analytics?.recent_applications.length ? (
            <ul className="divide-y divide-border/60">
              {analytics.recent_applications.map((application) => (
                <li
                  key={application.application_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-canvas/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/10 text-action font-bold text-xs">
                      {application.symbol.slice(0, 3)}
                    </span>
                    <div>
                      <Link
                        className="font-semibold text-ink hover:text-action transition-colors"
                        to={`/applications/${application.application_id}`}
                      >
                        {application.company_name} ({application.symbol})
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="font-medium text-navy">
                          {categoryLabel(application.category)}
                        </span>
                        {" • "}
                        <span>{application.holder_name}</span>
                        {" • "}
                        <span className="font-mono">{application.masked_demat_identifier}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <StatusBadge status={application.status} />
                    <time
                      className="text-xs text-muted tabular hidden sm:inline"
                      dateTime={application.created_at}
                    >
                      {formatDateTime(application.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6">
              <AnalyticsStateMessage
                label="No recent application activity is available."
                loading={analyticsQuery.isLoading}
                failed={Boolean(analyticsQuery.error)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reusable Helper Components ──────────────────────────────────────────────

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card hoverable className="border-border/80">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
          {icon && <span className="shrink-0">{icon}</span>}
        </div>
        <p className="mt-2 text-2xl font-bold tabular text-navy tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted truncate">{detail}</p>
      </CardContent>
    </Card>
  );
}

function MoneyMetric({
  label,
  value,
  currency,
  unavailable = false,
  accent,
}: {
  label: string;
  value: string | null | undefined;
  currency: string;
  unavailable?: boolean;
  accent?: "blocked" | "debit" | "pending" | "received";
}) {
  const accentBorder = accent
    ? {
        blocked: "border-l-4 border-l-action-amber",
        debit: "border-l-4 border-l-action",
        pending: "border-l-4 border-l-danger",
        received: "border-l-4 border-l-action-emerald",
      }[accent]
    : "";

  return (
    <div className={`rounded-xl border border-border/70 bg-canvas/40 p-3.5 ${accentBorder}`}>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-bold tabular text-navy">
        {unavailable || value === null || value === undefined
          ? "Unavailable"
          : exactMoney(value, currency)}
      </dd>
    </div>
  );
}

function OutcomeTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "info" | "muted" | "action";
}) {
  const borderVariants = {
    success: "border-action-emerald/30 bg-action-emerald/5 text-action-emerald",
    info: "border-sky-500/30 bg-sky-50 text-sky-700",
    muted: "border-slate-300 bg-canvas text-slate-600",
    action: "border-action/30 bg-action/5 text-action",
  };

  return (
    <div className={`rounded-xl border p-3 ${borderVariants[variant]}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular text-ink">{value}</dd>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card hoverable className="border-border/80">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyMessage({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-canvas/40 p-6 text-center text-sm text-muted">
      {label}
    </div>
  );
}

function AnalyticsStateMessage({
  label,
  loading,
  failed,
}: {
  label: string;
  loading: boolean;
  failed: boolean;
}) {
  if (loading) return <LoadingState label="Loading analytics…" inline />;
  if (failed) return <EmptyMessage label="Analytics section unavailable." />;
  return <EmptyMessage label={label} />;
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div
      className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm font-medium text-danger"
      role="alert"
    >
      {error instanceof Error ? error.message : "Dashboard data could not be loaded."}
    </div>
  );
}

function exactMoney(value: string, currency: string): string {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return "Unavailable";
  const [whole, fraction] = value.split(".");
  const groupedWhole = BigInt(whole!).toLocaleString("en-IN");
  return `${currency} ${groupedWhole}${fraction ? `.${fraction}` : ""}`;
}

function categoryLabel(category: string): string {
  return category === "SHAREHOLDER" ? "Shareholder" : category;
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function groupCapitalTrends(
  rows: DashboardAnalytics["capital_utilization_trends"],
): Array<[string, DashboardAnalytics["capital_utilization_trends"]]> {
  const byCurrency = new Map<string, DashboardAnalytics["capital_utilization_trends"]>();
  for (const row of rows) {
    const currencyRows = byCurrency.get(row.currency) ?? [];
    currencyRows.push(row);
    byCurrency.set(row.currency, currencyRows);
  }
  return [...byCurrency.entries()];
}

function chartCapitalValues(row: DashboardAnalytics["capital_utilization_trends"][number]) {
  return {
    ...row,
    capital_blocked: Number(row.capital_blocked),
    capital_released: Number(row.capital_released),
    actual_debit: Number(row.actual_debit),
    refund_received: Number(row.refund_received),
  };
}
