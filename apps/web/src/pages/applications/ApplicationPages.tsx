import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, CircleDollarSign, Landmark, Layers3, ReceiptText } from "lucide-react";
import type {
  DematAccount,
  IpoApplication,
  IpoCatalogCategoryConfiguration,
  IpoCatalogRecord,
  IpoCategoryConfiguration,
  IpoRecord,
} from "@ipo-mania/shared";
import { isIpoReadyForApplication } from "@ipo-mania/shared";
import {
  calculateApplicationAmount,
  calculateMaximumEligibleLots,
  calculateMinimumEligibleLots,
  calculateTotalShares,
  type CategoryRules,
  type IpoPricingInput,
} from "@ipo-mania/financial-engine";
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
import { ApiRequestError, apiBaseUrl, apiRequest } from "../../lib/api";
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
        ipos?: { symbol: string | null; company_name: string };
        demat_accounts?: { holder_name: string };
        ipo_categories?: { category: string } | null;
      }
    >;
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
};
type ApplicationSummaryResponse = {
  data: {
    total: number;
    distinct_ipo_count: number;
    category_counts: Record<"RETAIL" | "SHNI" | "BHNI" | "SHAREHOLDER", number>;
  };
};
type IpoListResponse = {
  data: { ipos: IpoRecord[]; pagination?: { page: number; total_pages: number } };
};
type IpoCatalogListResponse = {
  data: {
    ipos: IpoCatalogRecord[];
    pagination?: { page: number; total_pages: number };
  };
};
type IpoResponse = { data: IpoRecord };
type AccountListResponse = {
  data: { accounts: DematAccount[]; pagination?: { page: number; totalPages: number } };
};
type ApplicationCategoryConfiguration = IpoCategoryConfiguration | IpoCatalogCategoryConfiguration;
type CategoryResponse = { data: { configurations: ApplicationCategoryConfiguration[] } };
type ApplicationLotBounds = { minimum: number | null; maximum: number | null; increment: number };
type ApplicationResponse = {
  data: IpoApplication & {
    ipos?: { company_name: string | null; symbol: string | null };
    demat_accounts?: { holder_name: string | null; masked_demat_identifier: string | null };
    ipo_categories?: { category: string };
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
const defaultApplicationFilters: ApplicationFilters = {
  dematAccountId: "",
  archiveStatus: "active",
  reference: "",
  categoryId: "",
  submissionFrom: "",
  submissionTo: "",
};

function filtersFromParams(params: URLSearchParams): ApplicationFilters {
  return {
    dematAccountId: params.get("demat_account_id") ?? "",
    archiveStatus:
      params.get("include_archived") === "true"
        ? "archived"
        : params.get("include_archived") === "all"
          ? "all"
          : "active",
    reference: params.get("search") ?? "",
    categoryId: params.get("category_id") ?? "",
    submissionFrom: params.get("submission_from") ?? "",
    submissionTo: params.get("submission_to") ?? "",
  };
}

function filterCount(filters: ApplicationFilters) {
  return [
    filters.dematAccountId,
    filters.archiveStatus !== "active",
    filters.reference,
    filters.categoryId,
    filters.submissionFrom || filters.submissionTo,
  ].filter(Boolean).length;
}

function applicationReturnPath(value: string | null) {
  return value && /^\/ipos\/(?:catalog\/)?[0-9a-f-]{36}$/i.test(value) ? value : "/applications";
}

function useOwnedLists() {
  const { session } = useAuth();
  const ipos = useInfiniteQuery({
    queryKey: ["ipos", "application-options"],
    enabled: Boolean(session),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequest<IpoListResponse>(`/api/ipos?page=${pageParam}&page_size=25`, session!),
    getNextPageParam: (lastPage) => {
      const { page, total_pages: totalPages } = lastPage.data.pagination ?? {};
      return page && totalPages && page < totalPages ? page + 1 : undefined;
    },
  });
  const applications = useQuery({
    queryKey: ["applications", "applied-ipo-status"],
    enabled: Boolean(session),
    queryFn: async () => {
      const loadPage = (page: number) =>
        apiRequest<ApplicationListResponse>(
          `/api/applications?page=${page}&page_size=100&include_archived=all`,
          session!,
        );
      const first = await loadPage(1);
      const totalPages = first.data.pagination?.total_pages ?? 1;
      if (totalPages <= 1) return first;
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => loadPage(index + 2)),
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
  const appliedIpoIds = new Set(
    (applications.data?.data.applications ?? []).map((application) => application.ipo_id),
  );
  const appliedStatusByIpoId = new Map(
    (applications.data?.data.applications ?? [])
      .filter((application) => application.ipo_id)
      .map((application) => [application.ipo_id, application.application_status]),
  );
  return {
    ipos: ipos.data?.pages.flatMap((page) => page.data.ipos) ?? [],
    accounts: accounts.data?.data.accounts ?? [],
    appliedIpoIds,
    appliedStatusByIpoId,
    loading: ipos.isLoading || accounts.isLoading || applications.isLoading,
    optionLoading: {
      ipos: ipos.isLoading,
      accounts: accounts.isLoading,
      applications: applications.isLoading,
    },
    error: ipos.error ?? accounts.error ?? applications.error,
    refetch: () => Promise.all([ipos.refetch(), accounts.refetch(), applications.refetch()]),
    iposInfinite: ipos,
  };
}

export function ApplicationDashboardPage() {
  const { session } = useAuth();
  const [listParams] = useSearchParams();
  const selectedIpoId = listParams.get("ipo_id") ?? "";
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["applications", "dashboard", selectedIpoId || "all"],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<ApplicationSummaryResponse>(
        `/api/applications/summary${selectedIpoId ? `?ipo_id=${selectedIpoId}` : ""}`,
        session!,
      ),
  });
  const totals = [
    ["Retail", data?.data.category_counts.RETAIL],
    ["sHNI", data?.data.category_counts.SHNI],
    ["bHNI", data?.data.category_counts.BHNI],
    ["Shareholder", data?.data.category_counts.SHAREHOLDER],
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
  const selectedIpoId = listParams.get("ipo_id") ?? "";
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
      demat_account_id: filters.dematAccountId || null,
      include_archived:
        filters.archiveStatus === "active"
          ? null
          : filters.archiveStatus === "archived"
            ? "true"
            : "all",
      search: filters.reference || null,
      category_id: filters.categoryId || null,
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
  const params = new URLSearchParams({
    page: String(page),
    page_size: "50",
    include_archived:
      appliedFilters.archiveStatus === "archived"
        ? "true"
        : appliedFilters.archiveStatus === "all"
          ? "all"
          : "false",
    ...(selectedIpoId ? { ipo_id: selectedIpoId } : {}),
    ...(appliedFilters.dematAccountId ? { demat_account_id: appliedFilters.dematAccountId } : {}),
    ...(appliedFilters.categoryId ? { category_id: appliedFilters.categoryId } : {}),
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
  const summary = useQuery({
    queryKey: ["applications", "summary", "all"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<ApplicationSummaryResponse>("/api/applications/summary", session!),
  });
  const ipoOptions = lists.ipos.map((ipo) => ({
    value: ipo.id,
    label: ipo.company_name,
    badge: ipo.status ? prettyStatus(ipo.status) : undefined,
  }));
  const accountOptions = lists.accounts.map((account) => ({
    value: account.id,
    label: account.holder_name,
    description: account.masked_demat_identifier,
  }));
  const categoryOptions = (categoriesQuery.data ?? []).map((category) => ({
    value: category.id,
    label: category.category,
  }));
  const filterChips: ActiveFilterChip[] = [
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
    ...(appliedFilters.submissionFrom || appliedFilters.submissionTo
      ? [
          {
            key: "submissionDate",
            label: `${appliedFilters.submissionFrom || "Any date"} – ${appliedFilters.submissionTo || "Any date"}`,
          },
        ]
      : []),
  ];
  async function exportCsv() {
    const response = await fetch(`${apiBaseUrl}/api/applications/export?${params}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
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
          if (key === "submissionDate") {
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
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        loading={{
          accounts: lists.optionLoading.accounts,
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
          <div className="min-w-64 flex-1 sm:max-w-md">
            <SearchableSelect
              label="View applications for IPO"
              placeholder="All IPOs"
              searchPlaceholder="Search IPOs..."
              options={ipoOptions}
              value={selectedIpoId}
              onChange={(value) => updateListParams({ ipo_id: (value as string) || null })}
              loading={lists.optionLoading.ipos}
              emptyLabel="No IPOs match your search."
            />
          </div>
          <p className="min-h-touch pt-1 text-sm font-semibold text-muted" aria-live="polite">
            {summary.data?.data.distinct_ipo_count ?? 0} different IPO
            {(summary.data?.data.distinct_ipo_count ?? 0) === 1 ? "" : "s"} applied
          </p>
        </div>
        <div className="overflow-x-auto">
          <DataTable minWidth="640px">
            <thead>
              <tr className="border-b border-border text-sm text-muted">
                <th scope="col" className="p-3 text-left">
                  IPO
                </th>
                <th scope="col" className="p-3 text-left">
                  Category
                </th>
                <th scope="col" className="p-3 text-left">
                  Account
                </th>
                <th scope="col" className="p-3 text-right">
                  Lots / amount
                </th>
                <th scope="col" className="p-3 text-left">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody aria-busy={isLoading}>
              {isLoading ? (
                <SkeletonTableRows rows={6} cols={5} />
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="p-3">
                      <Link
                        className="font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
                        to={`/applications/${row.id}`}
                        state={{ from: `${location.pathname}${location.search}` }}
                      >
                        {row.ipos?.company_name || row.ipos?.symbol || "IPO"}
                      </Link>
                    </td>
                    <td className="p-3">
                      {formatCategory(row.ipo_categories?.category ?? row.category_code)}
                    </td>
                    <td className="p-3">{row.demat_accounts?.holder_name ?? "Account"}</td>
                    <td className="p-3 text-right tabular-nums whitespace-nowrap">
                      {row.lots} lots · {row.application_amount}
                    </td>
                    <td className="p-3 text-sm tabular-nums whitespace-nowrap">
                      {formatDateTime(row.submission_date ?? row.created_at)}
                    </td>
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
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { notify } = useToast();
  const lists = useOwnedLists();
  const [dirty, setDirty] = useState(false);
  const validation = useFormValidation();
  const [ipoId, setIpoId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [lots, setLots] = useState("1");
  const [price, setPrice] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCatalogIpo, setSelectedCatalogIpo] = useState<IpoCatalogRecord | null>(null);
  const preselectedAccountId = searchParams.get("demat_account_id");
  const preselectedIpoId = searchParams.get("ipo_id");
  const returnTo = applicationReturnPath(searchParams.get("return_to"));
  const preselectedIpo = useQuery({
    queryKey: ["ipo", preselectedIpoId],
    enabled: Boolean(session && !editing && preselectedIpoId),
    queryFn: () => apiRequest<IpoResponse>(`/api/ipos/${preselectedIpoId}`, session!),
  });
  const catalogIpos = useInfiniteQuery({
    queryKey: ["ipo-catalog", "application-options"],
    enabled: Boolean(session && !editing),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequest<IpoCatalogListResponse>(
        `/api/ipos/catalog?page=${pageParam}&page_size=25`,
        session!,
      ),
    getNextPageParam: (lastPage) => {
      const { page, total_pages: totalPages } = lastPage.data.pagination ?? {};
      return page && totalPages && page < totalPages ? page + 1 : undefined;
    },
  });
  const categoriesQuery = useQuery({
    queryKey: [selectedCatalogIpo ? "ipo-catalog-categories" : "ipo-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () =>
      apiRequest<CategoryResponse>(
        selectedCatalogIpo
          ? `/api/ipos/catalog/${ipoId}/categories`
          : `/api/ipos/${ipoId}/categories`,
        session!,
      ),
  });
  const categoryConfigurations = categoriesQuery.data?.data.configurations ?? [];
  // A category can have several immutable rule versions. An application must use the
  // current version, rather than presenting duplicate category choices to the user.
  const categories = Array.from(
    categoryConfigurations.reduce((latest, configuration) => {
      const current = latest.get(configuration.category);
      if (!current || configuration.rule_version > current.rule_version)
        latest.set(configuration.category, configuration);
      return latest;
    }, new Map<IpoCategoryConfiguration["category"], ApplicationCategoryConfiguration>()),
  ).map(([, configuration]) => configuration);
  const activeCategory = categories.find((category) => category.id === categoryId);
  const personalIpos = lists.ipos.filter((item) => !item.source_catalog_id);
  const sharedCatalogIpos = catalogIpos.data?.pages.flatMap((page) => page.data.ipos) ?? [];
  const selectedIpo =
    selectedCatalogIpo ??
    personalIpos.find((item) => item.id === ipoId) ??
    (preselectedIpo.data?.data.id === ipoId ? preselectedIpo.data.data : null);
  const selectedIpoIsApplied = Boolean(ipoId && lists.appliedIpoIds.has(ipoId));
  const enteredLots = Number(lots);
  const lotBounds = getApplicationLotBounds(
    selectedIpo && typeof selectedIpo.lot_size === "number"
      ? { lot_size: selectedIpo.lot_size }
      : null,
    activeCategory,
    price,
  );
  const validLotSelection = Boolean(
    Number.isSafeInteger(enteredLots) &&
      enteredLots > 0 &&
      enteredLots <= 1_000_000 &&
      (!activeCategory ||
        (lotBounds !== null &&
          lotBounds.minimum !== null &&
          enteredLots >= lotBounds.minimum &&
          (lotBounds.maximum === null || enteredLots <= lotBounds.maximum) &&
          (enteredLots - lotBounds.minimum) % lotBounds.increment === 0)),
  );
  const estimatedTotalShares =
    selectedIpo &&
    typeof selectedIpo.lot_size === "number" &&
    Number.isSafeInteger(enteredLots) &&
    enteredLots > 0 &&
    Number.isSafeInteger(selectedIpo.lot_size * enteredLots)
      ? selectedIpo.lot_size * enteredLots
      : null;
  useEffect(() => {
    if (editing || dirty || ipoId || !preselectedIpo.data?.data.id) return;
    setIpoId(preselectedIpo.data.data.id);
    setPrice(preselectedIpo.data.data.issue_price_max ?? "");
  }, [dirty, editing, ipoId, preselectedIpo.data]);
  useEffect(() => {
    if (editing || dirty || accountId || !preselectedAccountId) return;
    const account = lists.accounts.find((item) => item.id === preselectedAccountId);
    if (account?.account_status === "active" && !account.archived_at) {
      setAccountId(account.id);
    }
  }, [accountId, dirty, editing, lists.accounts, preselectedAccountId]);
  const priceType = activeCategory
    ? activeCategory.allowed_price_types.includes("BID")
      ? "BID"
      : "CUT_OFF"
    : "BID";
  const applicationPayload = {
    ipo_id: ipoId,
    demat_account_id: accountId,
    category_id: categoryId || null,
    category_code: categoryCode || undefined,
    lots: Number(lots),
    price_type: priceType,
    price,
    shareholder_shares: null,
    eligibility_answers: {},
    application_number: null,
    external_reference: null,
    submission_date: null,
    application_status: "DRAFT",
    mandate_status: "UNKNOWN",
    allotment_status: "UNKNOWN",
    notes: notes || null,
  };
  const localCalculation = (() => {
    if (
      !selectedIpo ||
      typeof selectedIpo.lot_size !== "number" ||
      !Number.isSafeInteger(enteredLots) ||
      enteredLots <= 0 ||
      !price
    )
      return null;
    try {
      const totalShares = calculateTotalShares(enteredLots, selectedIpo.lot_size);
      return { totalShares, applicationAmount: calculateApplicationAmount(totalShares, price) };
    } catch {
      return null;
    }
  })();
  const detail = useQuery({
    queryKey: ["applications", applicationId],
    enabled: Boolean(session && editing && applicationId),
    queryFn: () => apiRequest<ApplicationResponse>(`/api/applications/${applicationId}`, session!),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Sign in to save applications.");
      let body = editing
        ? {
            application_number: applicationNumber || null,
            external_reference: externalReference || null,
            notes: notes || null,
          }
        : applicationPayload;
      if (!editing && selectedCatalogIpo) {
        const imported = await apiRequest<IpoResponse>(
          `/api/ipos/catalog/${selectedCatalogIpo.id}/import`,
          session,
          { method: "POST" },
        );
        if (categoryId) {
          const importedCategories = await apiRequest<{
            data: { configurations: IpoCategoryConfiguration[] };
          }>(`/api/ipos/${imported.data.id}/categories`, session);
          const importedCategory = importedCategories.data.configurations.find(
            (configuration) => configuration.source_catalog_rule_id === categoryId,
          );
          if (!importedCategory) {
            throw new Error("The selected shared IPO category could not be prepared.");
          }
          body = {
            ...applicationPayload,
            ipo_id: imported.data.id,
            category_id: importedCategory.id,
          };
        } else {
          body = { ...applicationPayload, ipo_id: imported.data.id };
        }
      }
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["ipo-applications"] }),
      ]);
      navigate(returnTo, {
        state: { successMessage: editing ? "Application updated." : "Application created." },
      });
    },
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
    setCategoryId(application.category_id ?? "");
    setCategoryCode(application.category_code);
    setLots(String(application.lots));
    setApplicationNumber(application.application_number ?? "");
    setExternalReference(application.external_reference ?? "");
    setNotes(application.notes ?? "");
  }, [application, editing, ipoId]);
  return (
    <RouteFormDrawer
      title={editing ? "Edit application" : "Add application"}
      description="Choose an issue, account, category, and lot count. This records an application for tracking; it does not submit an IPO application."
      cancelTo={returnTo}
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
            !categoryCode ||
            categoriesQuery.isLoading ||
            Boolean(categoriesQuery.error) ||
            !price ||
            !localCalculation ||
            !validLotSelection ||
            selectedIpoIsApplied))
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
          {preselectedIpo.error ? <ErrorMessage error={preselectedIpo.error} /> : null}
          {preselectedIpo.error ? (
            <Button
              className="mb-4 mt-2"
              variant="outline"
              onClick={() => void preselectedIpo.refetch()}
            >
              Retry shared IPO
            </Button>
          ) : null}
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
                    loading={lists.optionLoading.ipos || catalogIpos.isLoading}
                    disabled={lists.optionLoading.ipos || catalogIpos.isLoading}
                    emptyLabel={
                      personalIpos.length === 0 && sharedCatalogIpos.length === 0
                        ? "No IPOs are available."
                        : "No matching options."
                    }
                    options={[
                      ...personalIpos.map((item) => ({
                        value: item.id,
                        label: item.company_name,
                        badge: lists.appliedIpoIds.has(item.id) ? "Applied" : undefined,
                        description: lists.appliedIpoIds.has(item.id)
                          ? "Already applied for this IPO"
                          : undefined,
                        disabled: lists.appliedIpoIds.has(item.id),
                      })),
                      ...sharedCatalogIpos.map((item) => ({
                        value: item.id,
                        label: item.company_name,
                        description: isIpoReadyForApplication(item)
                          ? "Shared catalog"
                          : "Shared catalog · Issue data incomplete",
                        disabled: !isIpoReadyForApplication(item),
                      })),
                    ]}
                    hasMore={Boolean(lists.iposInfinite.hasNextPage || catalogIpos.hasNextPage)}
                    loadingMore={
                      lists.iposInfinite.isFetchingNextPage || catalogIpos.isFetchingNextPage
                    }
                    onLoadMore={() => {
                      if (lists.iposInfinite.hasNextPage) void lists.iposInfinite.fetchNextPage();
                      if (catalogIpos.hasNextPage) void catalogIpos.fetchNextPage();
                    }}
                    onChange={(value) => {
                      const nextValue = Array.isArray(value) ? (value[0] ?? "") : value;
                      const catalogIpo = sharedCatalogIpos.find((item) => item.id === nextValue);
                      setSelectedCatalogIpo(catalogIpo ?? null);
                      setIpoId(nextValue);
                      setCategoryId("");
                      setCategoryCode("");
                      const ownedIpo = personalIpos.find((item) => item.id === nextValue);
                      setPrice(catalogIpo?.issue_price_max ?? ownedIpo?.issue_price_max ?? "");
                    }}
                  />
                  {!lists.optionLoading.ipos &&
                  !catalogIpos.isLoading &&
                  personalIpos.length === 0 &&
                  sharedCatalogIpos.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      No IPOs are available in your records or the shared catalog.{" "}
                      <Link
                        className="font-semibold text-action underline underline-offset-2 hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                        to="/ipos/new"
                      >
                        Add to catalog
                      </Link>{" "}
                      and record applications with manually selected lots.
                    </p>
                  ) : null}
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
                  label="Investor category"
                  error={validation.errors.category_code ?? validation.errors.category_id}
                  required
                  value={categoryId || categoryCode}
                  disabled={categoriesQuery.isLoading}
                  onChange={(event) => {
                    const nextCategory = categories.find((item) => item.id === event.target.value);
                    setCategoryId(nextCategory?.id ?? "");
                    setCategoryCode(nextCategory?.category ?? event.target.value);
                    if (nextCategory) {
                      const bounds = getApplicationLotBounds(
                        selectedIpo && typeof selectedIpo.lot_size === "number"
                          ? { lot_size: selectedIpo.lot_size }
                          : null,
                        nextCategory,
                        price,
                      );
                      setLots(
                        bounds
                          ? adjustLotsToBounds(String(nextCategory.default_lots), bounds)
                          : String(nextCategory.default_lots),
                      );
                    } else {
                      setLots("1");
                    }
                  }}
                >
                  <option value="">
                    {categoriesQuery.isLoading
                      ? "Loading categories…"
                      : categoriesQuery.error
                        ? "Categories unavailable"
                        : "Choose an investor category"}
                  </option>
                  {(["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"] as const).map((code) => {
                    const item = categories.find((category) => category.category === code);
                    return (
                      <option key={code} value={item?.id ?? code}>
                        {formatCategory(code)}
                      </option>
                    );
                  })}
                  {categories
                    .filter((item) => item.category === "EMPLOYER")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatCategory(item.category)}
                      </option>
                    ))}
                </FormSelect>
                <div className="sm:col-span-2">
                  <FormInput
                    label="Lots"
                    error={validation.errors.lots}
                    required
                    type="number"
                    min={activeCategory ? (lotBounds?.minimum ?? undefined) : 1}
                    max={activeCategory ? (lotBounds?.maximum ?? undefined) : 1_000_000}
                    step={activeCategory ? (lotBounds?.increment ?? 1) : 1}
                    value={lots}
                    disabled={
                      categoriesQuery.isLoading ||
                      Boolean(categoriesQuery.error) ||
                      (activeCategory &&
                        (!lotBounds ||
                          lotBounds.minimum === null ||
                          (lotBounds.maximum !== null && lotBounds.maximum < lotBounds.minimum)))
                    }
                    onChange={(event) => setLots(event.target.value)}
                  />
                  {lotBounds?.minimum !== null &&
                  lotBounds?.minimum !== undefined &&
                  Number.isSafeInteger(enteredLots) &&
                  enteredLots < lotBounds.minimum ? (
                    <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                      Select at least {lotBounds.minimum} lot(s).
                    </p>
                  ) : null}
                  {lotBounds?.maximum !== null &&
                  lotBounds?.maximum !== undefined &&
                  Number.isSafeInteger(enteredLots) &&
                  enteredLots > lotBounds.maximum ? (
                    <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                      Select no more than {lotBounds.maximum} lot(s).
                    </p>
                  ) : null}
                  {lotBounds?.minimum !== null &&
                  lotBounds?.minimum !== undefined &&
                  Number.isSafeInteger(enteredLots) &&
                  enteredLots >= lotBounds.minimum &&
                  (enteredLots - lotBounds.minimum) % lotBounds.increment !== 0 ? (
                    <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                      Select lots in increments of {lotBounds.increment}.
                    </p>
                  ) : null}
                </div>
                {selectedIpo?.lot_size ? (
                  <p className="text-sm text-muted sm:col-span-2">
                    One lot contains {selectedIpo.lot_size.toLocaleString("en-IN")} shares.
                    {estimatedTotalShares !== null
                      ? ` ${enteredLots.toLocaleString("en-IN")} lot(s) = ${estimatedTotalShares.toLocaleString("en-IN")} shares.`
                      : ""}
                  </p>
                ) : null}
                <FormInput
                  label="Price"
                  error={validation.errors.price}
                  required
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => {
                    const nextPrice = event.target.value;
                    setPrice(nextPrice);
                    if (activeCategory) {
                      const bounds = getApplicationLotBounds(
                        selectedIpo && typeof selectedIpo.lot_size === "number"
                          ? { lot_size: selectedIpo.lot_size }
                          : null,
                        activeCategory,
                        nextPrice,
                      );
                      if (bounds) setLots((current) => adjustLotsToBounds(current, bounds));
                    }
                  }}
                />
              </div>
            </FormSection>
          ) : (
            <p className="text-muted">
              Calculation inputs and rule version are preserved and cannot be changed here.
            </p>
          )}
          {localCalculation ? (
            <p role="status" className="mt-3 rounded-lg bg-canvas p-4 text-lg font-semibold">
              Total amount: ₹{localCalculation.applicationAmount}
              <span className="mt-1 block text-base font-normal">
                Total shares: {localCalculation.totalShares.toLocaleString("en-IN")}
              </span>
            </p>
          ) : null}
          {editing ? (
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
          ) : null}
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
  const snapshot = asRecord(item.calculation_snapshot);
  const calculationInput = asRecord(snapshot.calculation_input);
  const snapshotIpo = asRecord(calculationInput.ipo ?? snapshot.ipo);
  const categoryRules = asRecord(calculationInput.rules ?? snapshot.category_configuration);
  const ipoName = item.ipos?.company_name?.trim() || "IPO details unavailable";
  const ipoSymbol = item.ipos?.symbol?.trim();
  const accountName = item.demat_accounts?.holder_name?.trim() || "Demat account";
  const maskedIdentifier = item.demat_accounts?.masked_demat_identifier?.trim();
  const price = calculationInput.price;
  const priceType = calculationInput.price_type;
  const submittedDate = item.submission_date ?? item.created_at;
  const historicalRuleDetails: Array<[string, unknown]> = [
    ["Minimum lots", categoryRules.minimum_lots],
    ["Maximum lots", categoryRules.maximum_lots],
    ["Lot increment", categoryRules.lot_increment],
    ["Minimum investment", categoryRules.minimum_investment],
    ["Maximum investment", categoryRules.maximum_investment],
  ];

  return (
    <div className="w-full space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <BackLink fallback="/applications" allowedPath={/^\/(applications|dashboard)?$/}>
            Back to applications
          </BackLink>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-navy">Application details</h1>
            <ApplicationStatusBadge status={item.application_status} />
          </div>
          <p className="mt-2 text-base text-muted">
            {ipoSymbol ? `${ipoSymbol} · ` : ""}
            {ipoName}
          </p>
        </div>
        <DrawerRouteLink className={linkClass} to={`/applications/${item.id}/edit`}>
          Edit application details
        </DrawerRouteLink>
      </header>
      <section
        aria-label="Application summary"
        className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50 shadow-card"
      >
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-action">
              <CircleDollarSign aria-hidden="true" className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muted">Total application amount</p>
              <p className="mt-1 break-words text-3xl font-bold tracking-tight text-navy">
                {formatRupees(item.application_amount)}
              </p>
              <p className="mt-2 text-sm text-muted">
                {formatCategory(item.ipo_categories?.category ?? item.category_code)} category
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <SummaryMetric
              icon={<Layers3 aria-hidden="true" className="size-4" />}
              label="Lots applied"
              value={item.lots.toLocaleString("en-IN")}
            />
            <SummaryMetric
              icon={<ReceiptText aria-hidden="true" className="size-4" />}
              label="Total shares"
              value={item.total_shares.toLocaleString("en-IN")}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <DetailSectionHeading
            icon={<ReceiptText aria-hidden="true" className="size-5" />}
            title="Application"
          />
          <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <ApplicationDetail label="IPO" value={ipoName} />
            <ApplicationDetail
              label="Category"
              value={formatCategory(item.ipo_categories?.category ?? item.category_code)}
            />
            <ApplicationDetail
              label="Application number"
              value={item.application_number || "Not added"}
            />
            <ApplicationDetail
              label="External reference"
              value={item.external_reference || "Not added"}
            />
            <ApplicationDetail label="Rule version" value={item.rule_version ?? "Not recorded"} />
          </dl>
        </Card>

        <Card>
          <DetailSectionHeading
            icon={<Landmark aria-hidden="true" className="size-5" />}
            title="Account & timeline"
          />
          <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <ApplicationDetail
              label="Demat account"
              value={maskedIdentifier ? `${accountName} · ${maskedIdentifier}` : accountName}
            />
            <ApplicationDetail
              label="Submitted"
              value={formatDateTime(submittedDate)}
              icon={<CalendarDays aria-hidden="true" className="size-4" />}
            />
            <ApplicationDetail
              label="Last updated"
              value={formatDateTime(item.updated_at)}
              icon={<CalendarDays aria-hidden="true" className="size-4" />}
            />
            {item.notes ? (
              <ApplicationDetail label="Notes" value={item.notes} className="sm:col-span-2" />
            ) : null}
          </dl>
        </Card>
      </div>

      <Card>
        <DetailSectionHeading
          icon={<Layers3 aria-hidden="true" className="size-5" />}
          title="Application progress"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatusDetail label="Application status" status={item.application_status} />
          <StatusDetail label="Payment mandate" status={item.mandate_status} />
          <StatusDetail label="Allotment status" status={item.allotment_status} />
        </div>
      </Card>

      <Card>
        <details className="group">
          <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-action [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-lg font-semibold text-ink">Calculation details</h2>
              <p className="mt-1 text-sm text-muted">
                The saved inputs and issue rules used for this application.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-canvas px-3 py-1.5 text-sm font-semibold text-action group-open:bg-indigo-100">
              <span className="group-open:hidden">Show details</span>
              <span className="hidden group-open:inline">Hide details</span>
            </span>
          </summary>
          <div className="mt-5 border-t border-border pt-5">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <ApplicationDetail label="Price type" value={formatPriceType(priceType)} />
              <ApplicationDetail label="Price per share" value={formatOptionalRupees(price)} />
              <ApplicationDetail
                label="Price band"
                value={formatPriceBand(snapshotIpo.issue_price_min, snapshotIpo.issue_price_max)}
              />
              <ApplicationDetail
                label="Cut-off price"
                value={formatOptionalRupees(snapshotIpo.cut_off_price)}
              />
              <ApplicationDetail
                label="Shares per lot"
                value={formatOptionalNumber(snapshotIpo.lot_size)}
              />
              <ApplicationDetail
                label="Snapshot captured"
                value={
                  typeof snapshot.captured_at === "string"
                    ? formatDateTime(snapshot.captured_at)
                    : "Not recorded"
                }
              />
              {historicalRuleDetails.map(([label, value]) =>
                value === null || value === undefined ? null : (
                  <ApplicationDetail
                    key={label}
                    label={label}
                    value={
                      label.includes("investment")
                        ? formatOptionalRupees(value)
                        : formatOptionalNumber(value)
                    }
                  />
                ),
              )}
            </dl>
            {item.rule_version !== null ? (
              <p className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-950">
                Rule version {item.rule_version} is retained with this record. These historical
                details describe the original calculation and do not change if current IPO rules are
                updated.
              </p>
            ) : null}
          </div>
        </details>
      </Card>

      <div className="flex justify-end border-t border-border pt-5">
        <ConfirmButton
          variant="outline"
          disabled={archive.isPending}
          title="Archive this record?"
          description="This record will be removed from the active list."
          confirmLabel="Archive"
          onConfirm={() => archive.mutateAsync()}
        >
          Archive application
        </ConfirmButton>
      </div>
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
              placeholder="Enter number of lots"
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
              placeholder="Enter price per share"
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
                  placeholder="Enter shares held"
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
                  <span className="text-sm text-muted">{account.masked_demat_identifier}</span>
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

function prettyStatus(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getApplicationLotBounds(
  ipo: Pick<IpoPricingInput, "lot_size"> | null,
  rules: CategoryRules | null | undefined,
  price: string,
): ApplicationLotBounds | null {
  if (!ipo || !rules || !price) return null;
  try {
    return {
      minimum: calculateMinimumEligibleLots(ipo, rules, price),
      maximum: calculateMaximumEligibleLots(ipo, rules, price),
      increment: rules.lot_increment,
    };
  } catch {
    return null;
  }
}

function adjustLotsToBounds(value: string, bounds: ApplicationLotBounds) {
  if (bounds.minimum === null) return value;
  const entered = Number(value);
  if (!Number.isSafeInteger(entered)) return String(bounds.minimum);
  let adjusted = Math.max(entered, bounds.minimum);
  if ((adjusted - bounds.minimum) % bounds.increment !== 0) {
    adjusted += bounds.increment - ((adjusted - bounds.minimum) % bounds.increment);
  }
  if (bounds.maximum !== null && adjusted > bounds.maximum) {
    adjusted = bounds.maximum < bounds.minimum ? bounds.minimum : bounds.maximum;
  }
  return String(adjusted);
}

function formatCategory(value: string) {
  return (
    {
      RETAIL: "Retail",
      SHNI: "sHNI",
      BHNI: "bHNI",
      SHAREHOLDER: "Shareholder",
      EMPLOYER: "Employer",
    }[value] ?? value
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatRupees(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount)
    : "Not recorded";
}

function formatOptionalRupees(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? formatRupees(value)
    : "Not recorded";
}

function formatOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-IN")
    : "Not recorded";
}

function formatPriceBand(minimum: unknown, maximum: unknown) {
  const min = typeof minimum === "string" || typeof minimum === "number" ? minimum : null;
  const max = typeof maximum === "string" || typeof maximum === "number" ? maximum : null;
  if (min !== null && max !== null) return `${formatRupees(min)} – ${formatRupees(max)}`;
  if (min !== null) return `From ${formatRupees(min)}`;
  if (max !== null) return `Up to ${formatRupees(max)}`;
  return "Not recorded";
}

function formatPriceType(value: unknown) {
  if (value === "BID") return "Bid price";
  if (value === "CUT_OFF") return "Cut-off price";
  return "Not recorded";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function statusTone(value: string) {
  if (["APPROVED", "COMPLETED", "ALLOTTED", "RELEASED", "NOT_REQUIRED"].includes(value)) {
    return "border-success/20 bg-green-50 text-success";
  }
  if (["REJECTED", "FAILED", "NOT_ALLOTTED", "EXPIRED", "REVOKED"].includes(value)) {
    return "border-danger/20 bg-red-50 text-danger";
  }
  if (["PENDING", "UNDER_PROCESSING", "PARTIALLY_ALLOTTED", "PARTIAL_ALLOTMENT"].includes(value)) {
    return "border-warning/20 bg-amber-50 text-warning";
  }
  return "border-border bg-canvas text-muted";
}

function ApplicationStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(status)}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function DetailSectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-action">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
    </div>
  );
}

function ApplicationDetail({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="flex items-center gap-2 text-sm font-medium text-muted">
        {icon ? <span className="text-action">{icon}</span> : null}
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/80 bg-white/80 p-3 sm:min-w-32 sm:p-4">
      <div className="flex items-center gap-2 text-action">
        {icon}
        <span className="text-xs font-semibold text-muted">{label}</span>
      </div>
      <p className="mt-2 break-words text-lg font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function StatusDetail({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-canvas/70 p-4">
      <span className="text-sm font-medium text-muted">{label}</span>
      <ApplicationStatusBadge status={status} />
    </div>
  );
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
