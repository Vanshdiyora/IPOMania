import { userQueryKey } from "../../lib/queryKeys";
import { queryKeys } from "../../lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type {
  DematAccount,
  IpoApplication,
  IpoCategoryCode,
  IpoCatalogCategoryConfiguration,
  IpoCategoryConfiguration,
  IpoCatalogRecord,
  IpoRecord,
  IpoStatus,
} from "@ipo-mania/shared";
import { isIpoReadyForApplication } from "@ipo-mania/shared";
import { ipoCategoryConfigurationSchema } from "@ipo-mania/validation";
import { useAuth } from "../../auth/useAuth";
import { ConfirmButton } from "../../components/ui/ConfirmButton";
import { Button } from "../../components/ui/Button";
import { FormInput, FormSelect } from "../../components/ui/FormControls";
import { Input, Select as CustomSelect } from "../../components/ui/Input";
import { ConfirmationDialog } from "../../components/ui/ConfirmationDialog";
import { DrawerRouteLink, RouteFormDrawer } from "../../components/ui/FormDrawer";
import { useToast } from "../../components/ui/ToastContext";
import { Card } from "../../components/ui/Card";
import { BackLink } from "../../components/ui/BackLink";
import { StatusBadge } from "../../components/ui/Badge";
import { Pagination } from "../../components/ui/Pagination";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/States";
import {
  SkeletonCard,
  SkeletonFormPage,
  SkeletonIpoDetails,
  SkeletonPage,
  Skeleton,
  SkeletonStatCard,
  SkeletonTable,
} from "../../components/ui/Skeleton";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { applicationDrawerPath } from "../../lib/applicationDrawer";
import { toIsoDateTime, toLocalDateTime } from "../../lib/formValues";
import { defaultPageSize, parsePageSize } from "../../lib/pagination";
import { DataTable } from "../../components/ui/DataTable";

type IpoListResponse<T = IpoRecord> = {
  data: {
    ipos: T[];
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
};
type IpoCatalogMetricsResponse = {
  data: {
    total: number;
    status_counts: { upcoming: number; open: number; closed: number; listed: number };
  };
};
type IpoResponse = { data: IpoRecord };
type IpoCategoryResponse = { data: { configurations: IpoCategoryConfiguration[] } };
type IpoCatalogCategoryResponse = {
  data: { configurations: IpoCatalogCategoryConfiguration[] };
};
type IpoCategoryPageResponse = {
  data: { id: string; company_name: string; symbol: string | null; lot_size: number | null };
};
type IpoCategoryPageRulesResponse = {
  data: {
    configurations: Array<IpoCategoryConfiguration | IpoCatalogCategoryConfiguration>;
  };
};
type IpoApplicationsResponse = {
  data: {
    applications: Array<
      IpoApplication & {
        demat_accounts?: { holder_name: string };
        ipo_categories?: { category: IpoCategoryCode };
      }
    >;
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
};
type IpoApplicationWithRelations = IpoApplicationsResponse["data"]["applications"][number];
type IpoApplicationTableRow = {
  account: DematAccount | null;
  application: IpoApplicationWithRelations | null;
};
type AccountListResponse = {
  data: {
    accounts: DematAccount[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  };
};
type CalculationResponse = {
  data: {
    eligible: boolean;
    total_shares: number | null;
    application_amount: string | null;
    category: IpoCategoryCode;
    rule_version: number | null;
    eligibility_verified: false;
    calculation_timestamp?: string;
    calculation_id?: string;
    validation_errors: Array<{ code: string; message: string }>;
  };
};
type QuotaCalculationRequest = {
  ipo_id: string;
  demat_account_id: string;
  category: IpoCategoryCode;
  lots: number;
  price_type: "BID" | "CUT_OFF";
  price: string;
  shareholder_shares: number | null;
  eligibility_answers: Record<string, boolean | null>;
};

const categories: IpoCategoryCode[] = ["RETAIL", "SHNI", "BHNI", "SHAREHOLDER", "EMPLOYER"];
const ipoSortOptions = [
  { value: "date_desc", label: "Date · newest first" },
  { value: "date_asc", label: "Date · oldest first" },
  { value: "price_asc", label: "Price · low to high" },
  { value: "price_desc", label: "Price · high to low" },
  { value: "name_asc", label: "Alphabetical · A to Z" },
  { value: "name_desc", label: "Alphabetical · Z to A" },
] as const;
type IpoSort = (typeof ipoSortOptions)[number]["value"];
const catalogStatuses = ["UPCOMING", "OPEN", "CLOSED", "LISTED"] as const;
const secondaryLinkClass =
  "inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-white px-5 py-2 font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";

export function IpoListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!searchParams.has("source")) return;
    const canonicalParams = new URLSearchParams(searchParams);
    canonicalParams.delete("source");
    setSearchParams(canonicalParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return <IpoListContent />;
}

function IpoListContent() {
  const { session } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const availableStatuses: readonly IpoStatus[] = catalogStatuses;
  const selectedStatuses = searchParams
    .getAll("status")
    .filter((requestedStatus) => availableStatuses.includes(requestedStatus as IpoStatus));
  const requestedSort = searchParams.get("sort");
  const selectedSort = ipoSortOptions.find((option) => option.value === requestedSort)?.value;
  const sort: IpoSort = selectedSort ?? "date_desc";
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = parsePageSize(searchParams.get("page_size"));
  const updateListParams = (changes: Record<string, string | string[] | null>, replace = false) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          next.delete(key);
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (item) next.append(key, item);
            });
          } else if (value) {
            next.set(key, value);
          }
        }
        return next;
      },
      { replace },
    );
  };
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  selectedStatuses.forEach((selectedStatus) => params.append("status", selectedStatus));
  const metricsParams = new URLSearchParams();
  if (debouncedSearch) metricsParams.set("search", debouncedSearch);
  selectedStatuses.forEach((selectedStatus) => metricsParams.append("status", selectedStatus));
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipos", "catalog", params.toString()]),
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiRequest<IpoListResponse<IpoRecord | IpoCatalogRecord>>(
        `/api/ipos/catalog?${params}`,
        session!,
        { signal },
      ),
  });
  const metrics = useQuery({
    queryKey: userQueryKey(session?.user?.id, [
      "ipos",
      "catalog",
      "metrics",
      metricsParams.toString(),
    ]),
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiRequest<IpoCatalogMetricsResponse>(
        `/api/ipos/catalog/summary${metricsParams.size ? `?${metricsParams}` : ""}`,
        session!,
        { signal },
      ),
  });
  const ipos = data?.data.ipos ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Market overview"
        title="IPO catalog"
        description="Browse upcoming and open public issues, with key dates and pricing in one place."
        compact
        className="border-action/15 bg-gradient-to-r from-white via-white to-indigo-50/60"
      />
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="IPO totals"
        aria-busy={metrics.isLoading}
      >
        {metrics.isLoading ? (
          Array.from({ length: 4 }, (_, index) => <SkeletonStatCard key={index} className="p-4" />)
        ) : (
          <>
            <Card className="px-4 py-3 sm:p-4">
              <p className="text-sm font-semibold text-muted">Total IPOs</p>
              <p className="mt-1 text-2xl font-bold text-navy">
                {metrics.error ? "Unavailable" : (metrics.data?.data.total ?? 0)}
              </p>
            </Card>
            {(
              [
                ["Open", "open"],
                ["Upcoming", "upcoming"],
                ["Listed", "listed"],
              ] as const
            ).map(([title, status]) => (
              <Card key={status} className="px-4 py-3 sm:p-4">
                <p className="text-sm font-semibold text-muted">{title} IPOs</p>
                <p className="mt-1 text-2xl font-bold text-navy">
                  {metrics.error
                    ? "Unavailable"
                    : (metrics.data?.data.status_counts?.[status] ?? 0)}
                </p>
              </Card>
            ))}
          </>
        )}
      </section>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3">
          <label className="block min-w-0 text-sm font-semibold text-ink">
            Search company or exact symbol
            <Input
              aria-label="Search company or exact symbol"
              className={inputClass}
              placeholder="Search company or exact symbol..."
              value={search}
              onChange={(event) => {
                updateListParams({ search: event.target.value, page: null }, true);
              }}
            />
          </label>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1" role="group" aria-label="Filter IPOs by status">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Filter IPOs</span>
              <div className="flex flex-wrap gap-2">
                {availableStatuses.map((status) => {
                  const isSelected = selectedStatuses.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        updateListParams(
                          {
                            status: isSelected
                              ? selectedStatuses.filter((selected) => selected !== status)
                              : [...selectedStatuses, status],
                            page: null,
                          },
                          true,
                        )
                      }
                      className={`min-h-touch rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy ${
                        isSelected
                          ? "border-action bg-action-light text-action"
                          : "border-border bg-white text-ink hover:bg-canvas"
                      }`}
                    >
                      {label(status)}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block w-full shrink-0 text-sm font-semibold text-ink sm:w-64">
              Sort IPOs
              <CustomSelect
                aria-label="Sort IPOs"
                value={sort}
                searchable={false}
                clearable={false}
                onChange={(event) =>
                  updateListParams({ sort: event.target.value, page: null }, true)
                }
              >
                {ipoSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </label>
          </div>
        </div>
      </Card>
      {error ? <ErrorNotice error={error} onRetry={() => void refetch()} /> : null}
      {metrics.error && !error ? (
        <ErrorNotice error={metrics.error} onRetry={() => void metrics.refetch()} />
      ) : null}
      {isLoading ? (
        <SkeletonPage label="Loading IPO records">
          <div className="grid gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </SkeletonPage>
      ) : null}
      {!isLoading && !error && ipos.length === 0 ? (
        <Card>
          <EmptyState
            title="No IPO records found."
            description="Try another search. New IPOs appear here when an administrator adds them to the catalog."
          />
        </Card>
      ) : null}
      {!isLoading && !error && ipos.length > 0 ? (
        <DataTable minWidth="1000px">
          <thead>
            <tr className="border-b border-border bg-canvas text-xs uppercase tracking-wide text-muted">
              <th className="p-4 text-left">IPO</th>
              <th className="p-4 text-left">Exchange</th>
              <th className="p-4 text-left">Price band</th>
              <th className="p-4 text-right">Lot size</th>
              <th className="p-4 text-left">Bidding dates</th>
              <th className="p-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {ipos.map((ipo) => (
              <tr
                key={ipo.id}
                className="border-b border-border transition-colors hover:bg-canvas/60"
              >
                <td className="p-4">
                  <Link
                    className="font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
                    to={`/ipos/catalog/${ipo.id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                  >
                    {ipo.company_name}
                  </Link>
                  {ipo.symbol ? <p className="mt-1 text-xs text-muted">{ipo.symbol}</p> : null}
                </td>
                <td className="p-4 text-sm text-ink">{ipo.exchange || "-"}</td>
                <td className="p-4 text-sm font-medium text-ink">
                  {formatPriceBand(ipo.issue_price_min, ipo.issue_price_max)}
                </td>
                <td className="p-4 text-right text-sm font-medium text-ink tabular-nums">
                  {ipo.lot_size ? ipo.lot_size.toLocaleString("en-IN") : "-"}
                </td>
                <td className="p-4 text-sm text-ink whitespace-nowrap">
                  {formatTableDate(ipo.opening_date)} – {formatTableDate(ipo.closing_date)}
                </td>
                <td className="p-4 text-center">
                  <StatusBadge status={ipo.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
      {data ? (
        <Pagination
          label="IPO list pages"
          page={page}
          totalPages={data.data.pagination.total_pages}
          total={data.data.pagination.total}
          pageSize={pageSize}
          onPageSizeChange={(nextPageSize) =>
            updateListParams({ page_size: String(nextPageSize), page: null }, true)
          }
          onPageChange={(next) => updateListParams({ page: String(next) })}
        />
      ) : null}
    </div>
  );
}

export function IpoCatalogDetailsPage() {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipo-catalog", ipoId]),
    enabled: Boolean(session && ipoId),
    queryFn: ({ signal }) =>
      apiRequest<{ data: IpoCatalogRecord }>(`/api/ipos/catalog/${ipoId}`, session!, { signal }),
  });
  if (isLoading) return <SkeletonIpoDetails />;
  if (error) return <ErrorNotice error={error} onRetry={() => void refetch()} />;
  const ipo = data?.data;
  if (!ipo) return <p role="alert">IPO record not found.</p>;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <BackLink fallback="/ipos" allowedPath={/^\/(ipos|admin\/ipos|dashboard)?$/} />
          <h1 className="mt-3 text-3xl font-bold text-navy">{ipo.company_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-muted">
            <span>
              {ipo.symbol ?? "Symbol not set"} · {ipo.exchange ?? "Exchange not set"}
            </span>
            <StatusBadge status={ipo.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className={secondaryLinkClass} to={`/ipos/catalog/${ipoId}/applications`}>
            Demat account applications
          </Link>
        </div>
      </header>
      <IssueSummary ipo={ipo} personal={false} />
    </div>
  );
}

export function IpoCatalogApplicationsPage() {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountPage, setAccountPage] = useState(1);
  const [accountPageSize, setAccountPageSize] = useState<number>(defaultPageSize);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const ipoQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipo-catalog", ipoId]),
    enabled: Boolean(session && ipoId),
    queryFn: ({ signal }) =>
      apiRequest<{ data: IpoCatalogRecord }>(`/api/ipos/catalog/${ipoId}`, session!, { signal }),
  });
  const ipo = ipoQuery.data?.data;
  const applicationReady = ipo ? isIpoReadyForApplication(ipo) : false;
  const accountsQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, [
      "accounts",
      "catalog-ipo-application-table",
      debouncedSearch,
      accountPage,
      accountPageSize,
    ]),
    enabled: Boolean(session && applicationReady),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        page: String(accountPage),
        pageSize: String(accountPageSize),
        archived: "false",
      });
      if (debouncedSearch) params.set("holder_name", debouncedSearch);
      return apiRequest<AccountListResponse>(`/api/accounts?${params}`, session!, { signal });
    },
  });
  const ownedIpoQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipos", "catalog-application-status", ipoId]),
    enabled: Boolean(session && applicationReady),
    queryFn: async ({ signal }) => {
      const first = await apiRequest<IpoListResponse>(
        "/api/ipos?page=1&page_size=100&source=personal",
        session!,
        { signal },
      );
      const totalPages = first.data.pagination.total_pages;
      if (totalPages <= 1) return first;
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          apiRequest<IpoListResponse>(
            `/api/ipos?page=${index + 2}&page_size=100&source=personal`,
            session!,
            { signal },
          ),
        ),
      );
      return {
        data: {
          ...first.data,
          ipos: [first.data.ipos, ...pages.map((page) => page.data.ipos)].flat(),
        },
      };
    },
  });
  const ownedIpo = (ownedIpoQuery.data?.data.ipos ?? []).find(
    (item) => item.source_catalog_id === ipoId,
  );
  const applicationsQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["catalog-ipo-applications", ownedIpo?.id]),
    enabled: Boolean(session && ownedIpo?.id),
    queryFn: async ({ signal }) => {
      const first = await apiRequest<IpoApplicationsResponse>(
        `/api/applications?ipo_id=${ownedIpo!.id}&page=1&page_size=100`,
        session!,
        { signal },
      );
      const totalPages = first.data.pagination.total_pages;
      if (totalPages <= 1) return first;
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          apiRequest<IpoApplicationsResponse>(
            `/api/applications?ipo_id=${ownedIpo!.id}&page=${index + 2}&page_size=100`,
            session!,
            { signal },
          ),
        ),
      );
      return {
        data: {
          ...first.data,
          applications: [
            first.data.applications,
            ...pages.map((page) => page.data.applications),
          ].flat(),
        },
      };
    },
  });
  const catalogReturnTo = `/ipos/catalog/${ipoId}`;
  const importForApplication = useMutation<IpoResponse, Error, string>({
    mutationFn: () =>
      apiRequest<IpoResponse>(`/api/ipos/catalog/${ipoId}/import`, session!, { method: "POST" }),
    onSuccess: (result, accountId) => {
      navigate(applicationDrawerPath(accountId, result.data.id, catalogReturnTo));
    },
    onError: (cause) =>
      notify({
        title: "IPO could not be prepared for an application",
        description: cause instanceof Error ? cause.message : "The shared IPO could not be copied.",
        tone: "error",
      }),
  });

  if (ipoQuery.isLoading) return <SkeletonIpoDetails />;
  if (ipoQuery.error)
    return <ErrorNotice error={ipoQuery.error} onRetry={() => void ipoQuery.refetch()} />;
  if (!ipo) return <p role="alert">IPO record not found.</p>;

  const accounts = accountsQuery.data?.data.accounts ?? [];
  const applicationsByAccount = new Map(
    (applicationsQuery.data?.data.applications ?? []).map((application) => [
      application.demat_account_id,
      application,
    ]),
  );
  return (
    <div className="space-y-6">
      <BackLink fallback={`/ipos/catalog/${ipoId}`} allowedPath={/^\/ipos\/catalog\/[^/]+$/} />
      <PageHeader
        eyebrow={ipo.symbol ?? "IPO"}
        title="Demat account applications"
        description={`Choose an account to prefill an application for ${ipo.company_name}.`}
      />
      <Card>
        {!applicationReady ? (
          <p className="mb-4 text-sm text-muted">
            Demat account applications are available after the issue and bidding details are
            published.
          </p>
        ) : null}
        <div className="mb-4 max-w-md">
          <Input
            type="search"
            aria-label="Search demat account applications"
            placeholder="Search demat account holder..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setAccountPage(1);
            }}
          />
        </div>
        {!applicationReady ? null : accountsQuery.error ||
          ownedIpoQuery.error ||
          applicationsQuery.error ? (
          <ErrorNotice
            error={accountsQuery.error ?? ownedIpoQuery.error ?? applicationsQuery.error}
            onRetry={() =>
              void Promise.all([
                accountsQuery.refetch(),
                ownedIpoQuery.refetch(),
                applicationsQuery.refetch(),
              ])
            }
          />
        ) : accountsQuery.isLoading ||
          accountsQuery.isFetching ||
          ownedIpoQuery.isLoading ||
          applicationsQuery.isLoading ? (
          <div role="status" aria-label="Loading demat account applications" aria-busy="true">
            <span className="sr-only">Loading accounts and applications…</span>
            <SkeletonTable rows={5} cols={6} />
          </div>
        ) : accounts.length ? (
          <>
            <DataTable minWidth="1120px">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th scope="col" className="p-3 text-left">
                    Demat account
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Category
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Lots / price
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Total amount
                  </th>
                  <th scope="col" className="p-3 text-center">
                    Applied
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const application = applicationsByAccount.get(account.id);
                  const canApply = account.account_status === "active";
                  return (
                    <tr
                      key={account.id}
                      className="border-b border-border transition-colors hover:bg-canvas/60"
                    >
                      <td className="p-3">
                        <span className="font-semibold text-ink">{account.holder_name}</span>
                      </td>
                      <td className="p-3">
                        {application
                          ? formatCategory(
                              application.ipo_categories?.category ?? application.category_code,
                            )
                          : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {application ? formatApplicationLotsAndPrice(application) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {application ? formatApplicationTotalAmount(application) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <StatusBadge status={application ? "APPLIED" : "NOT_APPLIED"} />
                      </td>
                      <td className="p-3 text-right">
                        {application ? (
                          <DrawerRouteLink
                            className="font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
                            to={`/applications/${application.id}/edit?${new URLSearchParams({ return_to: catalogReturnTo }).toString()}`}
                          >
                            Edit
                          </DrawerRouteLink>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canApply || importForApplication.isPending}
                            loading={
                              importForApplication.isPending &&
                              importForApplication.variables === account.id
                            }
                            onClick={() => importForApplication.mutate(account.id)}
                          >
                            Apply
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </>
        ) : (
          <p className="py-6 text-center font-semibold text-muted">
            {debouncedSearch
              ? "No demat account holders match your search."
              : "Add a demat account to apply for this IPO."}
          </p>
        )}
        {accountsQuery.data?.data.pagination ? (
          <Pagination
            label="Demat account application pages"
            page={accountPage}
            totalPages={accountsQuery.data.data.pagination.totalPages}
            total={accountsQuery.data.data.pagination.total}
            pageSize={accountPageSize}
            onPageChange={setAccountPage}
            onPageSizeChange={(nextPageSize) => {
              setAccountPageSize(nextPageSize);
              setAccountPage(1);
            }}
          />
        ) : null}
      </Card>
    </div>
  );
}

export function IpoDetailsPage() {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const [applicationPage, setApplicationPage] = useState(1);
  const [applicationPageSize, setApplicationPageSize] = useState<number>(defaultPageSize);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const ipoQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipo", ipoId]),
    enabled: Boolean(session && ipoId),
    queryFn: ({ signal }) => apiRequest<IpoResponse>(`/api/ipos/${ipoId}`, session!, { signal }),
  });
  const categoriesQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipo-categories", ipoId]),
    enabled: Boolean(session && ipoId),
    queryFn: ({ signal }) =>
      apiRequest<IpoCategoryResponse>(`/api/ipos/${ipoId}/categories`, session!, { signal }),
  });
  const applicationsQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, [
      "ipo-applications",
      ipoId,
      applicationPage,
      applicationPageSize,
    ]),
    enabled: Boolean(session && ipoId),
    queryFn: ({ signal }) =>
      apiRequest<IpoApplicationsResponse>(
        `/api/applications?ipo_id=${ipoId}&page=${applicationPage}&page_size=${applicationPageSize}`,
        session!,
        { signal },
      ),
  });
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts.allOptions(session?.user?.id),
    enabled: Boolean(session),
    queryFn: async ({ signal }) => {
      const first = await apiRequest<AccountListResponse>("/api/accounts?pageSize=100", session!, {
        signal,
      });
      const totalPages = first.data.pagination?.totalPages ?? 1;
      if (totalPages <= 1) return first;
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          apiRequest<AccountListResponse>(
            `/api/accounts?page=${index + 2}&pageSize=100`,
            session!,
            { signal },
          ),
        ),
      );
      return {
        data: {
          ...first.data,
          accounts: [first.data.accounts, ...pages.map((page) => page.data.accounts)].flat(),
        },
      };
    },
  });
  const archive = useMutation({
    mutationFn: () =>
      apiRequest<IpoResponse>(`/api/ipos/${ipoId}/archive`, session!, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ipos"] });
      notify({ title: "IPO archived", tone: "success" });
      navigate("/ipos?source=personal");
    },
    onError: (error) =>
      notify({
        title: "IPO could not be archived",
        description: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      }),
  });
  const ipo = ipoQuery.data?.data;

  if (ipoQuery.isLoading) return <SkeletonIpoDetails />;
  if (ipoQuery.error)
    return <ErrorNotice error={ipoQuery.error} onRetry={() => void ipoQuery.refetch()} />;
  if (!ipo) return <p role="alert">IPO record not found.</p>;

  const latestCategories = latestByCategory(categoriesQuery.data?.data.configurations ?? []);
  const applicationReady = isIpoReadyForApplication(ipo);
  const applications = applicationsQuery.data?.data.applications ?? [];
  const applicationPagination = applicationsQuery.data?.data.pagination;
  const activeAccounts = (accountsQuery.data?.data.accounts ?? []).filter(
    (account) => account.account_status === "active" && !account.archived_at,
  );
  const activeAccountIds = new Set(activeAccounts.map((account) => account.id));
  const applicationRows = activeAccounts.flatMap<IpoApplicationTableRow>((account) => {
    const accountApplications = applications.filter(
      (application) => application.demat_account_id === account.id,
    );
    return accountApplications.length
      ? accountApplications.map((application) => ({ account, application }))
      : [{ account, application: null }];
  });
  const historicalApplicationRows: IpoApplicationTableRow[] = applications
    .filter((application) => !activeAccountIds.has(application.demat_account_id))
    .map((application) => ({ account: null, application }));
  const returnTo = `/ipos/${ipo.id}`;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <BackLink fallback="/ipos?source=personal" allowedPath={/^\/(ipos|dashboard)?$/} />
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">{ipo.symbol}</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">{ipo.company_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-muted">
            <span>
              {ipo.exchange} · {ipo.ipo_type}
            </span>
            <StatusBadge status={ipo.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <DrawerRouteLink className={secondaryLinkClass} to={`/ipos/${ipo.id}/categories`}>
            Configure categories
          </DrawerRouteLink>
          <Link className={secondaryLinkClass} to={`/quota-calculator?ipo=${ipo.id}`}>
            Quota calculator
          </Link>
          {!ipo.archived_at ? (
            <ConfirmButton
              variant="outline"
              disabled={archive.isPending}
              title="Archive this record?"
              description="This record will be removed from the active list."
              confirmLabel="Archive"
              onConfirm={() => archive.mutateAsync()}
            >
              Archive
            </ConfirmButton>
          ) : null}
        </div>
      </header>
      <IssueSummary ipo={ipo} personal />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">Category rule versions</h2>
            <p className="mt-1 text-sm text-muted">
              Each new configuration creates an immutable version for later calculation records.
            </p>
          </div>
          <DrawerRouteLink
            className="text-action no-underline transition-colors hover:text-navy visited:text-action"
            to={`/ipos/${ipo.id}/categories`}
          >
            Manage rules
          </DrawerRouteLink>
        </div>
        {categoriesQuery.error ? (
          <div className="mt-4 space-y-3">
            <ErrorNotice
              error={categoriesQuery.error}
              onRetry={() => void categoriesQuery.refetch()}
            />
          </div>
        ) : categoriesQuery.isLoading ? (
          <div role="status" aria-label="Loading category rules" aria-busy="true">
            <span className="sr-only">Loading category rules…</span>
            <ul aria-hidden="true" className="mt-4 grid gap-2 sm:grid-cols-2">
              {categories.map((category) => (
                <li key={category} className="rounded-lg border border-border p-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {categories.map((category) => {
              const current = latestCategories.get(category);
              return (
                <li key={category} className="rounded-lg border border-border p-3">
                  <span className="font-semibold text-ink">{category}</span>
                  <span className="ml-2 text-sm text-muted">
                    {current ? `Rule version ${current.rule_version}` : "Rules not configured"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">Demat account applications</h2>
            <p className="mt-1 text-sm text-muted">
              Start an application from an active demat account, then return here to review or edit
              its tracking details.
            </p>
          </div>
          <DrawerRouteLink
            className={secondaryLinkClass}
            to={`/applications/new?${new URLSearchParams({ ipo_id: ipo.id, return_to: returnTo }).toString()}`}
          >
            Add application
          </DrawerRouteLink>
        </div>
        {!applicationReady ? (
          <p className="mb-4 text-sm text-muted">
            Complete this IPO's issue and bidding details before recording an application.
          </p>
        ) : null}
        {applicationsQuery.error || accountsQuery.error ? (
          <ErrorNotice
            error={applicationsQuery.error ?? accountsQuery.error}
            onRetry={() => void Promise.all([applicationsQuery.refetch(), accountsQuery.refetch()])}
          />
        ) : applicationsQuery.isLoading || accountsQuery.isLoading ? (
          <p role="status">Loading applications…</p>
        ) : applicationRows.length || historicalApplicationRows.length ? (
          <>
            <DataTable minWidth="980px">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th scope="col" className="p-3 text-left">
                    Demat account
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Category
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Lots / price
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Total amount
                  </th>
                  <th scope="col" className="p-3 text-center">
                    Status
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...applicationRows, ...historicalApplicationRows].map(
                  ({ account, application }) => {
                    const accountName =
                      account?.holder_name ?? application?.demat_accounts?.holder_name ?? "Account";
                    return (
                      <tr
                        key={application?.id ?? account?.id}
                        className="border-b border-border transition-colors hover:bg-canvas/60"
                      >
                        <td className="p-3">
                          <span className="font-semibold text-ink">{accountName}</span>
                          {application?.application_number ? (
                            <span className="block text-xs text-muted">
                              Application {application.application_number}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3">
                          {application?.ipo_categories?.category ?? "Not applied"}
                        </td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">
                          {application ? formatApplicationLotsAndPrice(application) : "—"}
                        </td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">
                          {application ? formatApplicationTotalAmount(application) : "—"}
                        </td>
                        <td className="p-3 text-center">
                          {application ? (
                            <StatusBadge status={application.application_status} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {application ? (
                            <DrawerRouteLink
                              className="font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
                              to={`/applications/${application.id}/edit?${new URLSearchParams({ return_to: returnTo }).toString()}`}
                            >
                              Edit
                            </DrawerRouteLink>
                          ) : account ? (
                            <DrawerRouteLink
                              className="font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
                              to={applicationDrawerPath(account.id, ipo.id, returnTo)}
                              aria-disabled={!applicationReady}
                              onClick={(event) => {
                                if (!applicationReady) event.preventDefault();
                              }}
                            >
                              Apply
                            </DrawerRouteLink>
                          ) : null}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </DataTable>
            {applicationPagination ? (
              <div className="mt-4">
                <Pagination
                  label="IPO application pages"
                  page={applicationPage}
                  totalPages={applicationPagination.total_pages}
                  total={applicationPagination.total}
                  pageSize={applicationPageSize}
                  onPageChange={setApplicationPage}
                  onPageSizeChange={(nextPageSize) => {
                    setApplicationPageSize(nextPageSize);
                    setApplicationPage(1);
                  }}
                />
              </div>
            ) : null}
          </>
        ) : (
          <p className="py-6 text-center font-semibold text-muted">
            Add an active demat account to start tracking an application for this IPO.
          </p>
        )}
      </Card>
    </div>
  );
}

export function IpoCategoryConfigurationPage({
  sharedCatalog = false,
}: {
  sharedCatalog?: boolean;
}) {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [pendingCategory, setPendingCategory] = useState<IpoCategoryCode | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [categoryDirty, setCategoryDirty] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const [category, setCategory] = useState<IpoCategoryCode>("RETAIL");
  const [conditionId, setConditionId] = useState("");
  const [conditionDescription, setConditionDescription] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<RuleForm>(emptyRuleForm);
  const ipoQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, [sharedCatalog ? "ipo-catalog" : "ipo", ipoId]),
    enabled: Boolean(session && ipoId),
    queryFn: async ({ signal }): Promise<IpoCategoryPageResponse> => {
      const response = sharedCatalog
        ? await apiRequest<{ data: IpoCatalogRecord }>(`/api/ipos/catalog/${ipoId}`, session!, {
            signal,
          })
        : await apiRequest<IpoResponse>(`/api/ipos/${ipoId}`, session!, { signal });
      return {
        data: {
          id: response.data.id,
          company_name: response.data.company_name,
          symbol: response.data.symbol,
          lot_size: response.data.lot_size,
        },
      };
    },
  });
  const rulesQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, [
      sharedCatalog ? "ipo-catalog-categories" : "ipo-categories",
      ipoId,
    ]),
    enabled: Boolean(session && ipoId),
    queryFn: async ({ signal }): Promise<IpoCategoryPageRulesResponse> => {
      const response = sharedCatalog
        ? await apiRequest<IpoCatalogCategoryResponse>(
            `/api/admin/ipos/catalog/${ipoId}/categories`,
            session!,
            { signal },
          )
        : await apiRequest<IpoCategoryResponse>(`/api/ipos/${ipoId}/categories`, session!, {
            signal,
          });
      return { data: { configurations: response.data.configurations } };
    },
  });
  const createRule = useMutation({
    mutationFn: (configuration: ReturnType<typeof ipoCategoryConfigurationSchema.parse>) =>
      apiRequest<{ data: IpoCategoryConfiguration | IpoCatalogCategoryConfiguration }>(
        sharedCatalog
          ? `/api/admin/ipos/catalog/${ipoId}/categories`
          : `/api/ipos/${ipoId}/categories`,
        session!,
        {
          method: "POST",
          body: JSON.stringify(configuration),
        },
      ),
    onSuccess: async () => {
      setCategoryDirty(false);
      setCategoryError(false);
      setMessage("");
      notify({
        title: "Category rule saved",
        description: "A new immutable rule version was created.",
        tone: "success",
      });
      await queryClient.invalidateQueries({
        queryKey: [sharedCatalog ? "ipo-catalog-categories" : "ipo-categories", ipoId],
      });
    },
    onError: (error) => {
      setCategoryError(false);
      setMessage("");
      notify({
        title: "Category rules could not be saved",
        description: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
    },
  });
  const configurations = rulesQuery.data?.data.configurations ?? [];
  const latest = latestByCategory(configurations);
  const existing = latest.get(category);

  useEffect(() => {
    if (categoryDirty) return;
    if (existing) setForm(toRuleForm(existing));
    else setForm(emptyRuleForm());
  }, [category, existing, categoryDirty]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const parsed = ipoCategoryConfigurationSchema.safeParse({
      category,
      lot_limit_status: form.lot_limit_status,
      default_lots: parseOptionalInteger(form.default_lots) ?? 0,
      minimum_lots: parseOptionalInteger(form.minimum_lots),
      maximum_lots: parseOptionalInteger(form.maximum_lots),
      lot_increment: parseOptionalInteger(form.lot_increment) ?? 0,
      investment_limit_status: form.investment_limit_status,
      minimum_investment: form.minimum_investment || null,
      maximum_investment: form.maximum_investment || null,
      reserved_shares: parseOptionalInteger(form.reserved_shares),
      reserved_percentage: form.reserved_percentage || null,
      shareholder_record_date: form.shareholder_record_date || null,
      minimum_shareholding: parseOptionalInteger(form.minimum_shareholding),
      eligibility_conditions: form.eligibility_conditions,
      allowed_price_types: form.allowed_price_types,
      minimum_price_increment: form.minimum_price_increment || null,
      source_reference: form.source_reference || null,
      rule_source: form.rule_source,
      last_verified_at: form.last_verified_at ? toIsoDateTime(form.last_verified_at) : null,
    });
    if (!parsed.success) {
      setCategoryError(true);
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      setMessage(parsed.error.issues[0]?.message ?? "The category rule configuration is invalid.");
      return;
    }
    setFieldErrors({});
    createRule.mutate(parsed.data);
  };

  if (ipoQuery.isLoading || rulesQuery.isLoading) return <SkeletonFormPage />;
  if (ipoQuery.error)
    return <ErrorNotice error={ipoQuery.error} onRetry={() => void ipoQuery.refetch()} />;
  if (rulesQuery.error) {
    return (
      <div className="space-y-3">
        <ErrorNotice error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} />
      </div>
    );
  }
  if (!ipoQuery.data) return <p role="alert">IPO record not found.</p>;
  const ipo = ipoQuery.data.data;
  const cancelTo = sharedCatalog ? "/admin/ipos" : `/ipos/${ipoId}`;

  return (
    <RouteFormDrawer
      title="Category configuration"
      description={`${ipo.company_name} · ${ipo.symbol ?? "Symbol not set"}`}
      cancelTo={cancelTo}
      formId="category-rule-form"
      submitLabel="Save new rule version"
      busy={createRule.isPending}
      disabled={rulesQuery.isLoading || Boolean(rulesQuery.error)}
      dirty={categoryDirty}
    >
      <p className="mb-4 rounded-lg border border-[#F1D9B3] bg-[#FFF9EF] p-3 text-sm text-ink">
        Enter issue-specific values you have sourced. Unknown limits stay unconfigured; they are
        never treated as unlimited. Saving creates a new immutable rule version.
      </p>
      <p className="mb-4 rounded-lg border border-border bg-canvas p-3 text-sm text-muted">
        {ipo.lot_size
          ? `Lot size: ${ipo.lot_size.toLocaleString("en-IN")} shares in one lot.`
          : "Lot size is the number of shares in one lot; applications require this IPO value to be available."}
      </p>
      <Card>
        <FormSelect
          label="Category"
          fieldClassName="max-w-sm"
          value={category}
          onChange={(event) => {
            const next = event.target.value as IpoCategoryCode;
            if (categoryDirty) setPendingCategory(next);
            else {
              setCategory(next);
              setFieldErrors({});
              setMessage("");
            }
          }}
        >
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </FormSelect>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {categories.map((value) => (
            <li key={value} className="rounded-lg border border-border p-3 text-sm">
              <span className="font-semibold text-ink">{value}</span>
              <span className="ml-2 text-muted">
                {latest.get(value)
                  ? `Latest: v${latest.get(value)?.rule_version}`
                  : "Not configured"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {message ? (
        <p role={categoryError ? "alert" : "status"} className="my-4 text-sm text-ink">
          {message}
        </p>
      ) : null}
      <Card>
        <form
          id="category-rule-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={submit}
          noValidate
          onChangeCapture={() => setCategoryDirty(true)}
        >
          <SelectRuleField
            label="Lot limits"
            value={form.lot_limit_status}
            options={["UNCONFIGURED", "CONFIGURED", "NO_PUBLISHED_LIMIT"]}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                lot_limit_status: value as RuleForm["lot_limit_status"],
                ...(value !== "CONFIGURED" ? { minimum_lots: "", maximum_lots: "" } : {}),
              }))
            }
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="default_lots"
            label="Initial lots"
            type="number"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="lot_increment"
            label="Lot increment"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="minimum_lots"
            label="Minimum lots"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="maximum_lots"
            label="Maximum lots"
          />
          <SelectRuleField
            label="Investment limits"
            value={form.investment_limit_status}
            options={["UNCONFIGURED", "CONFIGURED", "NO_PUBLISHED_LIMIT"]}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                investment_limit_status: value as RuleForm["investment_limit_status"],
                ...(value !== "CONFIGURED"
                  ? { minimum_investment: "", maximum_investment: "" }
                  : {}),
              }))
            }
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="minimum_investment"
            label="Minimum investment"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="maximum_investment"
            label="Maximum investment"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="reserved_shares"
            label="Reserved shares (optional)"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="reserved_percentage"
            label="Reserved percentage (optional)"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="shareholder_record_date"
            label="Shareholder record date"
            type="date"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="minimum_shareholding"
            label="Minimum eligible shares"
          />
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-semibold text-ink">Allowed pricing</legend>
            <div className="mt-2 flex flex-wrap gap-5">
              {(["BID", "CUT_OFF"] as const).map((priceType) => (
                <label key={priceType} className="flex min-h-touch items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allowed_price_types.includes(priceType)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowed_price_types: event.target.checked
                          ? [...current.allowed_price_types, priceType]
                          : current.allowed_price_types.filter((value) => value !== priceType),
                      }))
                    }
                  />
                  {priceType === "BID" ? "Bid price" : "Cut-off price"}
                </label>
              ))}
            </div>
          </fieldset>
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="minimum_price_increment"
            label="Minimum price increment"
          />
          <SelectRuleField
            label="Rule source"
            value={form.rule_source}
            options={["MANUAL", "PUBLISHED_SOURCE"]}
            onChange={(value) => updateRuleForm(setForm, "rule_source", value)}
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="source_reference"
            label="Source reference"
          />
          <TextRuleField
            errors={fieldErrors}
            form={form}
            setForm={setForm}
            name="last_verified_at"
            label="Last verified at"
            type="datetime-local"
          />
          <div className="space-y-3 sm:col-span-2">
            <h2 className="text-lg font-bold text-ink">Published eligibility conditions</h2>
            <p className="text-sm text-muted">
              Record each condition separately. Applicants must explicitly confirm each one;
              confirmation is not independent verification.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-ink">
                Condition ID
                <input
                  className={inputClass}
                  value={conditionId}
                  placeholder="Enter a condition ID"
                  onChange={(event) => setConditionId(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Published condition text
                <input
                  className={inputClass}
                  value={conditionDescription}
                  placeholder="Enter the published condition text"
                  onChange={(event) => setConditionDescription(event.target.value)}
                />
              </label>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                if (!conditionId.trim() || !conditionDescription.trim()) {
                  setMessage("Enter both a condition ID and its published text.");
                  return;
                }
                if (form.eligibility_conditions.some(({ id }) => id === conditionId.trim())) {
                  setMessage("Each eligibility condition needs a unique ID.");
                  return;
                }
                setForm((current) => ({
                  ...current,
                  eligibility_conditions: [
                    ...current.eligibility_conditions,
                    { id: conditionId.trim(), description: conditionDescription.trim() },
                  ],
                }));
                setConditionId("");
                setConditionDescription("");
              }}
            >
              Add condition
            </Button>
            <ul className="space-y-2">
              {form.eligibility_conditions.map((condition) => (
                <li
                  key={condition.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3 text-sm"
                >
                  <span>
                    <strong>{condition.id}:</strong> {condition.description}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCategoryDirty(true);
                      setForm((current) => ({
                        ...current,
                        eligibility_conditions: current.eligibility_conditions.filter(
                          ({ id }) => id !== condition.id,
                        ),
                      }));
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <Button type="submit" disabled={createRule.isPending || rulesQuery.isLoading}>
            {createRule.isPending ? "Saving…" : "Save new rule version"}
          </Button>
        </form>
      </Card>
      <ConfirmationDialog
        open={pendingCategory !== null}
        title="Discard category changes?"
        description="Switching categories will discard your unsaved edits."
        confirmLabel="Switch category"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setPendingCategory(null)}
        onConfirm={() => {
          if (pendingCategory) setCategory(pendingCategory);
          setPendingCategory(null);
          setCategoryDirty(false);
          setFieldErrors({});
          setMessage("");
        }}
      />
    </RouteFormDrawer>
  );
}

export function QuotaCalculatorPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const [ipoId, setIpoId] = useState(searchParams.get("ipo") ?? "");
  const [dematAccountId, setDematAccountId] = useState("");
  const [category, setCategory] = useState<IpoCategoryCode>("RETAIL");
  const [lots, setLots] = useState("1");
  const [priceType, setPriceType] = useState<"BID" | "CUT_OFF">("BID");
  const [price, setPrice] = useState("");
  const [shareholderShares, setShareholderShares] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [result, setResult] = useState<CalculationResponse["data"] | null>(null);
  const [requestError, setRequestError] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const iposQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipos", "calculator"]),
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiRequest<IpoListResponse>("/api/ipos?page_size=100", session!, { signal }),
  });
  const accountsQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["accounts", "calculator"]),
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiRequest<AccountListResponse>("/api/accounts?pageSize=100", session!, { signal }),
  });
  const categoriesQuery = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["ipo-categories", ipoId]),
    enabled: Boolean(session && ipoId),
    queryFn: ({ signal }) =>
      apiRequest<IpoCategoryResponse>(`/api/ipos/${ipoId}/categories`, session!, { signal }),
  });
  const calculationMutation = useMutation({
    mutationFn: ({ persist, request }: { persist: boolean; request: QuotaCalculationRequest }) =>
      apiRequest<CalculationResponse>(
        persist ? "/api/quota/calculate" : "/api/quota/validate",
        session!,
        { method: "POST", body: JSON.stringify(request) },
      ),
    onSuccess: (response) => setResult(response.data),
    onError: (error) =>
      setRequestError(error instanceof Error ? error.message : "The calculation failed."),
  });
  const recordApplicationMutation = useMutation({
    mutationFn: (calculationId: string) =>
      apiRequest<{ data: { id: string } }>("/api/capital/applications", session!, {
        method: "POST",
        body: JSON.stringify({ calculation_id: calculationId }),
      }),
    onSuccess: async (response) => {
      setApplicationMessage(
        `Application ${response.data.id} recorded for tracking. No application was submitted.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["capital"] }),
      ]);
    },
    onError: (error) =>
      setRequestError(
        error instanceof Error ? error.message : "The application record could not be saved.",
      ),
  });
  const configurations = categoriesQuery.data?.data.configurations ?? [];
  const latestRules = latestByCategory(configurations);
  const selectedRules = latestRules.get(category);

  useEffect(() => {
    if (selectedRules) {
      setAnswers(
        Object.fromEntries(selectedRules.eligibility_conditions.map(({ id }) => [id, false])),
      );
    } else {
      setAnswers({});
    }
  }, [selectedRules]);

  const submitCalculation = (persist: boolean) => {
    if (!session) return;
    setRequestError("");
    setApplicationMessage("");
    setResult(null);
    const request = {
      ipo_id: ipoId,
      demat_account_id: dematAccountId,
      category,
      lots: Number(lots),
      price_type: priceType,
      price,
      shareholder_shares: category === "SHAREHOLDER" ? Number(shareholderShares) : null,
      eligibility_answers: answers,
    };
    calculationMutation.mutate({ persist, request });
  };

  const recordApplication = () => {
    if (!session || !result?.eligible || !result.calculation_id) return;
    setRequestError("");
    recordApplicationMutation.mutate(result.calculation_id);
  };

  const accountOptions = accountsQuery.data?.data.accounts ?? [];
  const ipoOptions = iposQuery.data?.data.ipos ?? [];
  const selectedIpo = ipoOptions.find((ipo) => ipo.id === ipoId);
  const priceOptions = useMemo(() => selectedRules?.allowed_price_types ?? [], [selectedRules]);

  useEffect(() => {
    if (priceOptions.length > 0 && !priceOptions.includes(priceType)) {
      setPriceType(priceOptions[0]!);
    }
  }, [priceOptions, priceType]);

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Quota calculator</h1>
        <p className="mt-2 text-muted">
          Calculate shares and application amount against the latest configured rule version.
        </p>
      </header>
      <p className="rounded-lg border border-[#F1D9B3] bg-[#FFF9EF] p-4 text-sm text-ink">
        IPO data and category rules are user-entered and may be unverified. Shareholder information
        and condition answers are your inputs, not verified holdings. This calculator does not
        verify eligibility with an exchange.
      </p>
      {requestError ? (
        <p role="alert" className="text-danger">
          {requestError}
        </p>
      ) : null}
      {iposQuery.error ? (
        <ErrorNotice error={iposQuery.error} onRetry={() => void iposQuery.refetch()} />
      ) : null}
      {accountsQuery.error ? (
        <ErrorNotice error={accountsQuery.error} onRetry={() => void accountsQuery.refetch()} />
      ) : null}
      {categoriesQuery.error ? (
        <ErrorNotice error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} />
      ) : null}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            IPO
            <CustomSelect
              className={inputClass}
              value={ipoId}
              disabled={iposQuery.isLoading || Boolean(iposQuery.error)}
              onChange={(event) => setIpoId(event.target.value)}
            >
              <option value="">
                {iposQuery.isLoading
                  ? "Loading IPOs…"
                  : iposQuery.error
                    ? "IPO list unavailable"
                    : "Choose an IPO"}
              </option>
              {ipoOptions.map((ipo) => (
                <option key={ipo.id} value={ipo.id}>
                  {ipo.company_name}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="text-sm font-semibold text-ink">
            Demat account
            <CustomSelect
              className={inputClass}
              value={dematAccountId}
              disabled={accountsQuery.isLoading || Boolean(accountsQuery.error)}
              onChange={(event) => setDematAccountId(event.target.value)}
            >
              <option value="">
                {accountsQuery.isLoading
                  ? "Loading accounts…"
                  : accountsQuery.error
                    ? "Account list unavailable"
                    : "Choose an account"}
              </option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.holder_name} · {account.bank_name ?? "Bank not provided"} (
                  {account.username ?? "Username not provided"})
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="text-sm font-semibold text-ink">
            Category
            <CustomSelect
              className={inputClass}
              value={category}
              disabled={!ipoId || categoriesQuery.isLoading || Boolean(categoriesQuery.error)}
              onChange={(event) => setCategory(event.target.value as IpoCategoryCode)}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                  {latestRules.has(value) ? "" : " — not configured"}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="text-sm font-semibold text-ink">
            Lots
            <input
              className={inputClass}
              type="number"
              min="1"
              step="1"
              value={lots}
              onChange={(event) => setLots(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            Price type
            <CustomSelect
              className={inputClass}
              value={priceType}
              onChange={(event) => setPriceType(event.target.value as "BID" | "CUT_OFF")}
            >
              {priceOptions.map((type) => (
                <option key={type} value={type}>
                  {type === "BID" ? "Bid price" : "Cut-off price"}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="text-sm font-semibold text-ink">
            Price per share
            <input
              className={inputClass}
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder={
                selectedIpo ? `${selectedIpo.issue_price_min}–${selectedIpo.issue_price_max}` : ""
              }
            />
          </label>
          {category === "SHAREHOLDER" ? (
            <label className="text-sm font-semibold text-ink">
              Shares held on the configured record date
              <input
                className={inputClass}
                type="number"
                min="0"
                step="1"
                value={shareholderShares}
                onChange={(event) => setShareholderShares(event.target.value)}
              />
              <span className="mt-1 block font-normal text-muted">
                Self-reported input; account ownership does not establish record-date eligibility.
              </span>
            </label>
          ) : null}
        </div>
        {selectedRules?.eligibility_conditions.length ? (
          <fieldset className="mt-5 space-y-3">
            <legend className="font-semibold text-ink">
              Issue-specific eligibility conditions
            </legend>
            {selectedRules.eligibility_conditions.map((condition) => (
              <label
                key={condition.id}
                className="flex min-h-touch items-start gap-3 rounded border border-border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={answers[condition.id] === true}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [condition.id]: event.target.checked }))
                  }
                />
                <span>{condition.description}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {selectedRules ? (
          <p className="mt-4 text-sm text-muted">
            Using rule version {selectedRules.rule_version} · {selectedRules.rule_source}
            {selectedRules.last_verified_at
              ? ` · user-marked ${formatDateTime(selectedRules.last_verified_at)}`
              : " · not verified"}
          </p>
        ) : null}
        {selectedRules?.category === "SHAREHOLDER" ? (
          <p className="mt-2 text-sm text-muted">
            Configured record date: {formatDate(selectedRules.shareholder_record_date)}. A selected
            demat account alone cannot establish holdings on that date.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            disabled={
              !ipoId ||
              !dematAccountId ||
              !selectedRules ||
              calculationMutation.isPending ||
              recordApplicationMutation.isPending
            }
            onClick={() => submitCalculation(false)}
          >
            {calculationMutation.isPending ? "Validating…" : "Validate"}
          </Button>
          <Button
            variant="secondary"
            disabled={
              !ipoId ||
              !dematAccountId ||
              !selectedRules ||
              calculationMutation.isPending ||
              recordApplicationMutation.isPending
            }
            onClick={() => submitCalculation(true)}
          >
            {calculationMutation.isPending ? "Calculating…" : "Calculate and save audit"}
          </Button>
        </div>
      </Card>
      {result ? (
        <Card aria-live="polite">
          <h2 className="text-xl font-bold text-ink">
            {result.eligible ? "Configuration valid" : "Configuration needs attention"}
          </h2>
          {result.validation_errors.length > 0 ? (
            <ul className="mt-3 list-disc space-y-2 pl-6 text-danger">
              {result.validation_errors.map((error, index) => (
                <li key={`${error.code}-${index}`}>{error.message}</li>
              ))}
            </ul>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Detail label="Total shares" value={String(result.total_shares)} />
              <Detail
                label="Application amount"
                value={result.application_amount ?? "Not calculated"}
              />
              <Detail label="Rule version" value={String(result.rule_version)} />
              <Detail
                label="Eligibility verification"
                value={result.eligibility_verified ? "Verified" : "Based only on provided inputs"}
              />
            </dl>
          )}
          {result.calculation_id ? (
            <p className="mt-4 text-sm text-muted">
              Saved calculation {result.calculation_id}
              {result.calculation_timestamp
                ? ` at ${formatDateTime(result.calculation_timestamp)}`
                : ""}
            </p>
          ) : null}
          {result.eligible && result.calculation_id ? (
            <Button
              className="mt-4"
              variant="secondary"
              disabled={recordApplicationMutation.isPending}
              onClick={recordApplication}
            >
              {recordApplicationMutation.isPending
                ? "Recording…"
                : "Record application for tracking"}
            </Button>
          ) : null}
          {applicationMessage ? (
            <p role="status" className="mt-3 text-sm text-muted">
              {applicationMessage}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

type RuleForm = {
  lot_limit_status: "CONFIGURED" | "NO_PUBLISHED_LIMIT" | "UNCONFIGURED";
  default_lots: string;
  minimum_lots: string;
  maximum_lots: string;
  lot_increment: string;
  investment_limit_status: "CONFIGURED" | "NO_PUBLISHED_LIMIT" | "UNCONFIGURED";
  minimum_investment: string;
  maximum_investment: string;
  reserved_shares: string;
  reserved_percentage: string;
  shareholder_record_date: string;
  minimum_shareholding: string;
  eligibility_conditions: Array<{ id: string; description: string }>;
  allowed_price_types: Array<"BID" | "CUT_OFF">;
  minimum_price_increment: string;
  source_reference: string;
  rule_source: "MANUAL" | "PUBLISHED_SOURCE";
  last_verified_at: string;
};

function emptyRuleForm(): RuleForm {
  return {
    lot_limit_status: "UNCONFIGURED",
    default_lots: "1",
    minimum_lots: "",
    maximum_lots: "",
    lot_increment: "",
    investment_limit_status: "UNCONFIGURED",
    minimum_investment: "",
    maximum_investment: "",
    reserved_shares: "",
    reserved_percentage: "",
    shareholder_record_date: "",
    minimum_shareholding: "",
    eligibility_conditions: [],
    allowed_price_types: [],
    minimum_price_increment: "",
    source_reference: "",
    rule_source: "MANUAL",
    last_verified_at: "",
  };
}

function toRuleForm(
  configuration: IpoCategoryConfiguration | IpoCatalogCategoryConfiguration,
): RuleForm {
  return {
    lot_limit_status: configuration.lot_limit_status,
    default_lots: configuration.default_lots.toString(),
    minimum_lots: configuration.minimum_lots?.toString() ?? "",
    maximum_lots: configuration.maximum_lots?.toString() ?? "",
    lot_increment: configuration.lot_increment.toString(),
    investment_limit_status: configuration.investment_limit_status,
    minimum_investment: configuration.minimum_investment ?? "",
    maximum_investment: configuration.maximum_investment ?? "",
    reserved_shares: configuration.reserved_shares?.toString() ?? "",
    reserved_percentage: configuration.reserved_percentage ?? "",
    shareholder_record_date: configuration.shareholder_record_date ?? "",
    minimum_shareholding: configuration.minimum_shareholding?.toString() ?? "",
    eligibility_conditions: configuration.eligibility_conditions,
    allowed_price_types: configuration.allowed_price_types,
    minimum_price_increment: configuration.minimum_price_increment ?? "",
    source_reference: configuration.source_reference ?? "",
    rule_source: configuration.rule_source,
    last_verified_at: configuration.last_verified_at
      ? toLocalDateTime(configuration.last_verified_at)
      : "",
  };
}

function TextRuleField({
  form,
  setForm,
  name,
  label,
  type = "text",
  errors,
}: {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
  name: Exclude<keyof RuleForm, "eligibility_conditions" | "allowed_price_types">;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  errors?: Record<string, string>;
}) {
  return (
    <FormInput
      label={label}
      type={type}
      value={form[name]}
      error={errors?.[name]}
      onChange={(event) => updateRuleForm(setForm, name, event.target.value)}
    />
  );
}

function SelectRuleField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <FormSelect label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {labelValue(option)}
        </option>
      ))}
    </FormSelect>
  );
}

function updateRuleForm(
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>,
  key: keyof RuleForm,
  value: string,
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function IssueSummary({ ipo, personal }: { ipo: IpoRecord | IpoCatalogRecord; personal: boolean }) {
  const priceBand =
    ipo.issue_price_min && ipo.issue_price_max
      ? `${formatRupees(ipo.issue_price_min)}–${formatRupees(ipo.issue_price_max)}`
      : "Not published";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="IPO at a glance">
        {[
          ["Price band", priceBand],
          ["Issue size", ipo.issue_size ?? "Not published"],
          ["Lot size", ipo.lot_size == null ? "Not published" : String(ipo.lot_size)],
          ["Exchange", ipo.exchange ?? "Not published"],
        ].map(([title, value]) => (
          <Card key={title} className="p-4 sm:p-5">
            <p className="text-sm font-medium text-muted">{title}</p>
            <p className="mt-2 break-words text-xl font-bold tabular text-ink">{value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-ink">Issue information</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Detail label="IPO type" value={ipo.ipo_type || "Not published"} />
            <Detail label="Symbol" value={ipo.symbol ?? "Not published"} />
            <Detail
              label="Cut-off price"
              value={ipo.cut_off_price ? formatRupees(ipo.cut_off_price) : "Not published"}
            />
            <Detail label="Status" value={label(ipo.status)} />
          </dl>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink">Important dates</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Detail label="Opening" value={formatDate(ipo.opening_date)} />
            <Detail label="Closing" value={formatDate(ipo.closing_date)} />
            <Detail label="Allotment" value={formatDate(ipo.allotment_date)} />
            <Detail label="Listing" value={formatDate(ipo.listing_date)} />
          </dl>
        </Card>
      </div>
      <Card>
        <h2 className="text-lg font-bold text-ink">Source and availability</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail
            label="Data source"
            value={ipo.data_source === "IPO_GURU" ? "Admin-managed" : labelValue(ipo.data_source)}
          />
          <Detail label="Source reference" value={ipo.source_reference ?? "Not provided"} />
          <Detail
            label={personal ? "User-entered verification date" : "Last synchronized"}
            value={ipo.last_verified_at ? formatDateTime(ipo.last_verified_at) : "Not available"}
          />
        </dl>
        <p className="mt-5 rounded-lg border border-warning-border bg-warning-bg p-4 text-sm text-ink">
          {personal
            ? "This record and its source/verification date were entered by the user. The application does not automatically fetch or verify the source."
            : ipo.data_source === "USER_SUBMITTED"
              ? "This shared IPO was submitted by a user and can be maintained by an administrator. Missing details are shown as not published; the application does not automatically verify the source."
              : "This IPO is maintained by the administrator. Missing details are shown as not published. Subscription, GMP, financial and listing performance data are not available in this record."}
        </p>
      </Card>
    </div>
  );
}

function formatRupees(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatApplicationPrice(application: IpoApplication) {
  const input = application.calculation_snapshot.calculation_input;
  if (!input || typeof input !== "object") return "Not recorded";
  const price = "price" in input ? input.price : null;
  const priceType = "price_type" in input ? input.price_type : null;
  if (typeof price !== "string") return "Not recorded";
  return `${formatRupees(price)}${priceType === "CUT_OFF" ? " (cut-off)" : ""}`;
}

function formatApplicationLotsAndPrice(application: IpoApplication) {
  const lots = Number(application.lots ?? 0);
  const price = formatApplicationPrice(application);
  if (!Number.isFinite(lots) || lots <= 0 || price === "Not recorded") return price;
  return `${lots} × ${price}`;
}

function formatApplicationTotalAmount(application: IpoApplication) {
  const amount = application.application_amount ?? "";
  if (amount) return formatRupees(amount);
  const price = application.calculation_snapshot?.calculation_input;
  if (
    !price ||
    typeof price !== "object" ||
    !("price" in price) ||
    typeof price.price !== "string"
  ) {
    return "—";
  }
  const lots = Number(application.lots ?? 0);
  if (!Number.isFinite(lots) || lots <= 0) return "—";
  return formatRupees(String(lots * Number(price.price)));
}

function formatPriceBand(minimum: string | null, maximum: string | null) {
  if (!minimum && !maximum) return "-";
  if (!maximum || minimum === maximum) return formatRupees(minimum || maximum || "");
  if (!minimum) return formatRupees(maximum);
  return `${formatRupees(minimum)} – ${formatRupees(maximum)}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-ink">{value}</dd>
    </div>
  );
}

function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiRequestError ? error.message : "The request could not be completed.";
  return (
    <div role="alert" className="rounded-lg bg-[#FDECEC] p-4 text-danger">
      <p>{message}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-2 border-danger/30 text-danger" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

function latestByCategory<
  TConfiguration extends Pick<IpoCategoryConfiguration, "category" | "rule_version">,
>(configurations: TConfiguration[]) {
  const latest = new Map<IpoCategoryCode, TConfiguration>();
  for (const configuration of configurations) {
    const current = latest.get(configuration.category);
    if (!current || configuration.rule_version > current.rule_version) {
      latest.set(configuration.category, configuration);
    }
  }
  return latest;
}

function formatCategory(category: IpoCategoryCode) {
  return (
    {
      RETAIL: "Retail",
      SHNI: "sHNI",
      BHNI: "bHNI",
      SHAREHOLDER: "Shareholder",
      EMPLOYER: "Employer",
    }[category] ?? category
  );
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
  );
}

function formatTableDate(value: string | null) {
  return value ? formatDate(value) : "-";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function label(value: IpoStatus | string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

function labelValue(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

const inputClass =
  "mt-1 block min-h-touch w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";
