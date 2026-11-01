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
import type {
  CapitalSummary,
  DashboardAnalytics,
  DematAccount,
  IpoRecord,
} from "@ipo-mania/shared";
import { useAuth } from "../auth/useAuth";
import { Card } from "../components/ui/Card";
import { LoadingState } from "../components/LoadingState";
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
const inputClass =
  "mt-1 min-h-touch w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";
const chartColors = ["#245A8D", "#237A4B", "#A66A13", "#B42318", "#526071", "#294C73"];

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

  function analyticsCount(value: number | undefined): string {
    if (analyticsQuery.isLoading) return "Loading…";
    if (analyticsQuery.error || value === undefined) return "Unavailable";
    return String(value);
  }

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-action">
            IPO Mania overview
          </p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Dashboard &amp; analytics</h1>
          <p className="mt-2 text-lg text-muted">
            Your private application, account, allotment, and capital activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-touch rounded-lg border border-border bg-white px-4 py-2 font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy disabled:opacity-50"
            disabled={exportMutation.isPending || !analytics}
            onClick={() => exportMutation.mutate("csv")}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="min-h-touch rounded-lg bg-action px-4 py-2 font-semibold text-white hover:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy disabled:opacity-50"
            disabled={exportMutation.isPending || !analytics}
            onClick={() => exportMutation.mutate("xlsx")}
          >
            Export Excel
          </button>
        </div>
      </header>

      <Card className="min-w-0">
        <h2 className="text-lg font-bold text-ink">Filter analytics</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-semibold text-ink">
            From date
            <input
              aria-label="From date"
              className={inputClass}
              type="date"
              value={filters.date_from}
              onChange={(event) => updateFilter("date_from", event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            To date
            <input
              aria-label="To date"
              className={inputClass}
              type="date"
              value={filters.date_to}
              onChange={(event) => updateFilter("date_to", event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            IPO
            <select
              aria-label="IPO filter"
              className={inputClass}
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
                className="mt-1 min-h-touch text-sm font-semibold text-action underline"
                disabled={ipoOptionsQuery.isFetchingNextPage}
                onClick={() => void ipoOptionsQuery.fetchNextPage()}
              >
                {ipoOptionsQuery.isFetchingNextPage ? "Loading…" : "Load more IPO options"}
              </button>
            ) : null}
          </label>
          <label className="text-sm font-semibold text-ink">
            Category
            <select
              aria-label="Category filter"
              className={inputClass}
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
          </label>
          <label className="text-sm font-semibold text-ink">
            Demat account
            <select
              aria-label="Demat account filter"
              className={inputClass}
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
                className="mt-1 min-h-touch text-sm font-semibold text-action underline"
                disabled={accountOptionsQuery.isFetchingNextPage}
                onClick={() => void accountOptionsQuery.fetchNextPage()}
              >
                {accountOptionsQuery.isFetchingNextPage ? "Loading…" : "Load more accounts"}
              </button>
            ) : null}
          </label>
        </div>
        <button
          type="button"
          className="mt-3 min-h-touch text-sm font-semibold text-action underline"
          onClick={() => setFilters(emptyFilters)}
        >
          Clear filters
        </button>
        <p className="mt-2 text-sm text-muted">
          Date filters apply to application creation dates and capital ledger effective dates.
          Account and IPO totals show your current inventory.
        </p>
      </Card>

      {queryError ? <ErrorNotice error={queryError} /> : null}
      {optionsError && optionsError !== queryError ? <ErrorNotice error={optionsError} /> : null}
      {exportError ? (
        <p className="rounded-lg border border-danger bg-white p-3 text-danger" role="alert">
          {exportError}
        </p>
      ) : null}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Dashboard totals"
        aria-busy={loading}
      >
        <MetricCard
          label="IPO applications"
          value={analyticsCount(analytics?.totals.applications)}
          detail="Active, non-archived records"
        />
        <MetricCard
          label="Active demat accounts"
          value={analyticsCount(analytics?.totals.active_demat_accounts)}
          detail="Current active accounts"
        />
        <MetricCard
          label="IPOs tracked"
          value={analyticsCount(analytics?.totals.tracked_ipos)}
          detail="Active, non-archived records"
        />
        <MetricCard
          label="Allotments"
          value={analyticsCount(analytics?.allotment_performance.total)}
          detail="Recorded outcomes"
        />
        <MetricCard
          label="Allotment success rate"
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
              ? `${analytics.allotment_performance.successful} positive allotments`
              : "No recorded allotment results"
          }
        />
        <MetricCard
          label="Pending refunds"
          value={analyticsCount(analytics?.refund_performance.pending)}
          detail="Recorded allotments awaiting refund"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2" aria-label="Capital summary">
        {currencies.length ? (
          currencies.map((currency) => {
            const summary = capitalSummaries.find((item) => item.currency === currency);
            const ledger = capitalEvents.find((item) => item.currency === currency);
            const listingEvents =
              (ledger?.listing_sales ?? 0) + (ledger?.listing_price_updates ?? 0);
            return (
              <Card key={currency}>
                <h2 className="text-xl font-bold text-navy">{currency} capital</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <MoneyMetric
                    label="Currently blocked"
                    value={summary?.currently_blocked_capital}
                    currency={currency}
                    unavailable={!summary || !ledger?.capital_block_events}
                  />
                  <MoneyMetric
                    label="Actual capital debited"
                    value={ledger?.actual_debit}
                    currency={currency}
                    unavailable={!ledger?.actual_debit_events}
                  />
                  <MoneyMetric
                    label="Refunds pending"
                    value={summary?.outstanding_refunds}
                    currency={currency}
                    unavailable={!summary || !analytics?.refund_performance.total}
                  />
                  <MoneyMetric
                    label="Refunds completed"
                    value={summary?.refunds_received}
                    currency={currency}
                    unavailable={!summary || !analytics?.refund_performance.total}
                  />
                  <MoneyMetric
                    label="Realized listing P&amp;L"
                    value={summary?.realized_pnl}
                    currency={currency}
                    unavailable={!summary || listingEvents === 0}
                  />
                  <MoneyMetric
                    label="Unrealized listing P&amp;L"
                    value={summary?.unrealized_pnl}
                    currency={currency}
                    unavailable={!summary || summary.unrealized_pnl === null || listingEvents === 0}
                  />
                </dl>
                <p className="mt-4 text-sm text-muted">
                  Blocked capital is held, not spent. Debits are gross cash outflows; refunds are
                  shown separately. Listing P&amp;L uses saved allotment and ledger data only.
                </p>
              </Card>
            );
          })
        ) : (
          <Card>
            <h2 className="text-xl font-bold text-navy">Capital activity</h2>
            <p className="mt-2 text-muted">
              {capitalQuery.isLoading
                ? "Loading capital summary…"
                : capitalQuery.error
                  ? "Unavailable: capital summary could not be loaded."
                  : "Unavailable: no capital records."}
            </p>
          </Card>
        )}
        <Card>
          <h2 className="text-xl font-bold text-navy">Allotment and refund performance</h2>
          {analytics?.allotment_performance.total ? (
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <CountMetric label="Full allotments" value={analytics.allotment_performance.full} />
              <CountMetric
                label="Partial allotments"
                value={analytics.allotment_performance.partial}
              />
              <CountMetric label="No allotment" value={analytics.allotment_performance.none} />
              <CountMetric
                label="Refunds completed"
                value={analytics.refund_performance.completed}
              />
            </dl>
          ) : (
            <AnalyticsStateMessage
              label="No allotment results are available for this filter."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2" aria-label="Application charts">
        <ChartCard title="Applications by status">
          {analytics?.applications_by_status.some((row) => row.count > 0) ? (
            <div
              role="img"
              aria-label="Applications grouped by application status"
              className="h-72"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.applications_by_status.filter((row) => row.count > 0)}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${humanize(String(name))}: ${value}`}
                  >
                    {analytics.applications_by_status
                      .filter((row) => row.count > 0)
                      .map((row, index) => (
                        <Cell
                          key={row.status}
                          aria-hidden="true"
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Applications"]} />
                  <Legend formatter={(value) => humanize(String(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No applications are available for this filter."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>

        <ChartCard title="Applications by IPO">
          {analytics?.applications_by_ipo.length ? (
            <div role="img" aria-label="Top IPOs by application count" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.applications_by_ipo} margin={{ bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" angle={-25} textAnchor="end" interval={0} height={55} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, "Applications"]} />
                  <Bar dataKey="count" name="Applications" fill="#245A8D" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No IPO application data is available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>

        <ChartCard title="Applications by category">
          {analytics?.applications_by_category.length ? (
            <div
              role="img"
              aria-label="Applications by Retail, SHNI, BHNI and Shareholder category"
              className="h-72"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.applications_by_category.map((row) => ({
                    ...row,
                    category_label: categoryLabel(row.category),
                  }))}
                  margin={{ bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category_label" angle={-15} textAnchor="end" height={55} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, "Applications"]} />
                  <Bar dataKey="count" name="Applications" fill="#237A4B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No category data is available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>

        <ChartCard title="Monthly application trend">
          {analytics?.monthly_application_trends.some((row) => row.count > 0) ? (
            <div role="img" aria-label="Monthly application count trend" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.monthly_application_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, "Applications"]} />
                  <Line type="monotone" dataKey="count" name="Applications" stroke="#245A8D" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No application trend data is available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2" aria-label="Capital utilization charts">
        {(analytics?.capital_utilization_trends ?? []).length ? (
          groupCapitalTrends(analytics!.capital_utilization_trends).map(([currency, rows]) => (
            <ChartCard key={currency} title={`Capital utilization · ${currency}`}>
              <div
                role="img"
                aria-label={`Blocked, released, debited and refunded ledger event totals in ${currency}`}
                className="h-72"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows.map(chartCapitalValues)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, "Amount (chart scale)"]} />
                    <Legend />
                    <Line dataKey="capital_blocked" name="Blocked" stroke="#A66A13" />
                    <Line dataKey="capital_released" name="Released" stroke="#526071" />
                    <Line dataKey="actual_debit" name="Actual debit" stroke="#245A8D" />
                    <Line dataKey="refund_received" name="Refund received" stroke="#237A4B" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-sm text-muted">
                Separate event totals; blocked amounts are not added to actual debits. Chart scale
                is approximate; exact decimal strings are in the export.
              </p>
            </ChartCard>
          ))
        ) : (
          <Card>
            <h2 className="text-xl font-bold text-navy">Capital utilization trend</h2>
            <AnalyticsStateMessage
              label="No capital ledger activity is available for this filter."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          </Card>
        )}
        <ChartCard title="Applications by demat account">
          {analytics?.applications_by_account.length ? (
            <div
              role="img"
              aria-label="Application counts by masked demat account"
              className="h-72"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.applications_by_account} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="masked_demat_identifier"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={65}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, "Applications"]} />
                  <Bar dataKey="count" name="Applications" fill="#294C73" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No demat-account application data is available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </ChartCard>
      </section>

      <section
        className="grid gap-4 xl:grid-cols-2"
        aria-label="Broker analytics and upcoming IPOs"
      >
        <Card className="min-w-0">
          <h2 className="text-xl font-bold text-navy">Broker-wise analytics</h2>
          {analytics?.applications_by_broker.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
                <caption className="sr-only">Application counts grouped by broker</caption>
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th scope="col" className="p-3">
                      Broker
                    </th>
                    <th scope="col" className="p-3">
                      Applications
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.applications_by_broker.map((row) => (
                    <tr key={row.broker_name} className="border-b border-border">
                      <th scope="row" className="p-3 font-semibold">
                        {row.broker_name}
                      </th>
                      <td className="p-3 tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AnalyticsStateMessage
              label="No broker data is available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </Card>
        <Card>
          <h2 className="text-xl font-bold text-navy">Upcoming IPO closing dates</h2>
          {analytics?.upcoming_ipos.length ? (
            <ul className="mt-3 divide-y divide-border">
              {analytics.upcoming_ipos.map((ipo) => (
                <li
                  key={ipo.ipo_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <Link
                      className="font-semibold text-action underline"
                      to={`/ipos/${ipo.ipo_id}`}
                    >
                      {ipo.company_name} ({ipo.symbol})
                    </Link>
                    <p className="text-sm text-muted">
                      {humanize(ipo.status)} ·{" "}
                      {ipo.data_source === "MANUAL" ? "Manual, unverified" : "User-entered source"}
                    </p>
                  </div>
                  <time className="font-semibold tabular-nums" dateTime={ipo.closing_date}>
                    Closes {formatDate(ipo.closing_date)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <AnalyticsStateMessage
              label="No upcoming IPO closing dates are available."
              loading={analyticsQuery.isLoading}
              failed={Boolean(analyticsQuery.error)}
            />
          )}
        </Card>
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-navy">Recent application activity</h2>
            <p className="mt-1 text-sm text-muted">Newest active application records.</p>
          </div>
          <Link className="font-semibold text-action underline" to="/applications/list">
            View all applications
          </Link>
        </div>
        {analytics?.recent_applications.length ? (
          <ul className="mt-3 divide-y divide-border">
            {analytics.recent_applications.map((application) => (
              <li
                key={application.application_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <Link
                    className="font-semibold text-action underline"
                    to={`/applications/${application.application_id}`}
                  >
                    {application.company_name} ({application.symbol})
                  </Link>
                  <p className="text-sm text-muted">
                    {categoryLabel(application.category)} · {application.holder_name} ·{" "}
                    {application.masked_demat_identifier}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{humanize(application.status)}</p>
                  <time className="text-sm text-muted" dateTime={application.created_at}>
                    {formatDateTime(application.created_at)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <AnalyticsStateMessage
            label="No recent application activity is available."
            loading={analyticsQuery.isLoading}
            failed={Boolean(analyticsQuery.error)}
          />
        )}
      </Card>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <p className="text-base font-semibold text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-navy">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </Card>
  );
}

function MoneyMetric({
  label,
  value,
  currency,
  unavailable = false,
}: {
  label: string;
  value: string | null | undefined;
  currency: string;
  unavailable?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-bold tabular-nums text-ink">
        {unavailable || value === null || value === undefined
          ? "Unavailable"
          : exactMoney(value, currency)}
      </dd>
    </div>
  );
}

function CountMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 text-xl font-bold text-navy">{title}</h2>
      {children}
    </Card>
  );
}

function EmptyMessage({ label }: { label: string }) {
  return <p className="mt-4 rounded-lg bg-canvas p-4 text-muted">{label}</p>;
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
  if (loading) return <LoadingState label="Loading dashboard data" />;
  if (failed) return <EmptyMessage label="This dashboard section is unavailable." />;
  return <EmptyMessage label={label} />;
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <p className="rounded-lg border border-danger bg-white p-3 text-danger" role="alert">
      {error instanceof Error ? error.message : "Dashboard data could not be loaded."}
    </p>
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
