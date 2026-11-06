import { userQueryKey } from "../lib/queryKeys";
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
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Select as CustomSelect } from "../components/ui/Input";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  TrendingUp,
} from "lucide-react";
import type {
  DashboardAnalytics,
  DematAccount,
  IpoCatalogRecord,
  IpoRecord,
} from "@ipo-mania/shared";
import { useAuth } from "../auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { StatusBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/LoadingState";
import { SkeletonStatCard } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastContext";
import { ApiRequestError, apiRequest, downloadApiFile } from "../lib/api";
import { WelcomePage } from "./WelcomePage";
import { FilterDrawer, FilterSection } from "../components/filters/FilterDrawer";
import { DateRangePicker } from "../components/filters/DateRangePicker";
import { useAppDispatch, useAppSelector } from "../store";
import {
  emptyDashboardFilters,
  setDashboardFilters,
  type DashboardFilters,
} from "../store/slices/dashboardFiltersSlice";

type AnalyticsResponse = { data: DashboardAnalytics };
type IpoOptionsResponse = {
  data: {
    ipos: Array<IpoRecord | IpoCatalogRecord>;
    pagination?: { page: number; total_pages: number };
  };
};
type AccountOptionsResponse = {
  data: {
    accounts: DematAccount[];
    pagination?: { page: number; totalPages: number };
  };
};
type Filters = DashboardFilters;
const emptyFilters = emptyDashboardFilters;

const selectClass =
  "min-h-touch w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/20 focus-visible:border-action";
const chartColors = ["#4F46E5", "#0D9488", "#F59E0B", "#F43F5E", "#8B5CF6", "#06B6D4"];

export function DashboardHomePage() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingState label="Restoring your session" />;
  return user ? <DashboardPage /> : <WelcomePage />;
}

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { notify } = useToast();
  const { session, markSessionExpired } = useAuth();
  const filters = useAppSelector((state) => state.dashboardFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportError, setExportError] = useState("");
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [filters]);

  const analyticsQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["analytics", queryString]),
    enabled: Boolean(session),
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      apiRequest<AnalyticsResponse>(
        `/api/analytics${queryString ? `?${queryString}` : ""}`,
        session!,
        { signal },
      ),
  });
  const ipoOptionsQuery = useInfiniteQuery({
    queryKey: userQueryKey(session?.user?.id, ["analytics", "personal-ipo-options"]),
    enabled: Boolean(session),
    staleTime: 60_000,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<IpoOptionsResponse>(`/api/ipos?page=${pageParam}&page_size=100`, session!, {
        signal,
      }),
    getNextPageParam: (lastPage) => {
      const { page, total_pages: totalPages } = lastPage.data.pagination ?? {};
      return page && totalPages && page < totalPages ? page + 1 : undefined;
    },
  });
  const catalogOptionsQuery = useInfiniteQuery({
    queryKey: userQueryKey(session?.user?.id, ["analytics", "catalog-ipo-options"]),
    enabled: Boolean(session),
    staleTime: 60_000,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<IpoOptionsResponse>(
        `/api/ipos/catalog?page=${pageParam}&page_size=100`,
        session!,
        {
          signal,
        },
      ),
    getNextPageParam: (lastPage) => {
      const { page, total_pages: totalPages } = lastPage.data.pagination ?? {};
      return page && totalPages && page < totalPages ? page + 1 : undefined;
    },
  });
  const accountOptionsQuery = useInfiniteQuery({
    queryKey: userQueryKey(session?.user?.id, ["analytics", "account-options"]),
    enabled: Boolean(session),
    staleTime: 60_000,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<AccountOptionsResponse>(`/api/accounts?page=${pageParam}&pageSize=100`, session!, {
        signal,
      }),
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
    onSuccess: (_result, format) =>
      notify({ title: `${format.toUpperCase()} report downloaded`, tone: "success" }),
    onError: (error) => {
      const message = error instanceof Error ? error.message : "The report could not be exported.";
      setExportError(message);
      notify({ title: "Report export failed", description: message, tone: "error" });
    },
  });

  const queryError =
    analyticsQuery.error ??
    ipoOptionsQuery.error ??
    catalogOptionsQuery.error ??
    accountOptionsQuery.error;
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
  const optionsError =
    ipoOptionsQuery.error ?? catalogOptionsQuery.error ?? accountOptionsQuery.error;

  function analyticsCount(value: number | undefined): string {
    if (analyticsQuery.error || value === undefined) return "Unavailable";
    return String(value);
  }

  function updateDraftFilter(key: keyof Filters, value: string) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const invalidDateRange = Boolean(
    draftFilters.date_from && draftFilters.date_to && draftFilters.date_from > draftFilters.date_to,
  );

  return (
    <div className="min-w-0 w-full space-y-8 animate-fade-in">
      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-950 via-indigo-800 to-teal-700 px-5 py-6 text-white shadow-lg sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 right-28 h-24 w-24 rounded-full bg-teal-300/20 blur-xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-indigo-50 backdrop-blur">
              <TrendingUp size={13} />
              <span>PORTFOLIO INTELLIGENCE</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Dashboard &amp; Analytics
            </h1>
            <p className="mt-2 max-w-xl text-sm text-indigo-100">
              Unified view of applications, demat accounts, and tracked IPOs.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 hover:text-white"
              onClick={() => {
                setDraftFilters(filters);
                setFiltersOpen(true);
              }}
            >
              <Filter size={15} />
              <span>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 hover:text-white"
              loading={exportMutation.isPending}
              disabled={exportMutation.isPending || !analytics}
              onClick={() => exportMutation.mutate("csv")}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 border border-white bg-white text-indigo-950 shadow-md hover:bg-indigo-50"
              loading={exportMutation.isPending}
              disabled={exportMutation.isPending || !analytics}
              onClick={() => exportMutation.mutate("xlsx")}
            >
              <FileSpreadsheet size={15} />
              <span>Export Excel</span>
            </Button>
          </div>
        </div>
      </div>

      <FilterDrawer
        open={filtersOpen}
        activeCount={Object.values(draftFilters).filter(Boolean).length}
        description="Refine dashboard analytics and downloadable reports."
        onClose={() => setFiltersOpen(false)}
        onReset={() => setDraftFilters(emptyFilters)}
        onApply={() => {
          dispatch(setDashboardFilters(draftFilters));
          setFiltersOpen(false);
        }}
        applyDisabled={invalidDateRange}
      >
        <div className="space-y-5">
          <FilterSection title="Date range">
            <DateRangePicker
              from={draftFilters.date_from}
              to={draftFilters.date_to}
              onFromChange={(value) => updateDraftFilter("date_from", value)}
              onToChange={(value) => updateDraftFilter("date_to", value)}
            />
          </FilterSection>
          <FilterSection title="My IPO">
            <CustomSelect
              aria-label="My IPO filter"
              className={selectClass}
              value={draftFilters.ipo_id}
              onChange={(event) => updateDraftFilter("ipo_id", event.target.value)}
            >
              <option value="">All my IPOs</option>
              {ipoOptions.map((ipo) => (
                <option key={ipo.id} value={ipo.id}>
                  {ipo.company_name}
                </option>
              ))}
            </CustomSelect>
          </FilterSection>
          <FilterSection title="Shared IPO">
            <CustomSelect
              aria-label="Shared IPO filter"
              className={selectClass}
              value={draftFilters.catalog_ipo_id}
              onChange={(event) => updateDraftFilter("catalog_ipo_id", event.target.value)}
            >
              <option value="">All shared IPOs</option>
              {catalogOptions.map((ipo) => (
                <option key={ipo.id} value={ipo.id}>
                  {ipo.company_name}
                </option>
              ))}
            </CustomSelect>
          </FilterSection>
          <FilterSection title="Bid category">
            <CustomSelect
              aria-label="Category filter"
              className={selectClass}
              value={draftFilters.category}
              onChange={(event) => updateDraftFilter("category", event.target.value)}
            >
              <option value="">All categories</option>
              {["RETAIL", "SHNI", "BHNI", "SHAREHOLDER", "EMPLOYER"].map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </CustomSelect>
          </FilterSection>
          <FilterSection title="Demat account">
            <CustomSelect
              aria-label="Demat account filter"
              className={selectClass}
              value={draftFilters.account_id}
              onChange={(event) => updateDraftFilter("account_id", event.target.value)}
            >
              <option value="">All accounts</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.holder_name} · {account.bank_name ?? "Bank not provided"} (
                  {account.username ?? "Username not provided"})
                </option>
              ))}
            </CustomSelect>
          </FilterSection>
        </div>
      </FilterDrawer>

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
        aria-busy={analyticsQuery.isLoading}
      >
        {analyticsQuery.isLoading ? (
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
              accent="indigo"
            />
            <MetricCard
              label="Demat Accounts"
              value={analyticsCount(analytics?.totals.active_demat_accounts)}
              detail="Active demat units"
              icon={<BriefcaseBusiness size={18} className="text-action-emerald" />}
              accent="teal"
            />
            <MetricCard
              label="Tracked IPOs"
              value={analyticsCount(analytics?.totals.tracked_ipos)}
              detail="My saved IPOs"
              icon={<TrendingUp size={18} className="text-action" />}
              accent="amber"
            />
            <MetricCard
              label="Shared IPOs"
              value={analyticsCount(analytics?.catalog.total)}
              detail="Admin managed catalog"
              icon={<TrendingUp size={18} className="text-action" />}
              accent="violet"
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
                  <li
                    key={ipo.ipo_id}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <Link
                        className="font-semibold text-ink hover:text-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                        to={`/ipos/catalog/${ipo.ipo_id}`}
                        state={{ from: `${location.pathname}${location.search}` }}
                      >
                        {ipo.company_name}
                        {ipo.symbol ? ` (${ipo.symbol})` : ""}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {ipo.issue_type === "SME" ? "SME" : "Mainboard"} ·{" "}
                        {ipo.exchange ?? "Exchange not published"} · {ipo.data_source}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Price band:{" "}
                        {ipo.price_band_min && ipo.price_band_max
                          ? `₹${ipo.price_band_min}–₹${ipo.price_band_max}`
                          : "Not published"}{" "}
                        · Lot size: {ipo.lot_size ?? "Not published"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end">
                      <StatusBadge status={ipo.status} />
                      <span className="text-muted">
                        {ipo.opening_date ? formatDate(ipo.opening_date) : "Opening not published"}{" "}
                        →{" "}
                        {ipo.closing_date ? formatDate(ipo.closing_date) : "Closing not published"}
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
                  <Tooltip content={<DashboardChartTooltip kind="status" />} />
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E9F2" />
                  <XAxis
                    dataKey="symbol"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={55}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<DashboardChartTooltip kind="ipo" />} />
                  <Bar dataKey="count" name="Applications" fill="#4F46E5" radius={[4, 4, 0, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E9F2" />
                  <XAxis
                    dataKey="category_label"
                    angle={-15}
                    textAnchor="end"
                    height={55}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<DashboardChartTooltip kind="category" />} />
                  <Bar dataKey="count" name="Applications" fill="#0D9488" radius={[4, 4, 0, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E9F2" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<DashboardChartTooltip kind="month" />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Applications"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#4F46E5" }}
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E9F2" />
                  <XAxis
                    dataKey="bank_name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={65}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<DashboardChartTooltip kind="account" />} />
                  <Bar dataKey="count" name="Applications" fill="#312E81" radius={[4, 4, 0, 0]} />
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
      <section className="grid gap-6" aria-label="Upcoming activity">
        <Card hoverable className="border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-action" />
                <CardTitle>Upcoming IPO Closing Dates</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/ipos">
                  <span>Browse IPOs</span>
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
                        to={
                          ipo.source === "catalog"
                            ? `/ipos/catalog/${ipo.ipo_id}`
                            : `/ipos/${ipo.ipo_id}`
                        }
                        state={{ from: `${location.pathname}${location.search}` }}
                      >
                        {ipo.company_name}
                        {ipo.symbol ? ` (${ipo.symbol})` : ""}
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
              <Link to="/applications">
                <span>View all applications</span>
                <ChevronRight size={14} />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent noPadding>
          {analytics?.recent_applications.length ? (
            <ul className="divide-y divide-border/60">
              {analytics.recent_applications.map((application) => {
                const symbol = application.symbol?.trim();
                return (
                  <li
                    key={application.application_id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-canvas/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/10 text-action font-bold text-xs">
                        {symbol?.slice(0, 3) || application.company_name.slice(0, 3).toUpperCase()}
                      </span>
                      <div>
                        <Link
                          className="font-semibold text-ink hover:text-action transition-colors"
                          to={`/applications/${application.application_id}`}
                          state={{ from: `${location.pathname}${location.search}` }}
                        >
                          {application.company_name}
                          {symbol ? ` (${symbol})` : ""}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          <span className="font-medium text-navy">
                            {categoryLabel(application.category)}
                          </span>
                          {" • "}
                          <span>{application.holder_name}</span>
                          {" • "}
                          <span className="font-mono">{application.bank_name}</span>
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
                );
              })}
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
  accent = "indigo",
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ReactNode;
  accent?: "indigo" | "teal" | "amber" | "violet";
}) {
  const accentClasses = {
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
  };
  return (
    <Card
      hoverable
      className="group overflow-hidden border-border/80 bg-gradient-to-br from-white to-slate-50/70"
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
          {icon && (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${accentClasses[accent]} transition-transform duration-200 group-hover:scale-105`}
            >
              {icon}
            </span>
          )}
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

type DashboardChartTooltipKind = "status" | "ipo" | "category" | "month" | "account";

type DashboardChartTooltipProps = Pick<TooltipProps<number, string>, "active" | "payload"> & {
  kind: DashboardChartTooltipKind;
};

export function DashboardChartTooltip({ active, payload, kind }: DashboardChartTooltipProps) {
  const entry = payload?.[0];
  if (!active || !entry || typeof entry.value !== "number" || !Number.isFinite(entry.value)) {
    return null;
  }

  const row = isRecord(entry.payload) ? entry.payload : {};
  const field = (name: string) => (typeof row[name] === "string" ? row[name] : "");
  let title = "";
  let detail: string | undefined;

  switch (kind) {
    case "status":
      title = humanize(field("status"));
      break;
    case "ipo":
      title = field("company_name") || "IPO";
      detail = field("symbol") ? `Symbol: ${field("symbol")}` : undefined;
      break;
    case "category":
      title = categoryLabel(field("category"));
      break;
    case "month":
      title = formatMonth(field("month"));
      break;
    case "account":
      title = field("bank_name") || "Demat account";
      detail = field("holder_name") ? `Account holder: ${field("holder_name")}` : undefined;
      break;
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink shadow-lg">
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
      <p className="mt-1 tabular">
        <span className="font-medium">{entry.value === 1 ? "Application" : "Applications"}: </span>
        {new Intl.NumberFormat().format(entry.value)}
      </p>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  if (loading) return <LoadingState label="Loading analytics" inline />;
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

function formatMonth(value: string): string {
  const month = Number(value.slice(5, 7));
  const date = new Date(`${value}-01T00:00:00Z`);
  if (!/^\d{4}-\d{2}$/.test(value) || month < 1 || month > 12 || Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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
