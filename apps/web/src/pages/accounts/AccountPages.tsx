import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { z } from "@ipo-mania/validation";
import { dematAccountSchema } from "@ipo-mania/validation";
import type { AccountImportPreviewRow, DematAccount } from "@ipo-mania/shared";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ApiRequestError, apiRequest } from "../../lib/api";

type AccountSummary = {
  total: number;
  active: number;
  archived: number;
  remainingCapacity: number;
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
      <Link className="font-semibold text-action underline" to={`/accounts/${row.original.id}`}>
        {row.original.holder_name}
      </Link>
    ),
  },
  { accessorKey: "broker_name", header: "Broker" },
  { accessorKey: "depository_type", header: "Depository" },
  { accessorKey: "masked_demat_identifier", header: "Masked ID" },
  {
    accessorKey: "account_status",
    header: "Status",
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.archived_at ? "archived" : row.original.account_status}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.created_at),
  },
];

export function AccountDashboardPage() {
  const { session, markSessionExpired } = useAuth();
  const { data, isLoading, error } = useQuery({
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Demat accounts</h1>
          <p className="mt-2 text-lg text-muted">
            Manage the accounts associated with your profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-touch items-center justify-center rounded-lg bg-action px-5 py-2 text-base font-semibold text-white hover:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            to="/accounts/new"
          >
            Add account
          </Link>
          <Link className={secondaryLinkClass} to="/accounts/import">
            Import accounts
          </Link>
        </div>
      </header>
      {error ? <ErrorNotice error={error} /> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account totals">
        <SummaryCard label="Total accounts" value={summary?.total} loading={isLoading} />
        <SummaryCard label="Active accounts" value={summary?.active} loading={isLoading} />
        <SummaryCard label="Archived accounts" value={summary?.archived} loading={isLoading} />
        <SummaryCard
          label="Active-account capacity remaining"
          value={summary?.remainingCapacity}
          loading={isLoading}
        />
      </section>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">Account management</h2>
            <p className="mt-1 text-base text-muted">
              Up to 500 unarchived, active accounts per user.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-base font-semibold">
            <Link className="text-action underline" to="/accounts/list">
              View account list
            </Link>
            <Link className="text-action underline" to="/accounts/import-history">
              Import history
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AccountListPage() {
  const { session, markSessionExpired } = useAuth();
  const [page, setPage] = useState(1);
  const [holderName, setHolderName] = useState("");
  const [broker, setBroker] = useState("");
  const [depository, setDepository] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState("false");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
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
  const { data, isLoading, error } = useQuery({
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const totalPages = data?.data.pagination.totalPages ?? 0;

  function resetFilters() {
    setPage(1);
    setHolderName("");
    setBroker("");
    setDepository("");
    setStatus("");
    setArchived("false");
    setCreatedFrom("");
    setCreatedTo("");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Account list</h1>
          <p className="mt-2 text-base text-muted">
            {data
              ? `${data.data.pagination.total} matching accounts`
              : "Search and filter your accounts."}
          </p>
        </div>
        <Link className={secondaryLinkClass} to="/accounts/new">
          Add an account
        </Link>
      </header>
      <Card>
        <h2 className="text-xl font-bold text-ink">Search and filter</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterInput
            label="Holder name"
            value={holderName}
            onChange={(value) => {
              setHolderName(value);
              setPage(1);
            }}
          />
          <FilterInput
            label="Broker"
            value={broker}
            onChange={(value) => {
              setBroker(value);
              setPage(1);
            }}
          />
          <label className="block text-base font-semibold text-ink">
            Depository
            <select
              className={inputClass}
              value={depository}
              onChange={(event) => {
                setDepository(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All depositories</option>
              <option value="NSDL">NSDL</option>
              <option value="CDSL">CDSL</option>
            </select>
          </label>
          <label className="block text-base font-semibold text-ink">
            Account status
            <select
              className={inputClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="block text-base font-semibold text-ink">
            Archive
            <select
              className={inputClass}
              value={archived}
              onChange={(event) => {
                setArchived(event.target.value);
                setPage(1);
              }}
            >
              <option value="false">Not archived</option>
              <option value="true">Archived</option>
              <option value="all">All accounts</option>
            </select>
          </label>
          <label className="block text-base font-semibold text-ink">
            Created from
            <input
              className={inputClass}
              type="date"
              value={createdFrom}
              onChange={(event) => {
                setCreatedFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-base font-semibold text-ink">
            Created through
            <input
              className={inputClass}
              type="date"
              value={createdTo}
              onChange={(event) => {
                setCreatedTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <button
            type="button"
            className="min-h-touch self-end text-left font-semibold text-action underline"
            onClick={resetFilters}
          >
            Clear filters
          </button>
        </div>
      </Card>
      {error ? <ErrorNotice error={error} /> : null}
      {isLoading ? (
        <p role="status" className="text-base text-muted">
          Loading accounts…
        </p>
      ) : null}
      <Card className="p-3 sm:p-5">
        <div className="hidden overflow-hidden md:block">
          <div ref={scrollRef} className="max-h-[36rem] overflow-auto">
            <table className="w-full min-w-[850px] table-fixed border-collapse text-left text-base">
              <thead className="sticky top-0 z-10 bg-canvas text-ink">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th key={header.id} className="border-b border-border px-3 py-4 font-bold">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                {virtualRows.map((virtualRow) => {
                  const row = table.getRowModel().rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      className="absolute left-0 top-0 w-full border-b border-border bg-white"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="truncate px-3 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {accounts.map((account) => (
            <article key={account.id} className="rounded-lg border border-border p-4 text-base">
              <Link
                className="text-lg font-bold text-action underline"
                to={`/accounts/${account.id}`}
              >
                {account.holder_name}
              </Link>
              <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-2">
                <dt className="font-semibold">Broker</dt>
                <dd>{account.broker_name}</dd>
                <dt className="font-semibold">Depository</dt>
                <dd>{account.depository_type}</dd>
                <dt className="font-semibold">Masked ID</dt>
                <dd className="break-all">{account.masked_demat_identifier}</dd>
                <dt className="font-semibold">Status</dt>
                <dd className="capitalize">
                  {account.archived_at ? "archived" : account.account_status}
                </dd>
                <dt className="font-semibold">Created</dt>
                <dd>{formatDate(account.created_at)}</dd>
              </dl>
            </article>
          ))}
        </div>
        {!isLoading && accounts.length === 0 ? (
          <p className="py-8 text-center text-base text-muted">No accounts match these filters.</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p aria-live="polite" className="text-base text-muted">
            Page {page} of {totalPages || 1}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
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
  const client = useQueryClient();
  const [formError, setFormError] = useState("");
  const { data: loadedAccount, error: loadError } = useQuery({
    queryKey: ["accounts", accountId],
    enabled: Boolean(session && editing && accountId),
    queryFn: () => apiRequest<AccountResponse>(`/api/accounts/${accountId}`, session!),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues, unknown, ValidAccountValues>({
    resolver: zodResolver(dematAccountSchema),
    defaultValues: blankAccount,
  });

  useEffect(() => {
    const account = loadedAccount?.data;
    if (!account) return;
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
  }, [loadedAccount, reset]);

  useEffect(() => {
    if (loadError instanceof ApiRequestError && loadError.status === 401) markSessionExpired();
  }, [loadError, markSessionExpired]);

  async function save(values: ValidAccountValues) {
    if (!session) return;
    setFormError("");
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
      navigate(editing ? `/accounts/${accountId}` : "/accounts/list");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
      if (error instanceof ApiRequestError && error.status === 409) {
        setFormError(error.message);
      } else {
        setFormError("We could not save this account. Check the fields and try again.");
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">
          {editing ? "Edit demat account" : "Add demat account"}
        </h1>
        <p className="mt-2 text-base text-muted">
          Enter the masked account details only. Do not enter a full account number or password.
        </p>
      </header>
      {loadError ? <ErrorNotice error={loadError} /> : null}
      <Card>
        <form className="space-y-5" noValidate onSubmit={handleSubmit(save)}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormInput
              label="Account holder name"
              error={errors.holder_name?.message}
              {...register("holder_name")}
            />
            <FormInput
              label="Broker name"
              error={errors.broker_name?.message}
              {...register("broker_name")}
            />
            <FormInput
              label="Broker code (optional)"
              error={errors.broker_code?.message}
              {...register("broker_code")}
            />
            <FormSelect
              label="Depository"
              error={errors.depository_type?.message}
              {...register("depository_type")}
            >
              <option value="NSDL">NSDL</option>
              <option value="CDSL">CDSL</option>
            </FormSelect>
            <FormInput
              label="Masked demat identifier"
              error={errors.masked_demat_identifier?.message}
              placeholder="For example, XXXX1234"
              {...register("masked_demat_identifier")}
            />
            <FormInput
              label="Masked client reference (optional)"
              error={errors.masked_client_reference?.message}
              {...register("masked_client_reference")}
            />
            <FormSelect
              label="Account status"
              error={errors.account_status?.message}
              {...register("account_status")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
            </FormSelect>
          </div>
          <label className="block text-base font-semibold text-ink">
            Notes (optional)
            <textarea className={`${inputClass} min-h-28 py-3`} rows={4} {...register("notes")} />
            <FieldError message={errors.notes?.message} />
          </label>
          {formError ? (
            <p role="alert" className="text-base text-danger">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save account"}
            </Button>
            <Link
              className={secondaryLinkClass}
              to={editing && accountId ? `/accounts/${accountId}` : "/accounts/list"}
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function AccountDetailsPage() {
  const { session, markSessionExpired } = useAuth();
  const { accountId } = useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState("");
  const { data, isLoading, error } = useQuery({
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
      if (method === "delete") navigate("/accounts/list");
    },
    onError: (reason) => {
      if (reason instanceof ApiRequestError && reason.status === 401) markSessionExpired();
      setActionError(reason instanceof Error ? reason.message : "The account action failed.");
    },
  });
  const account = data?.data;
  if (isLoading)
    return (
      <p role="status" className="text-base text-muted">
        Loading account…
      </p>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Account details</h1>
          <p className="mt-2 text-base text-muted">
            Only masked account identifiers are displayed.
          </p>
        </div>
        {account && !account.archived_at ? (
          <Link className={secondaryLinkClass} to={`/accounts/${account.id}/edit`}>
            Edit account
          </Link>
        ) : null}
      </header>
      {error ? <ErrorNotice error={error} /> : null}
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
          {actionError ? (
            <p role="alert" className="mt-5 text-base text-danger">
              {actionError}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
            {!account.archived_at ? (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => action.mutate("archive")}
              >
                Archive account
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() => action.mutate("restore")}
                >
                  Restore account
                </Button>
                <Button
                  variant="outline"
                  className="border-danger text-danger"
                  disabled={action.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Permanently delete this archived account? This cannot be undone.",
                      )
                    )
                      action.mutate("delete");
                  }}
                >
                  Delete archived account
                </Button>
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
  const [errorMessage, setErrorMessage] = useState("");
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
      setErrorMessage("");
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
      setErrorMessage(
        error instanceof Error ? error.message : "The spreadsheet could not be uploaded.",
      );
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
      if (preview?.import?.id) navigate(`/accounts/import-history/${preview.import.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 401) markSessionExpired();
      setErrorMessage(error instanceof Error ? error.message : "The import could not be saved.");
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Bulk account import</h1>
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
            setErrorMessage("");
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
                <select
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
                </select>
              </label>
            ))}
          </div>
          <div className="mt-5 overflow-auto">
            <table className="min-w-full text-left text-sm">
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
            </table>
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
            <table className="min-w-full text-left text-base">
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
            </table>
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
      {errorMessage ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-base text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function ImportHistoryPage() {
  const { session, markSessionExpired } = useAuth();
  const { importId } = useParams();
  const { data, isLoading, error } = useQuery({
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
  const [actionError, setActionError] = useState("");
  const reverse = useMutation({
    mutationFn: () =>
      apiRequest(`/api/accounts/import/${importId}/reverse`, session!, { method: "POST" }),
    onSuccess: () => window.location.reload(),
    onError: (reason) => {
      if (reason instanceof ApiRequestError && reason.status === 401) markSessionExpired();
      setActionError(
        reason instanceof Error ? reason.message : "The import could not be reversed.",
      );
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
          <h1 className="text-3xl font-bold text-navy">
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
      {error ? <ErrorNotice error={error} /> : null}
      {isLoading ? (
        <p role="status" className="text-base text-muted">
          Loading import history…
        </p>
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
              <Button
                variant="outline"
                disabled={reverse.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Reverse this import by archiving all unchanged accounts created by it?",
                    )
                  )
                    reverse.mutate();
                }}
              >
                {reverse.isPending ? "Reversing…" : "Reverse import"}
              </Button>
            ) : null}
          </div>
          {actionError ? (
            <p role="alert" className="mt-4 text-danger">
              {actionError}
            </p>
          ) : null}
          <div className="mt-5 overflow-auto">
            <table className="min-w-full text-left text-base">
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
            </table>
          </div>
        </Card>
      ) : null}
      {!importId ? (
        <Card className="overflow-auto p-3 sm:p-5">
          <table className="min-w-full text-left text-base">
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
                      className="text-action underline"
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
          </table>
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
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Card>
      <p className="text-base font-semibold text-muted">{label}</p>
      <p className="mt-3 text-4xl font-bold text-navy" aria-live="polite">
        {loading ? "…" : (value ?? 0)}
      </p>
    </Card>
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

function FormInput({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = props.id ?? props.name;
  return (
    <label className="block text-base font-semibold text-ink" htmlFor={id}>
      {label}
      <input id={id} className={inputClass} aria-invalid={Boolean(error)} {...props} />
      <FieldError message={error} />
    </label>
  );
}

function FormSelect({
  label,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const id = props.id ?? props.name;
  return (
    <label className="block text-base font-semibold text-ink" htmlFor={id}>
      {label}
      <select id={id} className={inputClass} aria-invalid={Boolean(error)} {...props}>
        {children}
      </select>
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="mt-1 block text-sm font-normal text-danger">{message}</span>
  ) : null;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-lg text-ink">{value}</dd>
    </div>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-base text-danger"
    >
      {error instanceof ApiRequestError
        ? error.message
        : "We could not load the requested data. Please try again."}
    </p>
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
  "inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-white px-5 py-2 text-base font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";

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
