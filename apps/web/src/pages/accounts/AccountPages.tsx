import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, Building2, CheckCircle2, Plus, Upload, WalletCards } from "lucide-react";
import type { z } from "@ipo-mania/validation";
import { dematAccountSchema } from "@ipo-mania/validation";
import type { AccountImportPreviewRow, DematAccount } from "@ipo-mania/shared";
import { useAuth } from "../../auth/useAuth";
import { ConfirmButton } from "../../components/ui/ConfirmButton";
import { Button } from "../../components/ui/Button";
import { FormInput, FormSelect, FormTextarea } from "../../components/ui/FormControls";
import { Input, Select as CustomSelect } from "../../components/ui/Input";
import { DrawerRouteLink, RouteFormDrawer } from "../../components/ui/FormDrawer";
import { FormSection } from "../../components/ui/FormSection";
import { useToast } from "../../components/ui/ToastContext";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/Badge";
import { BackLink } from "../../components/ui/BackLink";
import { DataTable } from "../../components/ui/DataTable";
import { ListToolbar } from "../../components/filters/ListToolbar";
import { FilterDrawer, FilterSection } from "../../components/filters/FilterDrawer";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { applicationDrawerPath } from "../../lib/applicationDrawer";
import {
  SkeletonCard,
  SkeletonDetailsPage,
  SkeletonFormFields,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonTableRows,
} from "../../components/ui/Skeleton";

type AccountSummary = {
  total: number;
  active: number;
  archived: number;
};
type AccountListResponse = {
  data: {
    accounts: DematAccount[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
    summary: AccountSummary;
  };
};
type AccountResponse = { data: DematAccount };
type ImportPreviewResponse = {
  data: {
    requires_mapping?: boolean;
    headers?: string[];
    sample_rows?: Array<{ row_number: number; values: Record<string, string> }>;
    total_rows?: number;
    import?: { id: string; file_name: string };
    rows?: AccountImportPreviewRow[];
    summary?: { total: number; ready: number; duplicate: number; invalid: number };
  };
};
type ImportHistoryResponse = {
  data: {
    imports: Array<{
      id: string;
      file_name: string;
      file_type: string;
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
type ImportDetailResponse = {
  data: {
    import: NonNullable<ImportHistoryResponse["data"]["imports"][number]>;
    rows: Array<{
      row_number: number;
      row_status: string;
      record: Record<string, unknown>;
      errors: string[];
      warnings: string[];
      created_account_id: string | null;
    }>;
  };
};
type AccountValues = z.input<typeof dematAccountSchema>;
type ValidAccountValues = z.output<typeof dematAccountSchema>;

const blankAccount: AccountValues = {
  holder_name: "",
  broker_name: "",
  broker_code: null,
  depository_type: "NSDL",
  masked_demat_identifier: "",
  masked_client_reference: null,
  account_status: "active",
  notes: null,
};

const accountColumns: ColumnDef<DematAccount>[] = [
  {
    accessorKey: "holder_name",
    header: "Holder",
    cell: ({ row }) => (
      <AccountDetailLink account={row.original}>{row.original.holder_name}</AccountDetailLink>
    ),
  },
  { accessorKey: "broker_name", header: "Broker" },
  { accessorKey: "depository_type", header: "Depository" },
  { accessorKey: "masked_demat_identifier", header: "Masked ID" },
  {
    accessorKey: "account_status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.original.archived_at ? "archived" : row.original.account_status} />
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => <AccountApplicationAction account={row.original} />,
  },
];

function AccountApplicationAction({
  account,
  className,
}: {
  account: DematAccount;
  className?: string;
}) {
  const canRecordApplication = account.account_status === "active" && !account.archived_at;

  if (!canRecordApplication) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={className}
        disabled
        aria-label="IPO application unavailable"
      >
        Unavailable
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="secondary" className={className}>
      <DrawerRouteLink to={applicationDrawerPath(account.id)}>
        Record IPO application
      </DrawerRouteLink>
    </Button>
  );
}

function AccountDetailLink({
  account,
  children,
  className = "font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action",
}: {
  account: DematAccount;
  children: React.ReactNode;
  className?: string;
}) {
  const location = useLocation();
  return (
    <Link
      className={className}
      to={`/accounts/${account.id}`}
      state={{ from: `${location.pathname}${location.search}` }}
    >
      {children}
    </Link>
  );
}

export function AccountDashboardPage() {
  const { session, markSessionExpired } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["accounts", "summary"],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<AccountListResponse>("/api/accounts?page=1&pageSize=1&archived=all", session!),
  });
  useEffect(() => {
    if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
  }, [error, markSessionExpired]);
  const summary = data?.data.summary;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/80 p-5 shadow-card sm:flex sm:items-end sm:justify-between sm:p-6">
        <div className="relative min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">
            Portfolio setup
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy">Demat accounts</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">
            Manage the accounts associated with your profile.
          </p>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-wrap sm:gap-3">
          <DrawerRouteLink
            className="inline-flex min-h-touch items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            to="/accounts/new"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add account
          </DrawerRouteLink>
          <Link className={`${secondaryLinkClass} gap-2 rounded-xl`} to="/accounts/import">
            <Upload className="size-4" aria-hidden="true" />
            Import accounts
          </Link>
        </div>
      </header>
      {error ? <ErrorNotice error={error} onRetry={() => void refetch()} /> : null}
      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Account totals"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <SummaryCard
              label="Total accounts"
              value={summary?.total}
              loading={false}
              icon={<WalletCards className="size-5" aria-hidden="true" />}
            />
            <SummaryCard
              label="Active accounts"
              value={summary?.active}
              loading={false}
              icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
            />
            <SummaryCard
              label="Archived accounts"
              value={summary?.archived}
              loading={false}
              icon={<Archive className="size-5" aria-hidden="true" />}
            />
          </>
        )}
      </section>
      <AccountListPage embedded />
    </div>
  );
}

export function AccountListPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { session, markSessionExpired } = useAuth();
  const [listParams, setListParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageValue = Number(listParams.get("page"));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const holderName = listParams.get("holder_name") ?? "";
  const broker = listParams.get("broker") ?? "";
  const depository = listParams.get("depository") ?? "";
  const status = listParams.get("status") ?? "";
  const archived = listParams.get("archived") ?? "false";
  const createdFrom = listParams.get("created_from") ?? "";
  const createdTo = listParams.get("created_to") ?? "";
  const [draftFilters, setDraftFilters] = useState(() => ({
    broker,
    depository,
    status,
    archived,
    createdFrom,
    createdTo,
  }));
  const updateFilter = (key: string, value: string) => {
    setListParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value && !(key === "archived" && value === "false")) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };
  const changePage = (nextPage: number) => {
    setListParams((previous) => {
      const next = new URLSearchParams(previous);
      if (nextPage > 1) next.set("page", String(nextPage));
      else next.delete("page");
      return next;
    });
  };
  const queryString = new URLSearchParams({
    page: String(page),
    pageSize: "50",
    archived,
    ...(holderName ? { holder_name: holderName } : {}),
    ...(broker ? { broker } : {}),
    ...(depository ? { depository } : {}),
    ...(status ? { status } : {}),
    ...(createdFrom ? { created_from: `${createdFrom}T00:00:00.000Z` } : {}),
    ...(createdTo ? { created_to: `${createdTo}T23:59:59.999Z` } : {}),
  });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["accounts", "list", queryString.toString()],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<AccountListResponse>(`/api/accounts?${queryString.toString()}`, session!),
  });
  useEffect(() => {
    if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
  }, [error, markSessionExpired]);

  const accounts = data?.data.accounts ?? [];
  const table = useReactTable({
    data: accounts,
    columns: accountColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: data?.data.pagination.total ?? 0,
    state: { pagination: { pageIndex: page - 1, pageSize: 50 } },
  });
  const totalPages = data?.data.pagination.totalPages ?? 0;

  function resetFilters() {
    setListParams({}, { replace: true });
  }

  const filterCount = [
    broker,
    depository,
    status,
    archived !== "false",
    createdFrom,
    createdTo,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {!embedded && (
        <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(560px,auto)] lg:items-end">
          <div>
            <h1 className="text-2xl font-bold text-navy">Account list</h1>
            <p className="mt-2 text-base text-muted">
              {data
                ? `${data.data.pagination.total} matching accounts`
                : "Search and filter your accounts."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ListToolbar
              className="min-w-0 flex-1 sm:flex-nowrap"
              search={holderName}
              searchPlaceholder="Search holder name..."
              searchLabel="Search holder name"
              activeFilterCount={filterCount}
              onSearchChange={(value) => updateFilter("holder_name", value)}
              onOpenFilters={() => {
                setDraftFilters({ broker, depository, status, archived, createdFrom, createdTo });
                setFiltersOpen(true);
              }}
              onClearFilters={resetFilters}
            />
            <DrawerRouteLink className={`${secondaryLinkClass} shrink-0`} to="/accounts/new">
              Add an account
            </DrawerRouteLink>
          </div>
        </header>
      )}
      {embedded ? (
        <ListToolbar
          search={holderName}
          searchPlaceholder="Search holder name..."
          searchLabel="Search holder name"
          activeFilterCount={filterCount}
          onSearchChange={(value) => updateFilter("holder_name", value)}
          onOpenFilters={() => {
            setDraftFilters({ broker, depository, status, archived, createdFrom, createdTo });
            setFiltersOpen(true);
          }}
          onClearFilters={resetFilters}
        />
      ) : null}
      <FilterDrawer
        open={filtersOpen}
        title="Account filters"
        activeCount={filterCount}
        onClose={() => setFiltersOpen(false)}
        onReset={() => {
          setDraftFilters({
            broker: "",
            depository: "",
            status: "",
            archived: "false",
            createdFrom: "",
            createdTo: "",
          });
        }}
        onApply={() => {
          setListParams(
            (previous) => {
              const next = new URLSearchParams(previous);
              ["broker", "depository", "status", "created_from", "created_to"].forEach((key) => {
                next.delete(key);
              });
              if (draftFilters.broker) next.set("broker", draftFilters.broker);
              if (draftFilters.depository) next.set("depository", draftFilters.depository);
              if (draftFilters.status) next.set("status", draftFilters.status);
              if (draftFilters.createdFrom) next.set("created_from", draftFilters.createdFrom);
              if (draftFilters.createdTo) next.set("created_to", draftFilters.createdTo);
              if (draftFilters.archived !== "false") next.set("archived", draftFilters.archived);
              else next.delete("archived");
              next.delete("page");
              return next;
            },
            { replace: true },
          );
          setFiltersOpen(false);
        }}
      >
        <FilterSection title="Account">
          <div className="grid gap-4">
            <FilterInput
              label="Broker"
              value={draftFilters.broker}
              onChange={(broker) => setDraftFilters((current) => ({ ...current, broker }))}
            />
            <label className="block text-sm font-semibold text-ink">
              Depository
              <CustomSelect
                className={inputClass}
                value={draftFilters.depository}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, depository: event.target.value }))
                }
              >
                <option value="">All depositories</option>
                <option value="NSDL">NSDL</option>
                <option value="CDSL">CDSL</option>
              </CustomSelect>
            </label>
            <label className="block text-sm font-semibold text-ink">
              Account status
              <CustomSelect
                className={inputClass}
                value={draftFilters.status}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="closed">Closed</option>
              </CustomSelect>
            </label>
            <label className="block text-sm font-semibold text-ink">
              Archive
              <CustomSelect
                className={inputClass}
                value={draftFilters.archived}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, archived: event.target.value }))
                }
              >
                <option value="false">Not archived</option>
                <option value="true">Archived</option>
                <option value="all">All accounts</option>
              </CustomSelect>
            </label>
            <label className="block text-sm font-semibold text-ink">
              Created from
              <Input
                className={inputClass}
                type="date"
                value={draftFilters.createdFrom}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, createdFrom: event.target.value }))
                }
              />
            </label>
            <label className="block text-sm font-semibold text-ink">
              Created through
              <Input
                className={inputClass}
                type="date"
                value={draftFilters.createdTo}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, createdTo: event.target.value }))
                }
              />
            </label>
          </div>
        </FilterSection>
      </FilterDrawer>
      {error ? <ErrorNotice error={error} onRetry={() => void refetch()} /> : null}
      <Card className="p-3 sm:p-5">
        <div className="hidden overflow-hidden md:block" aria-busy={isLoading}>
          <div className="max-h-[36rem] overflow-auto">
            <DataTable minWidth="1080px" className="table-fixed text-base">
              <colgroup>
                {[
                  ["holder_name", "16%"],
                  ["broker_name", "14%"],
                  ["depository_type", "12%"],
                  ["masked_demat_identifier", "15%"],
                  ["account_status", "10%"],
                  ["created_at", "12%"],
                  ["actions", "21%"],
                ].map(([id, width]) => (
                  <col key={id} style={{ width }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-canvas text-ink">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        className={`border-b border-border px-3 py-4 font-bold ${header.column.id === "actions" ? "text-right" : ["depository_type", "account_status", "created_at"].includes(header.column.id) ? "text-center" : "text-left"}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <SkeletonTableRows rows={6} cols={accountColumns.length} />
                ) : (
                  table.getRowModel().rows.map((row) => {
                    return (
                      <tr key={row.id} className="bg-white">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={`px-3 py-4 ${cell.column.id === "actions" ? "text-right" : ["depository_type", "account_status", "created_at"].includes(cell.column.id) ? "truncate text-center tabular-nums" : "truncate text-left"}`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </DataTable>
          </div>
        </div>
        <div className="space-y-3 md:hidden" aria-busy={isLoading}>
          {isLoading ? (
            <div role="status" aria-label="Loading accounts" className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            accounts.map((account) => <MobileAccountCard key={account.id} account={account} />)
          )}
        </div>
        {!isLoading && accounts.length === 0 ? (
          <p className="py-8 text-center text-base text-muted">No accounts match these filters.</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="text-base text-muted">
            Page {page} of {totalPages || 1}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={page >= totalPages}
              onClick={() => changePage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AccountFormPage({ editing = false }: { editing?: boolean }) {
  const { session, markSessionExpired } = useAuth();
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const client = useQueryClient();
  const {
    data: loadedAccount,
    error: loadError,
    isLoading: loadingAccount,
    refetch: refetchAccount,
  } = useQuery({
    queryKey: ["accounts", accountId],
    enabled: Boolean(session && editing && accountId),
    queryFn: () => apiRequest<AccountResponse>(`/api/accounts/${accountId}`, session!),
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AccountValues, unknown, ValidAccountValues>({
    resolver: zodResolver(dematAccountSchema),
    defaultValues: blankAccount,
  });

  useEffect(() => {
    const account = loadedAccount?.data;
    if (!account || isDirty) return;
    reset({
      holder_name: account.holder_name,
      broker_name: account.broker_name,
      broker_code: account.broker_code,
      depository_type: account.depository_type,
      masked_demat_identifier: account.masked_demat_identifier,
      masked_client_reference: account.masked_client_reference,
      account_status: account.account_status,
      notes: account.notes,
    });
  }, [loadedAccount, reset, isDirty]);

  useEffect(() => {
    if (loadError instanceof ApiRequestError && loadError.status === 401) markSessionExpired();
  }, [loadError, markSessionExpired]);

  async function save(values: ValidAccountValues) {
    if (!session) return;
    try {
      const path = editing ? `/api/accounts/${accountId}` : "/api/accounts";
      await apiRequest<AccountResponse>(path, session, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...values,
          broker_code: values.broker_code || null,
          masked_client_reference: values.masked_client_reference || null,
          notes: values.notes || null,
        }),
      });
      await client.invalidateQueries({ queryKey: ["accounts"] });
      navigate(editing ? `/accounts/${accountId}` : "/accounts", {
        state: { successMessage: editing ? "Account updated." : "Account created." },
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
      notify({
        title: editing ? "Account could not be updated" : "Account could not be created",
        description:
          error instanceof ApiRequestError && error.status === 409
            ? error.message
            : "We could not save this account. Check the fields and try again.",
        tone: "error",
      });
    }
  }

  return (
    <RouteFormDrawer
      title={editing ? "Edit demat account" : "Add demat account"}
      description="Enter masked account details only. Do not enter a full account number or password."
      cancelTo={editing && accountId ? `/accounts/${accountId}` : "/accounts"}
      formId="account-form"
      submitLabel="Save account"
      busy={isSubmitting}
      disabled={editing && (loadingAccount || Boolean(loadError) || !loadedAccount)}
      dirty={isDirty}
    >
      {editing && loadingAccount ? (
        <div role="status" aria-label="Loading account form" aria-busy="true">
          <span className="sr-only">Loading account form…</span>
          <SkeletonFormFields fields={6} />
        </div>
      ) : null}
      {loadError ? <ErrorNotice error={loadError} onRetry={() => void refetchAccount()} /> : null}
      <form
        id="account-form"
        className="space-y-5"
        hidden={editing && (loadingAccount || Boolean(loadError))}
        noValidate
        onSubmit={handleSubmit(save)}
      >
        <FormSection title="Account details">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormInput
              label="Account holder name"
              error={errors.holder_name?.message}
              required
              {...register("holder_name")}
            />
            <FormInput
              label="Broker name"
              error={errors.broker_name?.message}
              required
              {...register("broker_name")}
            />
            <FormInput
              label="Broker code (optional)"
              error={errors.broker_code?.message}
              {...register("broker_code")}
            />
            <Controller
              control={control}
              name="depository_type"
              render={({ field }) => (
                <FormSelect label="Depository" error={errors.depository_type?.message} {...field}>
                  <option value="NSDL">NSDL</option>
                  <option value="CDSL">CDSL</option>
                </FormSelect>
              )}
            />
            <FormInput
              label="Masked demat identifier"
              error={errors.masked_demat_identifier?.message}
              placeholder="For example, XXXX1234"
              required
              {...register("masked_demat_identifier")}
            />
            <FormInput
              label="Masked client reference (optional)"
              error={errors.masked_client_reference?.message}
              {...register("masked_client_reference")}
            />
            <Controller
              control={control}
              name="account_status"
              render={({ field }) => (
                <FormSelect
                  label="Account status"
                  error={errors.account_status?.message}
                  {...field}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="closed">Closed</option>
                </FormSelect>
              )}
            />
          </div>
        </FormSection>
        <FormTextarea
          label="Notes (optional)"
          rows={4}
          error={errors.notes?.message}
          {...register("notes")}
        />
      </form>
    </RouteFormDrawer>
  );
}

export function AccountDetailsPage() {
  const { session, markSessionExpired } = useAuth();
  const { accountId } = useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["accounts", accountId],
    enabled: Boolean(session && accountId),
    queryFn: () => apiRequest<AccountResponse>(`/api/accounts/${accountId}`, session!),
  });
  const action = useMutation({
    mutationFn: async (method: "archive" | "restore" | "delete") =>
      apiRequest(`/api/accounts/${accountId}${method === "delete" ? "" : `/${method}`}`, session!, {
        method: method === "delete" ? "DELETE" : "POST",
      }),
    onSuccess: async (_result, method) => {
      await client.invalidateQueries({ queryKey: ["accounts"] });
      notify({
        title:
          method === "archive"
            ? "Account archived"
            : method === "restore"
              ? "Account restored"
              : "Account deleted",
        tone: "success",
      });
      if (method === "delete") navigate("/accounts");
    },
    onError: (reason) => {
      if (reason instanceof ApiRequestError && reason.status === 401) markSessionExpired();
      notify({
        title: "Account action failed",
        description: reason instanceof Error ? reason.message : "The account action failed.",
        tone: "error",
      });
    },
  });
  const account = data?.data;
  if (isLoading) return <SkeletonDetailsPage rows={8} />;

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <BackLink fallback="/accounts" allowedPath={/^\/accounts$/}>
            Back to accounts
          </BackLink>
          <h1 className="text-2xl font-bold text-navy">Account details</h1>
          <p className="mt-2 text-base text-muted">
            Only masked account identifiers are displayed.
          </p>
        </div>
        {account && !account.archived_at ? (
          <DrawerRouteLink
            className={`${secondaryLinkClass} w-full rounded-xl sm:w-auto`}
            to={`/accounts/${account.id}/edit`}
          >
            Edit account
          </DrawerRouteLink>
        ) : null}
      </header>
      {error ? <ErrorNotice error={error} onRetry={() => void refetch()} /> : null}
      {account ? (
        <Card>
          <dl className="grid gap-5 sm:grid-cols-2">
            <DetailItem label="Account holder" value={account.holder_name} />
            <DetailItem label="Broker" value={account.broker_name} />
            <DetailItem label="Broker code" value={account.broker_code ?? "Not provided"} />
            <DetailItem label="Depository" value={account.depository_type} />
            <DetailItem label="Masked demat identifier" value={account.masked_demat_identifier} />
            <DetailItem
              label="Masked client reference"
              value={account.masked_client_reference ?? "Not provided"}
            />
            <DetailItem label="Account status" value={account.account_status} />
            <DetailItem label="Created" value={formatDate(account.created_at)} />
            <DetailItem label="Last updated" value={formatDate(account.updated_at)} />
            <DetailItem
              label="Archived"
              value={account.archived_at ? formatDate(account.archived_at) : "No"}
            />
            <div className="sm:col-span-2">
              <DetailItem label="Notes" value={account.notes || "No notes"} />
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
            {!account.archived_at ? (
              <ConfirmButton
                variant="outline"
                disabled={action.isPending}
                title="Archive this record?"
                description="This record will be removed from the active list."
                confirmLabel="Archive"
                onConfirm={() => action.mutateAsync("archive")}
              >
                Archive account
              </ConfirmButton>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() => action.mutate("restore")}
                >
                  Restore account
                </Button>
                <ConfirmButton
                  variant="outline"
                  className="border-danger text-danger"
                  disabled={action.isPending}
                  title="Confirm this action"
                  description="Permanently delete this archived account? This cannot be undone."
                  confirmLabel="Continue"
                  onConfirm={() => action.mutateAsync("delete")}
                >
                  Delete archived account
                </ConfirmButton>
              </>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function AccountImportPage() {
  const { session, markSessionExpired } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<
    Array<{ row_number: number; values: Record<string, string> }>
  >([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreviewResponse["data"] | null>(null);
  const { notify } = useToast();
  const upload = useMutation({
    mutationFn: async (includeMapping: boolean) => {
      if (!session || !file) throw new Error("Choose a spreadsheet first.");
      const form = new FormData();
      form.append("file", file);
      if (includeMapping) form.append("mapping", JSON.stringify(mapping));
      return apiRequest<ImportPreviewResponse>("/api/accounts/import/preview", session, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (result, includeMapping) => {
      if (includeMapping) {
        setPreview(result.data);
        void client.invalidateQueries({ queryKey: ["account-imports"] });
      } else {
        const columns = result.data.headers ?? [];
        setHeaders(columns);
        setSampleRows(result.data.sample_rows ?? []);
        const defaults: Record<string, string> = {};
        for (const field of importFields) {
          const match = columns.find(
            (column) => column.trim().toLowerCase().replaceAll(" ", "_") === field.key,
          );
          if (match) defaults[field.key] = match;
        }
        setMapping(defaults);
      }
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
      notify({
        title: "Spreadsheet could not be uploaded",
        description: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
    },
  });
  const confirm = useMutation({
    mutationFn: async () => {
      if (!preview?.import?.id || !session)
        throw new Error("Preview the import before confirming.");
      return apiRequest(`/api/accounts/import/confirm`, session, {
        method: "POST",
        body: JSON.stringify({ import_id: preview.import.id }),
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["accounts"] });
      await client.invalidateQueries({ queryKey: ["account-imports"] });
      notify({ title: "Account import confirmed", tone: "success" });
      if (preview?.import?.id) navigate(`/accounts/import-history/${preview.import.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
      notify({
        title: "Account import could not be saved",
        description: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy">Bulk account import</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
          Upload one CSV or XLSX sheet (up to 5 MB and 500 rows), map its columns, review every row,
          then confirm. Invalid and duplicate rows remain visible in the report and are not
          imported.
        </p>
      </header>
      <Card>
        <label className="block text-base font-semibold text-ink" htmlFor="account-import-file">
          Choose a CSV or XLSX file
        </label>
        <input
          id="account-import-file"
          className={`${inputClass} mt-2`}
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setHeaders([]);
            setPreview(null);
          }}
        />
        {file ? (
          <p className="mt-2 text-sm text-muted">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : null}
        <Button
          className="mt-4"
          disabled={!file || upload.isPending}
          onClick={() => upload.mutate(false)}
        >
          {upload.isPending ? "Reading file…" : "Upload and read columns"}
        </Button>
      </Card>
      {headers.length ? (
        <Card>
          <h2 className="text-xl font-bold text-ink">Map spreadsheet columns</h2>
          <p className="mt-2 text-base text-muted">
            Required fields must be mapped. Optional fields may be left unmapped.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {importFields.map((field) => (
              <label key={field.key} className="block text-base font-semibold text-ink">
                {field.label}
                {field.required ? " (required)" : " (optional)"}
                <CustomSelect
                  className={inputClass}
                  value={mapping[field.key] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [field.key]: event.target.value }))
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
          <div className="mt-5 overflow-auto">
            <DataTable minWidth="720px">
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th className="px-3 py-2" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row) => (
                  <tr key={row.row_number} className="border-t border-border">
                    {headers.map((header) => (
                      <td className="max-w-56 truncate px-3 py-2" key={header}>
                        {row.values[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <Button
            className="mt-5"
            disabled={
              upload.isPending ||
              importFields.some((field) => field.required && !mapping[field.key])
            }
            onClick={() => upload.mutate(true)}
          >
            Validate and preview
          </Button>
        </Card>
      ) : null}
      {preview?.rows ? (
        <Card>
          <h2 className="text-xl font-bold text-ink">Import preview</h2>
          <p className="mt-2 text-base leading-7 text-muted" role="status">
            {preview.summary?.ready ?? 0} ready · {preview.summary?.duplicate ?? 0} duplicate ·{" "}
            {preview.summary?.invalid ?? 0} invalid
          </p>
          <div className="mt-4 overflow-auto">
            <DataTable minWidth="720px">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3">Row</th>
                  <th className="p-3">Holder</th>
                  <th className="p-3">Broker</th>
                  <th className="p-3">Depository</th>
                  <th className="p-3">Masked ID</th>
                  <th className="p-3">Result</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row_number} className="border-b border-border align-top">
                    <td className="p-3">{row.row_number}</td>
                    <td className="p-3">{row.record.holder_name}</td>
                    <td className="p-3">{row.record.broker_name}</td>
                    <td className="p-3">{row.record.depository_type}</td>
                    <td className="p-3">{row.record.masked_demat_identifier}</td>
                    <td className="p-3 capitalize">{row.row_status}</td>
                    <td className="p-3 text-danger">
                      {[...row.errors, ...row.warnings].join(" ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          {preview.summary?.ready ? (
            <p className="mt-4 text-base text-muted">
              Confirming will import the ready rows. Duplicate and invalid rows will remain in the
              report and will not be imported.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={!preview.summary?.ready || confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending
                ? "Saving rows…"
                : `Confirm ${preview.summary?.ready ?? 0} ready rows`}
            </Button>
            <Link className={secondaryLinkClass} to="/accounts/import-history">
              Import history
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function ImportHistoryPage() {
  const { session, markSessionExpired } = useAuth();
  const { importId } = useParams();
  const client = useQueryClient();
  const { notify } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: importId ? ["account-imports", importId] : ["account-imports", "history"],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<ImportHistoryResponse>(
        importId ? `/api/accounts/import/${importId}` : "/api/accounts/import/history",
        session!,
      ),
  });
  useEffect(() => {
    if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
  }, [error, markSessionExpired]);
  const detail = importId ? (data as ImportDetailResponse | undefined)?.data : undefined;
  const imports = importId ? [] : ((data as ImportHistoryResponse | undefined)?.data.imports ?? []);
  const reverse = useMutation({
    mutationFn: () =>
      apiRequest(`/api/accounts/import/${importId}/reverse`, session!, { method: "POST" }),
    onSuccess: async () => {
      notify({ title: "Import reversed", tone: "success" });
      await client.invalidateQueries({ queryKey: ["account-imports"] });
      await client.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (reason) => {
      if (reason instanceof ApiRequestError && reason.status === 401) markSessionExpired();
      notify({
        title: "Import could not be reversed",
        description: reason instanceof Error ? reason.message : "Please try again.",
        tone: "error",
      });
    },
  });

  function downloadErrorReport() {
    if (!detail) return;
    const errors = detail.rows.filter((row) => row.errors.length || row.warnings.length);
    const csvRows = [
      ["row_number", "status", "record", "errors", "warnings"],
      ...errors.map((row) => [
        String(row.row_number),
        row.row_status,
        JSON.stringify(row.record),
        row.errors.join("; "),
        row.warnings.join("; "),
      ]),
    ];
    const content = csvRows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `account-import-${detail.import.id}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            {importId ? "Import report" : "Import history"}
          </h1>
          <p className="mt-2 text-base text-muted">
            Review imported rows, warnings, and saved reports.
          </p>
        </div>
        <Link className={secondaryLinkClass} to="/accounts/import">
          Start a new import
        </Link>
      </header>
      {error ? <ErrorNotice error={error} onRetry={() => void refetch()} /> : null}
      {isLoading ? (
        <div
          role="status"
          aria-label={importId ? "Loading import report" : "Loading import history"}
          aria-busy="true"
        >
          <span className="sr-only">Loading import data…</span>
          {importId ? <SkeletonDetailsPage rows={5} /> : <SkeletonTable rows={5} cols={5} />}
        </div>
      ) : null}
      {detail ? (
        <Card>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="File" value={detail.import.file_name} />
            <DetailItem label="Status" value={detail.import.status} />
            <DetailItem label="Rows in file" value={String(detail.import.total_rows)} />
            <DetailItem label="Rows imported" value={String(detail.import.imported_rows)} />
            <DetailItem label="Uploaded" value={formatDate(detail.import.created_at)} />
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadErrorReport}>
              Download error report
            </Button>
            {detail.import.status === "confirmed" ? (
              <ConfirmButton
                variant="outline"
                disabled={reverse.isPending}
                title="Confirm this action"
                description="Reverse this import by archiving all unchanged accounts created by it?"
                confirmLabel="Continue"
                onConfirm={() => reverse.mutateAsync()}
              >
                {reverse.isPending ? "Reversing…" : "Reverse import"}
              </ConfirmButton>
            ) : null}
          </div>
          <div className="mt-5 overflow-auto">
            <DataTable minWidth="720px">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3">Row</th>
                  <th className="p-3">Result</th>
                  <th className="p-3">Errors and warnings</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => (
                  <tr key={row.row_number} className="border-b border-border">
                    <td className="p-3">{row.row_number}</td>
                    <td className="p-3 capitalize">{row.row_status}</td>
                    <td className="p-3 text-danger">
                      {[...row.errors, ...row.warnings].join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </Card>
      ) : null}
      {!importId ? (
        <Card className="overflow-auto p-3 sm:p-5">
          <DataTable minWidth="720px">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3">File</th>
                <th className="p-3">Status</th>
                <th className="p-3">Rows</th>
                <th className="p-3">Imported</th>
                <th className="p-3">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-3">
                    <Link
                      className="text-action no-underline transition-colors hover:text-navy visited:text-action"
                      to={`/accounts/import-history/${item.id}`}
                    >
                      {item.file_name}
                    </Link>
                  </td>
                  <td className="p-3 capitalize">{item.status}</td>
                  <td className="p-3">{item.total_rows}</td>
                  <td className="p-3">{item.imported_rows}</td>
                  <td className="p-3">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {!imports.length ? (
            <p className="py-8 text-center text-base text-muted">No imports yet.</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value?: number;
  loading: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-4 sm:p-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-action" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-action-light text-action ring-1 ring-action-border">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-navy" aria-live="polite">
        {loading ? "…" : (value ?? "—")}
      </p>
    </Card>
  );
}

function MobileAccountCard({ account }: { account: DematAccount }) {
  const status = account.archived_at ? "archived" : account.account_status;

  return (
    <article className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white shadow-sm">
          <Building2 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <AccountDetailLink
              account={account}
              className="min-w-0 text-lg font-bold leading-6 text-navy no-underline transition-colors hover:text-action visited:text-navy"
            >
              {account.holder_name}
            </AccountDetailLink>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-muted">{account.broker_name}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-indigo-100 py-3">
        <AccountCardDetail label="Depository" value={account.depository_type} />
        <AccountCardDetail label="Created" value={formatDate(account.created_at)} />
        <AccountCardDetail
          className="col-span-2"
          label="Masked demat ID"
          value={account.masked_demat_identifier}
        />
      </dl>
      <AccountApplicationAction account={account} className="mt-4 w-full" />
    </article>
  );
}

function AccountCardDetail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-base font-semibold text-ink">
      {label}
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-lg text-ink">{value}</dd>
    </div>
  );
}

function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-base text-danger"
    >
      <p>
        {error instanceof ApiRequestError
          ? error.message
          : "We could not load the requested data. Please try again."}
      </p>
      {onRetry ? (
        <Button variant="outline" className="mt-2 border-danger/30 text-danger" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

const inputClass =
  "mt-2 min-h-touch w-full rounded-lg border border-border bg-white px-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";
const secondaryLinkClass =
  "inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";

const importFields = [
  { key: "holder_name", label: "Holder name", required: true },
  { key: "broker_name", label: "Broker name", required: true },
  { key: "broker_code", label: "Broker code", required: false },
  { key: "depository_type", label: "Depository", required: true },
  { key: "masked_demat_identifier", label: "Masked demat identifier", required: true },
  { key: "masked_client_reference", label: "Masked client reference", required: false },
  { key: "account_status", label: "Account status", required: false },
  { key: "notes", label: "Notes", required: false },
];
