import { toIsoDateTime } from "../../lib/formValues";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type {
  DematAccount,
  IpoApplication,
  IpoCategoryConfiguration,
  IpoRecord,
} from "@ipo-mania/shared";
import { useAuth } from "../../auth/useAuth";
import { ConfirmButton } from "../../components/ui/ConfirmButton";
import { Button } from "../../components/ui/Button";
import { DrawerRouteLink, RouteFormDrawer } from "../../components/ui/FormDrawer";
import { SearchableFormSelect } from "../../components/ui/SearchableFormSelect";
import { SearchableSelect } from "../../components/filters/SearchableSelect";
import { FormInput, FormSelect, FormTextarea } from "../../components/ui/FormControls";
import { Select as CustomSelect } from "../../components/ui/Input";
import { FormSection } from "../../components/ui/FormSection";
import { useFormValidation } from "../../components/ui/useFormValidation";
import { applicationCreateSchema, applicationUpdateSchema } from "@ipo-mania/validation";
import { Card } from "../../components/ui/Card";
import { BackLink } from "../../components/ui/BackLink";
import { Pagination } from "../../components/ui/Pagination";
import { DataTable } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/ToastContext";
import {
  ActiveFilterChips,
  type ActiveFilterChip,
} from "../../components/filters/ActiveFilterChips";
import {
  ApplicationFilterDrawer,
  type ApplicationFilters,
} from "../../components/applications/ApplicationFilterDrawer";
import { ApplicationSearchToolbar } from "../../components/applications/ApplicationSearchToolbar";
import { ApiRequestError, apiRequest } from "../../lib/api";
import {
  SkeletonDetailsPage,
  SkeletonFormFields,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonTableRows,
} from "../../components/ui/Skeleton";

type ApplicationListResponse = {
  data: {
    applications: Array<
      IpoApplication & {
        ipos?: { symbol: string; company_name: string };
        demat_accounts?: { holder_name: string; broker_name: string };
        ipo_categories?: { category: string };
      }
    >;
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
};
type ApplicationSummaryResponse = {
  data: { total: number; application_status_counts: Record<string, number> };
};
type IpoListResponse = {
  data: { ipos: IpoRecord[]; pagination?: { page: number; total_pages: number } };
};
type AccountListResponse = {
  data: { accounts: DematAccount[]; pagination?: { page: number; totalPages: number } };
};
type CategoryResponse = { data: { configurations: IpoCategoryConfiguration[] } };
type ApplicationResponse = {
  data: IpoApplication & {
    ipos?: { company_name: string; symbol: string };
    demat_accounts?: { holder_name: string; broker_name: string; masked_demat_identifier: string };
    ipo_categories?: { category: string };
  };
};
type CalculationResponse = {
  data: {
    total_shares: number | null;
    application_amount: string | null;
    rule_version: number;
    warnings: string[];
  };
};
type ValidationRow = {
  index: number;
  demat_account_id: string;
  ready: boolean;
  errors: Array<{ code: string; message: string }>;
  warnings: string[];
  application_amount: string | null;
};
type BulkPreviewResponse = {
  data: { rows: ValidationRow[]; ready: number; invalid: number };
};
type ImportPreviewResponse = {
  data: {
    requires_mapping?: boolean;
    headers?: string[];
    sample_rows?: Array<{ row_number: number; values: Record<string, string> }>;
    import?: { id: string; file_name: string };
    rows?: Array<{
      row_number: number;
      row_status: string;
      errors: string[];
      warnings: string[];
      record: Record<string, unknown>;
    }>;
    summary?: { total: number; ready: number; duplicate: number; invalid: number };
  };
};
type ImportHistoryResponse = {
  data: {
    imports: Array<{
      id: string;
      file_name: string;
      status: string;
      total_rows: number;
      imported_rows: number;
      created_at: string;
      confirmed_at: string | null;
      reversed_at: string | null;
    }>;
    total: number;
  };
};

const fieldClass =
  "mt-1 min-h-touch w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";
const linkClass =
  "inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-white px-4 py-2 font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";
const statuses = ["DRAFT", "SUBMITTED", "UNDER_PROCESSING", "REJECTED", "FAILED", "COMPLETED"];
const defaultApplicationFilters: ApplicationFilters = {
  ipoIds: [],
  dematAccountId: "",
  broker: "",
  archiveStatus: "active",
  reference: "",
  categoryId: "",
  applicationStatus: "",
  submissionFrom: "",
  submissionTo: "",
};

function filtersFromParams(params: URLSearchParams): ApplicationFilters {
  const legacyIpoId = params.get("ipo_id");
  return {
    ipoIds: (params.get("ipo_ids")?.split(",") ?? (legacyIpoId ? [legacyIpoId] : [])).filter(
      Boolean,
    ),
    dematAccountId: params.get("demat_account_id") ?? "",
    broker: params.get("broker") ?? "",
    archiveStatus:
      params.get("include_archived") === "true"
        ? "archived"
        : params.get("include_archived") === "all"
          ? "all"
          : "active",
    reference: params.get("search") ?? "",
    categoryId: params.get("category_id") ?? "",
    applicationStatus: params.get("application_status") ?? "",
    submissionFrom: params.get("submission_from") ?? "",
    submissionTo: params.get("submission_to") ?? "",
  };
}

function filterCount(filters: ApplicationFilters) {
  return [
    filters.ipoIds.length,
    filters.dematAccountId,
    filters.broker,
    filters.archiveStatus !== "active",
    filters.reference,
    filters.categoryId,
    filters.applicationStatus,
    filters.submissionFrom || filters.submissionTo,
  ].filter(Boolean).length;
}

function useOwnedLists() {
  const { session } = useAuth();
  const ipos = useInfiniteQuery({
    queryKey: ["ipos", "application-options"],
    enabled: Boolean(session),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequest<IpoListResponse>(`/api/ipos/catalog?page=${pageParam}&page_size=25`, session!),
    getNextPageParam: (lastPage) => {
      const { page, total_pages: totalPages } = lastPage.data.pagination ?? {};
      return page && totalPages && page < totalPages ? page + 1 : undefined;
    },
  });
  const accounts = useQuery({
    queryKey: ["accounts", "application-options"],
    enabled: Boolean(session),
    queryFn: async () => {
      const first = await apiRequest<AccountListResponse>("/api/accounts?pageSize=100", session!);
      const totalPages = first.data.pagination?.totalPages ?? 1;
      if (totalPages <= 1) return first;
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          apiRequest<AccountListResponse>(`/api/accounts?page=${index + 2}&pageSize=100`, session!),
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
  return {
    ipos: ipos.data?.pages.flatMap((page) => page.data.ipos) ?? [],
    accounts: accounts.data?.data.accounts ?? [],
    loading: ipos.isLoading || accounts.isLoading,
    optionLoading: {
      ipos: ipos.isLoading,
      accounts: accounts.isLoading,
    },
    error: ipos.error ?? accounts.error,
    refetch: () => Promise.all([ipos.refetch(), accounts.refetch()]),
    iposInfinite: ipos,
  };
}

export function ApplicationDashboardPage() {
  const { session } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["applications", "dashboard"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<ApplicationSummaryResponse>("/api/applications/summary", session!),
  });
  const totals = [
    ["Applications", data?.data.total],
    ["Draft", data?.data.application_status_counts.DRAFT],
    ["Submitted", data?.data.application_status_counts.SUBMITTED],
    ["Under processing", data?.data.application_status_counts.UNDER_PROCESSING],
  ];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Application manager</h1>
          <p className="mt-2 text-lg text-muted">
            Track your IPO applications across your demat accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <DrawerRouteLink className={linkClass} to="/applications/new">
            Add application
          </DrawerRouteLink>
          <Link className={linkClass} to="/applications/bulk">
            Bulk entry
          </Link>
          <Link className={linkClass} to="/applications/import">
            Import file
          </Link>
        </div>
      </header>
      {error ? <ErrorMessage error={error} onRetry={() => void refetch()} /> : null}
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Application totals"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          totals.map(([label, value]) => (
            <Card key={label}>
              <p className="text-base font-semibold text-muted">{label}</p>
              <p className="mt-2 text-3xl font-bold text-navy">{error ? "—" : (value ?? 0)}</p>
            </Card>
          ))
        )}
      </section>
      <ApplicationListPage embedded />
    </div>
  );
}

export function ApplicationListPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { session } = useAuth();
  const { notify } = useToast();
  const location = useLocation();
  const [listParams, setListParams] = useSearchParams();
  const pageValue = Number(listParams.get("page"));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const appliedFilters = filtersFromParams(listParams);
  const ipoSearch = listParams.get("ipo_search") ?? "";
  const [searchInput, setSearchInput] = useState(ipoSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ApplicationFilters>(appliedFilters);
  const updateListParams = useCallback(
    (changes: Record<string, string | null>, replace = true) => {
      setListParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(changes).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          if (!("page" in changes)) next.delete("page");
          return next;
        },
        { replace },
      );
    },
    [setListParams],
  );
  const applyFilters = (filters: ApplicationFilters) => {
    updateListParams({
      ipo_id: null,
      ipo_ids: filters.ipoIds.length ? filters.ipoIds.join(",") : null,
      demat_account_id: filters.dematAccountId || null,
      broker: filters.broker || null,
      include_archived:
        filters.archiveStatus === "active"
          ? null
          : filters.archiveStatus === "archived"
            ? "true"
            : "all",
      search: filters.reference || null,
      category_id: filters.categoryId || null,
      application_status: filters.applicationStatus || null,
      submission_from: filters.submissionFrom || null,
      submission_to: filters.submissionTo || null,
    });
  };
  useEffect(() => setSearchInput(ipoSearch), [ipoSearch]);
  useEffect(() => {
    if (searchInput === ipoSearch) return;
    const timer = window.setTimeout(
      () => updateListParams({ ipo_search: searchInput || null }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput, ipoSearch, updateListParams]);
  const changePage = (nextPage: number) => {
    updateListParams({ page: nextPage > 1 ? String(nextPage) : null }, false);
  };
  const lists = useOwnedLists();
  const categoriesQuery = useQuery({
    queryKey: ["application-category-options", lists.ipos.map((item) => item.id).join(",")],
    enabled: Boolean(session && lists.ipos.length),
    queryFn: async () => {
      const results = await Promise.all(
        lists.ipos.map((ipo) =>
          apiRequest<CategoryResponse>(`/api/ipos/${ipo.id}/categories`, session!),
        ),
      );
      return results.flatMap((result) => result.data.configurations);
    },
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const bulkStatusMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/applications/bulk/status", session!, {
        method: "PATCH",
        body: JSON.stringify({ application_ids: selectedIds, application_status: bulkStatus }),
      }),
    onSuccess: async () => {
      setSelectedIds([]);
      notify({ title: "Selected applications updated", tone: "success" });
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error) =>
      notify({
        title: "Applications could not be updated",
        description: errorMessage(error),
        tone: "error",
      }),
  });
  const params = new URLSearchParams({
    page: String(page),
    page_size: "50",
    include_archived:
      appliedFilters.archiveStatus === "archived"
        ? "true"
        : appliedFilters.archiveStatus === "all"
          ? "all"
          : "false",
    ...(appliedFilters.ipoIds.length ? { ipo_ids: appliedFilters.ipoIds.join(",") } : {}),
    ...(appliedFilters.dematAccountId ? { demat_account_id: appliedFilters.dematAccountId } : {}),
    ...(appliedFilters.categoryId ? { category_id: appliedFilters.categoryId } : {}),
    ...(appliedFilters.applicationStatus
      ? { application_status: appliedFilters.applicationStatus }
      : {}),
    ...(appliedFilters.broker ? { broker: appliedFilters.broker } : {}),
    ...(appliedFilters.reference ? { search: appliedFilters.reference } : {}),
    ...(ipoSearch ? { ipo_search: ipoSearch } : {}),
    ...(appliedFilters.submissionFrom ? { submission_from: appliedFilters.submissionFrom } : {}),
    ...(appliedFilters.submissionTo ? { submission_to: appliedFilters.submissionTo } : {}),
  });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["applications", params.toString()],
    enabled: Boolean(session),
    queryFn: () => apiRequest<ApplicationListResponse>(`/api/applications?${params}`, session!),
  });
  const rows = data?.data.applications ?? [];
  const activeFilterCount = filterCount(appliedFilters);
  const ipoOptions = lists.ipos.map((ipo) => ({
    value: ipo.id,
    label: ipo.company_name,
    badge: ipo.status ? prettyStatus(ipo.status) : undefined,
  }));
  const accountOptions = lists.accounts.map((account) => ({
    value: account.id,
    label: account.holder_name,
    description: `${account.broker_name} · ${account.masked_demat_identifier}`,
  }));
  const brokerOptions = Array.from(
    new Set(lists.accounts.map((account) => account.broker_name).filter(Boolean)),
  ).map((name) => ({ value: name, label: name }));
  const categoryOptions = (categoriesQuery.data ?? []).map((category) => ({
    value: category.id,
    label: category.category,
  }));
  const filterChips: ActiveFilterChip[] = [
    ...appliedFilters.ipoIds.map((id) => ({
      key: `ipo:${id}`,
      label: ipoOptions.find((option) => option.value === id)?.label ?? "IPO",
    })),
    ...(appliedFilters.dematAccountId
      ? [
          {
            key: "dematAccountId",
            label:
              accountOptions.find((option) => option.value === appliedFilters.dematAccountId)
                ?.label ?? "Demat account",
          },
        ]
      : []),
    ...(appliedFilters.broker
      ? [{ key: "broker", label: `Broker: ${appliedFilters.broker}` }]
      : []),
    ...(appliedFilters.archiveStatus !== "active"
      ? [
          {
            key: "archiveStatus",
            label: appliedFilters.archiveStatus === "archived" ? "Archived records" : "All records",
          },
        ]
      : []),
    ...(appliedFilters.reference
      ? [{ key: "reference", label: `Reference: ${appliedFilters.reference}` }]
      : []),
    ...(appliedFilters.categoryId
      ? [
          {
            key: "categoryId",
            label:
              categoryOptions.find((option) => option.value === appliedFilters.categoryId)?.label ??
              "Category",
          },
        ]
      : []),
    ...(appliedFilters.applicationStatus
      ? [{ key: "applicationStatus", label: prettyStatus(appliedFilters.applicationStatus) }]
      : []),
    ...(appliedFilters.submissionFrom || appliedFilters.submissionTo
      ? [
          {
            key: "submissionDate",
            label: `${appliedFilters.submissionFrom || "Any date"} – ${appliedFilters.submissionTo || "Any date"}`,
          },
        ]
      : []),
  ];
  const queryClient = useQueryClient();
  async function exportCsv() {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/applications/export?${params}`,
      {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      },
    );
    if (!response.ok) throw new Error("Export failed. Please try again.");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ipo-applications.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-6">
      {!embedded && (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-navy">Application table</h1>
            <p className="mt-2 text-base text-muted">
              {data?.data.pagination.total ?? 0} matching applications
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                void exportCsv()
                  .then(() => notify({ title: "Application CSV downloaded", tone: "success" }))
                  .catch((reason: unknown) =>
                    notify({
                      title: "Export failed",
                      description: errorMessage(reason),
                      tone: "error",
                    }),
                  )
              }
            >
              Export CSV
            </Button>
            <DrawerRouteLink className={linkClass} to="/applications/new">
              Add application
            </DrawerRouteLink>
          </div>
        </header>
      )}
      <ApplicationSearchToolbar
        search={searchInput}
        activeFilterCount={activeFilterCount}
        onSearchChange={setSearchInput}
        onClearSearch={() => {
          setSearchInput("");
          updateListParams({ ipo_search: null });
        }}
        onOpenFilters={() => {
          setDraftFilters(appliedFilters);
          setFiltersOpen(true);
        }}
        onClearFilters={() => applyFilters(defaultApplicationFilters)}
      />
      <ActiveFilterChips
        filters={filterChips}
        onRemove={(key) => {
          const next = { ...appliedFilters };
          if (key.startsWith("ipo:")) next.ipoIds = next.ipoIds.filter((id) => key !== `ipo:${id}`);
          else if (key === "submissionDate") {
            next.submissionFrom = "";
            next.submissionTo = "";
          } else if (key in next) {
            (next as Record<string, string | string[]>)[key] =
              key === "archiveStatus" ? "active" : "";
          }
          applyFilters(next);
        }}
        onClear={() => applyFilters(defaultApplicationFilters)}
      />
      <ApplicationFilterDrawer
        open={filtersOpen}
        filters={draftFilters}
        activeCount={filterCount(draftFilters)}
        ipoOptions={ipoOptions}
        accountOptions={accountOptions}
        brokerOptions={brokerOptions}
        categoryOptions={categoryOptions}
        statusOptions={statuses.map((status) => ({ value: status, label: prettyStatus(status) }))}
        loading={{
          ipos: lists.optionLoading.ipos,
          accounts: lists.optionLoading.accounts,
          brokers: lists.optionLoading.accounts,
          categories: categoriesQuery.isLoading,
        }}
        onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))}
        onClose={() => setFiltersOpen(false)}
        onReset={() => setDraftFilters(defaultApplicationFilters)}
        onApply={() => {
          applyFilters(draftFilters);
          setFiltersOpen(false);
        }}
      />
      {error ? <ErrorMessage error={error} onRetry={() => void refetch()} /> : null}
      {lists.error ? (
        <div className="space-y-2">
          <ErrorMessage error={lists.error} />
          <Button variant="outline" onClick={() => void lists.refetch()}>
            Retry filter options
          </Button>
        </div>
      ) : null}
      {categoriesQuery.error ? (
        <div className="space-y-2">
          <ErrorMessage error={categoriesQuery.error} />
          <Button variant="outline" onClick={() => void categoriesQuery.refetch()}>
            Retry category filters
          </Button>
        </div>
      ) : null}
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="font-semibold">
            Set application status for selected
            <CustomSelect
              className={fieldClass}
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value)}
            >
              <option value="">Choose status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {prettyStatus(status)}
                </option>
              ))}
            </CustomSelect>
          </label>
          <Button
            variant="outline"
            disabled={!selectedIds.length || !bulkStatus || bulkStatusMutation.isPending}
            onClick={() => bulkStatusMutation.mutate()}
          >
            Update {selectedIds.length} selected
          </Button>
        </div>
        <div className="overflow-x-auto">
          <DataTable minWidth="760px">
            <thead>
              <tr className="border-b border-border text-sm text-muted">
                <th scope="col" className="p-3 text-center">
                  Select
                </th>
                <th scope="col" className="p-3 text-left">
                  IPO / category
                </th>
                <th scope="col" className="p-3 text-left">
                  Account / broker
                </th>
                <th scope="col" className="p-3 text-right">
                  Lots / amount
                </th>
                <th scope="col" className="p-3 text-center">
                  Application
                </th>
              </tr>
            </thead>
            <tbody aria-busy={isLoading}>
              {isLoading ? (
                <SkeletonTableRows rows={6} cols={5} />
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="p-3 text-center">
                      <input
                        aria-label={`Select application ${row.id}`}
                        className="size-5"
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, row.id]
                              : current.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <td className="p-3">
                      <Link
                        className="font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
                        to={`/applications/${row.id}`}
                        state={{ from: `${location.pathname}${location.search}` }}
                      >
                        {row.ipos?.symbol ?? "IPO"} · {row.ipo_categories?.category ?? "Category"}
                      </Link>
                    </td>
                    <td className="p-3">
                      {row.demat_accounts?.holder_name ?? "Account"}
                      <br />
                      <span className="text-sm text-muted">{row.demat_accounts?.broker_name}</span>
                    </td>
                    <td className="p-3 text-right tabular-nums whitespace-nowrap">
                      {row.lots} lots · {row.application_amount}
                    </td>
                    <td className="p-3 text-center">{prettyStatus(row.application_status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
          {!isLoading && !rows.length ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-ink">No applications found.</p>
              <p className="mt-1 text-sm text-muted">Try changing your search or filters.</p>
              {activeFilterCount ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => applyFilters(defaultApplicationFilters)}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <Pagination
          label="Application list pages"
          page={page}
          totalPages={data?.data.pagination.total_pages ?? 1}
          total={data?.data.pagination.total}
          onPageChange={changePage}
        />
      </Card>
    </div>
  );
}

export function ApplicationFormPage({ editing = false }: { editing?: boolean }) {
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const lists = useOwnedLists();
  const [dirty, setDirty] = useState(false);
  const validation = useFormValidation();
  const [ipoId, setIpoId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lots, setLots] = useState("1");
  const [priceType, setPriceType] = useState<"BID" | "CUT_OFF">("CUT_OFF");
  const [price, setPrice] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("DRAFT");
  const [shareholderShares, setShareholderShares] = useState("");
  const [eligibilityAnswers, setEligibilityAnswers] = useState<Record<string, boolean | null>>({});
  const [notes, setNotes] = useState("");
  const [reviewedApplication, setReviewedApplication] = useState<{
    fingerprint: string;
    data: CalculationResponse["data"];
  } | null>(null);
  const preselectedAccountId = searchParams.get("demat_account_id");
  const ipo = lists.ipos.find((item) => item.id === ipoId);
  const categoriesQuery = useQuery({
    queryKey: ["ipo-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<CategoryResponse>(`/api/ipos/${ipoId}/categories`, session!),
  });
  const categories = categoriesQuery.data?.data.configurations ?? [];
  const activeCategory = categories.find((category) => category.id === categoryId);
  useEffect(() => {
    if (!editing && ipo && priceType === "CUT_OFF" && !price && ipo.cut_off_price) {
      setPrice(ipo.cut_off_price);
    }
  }, [editing, ipo, price, priceType]);
  useEffect(() => {
    if (editing || dirty || accountId || !preselectedAccountId) return;
    const account = lists.accounts.find((item) => item.id === preselectedAccountId);
    if (account?.account_status === "active" && !account.archived_at) {
      setAccountId(account.id);
    }
  }, [accountId, dirty, editing, lists.accounts, preselectedAccountId]);
  const applicationPayload = {
    ipo_id: ipoId,
    demat_account_id: accountId,
    category_id: categoryId,
    lots: Number(lots),
    price_type: priceType,
    price: price || (priceType === "CUT_OFF" ? ipo?.cut_off_price : ""),
    shareholder_shares: shareholderShares ? Number(shareholderShares) : null,
    eligibility_answers: eligibilityAnswers,
    application_number: applicationNumber || null,
    external_reference: externalReference || null,
    submission_date: submissionDate ? toIsoDateTime(submissionDate) : null,
    application_status: applicationStatus,
    mandate_status: "UNKNOWN",
    allotment_status: "UNKNOWN",
    notes: notes || null,
  };
  const applicationFingerprint = JSON.stringify(applicationPayload);
  const { notify } = useToast();
  const currentReview =
    reviewedApplication?.fingerprint === applicationFingerprint ? reviewedApplication.data : null;
  const calculation = useMutation({
    mutationFn: () =>
      apiRequest<CalculationResponse>("/api/applications/preview", session!, {
        method: "POST",
        body: JSON.stringify(validation.validate(applicationCreateSchema, applicationPayload)),
      }),
    onSuccess: (result) =>
      setReviewedApplication({ fingerprint: applicationFingerprint, data: result.data }),
  });
  const detail = useQuery({
    queryKey: ["applications", applicationId],
    enabled: Boolean(session && editing && applicationId),
    queryFn: () => apiRequest<ApplicationResponse>(`/api/applications/${applicationId}`, session!),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Sign in to save applications.");
      const body = editing
        ? {
            application_number: applicationNumber || null,
            external_reference: externalReference || null,
            submission_date: submissionDate ? toIsoDateTime(submissionDate) : null,
            application_status: applicationStatus,
            notes: notes || null,
          }
        : applicationPayload;
      return apiRequest(
        editing ? `/api/applications/${applicationId}` : "/api/applications",
        session,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(
            editing
              ? validation.validate(applicationUpdateSchema, body)
              : validation.validate(applicationCreateSchema, body),
          ),
        },
      );
    },
    onSuccess: () =>
      navigate("/applications", {
        state: { successMessage: editing ? "Application updated." : "Application created." },
      }),
    onError: (error) =>
      notify({
        title: editing ? "Application could not be updated" : "Application could not be created",
        description: errorMessage(error),
        tone: "error",
      }),
  });
  const application = detail.data?.data;
  useEffect(() => {
    if (!editing || !application || ipoId) return;
    setIpoId(application.ipo_id);
    setAccountId(application.demat_account_id);
    setCategoryId(application.category_id);
    setLots(String(application.lots));
    setApplicationNumber(application.application_number ?? "");
    setExternalReference(application.external_reference ?? "");
    setSubmissionDate(application.submission_date?.slice(0, 10) ?? "");
    setApplicationStatus(application.application_status);
    setNotes(application.notes ?? "");
  }, [application, editing, ipoId]);
  return (
    <RouteFormDrawer
      title={editing ? "Edit application" : "Add application"}
      description="Choose an issue, an account, and a configured category. This records an application for tracking; it does not submit an IPO application to a broker or exchange."
      cancelTo="/applications"
      formId="application-form"
      submitLabel="Save application"
      busy={mutation.isPending}
      dirty={dirty}
      disabled={
        Boolean(detail.error || lists.error) ||
        (editing && !application) ||
        (!editing &&
          (!ipoId ||
            !accountId ||
            !categoryId ||
            !price ||
            reviewedApplication?.fingerprint !== applicationFingerprint))
      }
    >
      <form
        id="application-form"
        className="space-y-5"
        noValidate
        onChangeCapture={() => setDirty(true)}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {editing && detail.isLoading ? (
          <div role="status" aria-label="Loading application" aria-busy="true">
            <span className="sr-only">Loading application…</span>
            <SkeletonFormFields fields={6} />
          </div>
        ) : null}
        {detail.error ? (
          <ErrorMessage error={detail.error} onRetry={() => void detail.refetch()} />
        ) : null}
        <div hidden={editing && (detail.isLoading || Boolean(detail.error))}>
          {lists.error ? <ErrorMessage error={lists.error} /> : null}
          {lists.error ? (
            <Button className="mt-2" variant="outline" onClick={() => void lists.refetch()}>
              Retry issue and account options
            </Button>
          ) : null}
          {categoriesQuery.error ? (
            <div className="mb-4 space-y-2">
              <ErrorMessage error={categoriesQuery.error} />
              <Button variant="outline" onClick={() => void categoriesQuery.refetch()}>
                Retry categories
              </Button>
            </div>
          ) : null}
          {!editing ? (
            <FormSection title="Issue and account">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <SearchableSelect
                    label="IPO"
                    placeholder="Choose an IPO"
                    value={ipoId}
                    loading={lists.optionLoading.ipos}
                    disabled={lists.optionLoading.ipos}
                    options={lists.ipos.map((item) => ({
                      value: item.id,
                      label: item.company_name,
                    }))}
                    hasMore={Boolean(lists.iposInfinite.hasNextPage)}
                    loadingMore={lists.iposInfinite.isFetchingNextPage}
                    onLoadMore={() => void lists.iposInfinite.fetchNextPage()}
                    onChange={(value) => {
                      const nextValue = Array.isArray(value) ? (value[0] ?? "") : value;
                      setIpoId(nextValue);
                      setCategoryId("");
                      setPrice("");
                    }}
                  />
                  {validation.errors.ipo_id ? (
                    <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                      {validation.errors.ipo_id}
                    </p>
                  ) : null}
                </div>
                <SearchableFormSelect
                  label="Demat account"
                  required
                  error={validation.errors.demat_account_id}
                  value={accountId}
                  placeholder={
                    lists.optionLoading.accounts ? "Loading accounts…" : "Choose an active account"
                  }
                  disabled={lists.optionLoading.accounts}
                  options={lists.accounts
                    .filter(
                      (account) => account.account_status === "active" && !account.archived_at,
                    )
                    .map((account) => ({
                      value: account.id,
                      label: `${account.holder_name} — ${account.masked_demat_identifier}`,
                    }))}
                  onChange={setAccountId}
                />
                <FormSelect
                  label="Application category"
                  error={validation.errors.category_id}
                  required
                  value={categoryId}
                  disabled={categoriesQuery.isLoading || Boolean(categoriesQuery.error)}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">
                    {categoriesQuery.isLoading
                      ? "Loading categories…"
                      : categoriesQuery.error
                        ? "Categories unavailable"
                        : "Choose a configured category"}
                  </option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.category} (rules v{item.rule_version})
                    </option>
                  ))}
                </FormSelect>
                <FormInput
                  label="Lots"
                  error={validation.errors.lots}
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={lots}
                  onChange={(event) => setLots(event.target.value)}
                />
                <FormSelect
                  label="Price type"
                  error={validation.errors.price_type}
                  value={priceType}
                  onChange={(event) => {
                    setPriceType(event.target.value as "BID" | "CUT_OFF");
                    setPrice(event.target.value === "CUT_OFF" ? (ipo?.cut_off_price ?? "") : "");
                  }}
                >
                  <option value="CUT_OFF">Cut-off</option>
                  <option value="BID">Bid price</option>
                </FormSelect>
                <FormInput
                  label="Price"
                  error={validation.errors.price}
                  required
                  inputMode="decimal"
                  value={price || (priceType === "CUT_OFF" ? (ipo?.cut_off_price ?? "") : "")}
                  onChange={(event) => setPrice(event.target.value)}
                />
                {activeCategory?.category === "SHAREHOLDER" ? (
                  <FormInput
                    label="Shareholder shares on configured record date"
                    error={validation.errors.shareholder_shares}
                    type="number"
                    min="0"
                    value={shareholderShares}
                    onChange={(event) => setShareholderShares(event.target.value)}
                  />
                ) : null}
                {activeCategory?.eligibility_conditions.map((condition) => (
                  <label
                    key={condition.id}
                    className="flex min-h-touch items-center gap-3 rounded-lg border border-border p-3 sm:col-span-2"
                  >
                    <input
                      className="size-5"
                      type="checkbox"
                      checked={eligibilityAnswers[condition.id] === true}
                      onChange={(event) =>
                        setEligibilityAnswers((current) => ({
                          ...current,
                          [condition.id]: event.target.checked,
                        }))
                      }
                    />
                    <span>{condition.description}</span>
                  </label>
                ))}
              </div>
            </FormSection>
          ) : (
            <p className="text-muted">
              Calculation inputs and rule version are preserved and cannot be changed here.
            </p>
          )}
          <Button
            className="mt-4"
            variant="outline"
            disabled={!ipoId || !accountId || !categoryId || !price || calculation.isPending}
            onClick={() => calculation.mutate()}
          >
            Review calculation and duplicates
          </Button>
          {currentReview ? (
            <p role="status" className="mt-3 rounded-lg bg-canvas p-4 text-lg font-semibold">
              Calculation: {currentReview.total_shares} shares · {currentReview.application_amount}
              {currentReview.warnings.map((warning) => (
                <span className="mt-2 block text-base font-normal text-danger" key={warning}>
                  Potential duplicate: {warning}
                </span>
              ))}
            </p>
          ) : null}
          {calculation.error ? <ErrorMessage error={calculation.error} /> : null}
          {activeCategory ? (
            <p className="mt-3 text-sm text-muted">
              Rule version {activeCategory.rule_version}. This account/category combination will be
              checked against the configured issue rules.
            </p>
          ) : null}
          <FormSection title="Record details">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Application number"
                error={validation.errors.application_number}
                value={applicationNumber}
                onChange={(event) => setApplicationNumber(event.target.value)}
              />
              <FormInput
                label="External reference"
                error={validation.errors.external_reference}
                value={externalReference}
                onChange={(event) => setExternalReference(event.target.value)}
              />
              <FormInput
                label="Submission date"
                error={validation.errors.submission_date}
                type="date"
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
              />
              <StatusSelect
                label="Application status"
                value={applicationStatus}
                statuses={statuses}
                onChange={setApplicationStatus}
              />
              <FormTextarea
                label="Notes"
                error={validation.errors.notes}
                fieldClassName="sm:col-span-2"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </FormSection>
        </div>
      </form>
    </RouteFormDrawer>
  );
}

export function ApplicationDetailsPage() {
  const { applicationId } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const detail = useQuery({
    queryKey: ["applications", applicationId],
    enabled: Boolean(session && applicationId),
    queryFn: () => apiRequest<ApplicationResponse>(`/api/applications/${applicationId}`, session!),
  });
  const archive = useMutation({
    mutationFn: () =>
      apiRequest(`/api/applications/${applicationId}`, session!, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      notify({ title: "Application archived", tone: "success" });
      navigate("/applications");
    },
    onError: (error) =>
      notify({
        title: "Application could not be archived",
        description: errorMessage(error),
        tone: "error",
      }),
  });
  const item = detail.data?.data;
  if (detail.isLoading) return <SkeletonDetailsPage rows={10} />;
  if (detail.error)
    return <ErrorMessage error={detail.error} onRetry={() => void detail.refetch()} />;
  if (!item) return <p>Application not found.</p>;
  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink fallback="/applications" allowedPath={/^\/(applications|dashboard)?$/}>
            Back to applications
          </BackLink>
          <h1 className="text-3xl font-bold text-navy">Application details</h1>
          <p className="mt-2 text-base text-muted">
            Historical calculation rules are retained with this record.
          </p>
        </div>
        <DrawerRouteLink className={linkClass} to={`/applications/${item.id}/edit`}>
          Edit status and notes
        </DrawerRouteLink>
      </header>
      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ["IPO", item.ipos ? `${item.ipos.symbol} — ${item.ipos.company_name}` : item.ipo_id],
            [
              "Demat account",
              item.demat_accounts
                ? `${item.demat_accounts.holder_name} — ${item.demat_accounts.masked_demat_identifier}`
                : item.demat_account_id,
            ],
            ["Broker", item.demat_accounts?.broker_name ?? "Not available"],
            ["Category", item.ipo_categories?.category ?? item.category_id],
            ["Lots", item.lots],
            ["Total shares", item.total_shares],
            ["Application amount", item.application_amount],
            ["Application number", item.application_number ?? "Not recorded"],
            ["External reference", item.external_reference ?? "Not recorded"],
            ["Application status", prettyStatus(item.application_status)],
            ["Rule version", item.rule_version],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="font-semibold text-muted">{label}</dt>
              <dd className="mt-1 break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <details className="mt-6">
          <summary className="min-h-touch cursor-pointer font-semibold">
            View saved calculation snapshot
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-canvas p-4 text-sm">
            {JSON.stringify(item.calculation_snapshot, null, 2)}
          </pre>
        </details>
        <ConfirmButton
          className="mt-5"
          variant="outline"
          disabled={archive.isPending}
          title="Archive this record?"
          description="This record will be removed from the active list."
          confirmLabel="Archive"
          onConfirm={() => archive.mutateAsync()}
        >
          Archive application
        </ConfirmButton>
      </Card>
    </div>
  );
}

export function BulkApplicationPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [ipoId, setIpoId] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [lots, setLots] = useState("1");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<"BID" | "CUT_OFF">("CUT_OFF");
  const [preview, setPreview] = useState<ValidationRow[] | null>(null);
  const [holdings, setHoldings] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const lists = useOwnedLists();
  const ipo = lists.ipos.find((item) => item.id === ipoId);
  const categoriesQuery = useQuery({
    queryKey: ["ipo-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<CategoryResponse>(`/api/ipos/${ipoId}/categories`, session!),
  });
  const category = categoriesQuery.data?.data.configurations.find((item) => item.id === categoryId);
  const inputs = selectedAccounts.map((demat_account_id) => ({
    ipo_id: ipoId,
    demat_account_id,
    category_id: categoryId,
    lots: Number(lots),
    price_type: priceType,
    price: price || (priceType === "CUT_OFF" ? ipo?.cut_off_price : null),
    shareholder_shares: holdings[demat_account_id] ? Number(holdings[demat_account_id]) : null,
    eligibility_answers: answers,
  }));
  const previewMutation = useMutation({
    mutationFn: () =>
      apiRequest<BulkPreviewResponse>("/api/applications/bulk/preview", session!, {
        method: "POST",
        body: JSON.stringify({ applications: inputs }),
      }),
    onSuccess: (result) => {
      setPreview(result.data.rows);
    },
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/applications/bulk", session!, {
        method: "POST",
        body: JSON.stringify({ applications: inputs }),
      }),
    onSuccess: () => {
      notify({ title: "Applications created", tone: "success" });
      setPreview(null);
    },
    onError: (error) =>
      notify({
        title: "Applications could not be created",
        description: errorMessage(error),
        tone: "error",
      }),
  });
  const eligibleAccounts = lists.accounts.filter(
    (account) => account.account_status === "active" && !account.archived_at,
  );
  function toggleAccount(id: string) {
    setSelectedAccounts((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    setPreview(null);
  }
  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Bulk application entry</h1>
        <p className="mt-2 text-base text-muted">
          Each account is checked separately. Selecting accounts does not assume category
          eligibility.
        </p>
      </header>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="font-semibold">
            1. Select IPO
            <CustomSelect
              className={fieldClass}
              value={ipoId}
              onChange={(event) => {
                setIpoId(event.target.value);
                setCategoryId("");
                setPreview(null);
              }}
            >
              <option value="">Choose IPO</option>
              {lists.ipos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.company_name}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="font-semibold">
            2. Category
            <CustomSelect
              className={fieldClass}
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPreview(null);
              }}
            >
              <option value="">Choose configured category</option>
              {categoriesQuery.data?.data.configurations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="font-semibold">
            3. Lots
            <input
              className={fieldClass}
              type="number"
              min="1"
              value={lots}
              onChange={(event) => {
                setLots(event.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label className="font-semibold">
            Price type
            <CustomSelect
              className={fieldClass}
              value={priceType}
              onChange={(event) => {
                setPriceType(event.target.value as "BID" | "CUT_OFF");
                setPreview(null);
              }}
            >
              <option value="CUT_OFF">Cut-off</option>
              <option value="BID">Bid</option>
            </CustomSelect>
          </label>
          <label className="font-semibold">
            Price
            <input
              className={fieldClass}
              inputMode="decimal"
              value={price || (priceType === "CUT_OFF" ? (ipo?.cut_off_price ?? "") : "")}
              onChange={(event) => {
                setPrice(event.target.value);
                setPreview(null);
              }}
            />
          </label>
        </div>
        {category ? (
          <p className="mt-4 rounded-lg bg-canvas p-4">
            Category rules version {category.rule_version} · configured for this IPO.
          </p>
        ) : null}
        {category?.category === "SHAREHOLDER" ? (
          <fieldset className="mt-4">
            <legend className="font-semibold">
              Shareholding on the configured record date (enter separately for each account)
            </legend>
            {selectedAccounts.map((id) => (
              <label key={id} className="mt-2 block">
                {eligibleAccounts.find((account) => account.id === id)?.holder_name}
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  value={holdings[id] ?? ""}
                  onChange={(event) => {
                    setHoldings((current) => ({ ...current, [id]: event.target.value }));
                    setPreview(null);
                  }}
                />
              </label>
            ))}
          </fieldset>
        ) : null}
        {category?.eligibility_conditions.map((condition) => (
          <label
            key={condition.id}
            className="mt-3 flex min-h-touch items-center gap-3 rounded-lg border border-border p-3"
          >
            <input
              className="size-5"
              type="checkbox"
              checked={answers[condition.id] ?? false}
              onChange={(event) => {
                setAnswers((current) => ({ ...current, [condition.id]: event.target.checked }));
                setPreview(null);
              }}
            />
            <span>{condition.description}</span>
          </label>
        ))}
        <fieldset className="mt-5">
          <legend className="text-lg font-bold">4. Select active demat accounts</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {eligibleAccounts.map((account) => (
              <label
                key={account.id}
                className="flex min-h-touch items-center gap-3 rounded-lg border border-border p-3"
              >
                <input
                  className="size-5"
                  type="checkbox"
                  checked={selectedAccounts.includes(account.id)}
                  onChange={() => toggleAccount(account.id)}
                />
                <span>
                  <span className="font-semibold">{account.holder_name}</span>
                  <br />
                  <span className="text-sm text-muted">
                    {account.broker_name} · {account.masked_demat_identifier}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {preview ? (
          <div className="mt-5 space-y-3">
            <h2 className="text-xl font-bold">5. Review account-by-account results</h2>
            {preview.map((row) => (
              <div
                key={row.index}
                className={`rounded-lg border p-4 ${row.ready ? "border-border" : "border-danger"}`}
              >
                <p className="font-semibold">
                  {lists.accounts.find((account) => account.id === row.demat_account_id)
                    ?.holder_name ?? "Selected account"}
                  : {row.ready ? `Ready · estimated ${row.application_amount}` : "Needs attention"}
                </p>
                {row.errors.map((error) => (
                  <p role="alert" className="mt-1 text-danger" key={error.code}>
                    {error.message}
                  </p>
                ))}
                {row.warnings.map((warning) => (
                  <p className="mt-1 text-muted" key={warning}>
                    {warning}
                  </p>
                ))}
              </div>
            ))}
            <p>
              {preview.filter((row) => row.ready).length} ready;{" "}
              {preview.filter((row) => !row.ready).length} need correction.
            </p>
          </div>
        ) : null}
        {previewMutation.error ? <ErrorMessage error={previewMutation.error} /> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            disabled={
              !ipoId || !categoryId || !selectedAccounts.length || previewMutation.isPending
            }
            onClick={() => previewMutation.mutate()}
          >
            {previewMutation.isPending ? "Checking accounts…" : "Validate and preview"}
          </Button>
          {preview?.length && preview.every((row) => row.ready) ? (
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              Confirm creation
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function ApplicationImportPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<
    Array<{ row_number: number; values: Record<string, string> }>
  >([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreviewResponse["data"] | null>(null);
  const fields = [
    ["ipo", "IPO symbol or ID"],
    ["demat_account", "Demat account reference"],
    ["category", "Category or category ID"],
    ["lots", "Lots"],
    ["price", "Price"],
    ["price_type", "Price type"],
    ["application_number", "Application number"],
    ["external_reference", "External reference"],
    ["submission_date", "Submission date"],
    ["application_status", "Application status"],
    ["notes", "Notes"],
  ] as const;
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!session || !file) throw new Error("Choose a CSV or XLSX file first.");
      const form = new FormData();
      form.append("file", file);
      if (Object.keys(mapping).length) form.append("mapping", JSON.stringify(mapping));
      return apiRequest<ImportPreviewResponse>("/api/imports/preview", session, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (result) => {
      const data = result.data;
      setPreview(data);
      if (data.headers) setHeaders(data.headers);
      if (data.sample_rows) setSample(data.sample_rows);
    },
    onError: (error) =>
      notify({
        title: "Application import preview failed",
        description: errorMessage(error),
        tone: "error",
      }),
  });
  const confirmMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/imports/confirm", session!, {
        method: "POST",
        body: JSON.stringify({ import_id: preview?.import?.id }),
      }),
    onSuccess: () =>
      notify({
        title: "Application import confirmed",
        description: "Imported applications remain drafts unless you explicitly mapped a status.",
        tone: "success",
      }),
    onError: (error) =>
      notify({
        title: "Application import could not be confirmed",
        description: errorMessage(error),
        tone: "error",
      }),
  });
  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Application import wizard</h1>
        <p className="mt-2 text-base text-muted">
          Upload a CSV or XLSX file up to 5 MB and 500 rows. Nothing is created until you confirm.
        </p>
      </header>
      <Card>
        <label className="block text-lg font-semibold">
          1. Choose CSV or XLSX file
          <input
            className={`${fieldClass} file:mr-4 file:min-h-touch`}
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setHeaders([]);
              setMapping({});
            }}
          />
        </label>
        {file ? <p className="mt-2 text-muted">Selected: {file.name}</p> : null}
        <Button
          className="mt-4"
          disabled={!file || previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
        >
          Read columns
        </Button>
        {headers.length ? (
          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-bold">2. Match your columns</h2>
            <p className="text-base text-muted">
              Required: IPO, demat account, category, lots, price, and price type. Price must be
              included so old applications are not recalculated using assumed prices. Account
              references must match exactly one of your accounts.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(([name, label]) => (
                <label key={name} className="font-semibold">
                  {["ipo", "demat_account", "category", "lots", "price", "price_type"].includes(
                    name,
                  )
                    ? `${label} (required)`
                    : label}
                  <CustomSelect
                    className={fieldClass}
                    value={mapping[name] ?? ""}
                    onChange={(event) =>
                      setMapping((current) => ({ ...current, [name]: event.target.value }))
                    }
                  >
                    <option value="">Do not map</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </CustomSelect>
                </label>
              ))}
            </div>
            <details>
              <summary className="min-h-touch cursor-pointer font-semibold">
                View first rows of your file
              </summary>
              <pre className="overflow-x-auto rounded bg-canvas p-3 text-sm">
                {JSON.stringify(sample, null, 2)}
              </pre>
            </details>
            <Button
              disabled={
                !mapping.ipo ||
                !mapping.demat_account ||
                !mapping.category ||
                !mapping.lots ||
                !mapping.price ||
                !mapping.price_type ||
                previewMutation.isPending
              }
              onClick={() => previewMutation.mutate()}
            >
              Validate and preview
            </Button>
          </section>
        ) : null}
        {preview?.rows ? (
          <section className="mt-6">
            <h2 className="text-xl font-bold">3. Preview {preview.summary?.total} rows</h2>
            <p className="mt-2">
              Ready: {preview.summary?.ready} · Potential duplicates: {preview.summary?.duplicate} ·
              Errors: {preview.summary?.invalid}
            </p>
            <div className="mt-3 max-h-[28rem] space-y-2 overflow-auto">
              {preview.rows.map((row) => (
                <article key={row.row_number} className="rounded-lg border border-border p-3">
                  <p className="font-semibold">
                    Spreadsheet row {row.row_number}:{" "}
                    {row.row_status === "ready"
                      ? "Ready"
                      : row.row_status === "duplicate"
                        ? "Potential duplicate — review carefully"
                        : "Needs correction"}
                  </p>
                  {row.errors.map((error) => (
                    <p className="text-danger" key={error}>
                      {error}
                    </p>
                  ))}
                  {row.warnings.map((warning) => (
                    <p className="text-muted" key={warning}>
                      {warning}
                    </p>
                  ))}
                </article>
              ))}
            </div>
            <Button
              className="mt-4"
              disabled={confirmMutation.isPending || !preview.import}
              onClick={() => confirmMutation.mutate()}
            >
              Confirm ready and reviewed rows
            </Button>
          </section>
        ) : null}
        <Link
          className="mt-5 inline-flex min-h-touch items-center text-action no-underline transition-colors hover:text-navy visited:text-action"
          to="/applications/import-history"
        >
          View import history
        </Link>
      </Card>
    </div>
  );
}

export function ApplicationImportHistoryPage() {
  const { session } = useAuth();
  const { importId } = useParams();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["application-imports", importId ?? "history"],
    enabled: Boolean(session && !importId),
    queryFn: () => apiRequest<ImportHistoryResponse>(`/api/imports/history`, session!),
  });
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">
            {importId ? "Import error report" : "Application import history"}
          </h1>
          <p className="mt-2 text-base text-muted">
            Review previous batches and safely retry or reverse confirmed imports.
          </p>
        </div>
        <Link className={linkClass} to="/applications/import">
          Import applications
        </Link>
      </header>
      {error ? <ErrorMessage error={error} onRetry={() => void refetch()} /> : null}
      {importId ? (
        <ImportReport importId={importId} />
      ) : (
        <Card>
          {isLoading ? (
            <div role="status" aria-label="Loading application import history" aria-busy="true">
              <span className="sr-only">Loading import history…</span>
              <SkeletonTable rows={5} cols={5} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable minWidth="620px">
                <thead>
                  <tr>
                    <th className="p-3">File</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Rows</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data.imports ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="p-3">{item.file_name}</td>
                      <td className="p-3">{prettyStatus(item.status)}</td>
                      <td className="p-3">
                        {item.imported_rows} / {item.total_rows}
                      </td>
                      <td className="p-3">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="p-3">
                        <Link
                          className="text-action no-underline transition-colors hover:text-navy visited:text-action"
                          to={`/applications/import-history/${item.id}`}
                        >
                          Open report
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              {data && data.data.imports.length === 0 ? (
                <p className="p-3">No imports yet.</p>
              ) : null}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ImportReport({ importId }: { importId: string }) {
  const { session } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const report = useQuery({
    queryKey: ["application-import-report", importId],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<{
        data: {
          import: { id: string; file_name: string; status: string };
          rows: Array<{
            row_number: number;
            row_status: string;
            record: Record<string, unknown>;
            errors: string[];
            warnings: string[];
          }>;
        };
      }>(`/api/imports/${importId}/report`, session!),
  });
  const reverse = useMutation({
    mutationFn: () => apiRequest(`/api/imports/${importId}/reverse`, session!, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["application-import-report", importId] });
      notify({ title: "Application import reversed", tone: "success" });
    },
    onError: (error) =>
      notify({
        title: "Application import could not be reversed",
        description: errorMessage(error),
        tone: "error",
      }),
  });
  if (report.isLoading) return <SkeletonDetailsPage rows={6} />;
  if (report.error)
    return <ErrorMessage error={report.error} onRetry={() => void report.refetch()} />;
  const item = report.data?.data;
  if (!item) return null;
  return (
    <Card>
      <h2 className="text-xl font-bold">{item.import.file_name}</h2>
      <p className="mt-1">Status: {prettyStatus(item.import.status)}</p>
      <div className="mt-4 max-h-[32rem] space-y-3 overflow-auto">
        {item.rows.map((row) => (
          <article key={row.row_number} className="rounded-lg border border-border p-3">
            <p className="font-semibold">
              Row {row.row_number} — {prettyStatus(row.row_status)}
            </p>
            <p className="text-sm text-muted">
              {String(row.record.ipo_id ?? row.record.ipo ?? "")} ·{" "}
              {String(row.record.demat_account_id ?? "")}
            </p>
            {row.errors.map((message) => (
              <p className="text-danger" key={message}>
                {message}
              </p>
            ))}
            {row.warnings.map((message) => (
              <p className="text-muted" key={message}>
                {message}
              </p>
            ))}
          </article>
        ))}
      </div>
      {item.import.status === "confirmed" ? (
        <ConfirmButton
          className="mt-4"
          variant="outline"
          disabled={reverse.isPending}
          title="Confirm this action"
          description="Archive only applications created by this import, if unchanged?"
          confirmLabel="Continue"
          onConfirm={() => reverse.mutateAsync()}
        >
          Reverse import
        </ConfirmButton>
      ) : null}
    </Card>
  );
}

function StatusSelect({
  label,
  value,
  statuses: values,
  onChange,
}: {
  label: string;
  value: string;
  statuses: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="font-semibold">
      {label}
      <CustomSelect
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All statuses</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {prettyStatus(item)}
          </option>
        ))}
      </CustomSelect>
    </label>
  );
}

function prettyStatus(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError || error instanceof Error
    ? error.message
    : "The request failed.";
}

function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-white p-3 text-danger">
      <p>{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-2 border-danger/30 text-danger" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
