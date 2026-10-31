import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  CapitalLedgerEntry,
  CapitalApplication,
  CapitalSummary,
  DematAccount,
  IpoAllotment,
  IpoMandate,
  IpoRecord,
} from "@ipo-mania/shared";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ApiRequestError, apiRequest } from "../../lib/api";

type RelatedApplication = CapitalApplication & {
  ipo?:
    | Pick<IpoRecord, "company_name" | "symbol">
    | Array<Pick<IpoRecord, "company_name" | "symbol">>;
  demat_account?:
    | Pick<DematAccount, "id" | "holder_name" | "broker_name">
    | Array<Pick<DematAccount, "id" | "holder_name" | "broker_name">>;
};
type MandateDetail = IpoMandate & { application?: RelatedApplication | RelatedApplication[] };
type AllotmentDetail = IpoAllotment & { application?: RelatedApplication | RelatedApplication[] };
type LedgerDetail = CapitalLedgerEntry & {
  application?: RelatedApplication | RelatedApplication[];
};
type ApplicationsResponse = { data: { applications: RelatedApplication[] } };
type MandatesResponse = { data: { mandates: MandateDetail[]; pagination: Pagination } };
type AllotmentsResponse = { data: { allotments: AllotmentDetail[]; pagination: Pagination } };
type LedgerResponse = { data: { ledger: LedgerDetail[]; pagination: Pagination } };
type MandateResponse = { data: MandateDetail };
type AllotmentResponse = { data: AllotmentDetail };
type CapitalSummaryResponse = { data: { summaries: CapitalSummary[] } };
type IpoListResponse = { data: { ipos: IpoRecord[] } };
type AccountListResponse = { data: { accounts: DematAccount[] } };
type Pagination = { page: number; page_size: number; total: number; total_pages: number };
type Filters = {
  ipo_id: string;
  account_id: string;
  broker: string;
  category: string;
  date_from: string;
  date_to: string;
};

const blankFilters: Filters = {
  ipo_id: "",
  account_id: "",
  broker: "",
  category: "",
  date_from: "",
  date_to: "",
};
const inputClass =
  "mt-1 min-h-touch w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";
const linkClass = "font-semibold text-action underline";
const categories = ["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"];
const mandateStatuses = ["PENDING", "APPROVED", "REJECTED", "REVOKED", "EXPIRED", "RELEASED"];
const allotmentStatuses = ["ALLOTTED", "NOT_ALLOTTED", "PARTIAL_ALLOTMENT"];
const transactionTypes = [
  "CAPITAL_BLOCKED",
  "CAPITAL_RELEASED",
  "ACTUAL_DEBIT",
  "ALLOTMENT_DEBIT",
  "REFUND_RECEIVED",
  "LISTING_SALE",
  "LISTING_PRICE_UPDATE",
  "ADJUSTMENT",
];

export function MandateDashboardPage() {
  return <MandateList showAll />;
}

export function MandateDetailsPage() {
  const { mandateId = "" } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loadedId, setLoadedId] = useState("");
  const detail = useQuery({
    queryKey: ["mandate", mandateId],
    enabled: Boolean(session && mandateId),
    queryFn: () => apiRequest<MandateResponse>(`/api/mandates/${mandateId}`, session!),
  });
  const mandate = detail.data?.data;
  useEffect(() => {
    if (!mandate || loadedId === mandate.id) return;
    setLoadedId(mandate.id);
    setStatus(mandate.mandate_status);
    setReference(mandate.mandate_reference);
    setAmount(mandate.mandate_amount);
    setNotes(mandate.notes ?? "");
  }, [loadedId, mandate]);
  const update = useMutation({
    mutationFn: () =>
      apiRequest<MandateResponse>(`/api/mandates/${mandateId}`, session!, {
        method: "PATCH",
        body: JSON.stringify({
          mandate_status: status,
          mandate_reference: reference,
          mandate_amount: amount,
          notes: notes || null,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mandate", mandateId] }),
        queryClient.invalidateQueries({ queryKey: ["mandates"] }),
        queryClient.invalidateQueries({ queryKey: ["capital"] }),
      ]);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Mandate details"
        description="Manually maintain the mandate status and reference. Approval does not record a completed debit."
      />
      {detail.error ? <ErrorNotice error={detail.error} /> : null}
      {mandate ? (
        <>
          <RecordContext application={relatedApplication(mandate.application)} />
          <Card>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Value label="Current status" value={humanize(mandate.mandate_status)} />
              <Value label="Mandate amount" value={money(mandate.mandate_amount, "INR")} />
              <Value label="Blocked at" value={formatDateTime(mandate.blocked_at)} />
              <Value label="Released at" value={formatDateTime(mandate.released_at)} />
              <Value label="Created" value={formatDateTime(mandate.created_at)} />
              <Value label="Updated" value={formatDateTime(mandate.updated_at)} />
            </dl>
          </Card>
          <Card>
            <h2 className="text-xl font-bold text-ink">Manual update</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-ink">
                Status
                <select
                  className={inputClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {mandateStatuses.map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-ink">
                Mandate reference
                <input
                  className={inputClass}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Mandate amount
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink sm:col-span-2">
                Notes
                <textarea
                  className={inputClass}
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
            </div>
            {update.error ? <ErrorNotice error={update.error} /> : null}
            <Button className="mt-4" disabled={update.isPending} onClick={() => update.mutate()}>
              Save mandate update
            </Button>
          </Card>
        </>
      ) : null}
      <Link className={linkClass} to="/mandates">
        Back to mandates
      </Link>
    </div>
  );
}

export function AllotmentDashboardPage() {
  return <AllotmentList showAll />;
}

export function AllotmentDetailsPage() {
  const { allotmentId = "" } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [lots, setLots] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [refund, setRefund] = useState("");
  const [date, setDate] = useState("");
  const [loadedId, setLoadedId] = useState("");
  const detail = useQuery({
    queryKey: ["allotment", allotmentId],
    enabled: Boolean(session && allotmentId),
    queryFn: () => apiRequest<AllotmentResponse>(`/api/allotments/${allotmentId}`, session!),
  });
  const allotment = detail.data?.data;
  useEffect(() => {
    if (!allotment || loadedId === allotment.id) return;
    setLoadedId(allotment.id);
    setStatus(allotment.allotment_status);
    setLots(String(allotment.allotted_lots));
    setShares(String(allotment.allotted_shares));
    setPrice(allotment.allotment_price ?? "");
    setRefund(allotment.refund_amount);
    setDate(allotment.allotment_date ?? "");
  }, [allotment, loadedId]);
  const update = useMutation({
    mutationFn: () =>
      apiRequest<AllotmentResponse>(`/api/allotments/${allotmentId}`, session!, {
        method: "PATCH",
        body: JSON.stringify({
          allotment_status: status,
          allotted_lots: Number(lots),
          allotted_shares: Number(shares),
          allotment_price: price || null,
          refund_amount: refund,
          allotment_date: date || null,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allotment", allotmentId] }),
        queryClient.invalidateQueries({ queryKey: ["allotments"] }),
        queryClient.invalidateQueries({ queryKey: ["capital"] }),
      ]);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Allotment details"
        description="Maintain allotment, price, and expected refund data against the original application."
      />
      {detail.error ? <ErrorNotice error={detail.error} /> : null}
      {allotment ? (
        <>
          <RecordContext application={relatedApplication(allotment.application)} />
          <Card>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Value label="Allotment status" value={humanize(allotment.allotment_status)} />
              <Value label="Refund status" value={humanize(allotment.refund_status)} />
              <Value label="Allotted shares" value={String(allotment.allotted_shares)} />
              <Value label="Expected refund" value={money(allotment.refund_amount, "INR")} />
              <Value label="Allotment price" value={allotment.allotment_price ?? "—"} />
              <Value label="Allotment date" value={formatDate(allotment.allotment_date)} />
            </dl>
          </Card>
          <Card>
            <h2 className="text-xl font-bold text-ink">Update allotment record</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-ink">
                Status
                <select
                  className={inputClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {allotmentStatuses.map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-ink">
                Allotment date
                <input
                  className={inputClass}
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Allotted lots
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={lots}
                  onChange={(event) => setLots(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Allotted shares
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={shares}
                  onChange={(event) => setShares(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Allotment price
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Expected refund
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={refund}
                  onChange={(event) => setRefund(event.target.value)}
                />
              </label>
            </div>
            <p className="mt-3 text-sm text-muted">
              Refund status is derived from the recorded refund amount and actual refund ledger
              entries.
            </p>
            {update.error ? <ErrorNotice error={update.error} /> : null}
            <Button className="mt-4" disabled={update.isPending} onClick={() => update.mutate()}>
              Save allotment update
            </Button>
          </Card>
        </>
      ) : null}
      <Link className={linkClass} to="/allotments">
        Back to allotments
      </Link>
    </div>
  );
}

export function CreateMandatePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [applicationId, setApplicationId] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const applications = useApplications(session);
  const create = useMutation({
    mutationFn: () =>
      apiRequest<MandateResponse>("/api/mandates", session!, {
        method: "POST",
        body: JSON.stringify({
          application_id: applicationId,
          mandate_reference: reference,
          mandate_amount: amount,
          notes: notes || null,
        }),
      }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ["mandates"] });
      navigate(`/mandates/${data.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add UPI mandate"
        description="Record an existing mandate manually. This does not initiate a payment or approve the mandate."
      />
      <Card>
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-ink">
            Application
            <select
              className={inputClass}
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
            >
              <option value="">Choose an application</option>
              {(applications.data?.data.applications ?? []).map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationTitle(application)} ·{" "}
                  {money(application.application_amount, application.currency)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink">
            UPI mandate reference
            <input
              className={inputClass}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Mandate amount
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Notes
            <textarea
              className={inputClass}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
        {applications.error ? <ErrorNotice error={applications.error} /> : null}
        {create.error ? <ErrorNotice error={create.error} /> : null}
        <Button
          className="mt-5"
          disabled={!applicationId || create.isPending}
          onClick={() => create.mutate()}
        >
          Record pending mandate
        </Button>
      </Card>
      <Link className={linkClass} to="/mandates">
        Cancel
      </Link>
    </div>
  );
}

export function CreateAllotmentPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [applicationId, setApplicationId] = useState("");
  const [status, setStatus] = useState("NOT_ALLOTTED");
  const [lots, setLots] = useState("0");
  const [shares, setShares] = useState("0");
  const [price, setPrice] = useState("");
  const [refund, setRefund] = useState("0");
  const [date, setDate] = useState("");
  const applications = useApplications(session);
  const create = useMutation({
    mutationFn: () =>
      apiRequest<AllotmentResponse>("/api/allotments", session!, {
        method: "POST",
        body: JSON.stringify({
          application_id: applicationId,
          allotment_status: status,
          allotted_lots: Number(lots),
          allotted_shares: Number(shares),
          allotment_price: price || null,
          refund_amount: refund,
          allotment_date: date || null,
        }),
      }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ["allotments"] });
      navigate(`/allotments/${data.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Record allotment"
        description="Enter the received allotment details. Values are checked against the saved application and issue rules."
      />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink sm:col-span-2">
            Application
            <select
              className={inputClass}
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
            >
              <option value="">Choose an application</option>
              {(applications.data?.data.applications ?? []).map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationTitle(application)} · {application.shares} shares requested
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Allotment status
            <select
              className={inputClass}
              value={status}
              onChange={(event) => {
                const next = event.target.value;
                setStatus(next);
                if (next === "NOT_ALLOTTED") {
                  setLots("0");
                  setShares("0");
                  setPrice("");
                } else {
                  setLots((current) => (current === "0" ? "1" : current));
                  setShares((current) => (current === "0" ? "1" : current));
                }
              }}
            >
              {allotmentStatuses.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Allotment date
            <input
              className={inputClass}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            Allotted lots
            <input
              className={inputClass}
              type="number"
              min="0"
              value={lots}
              onChange={(event) => setLots(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            Allotted shares
            <input
              className={inputClass}
              type="number"
              min="0"
              value={shares}
              onChange={(event) => setShares(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            Allotment price
            <input
              className={inputClass}
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            Expected refund
            <input
              className={inputClass}
              inputMode="decimal"
              value={refund}
              onChange={(event) => setRefund(event.target.value)}
            />
          </label>
        </div>
        {applications.error ? <ErrorNotice error={applications.error} /> : null}
        {create.error ? <ErrorNotice error={create.error} /> : null}
        <Button
          className="mt-5"
          disabled={!applicationId || create.isPending}
          onClick={() => create.mutate()}
        >
          Save allotment
        </Button>
      </Card>
      <Link className={linkClass} to="/allotments">
        Cancel
      </Link>
    </div>
  );
}

export function CapitalTrackerPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState(blankFilters);
  const filterQuery = useMemo(() => capitalFilterString(filters), [filters]);
  const summaryQuery = useQuery({
    queryKey: ["capital", "summary", filterQuery],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<CapitalSummaryResponse>(`/api/capital/summary?${filterQuery}`, session!),
  });
  const summaries = summaryQuery.data?.data.summaries ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Capital tracker"
        description="Track application value, authorized mandates, blocked funds, actual debits, refunds, and investment performance separately."
      />
      <FinancialFilters filters={filters} onChange={setFilters} />
      {summaryQuery.error ? <ErrorNotice error={summaryQuery.error} /> : null}
      {summaries.length === 0 ? (
        <Card>
          <p className="text-muted">
            No financial activity has been recorded yet. Record an eligible application to begin
            tracking.
          </p>
        </Card>
      ) : (
        summaries.map((summary) => (
          <section
            key={summary.currency}
            className="space-y-3"
            aria-label={`${summary.currency} capital summary`}
          >
            <h2 className="text-xl font-bold text-navy">{summary.currency} summary</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Total application value"
                value={money(summary.total_application_value, summary.currency)}
              />
              <SummaryCard
                label="Approved mandate value (not a debit)"
                value={money(summary.approved_mandate_value, summary.currency)}
              />
              <SummaryCard
                label="Currently blocked capital"
                value={money(summary.currently_blocked_capital, summary.currency)}
              />
              <SummaryCard
                label="Released capital"
                value={money(summary.released_capital, summary.currency)}
              />
              <SummaryCard
                label="Net actual invested capital"
                value={money(summary.actually_invested_capital, summary.currency)}
              />
              <SummaryCard
                label="Refunds received"
                value={money(summary.refunds_received, summary.currency)}
              />
              <SummaryCard
                label="Outstanding refunds"
                value={money(summary.outstanding_refunds, summary.currency)}
              />
              <SummaryCard
                label="Realized P&L"
                value={money(summary.realized_pnl, summary.currency)}
              />
              <SummaryCard
                label="Unrealized P&L"
                value={
                  summary.unrealized_pnl === null
                    ? "Unavailable — listing price needed"
                    : money(summary.unrealized_pnl, summary.currency)
                }
              />
            </div>
          </section>
        ))
      )}
      <Card>
        <nav className="flex flex-wrap gap-5">
          <Link className={linkClass} to="/capital/transactions">
            Financial transaction history
          </Link>
          <Link className={linkClass} to="/capital/refunds">
            Refund tracker
          </Link>
          <Link className={linkClass} to="/mandates">
            Mandates
          </Link>
          <Link className={linkClass} to="/allotments">
            Allotments
          </Link>
        </nav>
      </Card>
    </div>
  );
}

export function FinancialTransactionHistoryPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const query = useMemo(() => queryString(filters, page), [filters, page]);
  const ledgerQuery = useQuery({
    queryKey: ["capital", "ledger", query],
    enabled: Boolean(session),
    queryFn: () => apiRequest<LedgerResponse>(`/api/capital/ledger?${query}`, session!),
  });
  const rows = ledgerQuery.data?.data.ledger ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial transaction history"
        description="Immutable ledger entries with an effective date, source, and audit reference."
      />
      <FinancialFilters
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      {ledgerQuery.error ? <ErrorNotice error={ledgerQuery.error} /> : null}
      <LedgerEventForm />
      <Card>
        <h2 className="text-xl font-bold text-ink">Ledger events</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-muted">No transactions match these filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="p-3">Effective</th>
                  <th className="p-3">IPO / type</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Source / audit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr className="border-b border-border last:border-0" key={entry.id}>
                    <td className="p-3">{formatDateTime(entry.effective_at)}</td>
                    <td className="p-3">
                      <p className="font-semibold">
                        {applicationTitle(relatedApplication(entry.application))}
                      </p>
                      <p className="text-muted">{humanize(entry.transaction_type)}</p>
                    </td>
                    <td className="p-3 tabular-nums">{money(entry.amount, entry.currency)}</td>
                    <td className="p-3">
                      {humanize(entry.source)} · {entry.audit_reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <PaginationNav pagination={ledgerQuery.data?.data.pagination} onPageChange={setPage} />
    </div>
  );
}

export function RefundTrackerPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState({ ...blankFilters, refund_status: "PENDING" });
  const [page, setPage] = useState(1);
  const params = useMemo(() => {
    const search = new URLSearchParams(queryString(filters, page));
    if (filters.refund_status) search.set("refund_status", filters.refund_status);
    return search.toString();
  }, [filters, page]);
  const allotmentQuery = useQuery({
    queryKey: ["allotments", "refunds", params],
    enabled: Boolean(session),
    queryFn: () => apiRequest<AllotmentsResponse>(`/api/allotments?${params}`, session!),
  });
  const rows = allotmentQuery.data?.data.allotments ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Refund tracker"
        description="Expected refunds are tracked separately from refunds actually received in the capital ledger."
      />
      <FinancialFilters
        filters={filters}
        onChange={(next) => {
          setFilters({ ...next, refund_status: filters.refund_status });
          setPage(1);
        }}
      />
      <label className="block max-w-sm text-sm font-semibold text-ink">
        Refund status
        <select
          className={inputClass}
          value={filters.refund_status}
          onChange={(event) => {
            setFilters({ ...filters, refund_status: event.target.value });
            setPage(1);
          }}
        >
          <option value="">All refunds</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="NOT_REQUIRED">Not required</option>
        </select>
      </label>
      {allotmentQuery.error ? <ErrorNotice error={allotmentQuery.error} /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="p-3">IPO / account</th>
                <th className="p-3">Application amount</th>
                <th className="p-3">Expected refund</th>
                <th className="p-3">Refund status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((allotment) => (
                <tr className="border-b border-border last:border-0" key={allotment.id}>
                  <td className="p-3">
                    <Link className={linkClass} to={`/allotments/${allotment.id}`}>
                      {applicationTitle(relatedApplication(allotment.application))}
                    </Link>
                    <p className="text-muted">
                      {accountTitle(relatedApplication(allotment.application))}
                    </p>
                  </td>
                  <td className="p-3">
                    {money(
                      relatedApplication(allotment.application)?.application_amount ?? "0",
                      relatedApplication(allotment.application)?.currency ?? "INR",
                    )}
                  </td>
                  <td className="p-3">
                    {money(
                      allotment.refund_amount,
                      relatedApplication(allotment.application)?.currency ?? "INR",
                    )}
                  </td>
                  <td className="p-3">{humanize(allotment.refund_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-3 text-muted">No refunds match these filters.</p>
          ) : null}
        </div>
      </Card>
      <PaginationNav pagination={allotmentQuery.data?.data.pagination} onPageChange={setPage} />
    </div>
  );
}

function MandateList({ showAll }: { showAll: boolean }) {
  const { session } = useAuth();
  const [filters, setFilters] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const query = useMemo(() => queryString(filters, page), [filters, page]);
  const mandatesQuery = useQuery({
    queryKey: ["mandates", query],
    enabled: Boolean(session),
    queryFn: () => apiRequest<MandatesResponse>(`/api/mandates?${query}`, session!),
  });
  const rows = mandatesQuery.data?.data.mandates ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mandate dashboard"
        description="Review manually recorded UPI mandate authorizations. Approval is not evidence that funds were debited."
        action={
          <Link className={primaryLinkClass} to="/mandates/new">
            Add mandate
          </Link>
        }
      />
      <FinancialFilters
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      {mandatesQuery.error ? <ErrorNotice error={mandatesQuery.error} /> : null}
      <Card>
        <h2 className="text-xl font-bold text-ink">Mandates</h2>
        <div className="mt-4 divide-y divide-border">
          {rows.map((mandate) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              key={mandate.id}
            >
              <div>
                <Link
                  className="text-lg font-semibold text-action underline"
                  to={`/mandates/${mandate.id}`}
                >
                  {applicationTitle(relatedApplication(mandate.application))}
                </Link>
                <p className="text-sm text-muted">
                  {mandate.mandate_reference} ·{" "}
                  {accountTitle(relatedApplication(mandate.application))}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {money(
                    mandate.mandate_amount,
                    relatedApplication(mandate.application)?.currency ?? "INR",
                  )}
                </p>
                <p className="text-sm text-muted">{humanize(mandate.mandate_status)}</p>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="py-2 text-muted">No mandates match these filters.</p>
          ) : null}
        </div>
      </Card>
      {showAll ? (
        <PaginationNav pagination={mandatesQuery.data?.data.pagination} onPageChange={setPage} />
      ) : null}
    </div>
  );
}

function AllotmentList({ showAll }: { showAll: boolean }) {
  const { session } = useAuth();
  const [filters, setFilters] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const query = useMemo(() => queryString(filters, page), [filters, page]);
  const allotmentsQuery = useQuery({
    queryKey: ["allotments", query],
    enabled: Boolean(session),
    queryFn: () => apiRequest<AllotmentsResponse>(`/api/allotments?${query}`, session!),
  });
  const rows = allotmentsQuery.data?.data.allotments ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Allotment dashboard"
        description="Track full, partial, and not-allotted outcomes against the saved application quantity."
        action={
          <Link className={primaryLinkClass} to="/allotments/new">
            Record allotment
          </Link>
        }
      />
      <FinancialFilters
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      {allotmentsQuery.error ? <ErrorNotice error={allotmentsQuery.error} /> : null}
      <Card>
        <h2 className="text-xl font-bold text-ink">Allotments</h2>
        <div className="mt-4 divide-y divide-border">
          {rows.map((allotment) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              key={allotment.id}
            >
              <div>
                <Link
                  className="text-lg font-semibold text-action underline"
                  to={`/allotments/${allotment.id}`}
                >
                  {applicationTitle(relatedApplication(allotment.application))}
                </Link>
                <p className="text-sm text-muted">
                  {allotment.allotted_shares} shares · Refund {humanize(allotment.refund_status)}
                </p>
              </div>
              <span className="rounded-full bg-[#EAF0F6] px-3 py-2 text-sm font-semibold text-navy">
                {humanize(allotment.allotment_status)}
              </span>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="py-2 text-muted">No allotments match these filters.</p>
          ) : null}
        </div>
      </Card>
      {showAll ? (
        <PaginationNav pagination={allotmentsQuery.data?.data.pagination} onPageChange={setPage} />
      ) : null}
    </div>
  );
}

function LedgerEventForm() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const applications = useApplications(session);
  const [applicationId, setApplicationId] = useState("");
  const [type, setType] = useState("CAPITAL_BLOCKED");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [direction, setDirection] = useState("DEBIT");
  const [effectiveAt, setEffectiveAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [auditReference, setAuditReference] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const listing = type === "LISTING_SALE" || type === "LISTING_PRICE_UPDATE";
      const finalAmount =
        listing && quantity && unitPrice
          ? multiplyDecimalString(unitPrice, Number(quantity))
          : amount;
      const payload = {
        application_id: applicationId || null,
        transaction_type: type,
        amount: finalAmount,
        currency: "INR",
        effective_at: new Date(effectiveAt).toISOString(),
        audit_reference: auditReference,
        idempotency_key: window.crypto.randomUUID(),
        ...(listing ? { quantity: Number(quantity), unit_price: unitPrice } : {}),
        ...(type === "ADJUSTMENT" ? { adjustment_direction: direction } : {}),
      };
      return apiRequest<{ data: CapitalLedgerEntry }>("/api/capital/ledger", session!, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setAmount("");
      setAuditReference("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["capital"] }),
        queryClient.invalidateQueries({ queryKey: ["allotments"] }),
      ]);
    },
  });
  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Record financial event</h2>
      <p className="mt-1 text-sm text-muted">
        Manual entry only. A mandate approval is informational and does not create an actual debit.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink sm:col-span-2">
          Application (not needed for general adjustment)
          <select
            className={inputClass}
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
          >
            <option value="">Choose application</option>
            {(applications.data?.data.applications ?? []).map((application) => (
              <option key={application.id} value={application.id}>
                {applicationTitle(application)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          Transaction type
          <select
            className={inputClass}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {transactionTypes.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </label>
        {type === "ADJUSTMENT" ? (
          <label className="text-sm font-semibold text-ink">
            Adjustment direction
            <select
              className={inputClass}
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
            >
              <option value="DEBIT">Debit</option>
              <option value="CREDIT">Credit</option>
            </select>
          </label>
        ) : null}
        {type === "LISTING_SALE" || type === "LISTING_PRICE_UPDATE" ? (
          <>
            <label className="text-sm font-semibold text-ink">
              Quantity
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-ink">
              Price per share
              <input
                className={inputClass}
                inputMode="decimal"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
              />
            </label>
            <p className="text-sm text-muted sm:col-span-2">
              Event amount:{" "}
              {quantity && unitPrice
                ? multiplyDecimalString(unitPrice, Number(quantity))
                : "Enter quantity and price"}
            </p>
          </>
        ) : (
          <label className="text-sm font-semibold text-ink">
            Amount
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
        )}
        <label className="text-sm font-semibold text-ink">
          Effective date and time
          <input
            className={inputClass}
            type="datetime-local"
            value={effectiveAt}
            onChange={(event) => setEffectiveAt(event.target.value)}
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Audit reference
          <input
            className={inputClass}
            value={auditReference}
            onChange={(event) => setAuditReference(event.target.value)}
          />
        </label>
      </div>
      {create.error ? <ErrorNotice error={create.error} /> : null}
      <Button
        className="mt-4"
        disabled={
          create.isPending ||
          !auditReference ||
          (!applicationId && type !== "ADJUSTMENT") ||
          (type === "LISTING_SALE" || type === "LISTING_PRICE_UPDATE"
            ? !quantity || !unitPrice
            : !amount)
        }
        onClick={() => create.mutate()}
      >
        Record event
      </Button>
    </Card>
  );
}

function FinancialFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const { session } = useAuth();
  const ipos = useQuery({
    queryKey: ["ipos", "capital-filters"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<IpoListResponse>("/api/ipos?page_size=100", session!),
  });
  const accounts = useQuery({
    queryKey: ["accounts", "capital-filters"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<AccountListResponse>("/api/accounts?pageSize=100", session!),
  });
  return (
    <Card>
      <h2 className="text-lg font-bold text-ink">Filters</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-semibold text-ink">
          IPO
          <select
            className={inputClass}
            value={filters.ipo_id}
            onChange={(event) => onChange({ ...filters, ipo_id: event.target.value })}
          >
            <option value="">All IPOs</option>
            {(ipos.data?.data.ipos ?? []).map((ipo) => (
              <option key={ipo.id} value={ipo.id}>
                {ipo.company_name} ({ipo.symbol})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          Demat account
          <select
            className={inputClass}
            value={filters.account_id}
            onChange={(event) => onChange({ ...filters, account_id: event.target.value })}
          >
            <option value="">All accounts</option>
            {(accounts.data?.data.accounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.holder_name} · {account.broker_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          Broker
          <input
            className={inputClass}
            value={filters.broker}
            onChange={(event) => onChange({ ...filters, broker: event.target.value })}
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Category
          <select
            className={inputClass}
            value={filters.category}
            onChange={(event) => onChange({ ...filters, category: event.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          From date
          <input
            className={inputClass}
            type="date"
            value={filters.date_from}
            onChange={(event) => onChange({ ...filters, date_from: event.target.value })}
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          To date
          <input
            className={inputClass}
            type="date"
            value={filters.date_to}
            onChange={(event) => onChange({ ...filters, date_to: event.target.value })}
          />
        </label>
      </div>
    </Card>
  );
}

function useApplications(session: ReturnType<typeof useAuth>["session"]) {
  return useQuery({
    queryKey: ["applications"],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<ApplicationsResponse>("/api/capital/applications?page_size=100", session!),
  });
}

function RecordContext({ application }: { application?: RelatedApplication }) {
  if (!application) return null;
  return (
    <Card>
      <h2 className="text-lg font-bold text-ink">Application reference</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <Value label="IPO" value={applicationTitle(application)} />
        <Value label="Account / broker" value={accountTitle(application)} />
        <Value
          label="Category / rules"
          value={`${application.category} · v${application.rule_version}`}
        />
        <Value
          label="Application value"
          value={money(application.application_amount, application.currency)}
        />
      </dl>
    </Card>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-navy">{title}</h1>
        <p className="mt-2 max-w-3xl text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 break-words text-xl font-bold tabular-nums text-navy">{value}</p>
    </Card>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words font-medium text-ink">{value}</dd>
    </div>
  );
}

function PaginationNav({
  pagination,
  onPageChange,
}: {
  pagination?: Pagination;
  onPageChange: (page: number) => void;
}) {
  if (!pagination || pagination.total_pages < 2) return null;
  return (
    <nav className="flex justify-between" aria-label="Financial record pages">
      <Button
        variant="outline"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        Previous
      </Button>
      <span className="self-center text-sm text-muted">
        Page {pagination.page} of {pagination.total_pages}
      </span>
      <Button
        variant="outline"
        disabled={pagination.page >= pagination.total_pages}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  const message =
    error instanceof ApiRequestError
      ? error.message
      : error instanceof Error
        ? error.message
        : "The request could not be completed.";
  return (
    <p
      role="alert"
      className="rounded-lg border border-[#F1D9B3] bg-[#FFF9EF] p-3 text-sm text-danger"
    >
      {message}
    </p>
  );
}

function relatedApplication(
  application?: RelatedApplication | RelatedApplication[],
): RelatedApplication | undefined {
  return Array.isArray(application) ? application[0] : application;
}

function applicationTitle(application?: RelatedApplication): string {
  const ipo = Array.isArray(application?.ipo) ? application.ipo[0] : application?.ipo;
  return ipo ? `${ipo.company_name} (${ipo.symbol})` : "Application";
}

function accountTitle(application?: RelatedApplication): string {
  const account = Array.isArray(application?.demat_account)
    ? application.demat_account[0]
    : application?.demat_account;
  return account ? `${account.holder_name} · ${account.broker_name}` : "Account unavailable";
}

function queryString(filters: Filters, page = 1): string {
  const parameters = new URLSearchParams({ page: String(page), page_size: "100" });
  for (const [key, value] of Object.entries(filters)) {
    if (value) parameters.set(key, value);
  }
  return parameters.toString();
}

function capitalFilterString(filters: Filters): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) parameters.set(key, value);
  }
  return parameters.toString();
}

function money(value: string, currency: string): string {
  return `${currency} ${value}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function multiplyDecimalString(value: string, quantity: number): string {
  if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(value) || !Number.isSafeInteger(quantity) || quantity <= 0)
    return "0";
  const [whole, fraction = ""] = value.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const product = (BigInt(digits) * BigInt(quantity)).toString().padStart(fraction.length + 1, "0");
  if (!fraction) return product;
  return `${product.slice(0, -fraction.length)}.${product.slice(-fraction.length)}`.replace(
    /\.?0+$/,
    "",
  );
}

const primaryLinkClass =
  "inline-flex min-h-touch items-center justify-center rounded-lg bg-action px-5 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";
