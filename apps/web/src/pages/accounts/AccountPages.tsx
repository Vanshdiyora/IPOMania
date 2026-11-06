import { userQueryKey } from "../../lib/queryKeys";
import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloneElement, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  Landmark,
  NotebookPen,
  Plus,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import type { z } from "@ipo-mania/validation";
import { dematAccountFormSchema } from "@ipo-mania/validation";
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
import { Pagination } from "../../components/ui/Pagination";
import { useModalLayer } from "../../components/ui/useModalLayer";
import { ListToolbar } from "../../components/filters/ListToolbar";
import { FilterDrawer, FilterSection } from "../../components/filters/FilterDrawer";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { parsePageSize } from "../../lib/pagination";
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
type AccountPasswordResponse = { data: { password: string } };
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
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
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
type AccountValues = z.input<typeof dematAccountFormSchema>;
type ValidAccountValues = z.output<typeof dematAccountFormSchema>;

const blankAccount: AccountValues = {
  holder_name: "",
  bank_name: "",
  username: "",
  password: "",
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
  {
    accessorKey: "bank_name",
    header: "Bank",
    cell: ({ row }) => row.original.bank_name || "-",
  },
  {
    accessorKey: "username",
    header: "Username",
    cell: ({ row }) => row.original.username || "-",
  },
  {
    accessorKey: "password_saved",
    header: "Password",
    cell: ({ row }) => <AccountPasswordText account={row.original} />,
  },
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

function AccountPasswordText({ account }: { account: DematAccount }) {
  const { session, markSessionExpired } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["accounts", account.id, "password"]),
    enabled: Boolean(session && account.password_saved),
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        return await apiRequest<AccountPasswordResponse>(
          `/api/accounts/${account.id}/password`,
          session!,
          { signal },
        );
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
        throw error;
      }
    },
  });

  if (!account.password_saved) return <>-</>;
  if (isLoading) return <>Loading…</>;
  if (isError) return <>Unavailable</>;

  return <span className="break-all font-mono">{data?.data.password ?? "Unavailable"}</span>;
}

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
    queryKey: userQueryKey(session?.user?.id, ["accounts", "summary"]),
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiRequest<AccountListResponse>("/api/accounts?page=1&pageSize=10&archived=all", session!, {
        signal,
      }),
  });
  useEffect(() => {
    if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
  }, [error, markSessionExpired]);
  const summary = data?.data.summary;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-action-border/50 bg-gradient-to-r from-[#F2EDFF] via-[#FAF8FF] to-[#EEE7FF] p-6 shadow-card sm:flex sm:items-end sm:justify-between sm:p-8">
        <div className="relative min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">
            Portfolio setup
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Demat accounts
          </h1>
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
          <Link
            className={`${secondaryLinkClass} gap-2 rounded-xl`}
            to="/accounts?accountImport=true"
          >
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
  const pageSize = parsePageSize(listParams.get("pageSize"));
  const holderName = listParams.get("holder_name") ?? "";
  const status = listParams.get("status") ?? "";
  const archived = listParams.get("archived") ?? "false";
  const createdFrom = listParams.get("created_from") ?? "";
  const createdTo = listParams.get("created_to") ?? "";
  const [draftFilters, setDraftFilters] = useState(() => ({
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
    pageSize: String(pageSize),
    archived,
    ...(holderName ? { holder_name: holderName } : {}),
    ...(status ? { status } : {}),
    ...(createdFrom ? { created_from: `${createdFrom}T00:00:00.000Z` } : {}),
    ...(createdTo ? { created_to: `${createdTo}T23:59:59.999Z` } : {}),
  });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: userQueryKey(session?.user?.id, ["accounts", "list", queryString.toString()]),
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiRequest<AccountListResponse>(`/api/accounts?${queryString.toString()}`, session!, {
        signal,
      }),
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
    state: { pagination: { pageIndex: page - 1, pageSize } },
  });
  const totalPages = data?.data.pagination.totalPages ?? 1;

  function resetFilters() {
    setListParams({}, { replace: true });
  }

  const filterCount = [status, archived !== "false", createdFrom, createdTo].filter(Boolean).length;

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
                setDraftFilters({ status, archived, createdFrom, createdTo });
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
            setDraftFilters({ status, archived, createdFrom, createdTo });
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
              ["status", "created_from", "created_to"].forEach((key) => {
                next.delete(key);
              });
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
                  ["holder_name", "13%"],
                  ["bank_name", "13%"],
                  ["username", "16%"],
                  ["password_saved", "11%"],
                  ["account_status", "10%"],
                  ["created_at", "12%"],
                  ["actions", "25%"],
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
                        className={`border-b border-border px-3 py-4 font-bold ${header.column.id === "actions" ? "text-right" : ["password_saved", "account_status", "created_at"].includes(header.column.id) ? "text-center" : "text-left"}`}
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
                            className={`px-3 py-4 ${cell.column.id === "actions" ? "text-right" : ["password_saved", "account_status", "created_at"].includes(cell.column.id) ? "truncate text-center tabular-nums" : "truncate text-left"}`}
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
        <div className="mt-5 border-t border-border pt-4">
          <Pagination
            label="Account list pages"
            page={page}
            totalPages={totalPages}
            total={data?.data.pagination.total}
            pageSize={pageSize}
            onPageChange={changePage}
            onPageSizeChange={(nextPageSize) => {
              setListParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("pageSize", String(nextPageSize));
                  next.delete("page");
                  return next;
                },
                { replace: true },
              );
            }}
          />
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
    queryKey: userQueryKey(session?.user?.id, ["accounts", accountId]),
    enabled: Boolean(session && editing && accountId),
    queryFn: ({ signal }) =>
      apiRequest<AccountResponse>(`/api/accounts/${accountId}`, session!, { signal }),
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AccountValues, unknown, ValidAccountValues>({
    resolver: zodResolver(dematAccountFormSchema),
    defaultValues: blankAccount,
  });

  useEffect(() => {
    const account = loadedAccount?.data;
    if (!account || isDirty) return;
    reset({
      holder_name: account.holder_name,
      bank_name: account.bank_name ?? "",
      username: account.username ?? "",
      password: "",
      account_status: account.account_status,
      notes: account.notes,
    });
  }, [loadedAccount, reset, isDirty]);

  useEffect(() => {
    if (loadError instanceof ApiRequestError && loadError.status === 401) markSessionExpired();
  }, [loadError, markSessionExpired]);

  async function save(values: ValidAccountValues) {
    if (!session) return;
    if (!editing && !values.password) {
      notify({
        title: "Password is required",
        description: "Enter the bank account password before saving.",
        tone: "error",
      });
      return;
    }
    try {
      const path = editing ? `/api/accounts/${accountId}` : "/api/accounts";
      const { password, ...accountFields } = values;
      await apiRequest<AccountResponse>(path, session, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...accountFields,
          ...(password ? { password } : {}),
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
      description="Bank passwords are encrypted before storage and can only be revealed by you."
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
              label="Bank name"
              error={errors.bank_name?.message}
              required
              {...register("bank_name")}
            />
            <FormInput
              label="Username"
              error={errors.username?.message}
              required
              {...register("username")}
            />
            <FormInput
              label="Password"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              placeholder={editing ? "Leave blank to keep the current password" : ""}
              required={!editing}
              {...register("password")}
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
    queryKey: userQueryKey(session?.user?.id, ["accounts", accountId]),
    enabled: Boolean(session && accountId),
    queryFn: ({ signal }) =>
      apiRequest<AccountResponse>(`/api/accounts/${accountId}`, session!, { signal }),
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
      <header className="flex flex-col gap-4">
        <BackLink fallback="/accounts" allowedPath={/^\/accounts$/}>
          Back to accounts
        </BackLink>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">
              Demat account
            </p>
            <h1 className="mt-1 text-2xl font-bold text-navy">Account details</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
              Review your saved account information and credentials.
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
        </div>
      </header>
      {error ? <ErrorNotice error={error} onRetry={() => void refetch()} /> : null}
      {account ? (
        <div className="space-y-5">
          <Card className="overflow-hidden border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/70 p-0">
            <div
              className="h-1.5 bg-gradient-to-r from-action via-indigo-400 to-sky-300"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-white shadow-sm sm:size-16">
                  <Building2 className="size-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    Account holder
                  </p>
                  <h2 className="mt-1 break-words text-xl font-bold tracking-tight text-navy sm:text-2xl">
                    {account.holder_name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
                      <Landmark className="size-4 text-action" aria-hidden="true" />
                      {account.bank_name ?? "Bank not provided"}
                    </span>
                    <StatusBadge
                      status={account.archived_at ? "archived" : account.account_status}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-action-light text-action">
                  <KeyRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-navy">Sign-in credentials</h2>
                  <p className="text-sm text-muted">The details saved for this account</p>
                </div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  icon={<UserRound />}
                  label="Username"
                  value={account.username ?? "Not provided"}
                />
                <div className="rounded-xl border border-border bg-canvas/70 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    Password
                  </dt>
                  <dd className="mt-2 flex min-h-6 flex-wrap items-center gap-2 text-sm text-ink">
                    <AccountPasswordText account={account} />
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-action-light text-action">
                  <Clock3 className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-navy">Account activity</h2>
                  <p className="text-sm text-muted">Status and recent changes</p>
                </div>
              </div>
              <dl className="space-y-4">
                <DetailItem
                  icon={<CheckCircle2 />}
                  label="Status"
                  value={
                    account.archived_at
                      ? "Archived"
                      : `${account.account_status.charAt(0).toUpperCase()}${account.account_status.slice(1).toLowerCase()}`
                  }
                />
                <DetailItem
                  icon={<CalendarDays />}
                  label="Created"
                  value={formatDate(account.created_at)}
                />
                <DetailItem
                  icon={<Clock3 />}
                  label="Last updated"
                  value={formatDate(account.updated_at)}
                />
                <DetailItem
                  icon={<Archive />}
                  label="Archived"
                  value={account.archived_at ? formatDate(account.archived_at) : "Not archived"}
                />
              </dl>
            </Card>
          </div>

          <Card className="flex items-start gap-3 border-indigo-100 bg-indigo-50/50 p-5 sm:p-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-action shadow-sm">
              <NotebookPen className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-navy">Notes</h2>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                {account.notes || "No notes added to this account yet."}
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-sm font-bold text-navy">Account management</h2>
              <p className="mt-1 text-sm text-muted">
                {account.archived_at
                  ? "Restore this account to make it active again, or permanently remove it."
                  : "Archive this account to remove it from your active accounts."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
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
        </div>
      ) : null}
    </div>
  );
}

export function AccountImportDialog({ onClose }: { onClose: () => void }) {
  const { session, markSessionExpired } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = `${titleId}-description`;
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
  const busy = upload.isPending || confirm.isPending;
  const close = () => {
    if (!busy) onClose();
  };
  useModalLayer(true, panelRef, close, "[data-account-import-file]");

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-3 sm:p-6" role="presentation">
      <button
        aria-label="Close account import"
        className="absolute inset-0 cursor-default bg-navy/45 backdrop-blur-sm"
        disabled={busy}
        type="button"
        onClick={close}
      />
      <section
        ref={panelRef}
        aria-busy={busy}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-canvas shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4 border-b border-indigo-100 bg-gradient-to-r from-white via-white to-indigo-50 px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">
              Account setup
            </p>
            <h2 id={titleId} className="mt-1 text-2xl font-bold tracking-tight text-navy">
              Bulk account import
            </h2>
            <p id={descriptionId} className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">
              Upload one CSV or XLSX sheet (up to 5 MB and 500 rows), map its columns, review every
              row, then confirm. Invalid and duplicate rows remain visible in the report.
            </p>
          </div>
          <Button
            aria-label="Close account import"
            disabled={busy}
            size="icon"
            variant="ghost"
            onClick={close}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="space-y-5">
            <Card className="border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
              <label
                className="block text-base font-semibold text-ink"
                htmlFor="account-import-file"
              >
                Choose a CSV or XLSX file
              </label>
              <input
                id="account-import-file"
                data-account-import-file
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
              <Card className="border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
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
              <Card className="border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-xl font-bold text-ink">Import preview</h2>
                <p className="mt-2 text-base leading-7 text-muted" role="status">
                  {preview.summary?.ready ?? 0} ready · {preview.summary?.duplicate ?? 0} duplicate
                  · {preview.summary?.invalid ?? 0} invalid
                </p>
                <div className="mt-4 overflow-auto">
                  <DataTable minWidth="720px">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-3">Row</th>
                        <th className="p-3">Holder</th>
                        <th className="p-3">Bank</th>
                        <th className="p-3">Username</th>
                        <th className="p-3">Result</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.row_number} className="border-b border-border align-top">
                          <td className="p-3">{row.row_number}</td>
                          <td className="p-3">{row.record.holder_name}</td>
                          <td className="p-3">{row.record.bank_name}</td>
                          <td className="p-3">{row.record.username}</td>
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
                    Confirming will import the ready rows. Duplicate and invalid rows will remain in
                    the report and will not be imported.
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
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function ImportHistoryPage() {
  const { session, markSessionExpired } = useAuth();
  const { importId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageValue = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const client = useQueryClient();
  const { notify } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: userQueryKey(
      session?.user?.id,
      importId ? ["account-imports", importId] : ["account-imports", "history", page, pageSize],
    ),
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiRequest<ImportHistoryResponse>(
        importId
          ? `/api/accounts/import/${importId}`
          : `/api/accounts/import/history?page=${page}&pageSize=${pageSize}`,
        session!,
        { signal },
      ),
  });
  useEffect(() => {
    if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
  }, [error, markSessionExpired]);
  const detail = importId ? (data as ImportDetailResponse | undefined)?.data : undefined;
  const imports = importId ? [] : ((data as ImportHistoryResponse | undefined)?.data.imports ?? []);
  const importPagination = importId
    ? undefined
    : (data as ImportHistoryResponse | undefined)?.data.pagination;
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
        <Link
          className={secondaryLinkClass}
          to={
            importId
              ? `/accounts/import-history/${importId}?accountImport=true`
              : "/accounts/import-history?accountImport=true"
          }
        >
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
          {importPagination ? (
            <Pagination
              label="Account import history pages"
              page={page}
              totalPages={importPagination.totalPages}
              total={importPagination.total}
              pageSize={pageSize}
              onPageChange={(nextPage) => {
                setSearchParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    if (nextPage > 1) next.set("page", String(nextPage));
                    else next.delete("page");
                    return next;
                  },
                  { replace: true },
                );
              }}
              onPageSizeChange={(nextPageSize) => {
                setSearchParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("pageSize", String(nextPageSize));
                    next.delete("page");
                    return next;
                  },
                  { replace: true },
                );
              }}
            />
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
    <Card className="relative overflow-hidden border-action-border/60 bg-gradient-to-br from-white to-[#F6F2FF] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
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
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-indigo-100 py-3">
        <AccountCardDetail label="Bank" value={account.bank_name ?? "Not provided"} />
        <AccountCardDetail label="Created" value={formatDate(account.created_at)} />
        <AccountCardDetail
          className="col-span-2"
          label="Username"
          value={account.username ?? "Not provided"}
        />
        <AccountCardDetail label="Password" value={<AccountPasswordText account={account} />} />
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
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-canvas/70 p-4">
      <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
        {icon
          ? cloneElement(icon, { className: "size-3.5 text-action", "aria-hidden": true })
          : null}
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold text-ink">{value}</dd>
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
  { key: "bank_name", label: "Bank name", required: true },
  { key: "username", label: "Username", required: true },
  { key: "account_status", label: "Account status", required: false },
  { key: "notes", label: "Notes", required: false },
];
