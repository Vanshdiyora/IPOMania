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
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  TrendingUp,
  X,
} from "lucide-react";
import type { DashboardAnalytics, DematAccount, IpoCatalogRecord, IpoRecord } from "@ipo-mania/shared";
import { useAuth } from "../auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/LoadingState";
import { SkeletonStatCard } from "../components/ui/Skeleton";
import { ApiRequestError, apiRequest, downloadApiFile } from "../lib/api";
import { WelcomePage } from "./WelcomePage";

type AnalyticsResponse = { data: DashboardAnalytics };
type IpoOptionsResponse = {
  data: { ipos: Array<IpoRecord | IpoCatalogRecord>; pagination?: { page: number; total_pages: number } };
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
  catalog_ipo_id: string;
  category: string;
  account_id: string;
};

const emptyFilters: Filters = {
  date_from: "",
  date_to: "",
  ipo_id: "",
  catalog_ipo_id: "",
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
  const ipoOptionsQuery = useInfiniteQuery({
    queryKey: ["analytics", "personal-ipo-options"],
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
  const catalogOptionsQuery = useInfiniteQuery({
    queryKey: ["analytics", "catalog-ipo-options"],
    enabled: Boolean(session),
    staleTime: 60_000,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequest<IpoOptionsResponse>(`/api/ipos/catalog?page=${pageParam}&page_size=100`, session!),
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
    analyticsQuery.error ?? ipoOptionsQuery.error ?? catalogOptionsQuery.error ?? accountOptionsQuery.error;
  useEffect(() => {
    if (queryError instanceof ApiRequestError && queryError.status === 401) {
      markSessionExpired();
    }
  }, [markSessionExpired, queryError]);

  const analytics = analyticsQuery.data?.data;
  const upcomingIpos = [
    ...(analytics?.upcoming_ipos.map((ipo) => ({ ...ipo, source: "personal" as const })) ?? []),
    ...(analytics?.catalog.upcoming.map((ipo) => ({ ...ipo, source: "catalog" as const })) ?? []),
  ].sort((left, right) => left.closing_date.localeCompare(right.closing_date));
  const ipoOptions = ipoOptionsQuery.data?.pages.flatMap((page) => page.data.ipos) ?? [];
  const catalogOptions = catalogOptionsQuery.data?.pages.flatMap((page) => page.data.ipos) ?? [];
  const accountOptions =
    accountOptionsQuery.data?.pages.flatMap((page) => page.data.accounts) ?? [];
  const loading =
    analyticsQuery.isLoading ||
    ipoOptionsQuery.isLoading ||
    catalogOptionsQuery.isLoading ||
    accountOptionsQuery.isLoading;
  const optionsError = ipoOptionsQuery.error ?? catalogOptionsQuery.error ?? accountOptionsQuery.error;

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
    <div className="min-w-0 w-full space-y-8 animate-fade-in">
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
            Unified view of applications, demat accounts, and tracked IPOs.
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
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">From date</label>
              <input
                aria-label="From date"
                className={`${inputClass} min-w-0 max-w-full`}
                type="date"
                value={filters.date_from}
                onChange={(event) => updateFilter("date_from", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">To date</label>
              <input
                aria-label="To date"
                className={`${inputClass} min-w-0 max-w-full`}
                type="date"
                value={filters.date_to}
                onChange={(event) => updateFilter("date_to", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">My IPO</label>
              <select
                aria-label="My IPO filter"
                className={selectClass}
                value={filters.ipo_id}
                onChange={(event) => updateFilter("ipo_id", event.target.value)}
              >
                <option value="">All my IPOs</option>
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
                  {ipoOptionsQuery.isFetchingNextPage ? "Loading…" : "+ Load more my IPOs"}
                </button>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Shared IPO</label>
              <select
                aria-label="Shared IPO filter"
                className={selectClass}
                value={filters.catalog_ipo_id}
                onChange={(event) => updateFilter("catalog_ipo_id", event.target.value)}
              >
                <option value="">All shared IPOs</option>
                {catalogOptions.map((ipo) => (
                  <option key={ipo.id} value={ipo.id}>
                    {ipo.company_name}{ipo.symbol ? ` (${ipo.symbol})` : ""}
                  </option>
                ))}
              </select>
              {catalogOptionsQuery.hasNextPage ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-action hover:underline"
                  disabled={catalogOptionsQuery.isFetchingNextPage}
                  onClick={() => void catalogOptionsQuery.fetchNextPage()}
                >
                  {catalogOptionsQuery.isFetchingNextPage ? "Loading…" : "+ Load more shared IPOs"}
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
            Date, category, account, and My IPO filters scope personal applications. Shared IPO filters
            scope catalog details. Current inventory is shown for accounts and IPOs.
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
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Dashboard totals"
        aria-busy={loading}
      >
        {loading ? (
          <>
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
              detail="My saved IPOs"
              icon={<TrendingUp size={18} className="text-action" />}
            />
            <MetricCard
              label="Shared IPOs"
              value={analyticsCount(analytics?.catalog.total)}
              detail="Admin managed catalog"
              icon={<TrendingUp size={18} className="text-action" />}
            />
          </>
        )}
      </section>

      {/* ─── Visual Analytics Charts ──────────────────────────────────────── */}
      <section className="space-y-4" aria-label="Shared IPO analytics">
        <div>
          <h2 className="text-lg font-bold text-navy">Shared IPO catalog</h2>
          <p className="mt-1 text-sm text-muted">
            Admin managed issue information. Unpublished values remain unavailable.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {analytics?.catalog.by_status.map((row) => (
            <Card key={row.status} className="border-border/80">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {humanize(row.status)} IPOs
                </p>
                <p className="mt-2 text-2xl font-bold tabular text-navy">{row.count}</p>
              </CardContent>
            </Card>
          )) ?? (
            <AnalyticsStateMessage
              label="Shared IPO analytics are unavailable."
              loading={analyticsQuery.isLoading}
              error={analyticsQuery.error}
            />
          )}
        </div>
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>IPO issue details</CardTitle>
            <CardDescription>Current catalog records, with open issues first</CardDescription>
          </CardHeader>
          <CardContent noPadding>
            {analytics?.catalog.issues.length ? (
              <ul className="divide-y divide-border/60">
                {analytics.catalog.issues.map((ipo) => (
                  <li key={ipo.ipo_id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <Link
                        className="font-semibold text-ink hover:text-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                        to={`/ipos/catalog/${ipo.ipo_id}`}
                      >
                        {ipo.company_name}{ipo.symbol ? ` (${ipo.symbol})` : ""}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {ipo.issue_type === "SME" ? "SME" : "Mainboard"} · {ipo.exchange ?? "Exchange not published"} · {ipo.data_source}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Price band: {ipo.price_band_min && ipo.price_band_max
                          ? `₹${ipo.price_band_min}–₹${ipo.price_band_max}`
                          : "Not published"} · Lot size: {ipo.lot_size ?? "Not published"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end">
                      <StatusBadge status={ipo.status} />
                      <span className="text-muted">
                        {ipo.opening_date ? formatDate(ipo.opening_date) : "Opening not published"} → {ipo.closing_date ? formatDate(ipo.closing_date) : "Closing not published"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <AnalyticsStateMessage
                  label="No shared IPO details are available for this filter."
                  loading={analyticsQuery.isLoading}
                  error={analyticsQuery.error}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-2" aria-label="Application charts">
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
                          aria-hidden="true"
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
              error={analyticsQuery.error}
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
              error={analyticsQuery.error}
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
              error={analyticsQuery.error}
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
              error={analyticsQuery.error}
            />
          )}
        </ChartCard>
      </section>

      <section className="grid gap-6" aria-label="Demat account analytics">
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
              error={analyticsQuery.error}
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
                  error={analyticsQuery.error}
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
            {upcomingIpos.length ? (
              <ul className="divide-y divide-border/60">
                {upcomingIpos.map((ipo) => (
                  <li
                    key={`${ipo.source}-${ipo.ipo_id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-canvas/30 transition-colors"
                  >
                    <div>
                      <Link
                        className="font-semibold text-ink hover:text-action transition-colors"
                        to={ipo.source === "catalog" ? `/ipos/catalog/${ipo.ipo_id}` : `/ipos/${ipo.ipo_id}`}
                      >
                        {ipo.company_name}{ipo.symbol ? ` (${ipo.symbol})` : ""}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted flex items-center gap-2">
                        <StatusBadge status={ipo.status} />
                        <span>·</span>
                        <span>
                          {ipo.source === "catalog" ? "Shared catalog" : "Self-maintained"}
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
                  error={analyticsQuery.error}
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
                error={analyticsQuery.error}
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
  error,
}: {
  label: string;
  loading: boolean;
  error?: unknown;
}) {
  if (loading) return <LoadingState label="Loading analytics…" inline />;
  if (error)
    return <EmptyMessage label={sectionErrorMessage(error, "Analytics section unavailable")} />;
  return <EmptyMessage label={label} />;
}

function sectionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
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
