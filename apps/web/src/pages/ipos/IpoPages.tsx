import { toIsoDateTime, toLocalDateTime, formValuesFromRecord } from "../../lib/formValues";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { ipoCategoryConfigurationSchema, ipoSchema, ipoStatusSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { useAuth } from "../../auth/useAuth";
import { ConfirmButton } from "../../components/ui/ConfirmButton";
import { Button } from "../../components/ui/Button";
import { FormInput, FormSelect, FormTextarea } from "../../components/ui/FormControls";
import { Input, Select as CustomSelect } from "../../components/ui/Input";
import { FormSection } from "../../components/ui/FormSection";
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
} from "../../components/ui/Skeleton";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { DataTable } from "../../components/ui/DataTable";

type IpoListResponse<T = IpoRecord> = {
  data: {
    ipos: T[];
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
};
type IpoResponse = { data: IpoRecord };
type IpoCategoryResponse = { data: { configurations: IpoCategoryConfiguration[] } };
type IpoCatalogCategoryResponse = {
  data: { configurations: IpoCatalogCategoryConfiguration[] };
};
type IpoCategoryPageResponse = {
  data: { id: string; company_name: string; symbol: string | null };
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
        demat_accounts?: { holder_name: string; broker_name: string };
        ipo_categories?: { category: string };
      }
    >;
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
};
type IpoValues = z.input<typeof ipoSchema>;
type IpoOutput = z.output<typeof ipoSchema>;
type AccountListResponse = { data: { accounts: DematAccount[] } };
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

const blankIpo: IpoValues = {
  company_name: "",
  symbol: "",
  ipo_type: "",
  exchange: "",
  issue_price_min: "",
  issue_price_max: "",
  cut_off_price: null,
  lot_size: 0,
  issue_size: "",
  opening_date: "",
  closing_date: "",
  allotment_date: null,
  listing_date: null,
  status: "" as IpoValues["status"],
  data_source: "MANUAL",
  source_reference: null,
  last_verified_at: null,
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
const statuses = ipoStatusSchema.options;
const catalogStatuses = ["UPCOMING", "OPEN", "CLOSED", "LISTED"] as const;
const secondaryLinkClass =
  "inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-white px-5 py-2 font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";

export function IpoListPage() {
  const [searchParams] = useSearchParams();
  const personal = searchParams.get("source") === "personal";
  return <IpoListContent key={String(personal)} personal={personal} />;
}

function IpoListContent({ personal }: { personal: boolean }) {
  const { session } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const requestedStatus = searchParams.get("status");
  const availableStatuses: readonly IpoStatus[] = personal ? statuses : catalogStatuses;
  const status = availableStatuses.includes(requestedStatus as IpoStatus) ? requestedStatus! : "";
  const requestedSort = searchParams.get("sort");
  const selectedSort = ipoSortOptions.find((option) => option.value === requestedSort)?.value;
  const sort: IpoSort = selectedSort ?? "date_desc";
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const updateListParams = (changes: Record<string, string | null>, replace = false) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace },
    );
  };
  const params = new URLSearchParams({
    page: String(page),
    page_size: "25",
    sort,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["ipos", personal ? "personal" : "catalog", params.toString()],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<IpoListResponse<IpoRecord | IpoCatalogRecord>>(
        `/api/ipos${personal ? "" : "/catalog"}?${params}`,
        session!,
      ),
  });
  const ipos = data?.data.ipos ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="IPOs"
        description="Browse the IPO catalog or manage your personal IPO records."
        actions={
          <DrawerRouteLink
            className="inline-flex min-h-touch items-center justify-center rounded-lg bg-action px-5 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
            to="/ipos/new"
          >
            Add IPO
          </DrawerRouteLink>
        }
      />
      <div className="flex flex-wrap gap-3" role="group" aria-label="IPO source">
        {[
          { value: false, name: "IPO catalog" },
          { value: true, name: "My IPOs" },
        ].map((source) => (
          <Button
            key={source.name}
            variant={personal === source.value ? "default" : "outline"}
            aria-pressed={personal === source.value}
            onClick={() =>
              updateListParams({
                source: source.value ? "personal" : null,
                search: null,
                status: null,
                page: null,
              })
            }
          >
            {source.name}
          </Button>
        ))}
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="IPO totals">
        <Card>
          <p className="text-sm font-semibold text-muted">Total IPOs</p>
          <p className="mt-2 text-3xl font-bold text-navy">{data?.data.pagination.total ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-muted">Open on this page</p>
          <p className="mt-2 text-3xl font-bold text-navy">
            {ipos.filter((ipo) => ipo.status === "OPEN").length}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-muted">Upcoming on this page</p>
          <p className="mt-2 text-3xl font-bold text-navy">
            {ipos.filter((ipo) => ipo.status === "UPCOMING").length}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-muted">Listed on this page</p>
          <p className="mt-2 text-3xl font-bold text-navy">
            {ipos.filter((ipo) => ipo.status === "LISTED").length}
          </p>
        </Card>
      </section>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm font-semibold text-ink">
            Search company or exact symbol
            <Input
              aria-label="Search company or exact symbol"
              className={inputClass}
              value={search}
              onChange={(event) => {
                updateListParams({ search: event.target.value, page: null }, true);
              }}
            />
          </label>
          <label className="block w-full shrink-0 text-sm font-semibold text-ink sm:w-52">
            Filter IPOs
            <CustomSelect
              aria-label="Filter IPOs"
              value={status}
              searchable={false}
              onChange={(event) =>
                updateListParams({ status: event.target.value || null, page: null }, true)
              }
            >
              <option value="">All statuses</option>
              {availableStatuses.map((option) => (
                <option key={option} value={option}>
                  {label(option)}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="block w-full shrink-0 text-sm font-semibold text-ink sm:w-64">
            Sort IPOs
            <CustomSelect
              aria-label="Sort IPOs"
              value={sort}
              searchable={false}
              clearable={false}
              onChange={(event) => updateListParams({ sort: event.target.value, page: null }, true)}
            >
              {ipoSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </label>
        </div>
      </Card>
      {error ? <ErrorNotice error={error} onRetry={() => void refetch()} /> : null}
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
            description={
              personal
                ? "Add an issue to start an issue-specific rule record."
                : "Try another search. New IPOs appear here when added to the catalog."
            }
          />
        </Card>
      ) : null}
      {!isLoading && !error && ipos.length > 0 ? (
        <DataTable minWidth="1200px">
          <thead>
            <tr className="border-b border-border bg-canvas text-xs uppercase tracking-wide text-muted">
              <th className="p-4 text-left">IPO</th>
              <th className="p-4 text-left">Exchange</th>
              <th className="p-4 text-left">Price band</th>
              <th className="p-4 text-right">Lot size</th>
              <th className="p-4 text-left">Bidding dates</th>
              <th className="p-4 text-left">Source</th>
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
                    to={`/ipos/${personal ? "" : "catalog/"}${ipo.id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                  >
                    {ipo.company_name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">{ipo.symbol || "Symbol not published"}</p>
                </td>
                <td className="p-4 text-sm text-ink">{ipo.exchange || "Not published"}</td>
                <td className="p-4 text-sm font-medium text-ink">
                  {formatPriceBand(ipo.issue_price_min, ipo.issue_price_max)}
                </td>
                <td className="p-4 text-right text-sm font-medium text-ink tabular-nums">
                  {ipo.lot_size ? ipo.lot_size.toLocaleString("en-IN") : "—"}
                </td>
                <td className="p-4 text-sm text-ink whitespace-nowrap">
                  {formatDate(ipo.opening_date)} – {formatDate(ipo.closing_date)}
                </td>
                <td className="p-4 text-xs text-muted whitespace-nowrap">
                  {!personal
                    ? ipo.data_source === "IPO_GURU"
                      ? "Admin-managed"
                      : `Admin-managed · ${ipo.data_source === "MANUAL" ? "Manual entry" : ipo.data_source}`
                    : ipo.data_source === "MANUAL"
                      ? ipo.last_verified_at
                        ? "Manual entry · user-marked verification date"
                        : "Manual entry · unverified"
                      : "Published source · user-entered"}
                </td>
                <td className="p-4 text-center">
                  <StatusBadge status={ipo.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
      {data && data.data.pagination.total_pages > 1 ? (
        <Pagination
          label="IPO list pages"
          page={page}
          totalPages={data.data.pagination.total_pages}
          total={data.data.pagination.total}
          onPageChange={(next) => updateListParams({ page: String(next) })}
        />
      ) : null}
    </div>
  );
}

export function IpoCatalogDetailsPage() {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["ipo-catalog", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<{ data: IpoCatalogRecord }>(`/api/ipos/catalog/${ipoId}`, session!),
  });
  const categoriesQuery = useQuery({
    queryKey: ["ipo-catalog-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () =>
      apiRequest<IpoCatalogCategoryResponse>(`/api/ipos/catalog/${ipoId}/categories`, session!),
  });
  const importForApplication = useMutation({
    mutationFn: () =>
      apiRequest<IpoResponse>(`/api/ipos/catalog/${ipoId}/import`, session!, { method: "POST" }),
    onSuccess: (result) =>
      navigate(`/applications/new?ipo_id=${encodeURIComponent(result.data.id)}`),
    onError: (cause) =>
      notify({
        title: "IPO could not be prepared for an application",
        description: cause instanceof Error ? cause.message : "The shared IPO could not be copied.",
        tone: "error",
      }),
  });
  if (isLoading) return <SkeletonIpoDetails />;
  if (error) return <ErrorNotice error={error} onRetry={() => void refetch()} />;
  const ipo = data?.data;
  if (!ipo) return <p role="alert">IPO record not found.</p>;

  return (
    <div className="space-y-6">
      <header>
        <BackLink fallback="/ipos" allowedPath={/^\/(ipos|admin\/ipos|dashboard)?$/} />
        <h1 className="mt-3 text-3xl font-bold text-navy">{ipo.company_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-muted">
          <span>
            {ipo.symbol ?? "Symbol not set"} · {ipo.exchange ?? "Exchange not set"}
          </span>
          <StatusBadge status={ipo.status} />
        </div>
      </header>
      <IssueSummary ipo={ipo} personal={false} />
      {categoriesQuery.error ? (
        <ErrorNotice error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} />
      ) : (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-ink">Application categories</h2>
              <p className="mt-1 text-sm text-muted">
                Admin-managed, issue-specific rules. The latest saved version for each category is
                copied into your IPO record when you continue.
              </p>
            </div>
            <Button
              disabled={importForApplication.isPending || categoriesQuery.isLoading}
              onClick={() => importForApplication.mutate()}
            >
              {importForApplication.isPending ? "Preparing IPO…" : "Use for application"}
            </Button>
          </div>
          {categoriesQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted" role="status" aria-busy="true">
              Loading category rules…
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {Array.from(
                latestByCategory(categoriesQuery.data?.data.configurations ?? []).values(),
              ).map((rule) => (
                <li
                  key={rule.id}
                  className="rounded-full border border-border px-3 py-1.5 text-sm font-medium"
                >
                  {formatCategory(rule.category)} (rules v{rule.rule_version})
                </li>
              ))}
              {categoriesQuery.data?.data.configurations.length === 0 ? (
                <li className="text-sm text-muted">
                  No category rules are configured for this IPO yet.
                </li>
              ) : null}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export function IpoDetailsPage() {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const [applicationPage, setApplicationPage] = useState(1);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const ipoQuery = useQuery({
    queryKey: ["ipo", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<IpoResponse>(`/api/ipos/${ipoId}`, session!),
  });
  const categoriesQuery = useQuery({
    queryKey: ["ipo-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<IpoCategoryResponse>(`/api/ipos/${ipoId}/categories`, session!),
  });
  const applicationsQuery = useQuery({
    queryKey: ["ipo-applications", ipoId, applicationPage],
    enabled: Boolean(session && ipoId),
    queryFn: () =>
      apiRequest<IpoApplicationsResponse>(
        `/api/applications?ipo_id=${ipoId}&page=${applicationPage}&page_size=25`,
        session!,
      ),
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
            <>
              <DrawerRouteLink className={secondaryLinkClass} to={`/ipos/${ipo.id}/edit`}>
                Edit IPO
              </DrawerRouteLink>
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
            </>
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
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">Applications for this IPO</h2>
          <p className="mt-1 text-sm text-muted">Applications you have recorded for this IPO.</p>
        </div>
        {applicationsQuery.error ? (
          <ErrorNotice
            error={applicationsQuery.error}
            onRetry={() => void applicationsQuery.refetch()}
          />
        ) : applicationsQuery.isLoading ? (
          <p role="status">Loading applications…</p>
        ) : applicationsQuery.data?.data.applications.length ? (
          <>
            <DataTable minWidth="760px">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th scope="col" className="p-3 text-left">
                    Application
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Account
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Category
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Lots / amount
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Submitted
                  </th>
                  <th scope="col" className="p-3 text-center">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {applicationsQuery.data.data.applications.map((application) => (
                  <tr key={application.id} className="border-b border-border">
                    <td className="p-3">
                      <Link
                        className="font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
                        to={`/applications/${application.id}`}
                      >
                        {application.application_number ?? "View application"}
                      </Link>
                    </td>
                    <td className="p-3">
                      {application.demat_accounts?.holder_name ?? "Account"}
                      <br />
                      <span className="text-sm text-muted">
                        {application.demat_accounts?.broker_name ?? "Broker not available"}
                      </span>
                    </td>
                    <td className="p-3">
                      {application.ipo_categories?.category ?? "Not available"}
                    </td>
                    <td className="p-3 text-right tabular-nums whitespace-nowrap">
                      {application.lots} lots · {formatRupees(application.application_amount)}
                    </td>
                    <td className="p-3 text-sm tabular-nums whitespace-nowrap">
                      {formatDateTime(application.submission_date ?? application.created_at)}
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={application.application_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {applicationsQuery.data.data.pagination.total_pages > 1 ? (
              <div className="mt-4">
                <Pagination
                  label="IPO application pages"
                  page={applicationPage}
                  totalPages={applicationsQuery.data.data.pagination.total_pages}
                  total={applicationsQuery.data.data.pagination.total}
                  onPageChange={setApplicationPage}
                />
              </div>
            ) : null}
          </>
        ) : (
          <p className="py-6 text-center font-semibold text-muted">
            No applications recorded for this IPO.
          </p>
        )}
      </Card>
    </div>
  );
}

export function IpoFormPage({ editing = false }: { editing?: boolean }) {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [verificationTime, setVerificationTime] = useState("");
  const loadedRecordId = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ["ipo", ipoId],
    enabled: Boolean(editing && session && ipoId),
    queryFn: () => apiRequest<IpoResponse>(`/api/ipos/${ipoId}`, session!),
  });
  const form = useForm<IpoValues, unknown, IpoOutput>({
    resolver: zodResolver(ipoSchema),
    defaultValues: blankIpo,
  });

  useEffect(() => {
    if (existing.data?.data && loadedRecordId.current !== existing.data.data.id) {
      loadedRecordId.current = existing.data.data.id;
      const { last_verified_at } = existing.data.data;
      form.reset(formValuesFromRecord(blankIpo, existing.data.data));
      setVerificationTime(last_verified_at ? toLocalDateTime(last_verified_at) : "");
    }
  }, [existing.data, form]);

  const submit = form.handleSubmit(async (values) => {
    if (!session) return;
    const payload = {
      ...values,
      source_reference: values.source_reference || null,
      last_verified_at: verificationTime ? toIsoDateTime(verificationTime) : null,
    };
    try {
      const response = await apiRequest<IpoResponse>(
        editing ? `/api/ipos/${ipoId}` : "/api/ipos",
        session,
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      await queryClient.invalidateQueries({ queryKey: ["ipos"] });
      navigate(`/ipos/${response.data.id}`, {
        state: { successMessage: editing ? "IPO updated." : "IPO created." },
      });
    } catch (error) {
      notify({
        title: editing ? "IPO could not be updated" : "IPO could not be created",
        description: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
    }
  });

  if (editing && existing.isLoading) return <SkeletonFormPage />;
  if (editing && existing.error)
    return <ErrorNotice error={existing.error} onRetry={() => void existing.refetch()} />;

  return (
    <RouteFormDrawer
      title={editing ? "Edit IPO" : "Add IPO"}
      description="Enter issue details from a source you can review. Manual values are never marked verified automatically."
      cancelTo={editing ? `/ipos/${ipoId}` : "/ipos?source=personal"}
      formId="personal-ipo-form"
      submitLabel={editing ? "Save changes" : "Add IPO"}
      busy={form.formState.isSubmitting}
      dirty={
        form.formState.isDirty ||
        verificationTime !==
          (existing.data?.data.last_verified_at
            ? toLocalDateTime(existing.data.data.last_verified_at)
            : "")
      }
    >
      <form id="personal-ipo-form" className="space-y-5" onSubmit={submit} noValidate>
        <FormSection title="Company details">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="company_name" label="Company name" />
            <TextField form={form} name="symbol" label="Symbol" />
            <TextField form={form} name="ipo_type" label="IPO type" />
            <TextField form={form} name="exchange" label="Exchange" />
          </div>
        </FormSection>
        <FormSection title="Issue and pricing">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="issue_price_min" label="Issue price minimum" />
            <TextField form={form} name="issue_price_max" label="Issue price maximum" />
            <TextField form={form} name="cut_off_price" label="Cut-off price (optional)" />
            <TextField form={form} name="lot_size" label="Lot size" inputMode="numeric" />
            <TextField form={form} name="issue_size" label="Issue size" />
            <SelectField form={form} name="status" label="Status">
              <option value="" disabled>
                Choose a status
              </option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </SelectField>
          </div>
        </FormSection>
        <FormSection title="Key dates">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="opening_date" label="Opening date" type="date" />
            <TextField form={form} name="closing_date" label="Closing date" type="date" />
            <TextField
              form={form}
              name="listing_date"
              label="Listing date (optional)"
              type="date"
            />
          </div>
        </FormSection>
        <FormSection title="Source and verification">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField form={form} name="data_source" label="Data source">
              <option value="MANUAL">Manual entry</option>
              <option value="PUBLISHED_SOURCE">Published source, entered manually</option>
            </SelectField>
            <FormTextarea
              label="Source reference (optional)"
              fieldClassName="sm:col-span-2"
              error={form.formState.errors.source_reference?.message}
              {...form.register("source_reference")}
              placeholder="Official document URL or publication reference"
            />
            <FormInput
              label="Last verified at (optional)"
              fieldClassName="sm:col-span-2"
              type="datetime-local"
              value={verificationTime}
              onChange={(event) => setVerificationTime(event.target.value)}
              hint="Leave blank unless you personally checked the referenced source."
            />
          </div>
        </FormSection>
      </form>
    </RouteFormDrawer>
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
    queryKey: [sharedCatalog ? "ipo-catalog" : "ipo", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: async (): Promise<IpoCategoryPageResponse> => {
      const response = sharedCatalog
        ? await apiRequest<{ data: IpoCatalogRecord }>(`/api/ipos/catalog/${ipoId}`, session!)
        : await apiRequest<IpoResponse>(`/api/ipos/${ipoId}`, session!);
      return {
        data: {
          id: response.data.id,
          company_name: response.data.company_name,
          symbol: response.data.symbol,
        },
      };
    },
  });
  const rulesQuery = useQuery({
    queryKey: [sharedCatalog ? "ipo-catalog-categories" : "ipo-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: async (): Promise<IpoCategoryPageRulesResponse> => {
      const response = sharedCatalog
        ? await apiRequest<IpoCatalogCategoryResponse>(
            `/api/admin/ipos/catalog/${ipoId}/categories`,
            session!,
          )
        : await apiRequest<IpoCategoryResponse>(`/api/ipos/${ipoId}/categories`, session!);
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
                  onChange={(event) => setConditionId(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Published condition text
                <input
                  className={inputClass}
                  value={conditionDescription}
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
    queryKey: ["ipos", "calculator"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<IpoListResponse>("/api/ipos?page_size=100", session!),
  });
  const accountsQuery = useQuery({
    queryKey: ["accounts", "calculator"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<AccountListResponse>("/api/accounts?pageSize=100", session!),
  });
  const categoriesQuery = useQuery({
    queryKey: ["ipo-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<IpoCategoryResponse>(`/api/ipos/${ipoId}/categories`, session!),
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

  const submitCalculation = async (persist: boolean) => {
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
    try {
      const response = await apiRequest<CalculationResponse>(
        persist ? "/api/quota/calculate" : "/api/quota/validate",
        session,
        { method: "POST", body: JSON.stringify(request) },
      );
      setResult(response.data);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The calculation failed.");
    }
  };

  const recordApplication = async () => {
    if (!session || !result?.eligible || !result.calculation_id) return;
    setRequestError("");
    try {
      const response = await apiRequest<{ data: { id: string } }>(
        "/api/capital/applications",
        session,
        {
          method: "POST",
          body: JSON.stringify({ calculation_id: result.calculation_id }),
        },
      );
      setApplicationMessage(
        `Application ${response.data.id} recorded for tracking. No application was submitted.`,
      );
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "The application record could not be saved.",
      );
    }
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
                  {account.holder_name} · {account.broker_name} · {account.masked_demat_identifier}
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
            disabled={!ipoId || !dematAccountId || !selectedRules}
            onClick={() => void submitCalculation(false)}
          >
            Validate
          </Button>
          <Button
            variant="secondary"
            disabled={!ipoId || !dematAccountId || !selectedRules}
            onClick={() => void submitCalculation(true)}
          >
            Calculate and save audit
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
            <Button className="mt-4" variant="secondary" onClick={() => void recordApplication()}>
              Record application for tracking
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

function TextField({
  form,
  name,
  label,
  type = "text",
  inputMode,
}: {
  form: ReturnType<typeof useForm<IpoValues, unknown, IpoOutput>>;
  name: keyof IpoValues;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: "numeric" | "decimal";
}) {
  const nullableField = ["cut_off_price", "allotment_date", "listing_date"].includes(name);
  const registration =
    name === "lot_size"
      ? form.register(name, { valueAsNumber: true })
      : nullableField
        ? form.register(name, { setValueAs: (value: string) => (value === "" ? null : value) })
        : form.register(name);
  const decimal = ["issue_price_min", "issue_price_max", "cut_off_price", "issue_size"].includes(
    name,
  );
  return (
    <FormInput
      label={label}
      type={name === "lot_size" ? "number" : type}
      min={name === "lot_size" ? 1 : undefined}
      step={name === "lot_size" ? 1 : undefined}
      inputMode={decimal ? "decimal" : inputMode}
      required={!nullableField}
      error={form.formState.errors[name]?.message}
      {...registration}
    />
  );
}

function SelectField({
  form,
  name,
  label,
  children,
}: {
  form: ReturnType<typeof useForm<IpoValues, unknown, IpoOutput>>;
  name: "status" | "data_source";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormSelect label={label} required error={form.formState.errors[name]?.message} {...field}>
          {children}
        </FormSelect>
      )}
    />
  );
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

function formatPriceBand(minimum: string | null, maximum: string | null) {
  if (!minimum && !maximum) return "Not published";
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
