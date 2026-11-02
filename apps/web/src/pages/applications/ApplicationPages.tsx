import { toIsoDateTime } from "../../lib/formValues";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { RouteFormDrawer } from "../../components/ui/FormDrawer";
import { SearchableFormSelect } from "../../components/ui/SearchableFormSelect";
import { FormInput, FormSelect, FormTextarea } from "../../components/ui/FormControls";
import { FormSection } from "../../components/ui/FormSection";
import { useFormValidation } from "../../components/ui/useFormValidation";
import { applicationCreateSchema, applicationUpdateSchema } from "@ipo-mania/validation";
import { Card } from "../../components/ui/Card";
import { BackLink } from "../../components/ui/BackLink";
import { Pagination } from "../../components/ui/Pagination";
import { ApiRequestError, apiRequest } from "../../lib/api";

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
type IpoListResponse = { data: { ipos: IpoRecord[] } };
type AccountListResponse = { data: { accounts: DematAccount[] } };
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

function useOwnedLists() {
  const { session } = useAuth();
  const ipos = useQuery({
    queryKey: ["ipos", "application-options"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<IpoListResponse>("/api/ipos?page_size=100", session!),
  });
  const accounts = useQuery({
    queryKey: ["accounts", "application-options"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<AccountListResponse>("/api/accounts?pageSize=100", session!),
  });
  return {
    ipos: ipos.data?.data.ipos ?? [],
    accounts: accounts.data?.data.accounts ?? [],
    loading: ipos.isLoading || accounts.isLoading,
    error: ipos.error ?? accounts.error,
  };
}

export function ApplicationDashboardPage() {
  const { session } = useAuth();
  const { data, isLoading, error } = useQuery({
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
          <Link className={linkClass} to="/applications/new">
            Add application
          </Link>
          <Link className={linkClass} to="/applications/bulk">
            Bulk entry
          </Link>
          <Link className={linkClass} to="/applications/import">
            Import file
          </Link>
        </div>
      </header>
      {error ? <ErrorMessage error={error} /> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Application totals">
        {totals.map(([label, value]) => (
          <Card key={label}>
            <p className="text-base font-semibold text-muted">{label}</p>
            <p className="mt-2 text-3xl font-bold text-navy">{isLoading ? "…" : (value ?? 0)}</p>
          </Card>
        ))}
      </section>
      <Card>
        <h2 className="text-xl font-bold text-ink">Keep each status up to date</h2>
        <p className="mt-2 text-base text-muted">
          Keep application progress up to date as your records change.
        </p>
        <Link
          className="mt-4 inline-flex min-h-touch items-center text-action underline"
          to="/applications/list"
        >
          View application table
        </Link>
      </Card>
    </div>
  );
}

export function ApplicationListPage() {
  const { session } = useAuth();
  const location = useLocation();
  const [listParams, setListParams] = useSearchParams();
  const pageValue = Number(listParams.get("page"));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const ipoId = listParams.get("ipo_id") ?? "";
  const accountId = listParams.get("demat_account_id") ?? "";
  const categoryId = listParams.get("category_id") ?? "";
  const applicationStatus = listParams.get("application_status") ?? "";
  const broker = listParams.get("broker") ?? "";
  const search = listParams.get("search") ?? "";
  const includeArchived = listParams.get("include_archived") ?? "false";
  const from = listParams.get("submission_from") ?? "";
  const to = listParams.get("submission_to") ?? "";
  const updateFilter = (key: string, value: string) => {
    setListParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value && !(key === "include_archived" && value === "false")) next.set(key, value);
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
  const [bulkStatusMessage, setBulkStatusMessage] = useState("");
  const bulkStatusMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/applications/bulk/status", session!, {
        method: "PATCH",
        body: JSON.stringify({ application_ids: selectedIds, application_status: bulkStatus }),
      }),
    onSuccess: async () => {
      setSelectedIds([]);
      setBulkStatusMessage("Selected applications updated.");
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
  const params = new URLSearchParams({
    page: String(page),
    page_size: "50",
    include_archived: includeArchived,
    ...(ipoId ? { ipo_id: ipoId } : {}),
    ...(accountId ? { demat_account_id: accountId } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(applicationStatus ? { application_status: applicationStatus } : {}),
    ...(broker ? { broker } : {}),
    ...(search ? { search } : {}),
    ...(from ? { submission_from: from } : {}),
    ...(to ? { submission_to: to } : {}),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", params.toString()],
    enabled: Boolean(session),
    queryFn: () => apiRequest<ApplicationListResponse>(`/api/applications?${params}`, session!),
  });
  const rows = data?.data.applications ?? [];
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
              void exportCsv().catch((reason: unknown) =>
                window.alert(reason instanceof Error ? reason.message : "Export failed."),
              )
            }
          >
            Export CSV
          </Button>
          <Link className={linkClass} to="/applications/new">
            Add application
          </Link>
        </div>
      </header>
      <Card>
        <h2 className="text-xl font-bold text-ink">Search and filter</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="font-semibold">
            IPO
            <select
              className={fieldClass}
              value={ipoId}
              onChange={(event) => {
                updateFilter("ipo_id", event.target.value);
              }}
            >
              <option value="">All IPOs</option>
              {lists.ipos.map((ipo) => (
                <option key={ipo.id} value={ipo.id}>
                  {ipo.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="font-semibold">
            Demat account
            <select
              className={fieldClass}
              value={accountId}
              onChange={(event) => {
                updateFilter("demat_account_id", event.target.value);
              }}
            >
              <option value="">All accounts</option>
              {lists.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.holder_name} — {account.masked_demat_identifier}
                </option>
              ))}
            </select>
          </label>
          <label className="font-semibold">
            Broker
            <input
              className={fieldClass}
              value={broker}
              onChange={(event) => {
                updateFilter("broker", event.target.value);
              }}
            />
          </label>
          <label className="font-semibold">
            Archive status
            <select
              className={fieldClass}
              value={includeArchived}
              onChange={(event) => {
                updateFilter("include_archived", event.target.value);
              }}
            >
              <option value="false">Active records</option>
              <option value="true">Archived records</option>
            </select>
          </label>
          <label className="font-semibold">
            Application number or external reference
            <input
              className={fieldClass}
              value={search}
              onChange={(event) => {
                updateFilter("search", event.target.value);
              }}
            />
          </label>
          <label className="font-semibold">
            Category
            <select
              className={fieldClass}
              value={categoryId}
              onChange={(event) => {
                updateFilter("category_id", event.target.value);
              }}
            >
              <option value="">All categories</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category}
                </option>
              ))}
            </select>
          </label>
          <StatusSelect
            label="Application status"
            value={applicationStatus}
            statuses={statuses}
            onChange={(value) => {
              updateFilter("application_status", value);
            }}
          />
          <label className="font-semibold">
            Submitted from
            <input
              className={fieldClass}
              type="date"
              value={from}
              onChange={(event) => {
                updateFilter("submission_from", event.target.value);
              }}
            />
          </label>
          <label className="font-semibold">
            Submitted to
            <input
              className={fieldClass}
              type="date"
              value={to}
              onChange={(event) => {
                updateFilter("submission_to", event.target.value);
              }}
            />
          </label>
        </div>
      </Card>
      {error ? <ErrorMessage error={error} /> : null}
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="font-semibold">
            Set application status for selected
            <select
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
            </select>
          </label>
          <Button
            variant="outline"
            disabled={!selectedIds.length || !bulkStatus || bulkStatusMutation.isPending}
            onClick={() => bulkStatusMutation.mutate()}
          >
            Update {selectedIds.length} selected
          </Button>
          {bulkStatusMessage ? <p role="status">{bulkStatusMessage}</p> : null}
          {bulkStatusMutation.error ? <ErrorMessage error={bulkStatusMutation.error} /> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
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
            <tbody>
              {rows.map((row) => (
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
                      className="font-semibold text-action underline"
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
              ))}
            </tbody>
          </table>
          {isLoading ? <p className="p-4">Loading applications…</p> : null}
          {!isLoading && !rows.length ? (
            <p className="p-4">No applications match these filters.</p>
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
      navigate("/applications/list", {
        state: { successMessage: editing ? "Application updated." : "Application created." },
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
      description="Choose an issue, an account, and a configured category. Existing manual records keep their calculation and rule version."
      cancelTo="/applications/list"
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
        {editing && detail.isLoading ? <p role="status">Loading application…</p> : null}
        {detail.error ? <ErrorMessage error={detail.error} /> : null}
        {lists.error ? <ErrorMessage error={lists.error} /> : null}
        {!editing ? (
          <FormSection title="Issue and account">
            <div className="grid gap-4 sm:grid-cols-2">
              <SearchableFormSelect
                label="IPO"
                required
                error={validation.errors.ipo_id}
                value={ipoId}
                placeholder="Choose an IPO"
                options={lists.ipos.map((item) => ({
                  value: item.id,
                  label: `${item.symbol} — ${item.company_name}`,
                }))}
                onChange={(event) => {
                  setIpoId(event.target.value);
                  setCategoryId("");
                  setPrice("");
                }}
              />
              <SearchableFormSelect
                label="Demat account"
                required
                error={validation.errors.demat_account_id}
                value={accountId}
                placeholder="Choose an active account"
                options={lists.accounts
                  .filter((account) => account.account_status === "active" && !account.archived_at)
                  .map((account) => ({
                    value: account.id,
                    label: `${account.holder_name} — ${account.masked_demat_identifier}`,
                  }))}
                onChange={(event) => setAccountId(event.target.value)}
              />
              <FormSelect
                label="Application category"
                error={validation.errors.category_id}
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Choose a configured category</option>
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
        {mutation.error ? (
          <p role="alert" className="mt-4 text-danger">
            {errorMessage(mutation.error)}
          </p>
        ) : null}
      </form>
    </RouteFormDrawer>
  );
}

export function ApplicationDetailsPage() {
  const { applicationId } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
      navigate("/applications/list");
    },
  });
  const item = detail.data?.data;
  if (detail.isLoading) return <p>Loading application…</p>;
  if (detail.error) return <ErrorMessage error={detail.error} />;
  if (!item) return <p>Application not found.</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink fallback="/applications/list" allowedPath={/^\/applications(\/list)?$/}>
            Back to applications
          </BackLink>
          <h1 className="text-3xl font-bold text-navy">Application details</h1>
          <p className="mt-2 text-base text-muted">
            Historical calculation rules are retained with this record.
          </p>
        </div>
        <Link className={linkClass} to={`/applications/${item.id}/edit`}>
          Edit status and notes
        </Link>
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
        {archive.error ? <ErrorMessage error={archive.error} /> : null}
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
  const [ipoId, setIpoId] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [lots, setLots] = useState("1");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<"BID" | "CUT_OFF">("CUT_OFF");
  const [preview, setPreview] = useState<ValidationRow[] | null>(null);
  const [message, setMessage] = useState("");
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
      setMessage("");
    },
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/applications/bulk", session!, {
        method: "POST",
        body: JSON.stringify({ applications: inputs }),
      }),
    onSuccess: () => {
      setMessage("Applications created.");
      setPreview(null);
    },
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
    <div className="mx-auto max-w-4xl space-y-6">
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
            <select
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
                  {item.symbol} — {item.company_name}
                </option>
              ))}
            </select>
          </label>
          <label className="font-semibold">
            2. Category
            <select
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
            </select>
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
            <select
              className={fieldClass}
              value={priceType}
              onChange={(event) => {
                setPriceType(event.target.value as "BID" | "CUT_OFF");
                setPreview(null);
              }}
            >
              <option value="CUT_OFF">Cut-off</option>
              <option value="BID">Bid</option>
            </select>
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
        {message ? (
          <p role="status" className="mt-4 text-success">
            {message}
          </p>
        ) : null}
        {previewMutation.error || createMutation.error ? (
          <ErrorMessage error={previewMutation.error ?? createMutation.error} />
        ) : null}
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
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<
    Array<{ row_number: number; values: Record<string, string> }>
  >([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreviewResponse["data"] | null>(null);
  const [message, setMessage] = useState("");
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
      setMessage("");
    },
  });
  const confirmMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/imports/confirm", session!, {
        method: "POST",
        body: JSON.stringify({ import_id: preview?.import?.id }),
      }),
    onSuccess: () => {
      setMessage(
        "Import confirmed. Imported applications remain drafts unless you explicitly mapped a status.",
      );
    },
  });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
                  <select
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
                  </select>
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
        {previewMutation.error || confirmMutation.error ? (
          <ErrorMessage error={previewMutation.error ?? confirmMutation.error} />
        ) : null}
        {message ? (
          <p role="status" className="mt-4 text-success">
            {message}
          </p>
        ) : null}
        <Link
          className="mt-5 inline-flex min-h-touch items-center text-action underline"
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
  const { data, error, isLoading } = useQuery({
    queryKey: ["application-imports", importId ?? "history"],
    enabled: Boolean(session),
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
      {error ? <ErrorMessage error={error} /> : null}
      {importId ? (
        <ImportReport importId={importId} />
      ) : (
        <Card>
          {isLoading ? (
            <p>Loading import history…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
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
                          className="text-action underline"
                          to={`/applications/import-history/${item.id}`}
                        >
                          Open report
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.data.imports.length ? <p className="p-3">No imports yet.</p> : null}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ImportReport({ importId }: { importId: string }) {
  const { session } = useAuth();
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
    },
  });
  if (report.isLoading)
    return (
      <Card>
        <p>Loading report…</p>
      </Card>
    );
  if (report.error) return <ErrorMessage error={report.error} />;
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
      {reverse.error ? <ErrorMessage error={reverse.error} /> : null}
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
      <select
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
      </select>
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

function ErrorMessage({ error }: { error: unknown }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-white p-3 text-danger">
      {errorMessage(error)}
    </p>
  );
}
