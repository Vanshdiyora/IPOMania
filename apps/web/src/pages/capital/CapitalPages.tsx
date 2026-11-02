import { toIsoDateTime, toLocalDateTime } from "../../lib/formValues";
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
import { FormDrawer, RouteFormDrawer } from "../../components/ui/FormDrawer";
import { FormInput, FormSelect, FormTextarea } from "../../components/ui/FormControls";
import { FormSection } from "../../components/ui/FormSection";
import { useFormValidation } from "../../components/ui/useFormValidation";
import {
  mandateSchema,
  mandateUpdateSchema,
  allotmentSchema,
  allotmentUpdateSchema,
  capitalLedgerEntrySchema,
} from "@ipo-mania/validation";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { EmptyState } from "../../components/ui/States";
import {
  SkeletonCard,
  SkeletonDetailsPage,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonTableRows,
} from "../../components/ui/Skeleton";

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
const linkClass =
  "font-semibold text-action no-underline underline-offset-4 hover:underline visited:text-action";
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const validation = useFormValidation();
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
        body: JSON.stringify(
          validation.validate(mandateUpdateSchema, {
            mandate_status: status,
            mandate_reference: reference,
            mandate_amount: amount,
            notes: notes || null,
          }),
        ),
      }),
    onSuccess: async () => {
      setDirty(false);
      setEditorOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mandate", mandateId] }),
        queryClient.invalidateQueries({ queryKey: ["mandates"] }),
        queryClient.invalidateQueries({ queryKey: ["capital"] }),
      ]);
    },
  });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Mandate details"
        description="Manually maintain the mandate status and reference. Approval does not record a completed debit."
      />
      {detail.isLoading ? <SkeletonDetailsPage rows={6} /> : null}
      {detail.error ? (
        <ErrorNotice error={detail.error} onRetry={() => void detail.refetch()} />
      ) : null}
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
          <Button
            variant="outline"
            onClick={() => {
              setStatus(String(mandate.mandate_status ?? ""));
              setReference(String(mandate.mandate_reference ?? ""));
              setAmount(String(mandate.mandate_amount ?? ""));
              setNotes(String(mandate.notes ?? ""));
              setDirty(false);
              setEditorOpen(true);
            }}
          >
            Edit mandate
          </Button>
          <FormDrawer
            open={editorOpen}
            title="Edit mandate"
            description="Update the existing manually recorded details."
            dirty={dirty}
            busy={update.isPending}
            onClose={() => setEditorOpen(false)}
            footer={(requestClose) => (
              <div className="flex justify-end gap-3">
                <Button variant="outline" disabled={update.isPending} onClick={requestClose}>
                  Cancel
                </Button>
                <Button type="submit" form="edit-mandate-form" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          >
            <form
              id="edit-mandate-form"
              className="space-y-4"
              noValidate
              onChangeCapture={() => setDirty(true)}
              onSubmit={(event) => {
                event.preventDefault();
                update.mutate();
              }}
            >
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormSelect
                  label="Status"
                  error={validation.errors.mandate_status}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {mandateStatuses.map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </FormSelect>
                <FormInput
                  label="Mandate reference"
                  error={validation.errors.mandate_reference}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
                <FormInput
                  label="Mandate amount"
                  error={validation.errors.mandate_amount}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
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
              {update.error ? <ErrorNotice error={update.error} /> : null}
            </form>
          </FormDrawer>
        </>
      ) : null}
      {!detail.isLoading && !detail.error && !mandate ? (
        <EmptyState title="Mandate not found" description="This record may have been removed." />
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const validation = useFormValidation();
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
        body: JSON.stringify(
          validation.validate(allotmentUpdateSchema, {
            allotment_status: status,
            allotted_lots: Number(lots),
            allotted_shares: Number(shares),
            allotment_price: price || null,
            refund_amount: refund,
            allotment_date: date || null,
          }),
        ),
      }),
    onSuccess: async () => {
      setDirty(false);
      setEditorOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allotment", allotmentId] }),
        queryClient.invalidateQueries({ queryKey: ["allotments"] }),
        queryClient.invalidateQueries({ queryKey: ["capital"] }),
      ]);
    },
  });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Allotment details"
        description="Maintain allotment, price, and expected refund data against the original application."
      />
      {detail.isLoading ? <SkeletonDetailsPage rows={6} /> : null}
      {detail.error ? (
        <ErrorNotice error={detail.error} onRetry={() => void detail.refetch()} />
      ) : null}
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
          <Button
            variant="outline"
            onClick={() => {
              setStatus(String(allotment.allotment_status ?? ""));
              setLots(String(allotment.allotted_lots ?? ""));
              setShares(String(allotment.allotted_shares ?? ""));
              setPrice(String(allotment.allotment_price ?? ""));
              setRefund(String(allotment.refund_amount ?? ""));
              setDate(String(allotment.allotment_date ?? ""));
              setDirty(false);
              setEditorOpen(true);
            }}
          >
            Edit allotment
          </Button>
          <FormDrawer
            open={editorOpen}
            title="Edit allotment"
            description="Update the existing manually recorded details."
            dirty={dirty}
            busy={update.isPending}
            onClose={() => setEditorOpen(false)}
            footer={(requestClose) => (
              <div className="flex justify-end gap-3">
                <Button variant="outline" disabled={update.isPending} onClick={requestClose}>
                  Cancel
                </Button>
                <Button type="submit" form="edit-allotment-form" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          >
            <form
              id="edit-allotment-form"
              className="space-y-4"
              noValidate
              onChangeCapture={() => setDirty(true)}
              onSubmit={(event) => {
                event.preventDefault();
                update.mutate();
              }}
            >
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormSelect
                  label="Status"
                  error={validation.errors.allotment_status}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {allotmentStatuses.map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </FormSelect>
                <FormInput
                  label="Allotment date"
                  error={validation.errors.allotment_date}
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <FormInput
                  label="Allotted lots"
                  error={validation.errors.allotted_lots}
                  type="number"
                  min="0"
                  value={lots}
                  onChange={(event) => setLots(event.target.value)}
                />
                <FormInput
                  label="Allotted shares"
                  error={validation.errors.allotted_shares}
                  type="number"
                  min="0"
                  value={shares}
                  onChange={(event) => setShares(event.target.value)}
                />
                <FormInput
                  label="Allotment price"
                  error={validation.errors.allotment_price}
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
                <FormInput
                  label="Expected refund"
                  error={validation.errors.refund_amount}
                  inputMode="decimal"
                  value={refund}
                  onChange={(event) => setRefund(event.target.value)}
                />
              </div>
              <p className="mt-3 text-sm text-muted">
                Refund status is derived from the recorded refund amount and actual refund ledger
                entries.
              </p>
              {update.error ? <ErrorNotice error={update.error} /> : null}
            </form>
          </FormDrawer>
        </>
      ) : null}
      {!detail.isLoading && !detail.error && !allotment ? (
        <EmptyState title="Allotment not found" description="This record may have been removed." />
      ) : null}
      <Link className={linkClass} to="/allotments">
        Back to allotments
      </Link>
    </div>
  );
}

export function CreateMandatePage() {
  const { session } = useAuth();
  const [dirty, setDirty] = useState(false);
  const validation = useFormValidation();
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
        body: JSON.stringify(
          validation.validate(mandateSchema, {
            application_id: applicationId,
            mandate_reference: reference,
            mandate_amount: amount,
            notes: notes || null,
          }),
        ),
      }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ["mandates"] });
      navigate(`/mandates/${data.id}`, { state: { successMessage: "Mandate recorded." } });
    },
  });

  return (
    <RouteFormDrawer
      title="Add UPI mandate"
      description="Record an existing mandate manually. This does not initiate a payment or approve the mandate."
      cancelTo="/mandates"
      formId="mandate-form"
      submitLabel="Record pending mandate"
      busy={create.isPending}
      dirty={dirty}
      disabled={!applicationId || Boolean(applications.error)}
    >
      <form
        id="mandate-form"
        className="space-y-5"
        noValidate
        onChangeCapture={() => setDirty(true)}
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <FormSection title="Mandate details">
          <div className="space-y-4">
            <FormSelect
              label="Application"
              error={validation.errors.application_id}
              value={applicationId}
              disabled={applications.isLoading || Boolean(applications.error)}
              onChange={(event) => setApplicationId(event.target.value)}
            >
              <option value="">
                {applications.isLoading ? "Loading applications…" : "Choose an application"}
              </option>
              {(applications.data?.data.applications ?? []).map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationTitle(application)} ·{" "}
                  {money(application.application_amount, application.currency)}
                </option>
              ))}
            </FormSelect>
            <FormInput
              label="UPI mandate reference"
              error={validation.errors.mandate_reference}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
            <FormInput
              label="Mandate amount"
              error={validation.errors.mandate_amount}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <FormTextarea
              label="Notes"
              error={validation.errors.notes}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </FormSection>
        {applications.error ? (
          <ErrorNotice error={applications.error} onRetry={() => void applications.refetch()} />
        ) : null}
        {create.error ? <ErrorNotice error={create.error} /> : null}
      </form>
    </RouteFormDrawer>
  );
}

export function CreateAllotmentPage() {
  const { session } = useAuth();
  const [dirty, setDirty] = useState(false);
  const validation = useFormValidation();
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
        body: JSON.stringify(
          validation.validate(allotmentSchema, {
            application_id: applicationId,
            allotment_status: status,
            allotted_lots: Number(lots),
            allotted_shares: Number(shares),
            allotment_price: price || null,
            refund_amount: refund,
            allotment_date: date || null,
          }),
        ),
      }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ["allotments"] });
      navigate(`/allotments/${data.id}`, { state: { successMessage: "Allotment recorded." } });
    },
  });

  return (
    <RouteFormDrawer
      title="Record allotment"
      description="Enter received allotment details against the saved application and issue rules."
      cancelTo="/allotments"
      formId="allotment-form"
      submitLabel="Save allotment"
      busy={create.isPending}
      dirty={dirty}
      disabled={!applicationId || Boolean(applications.error)}
    >
      <form
        id="allotment-form"
        className="space-y-5"
        noValidate
        onChangeCapture={() => setDirty(true)}
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <FormSection title="Allotment details">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect
              label="Application"
              error={validation.errors.application_id}
              fieldClassName="sm:col-span-2"
              value={applicationId}
              disabled={applications.isLoading || Boolean(applications.error)}
              onChange={(event) => setApplicationId(event.target.value)}
            >
              <option value="">
                {applications.isLoading ? "Loading applications…" : "Choose an application"}
              </option>
              {(applications.data?.data.applications ?? []).map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationTitle(application)} · {application.shares} shares requested
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="Allotment status"
              error={validation.errors.allotment_status}
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
            </FormSelect>
            <FormInput
              label="Allotment date"
              error={validation.errors.allotment_date}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <FormInput
              label="Allotted lots"
              error={validation.errors.allotted_lots}
              type="number"
              min="0"
              value={lots}
              onChange={(event) => setLots(event.target.value)}
            />
            <FormInput
              label="Allotted shares"
              error={validation.errors.allotted_shares}
              type="number"
              min="0"
              value={shares}
              onChange={(event) => setShares(event.target.value)}
            />
            <FormInput
              label="Allotment price"
              error={validation.errors.allotment_price}
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <FormInput
              label="Expected refund"
              error={validation.errors.refund_amount}
              inputMode="decimal"
              value={refund}
              onChange={(event) => setRefund(event.target.value)}
            />
          </div>
        </FormSection>
        {applications.error ? (
          <ErrorNotice error={applications.error} onRetry={() => void applications.refetch()} />
        ) : null}
        {create.error ? <ErrorNotice error={create.error} /> : null}
      </form>
    </RouteFormDrawer>
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
      {summaryQuery.error ? (
        <ErrorNotice error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      ) : null}
      {summaryQuery.isLoading ? (
        <div role="status" aria-label="Loading capital summary" aria-busy="true">
          <span className="sr-only">Loading capital summary…</span>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonStatCard key={index} />
            ))}
          </div>
        </div>
      ) : summaryQuery.error && !summaryQuery.data ? null : summaries.length === 0 ? (
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
      {ledgerQuery.error ? (
        <ErrorNotice error={ledgerQuery.error} onRetry={() => void ledgerQuery.refetch()} />
      ) : null}
      <LedgerEventForm />
      <Card>
        <h2 className="text-xl font-bold text-ink">Ledger events</h2>
        {ledgerQuery.isLoading ? (
          <div role="status" aria-label="Loading ledger events" aria-busy="true" className="mt-4">
            <span className="sr-only">Loading ledger events…</span>
            <SkeletonTable rows={5} cols={4} />
          </div>
        ) : ledgerQuery.error && !ledgerQuery.data ? null : rows.length === 0 ? (
          <p className="mt-3 text-muted">No transactions match these filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <DataTable minWidth="760px">
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
            </DataTable>
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
      {allotmentQuery.error ? (
        <ErrorNotice error={allotmentQuery.error} onRetry={() => void allotmentQuery.refetch()} />
      ) : null}
      <Card>
        <div className="overflow-x-auto">
          <DataTable minWidth="720px">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="p-3">IPO / account</th>
                <th className="p-3">Application amount</th>
                <th className="p-3">Expected refund</th>
                <th className="p-3">Refund status</th>
              </tr>
            </thead>
            <tbody aria-busy={allotmentQuery.isLoading}>
              {allotmentQuery.isLoading ? (
                <SkeletonTableRows rows={5} cols={4} />
              ) : (
                rows.map((allotment) => (
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
                ))
              )}
            </tbody>
          </DataTable>
          {!allotmentQuery.isLoading && !allotmentQuery.error && rows.length === 0 ? (
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
      {mandatesQuery.error ? (
        <ErrorNotice error={mandatesQuery.error} onRetry={() => void mandatesQuery.refetch()} />
      ) : null}
      <Card>
        <h2 className="text-xl font-bold text-ink">Mandates</h2>
        <div className="mt-4 divide-y divide-border">
          {mandatesQuery.isLoading ? (
            <div role="status" aria-label="Loading mandates" aria-busy="true" className="space-y-3">
              <span className="sr-only">Loading mandates…</span>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            rows.map((mandate) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                key={mandate.id}
              >
                <div>
                  <Link
                    className="text-lg font-semibold text-action no-underline underline-offset-4 hover:underline visited:text-action"
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
            ))
          )}
          {!mandatesQuery.isLoading && !mandatesQuery.error && rows.length === 0 ? (
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
      {allotmentsQuery.error ? (
        <ErrorNotice error={allotmentsQuery.error} onRetry={() => void allotmentsQuery.refetch()} />
      ) : null}
      <Card>
        <h2 className="text-xl font-bold text-ink">Allotments</h2>
        <div className="mt-4 divide-y divide-border">
          {allotmentsQuery.isLoading ? (
            <div
              role="status"
              aria-label="Loading allotments"
              aria-busy="true"
              className="space-y-3"
            >
              <span className="sr-only">Loading allotments…</span>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            rows.map((allotment) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                key={allotment.id}
              >
                <div>
                  <Link
                    className="text-lg font-semibold text-action no-underline underline-offset-4 hover:underline visited:text-action"
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
            ))
          )}
          {!allotmentsQuery.isLoading && !allotmentsQuery.error && rows.length === 0 ? (
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
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const validation = useFormValidation();
  const queryClient = useQueryClient();
  const applications = useApplications(session);
  const [applicationId, setApplicationId] = useState("");
  const [type, setType] = useState("CAPITAL_BLOCKED");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [direction, setDirection] = useState("DEBIT");
  const [effectiveAt, setEffectiveAt] = useState(() => toLocalDateTime(new Date().toISOString()));
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
        effective_at: toIsoDateTime(effectiveAt),
        audit_reference: auditReference,
        idempotency_key: window.crypto.randomUUID(),
        ...(listing ? { quantity: Number(quantity), unit_price: unitPrice } : {}),
        ...(type === "ADJUSTMENT" ? { adjustment_direction: direction } : {}),
      };
      return apiRequest<{ data: CapitalLedgerEntry }>("/api/capital/ledger", session!, {
        method: "POST",
        body: JSON.stringify(validation.validate(capitalLedgerEntrySchema, payload)),
      });
    },
    onSuccess: async () => {
      setDirty(false);
      setOpen(false);
      setAmount("");
      setAuditReference("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["capital"] }),
        queryClient.invalidateQueries({ queryKey: ["allotments"] }),
      ]);
    },
  });
  return (
    <>
      <Button
        onClick={() => {
          setApplicationId("");
          setType("CAPITAL_BLOCKED");
          setAmount("");
          setQuantity("");
          setUnitPrice("");
          setDirection("DEBIT");
          setEffectiveAt(toLocalDateTime(new Date().toISOString()));
          setAuditReference("");
          setDirty(false);
          setOpen(true);
        }}
      >
        Record financial event
      </Button>
      <FormDrawer
        open={open}
        title="Record financial event"
        description="Manually record a financial event. Mandate approval does not create an actual debit."
        dirty={dirty}
        busy={create.isPending}
        onClose={() => setOpen(false)}
        footer={(requestClose) => (
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={create.isPending} onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form="ledger-event-form" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Record event"}
            </Button>
          </div>
        )}
      >
        <form
          id="ledger-event-form"
          className="space-y-4"
          noValidate
          onChangeCapture={() => setDirty(true)}
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormSelect
              label="Application (not needed for general adjustment)"
              error={validation.errors.application_id}
              fieldClassName="sm:col-span-2"
              value={applicationId}
              disabled={applications.isLoading || Boolean(applications.error)}
              onChange={(event) => setApplicationId(event.target.value)}
            >
              <option value="">
                {applications.isLoading ? "Loading applications…" : "Choose application"}
              </option>
              {(applications.data?.data.applications ?? []).map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationTitle(application)}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="Transaction type"
              error={validation.errors.transaction_type}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {transactionTypes.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </FormSelect>
            {type === "ADJUSTMENT" ? (
              <FormSelect
                label="Adjustment direction"
                error={validation.errors.adjustment_direction}
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
              >
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </FormSelect>
            ) : null}
            {type === "LISTING_SALE" || type === "LISTING_PRICE_UPDATE" ? (
              <>
                <FormInput
                  label="Quantity"
                  error={validation.errors.quantity}
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <FormInput
                  label="Price per share"
                  error={validation.errors.unit_price}
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                />
                <p className="text-sm text-muted sm:col-span-2">
                  Event amount:{" "}
                  {quantity && unitPrice
                    ? multiplyDecimalString(unitPrice, Number(quantity))
                    : "Enter quantity and price"}
                </p>
              </>
            ) : (
              <FormInput
                label="Amount"
                error={validation.errors.amount}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            )}
            <FormInput
              label="Effective date and time"
              error={validation.errors.effective_at}
              type="datetime-local"
              value={effectiveAt}
              onChange={(event) => setEffectiveAt(event.target.value)}
            />
            <FormInput
              label="Audit reference"
              error={validation.errors.audit_reference}
              value={auditReference}
              onChange={(event) => setAuditReference(event.target.value)}
            />
          </div>
          {applications.error ? (
            <ErrorNotice error={applications.error} onRetry={() => void applications.refetch()} />
          ) : null}
          {create.error ? <ErrorNotice error={create.error} /> : null}
        </form>
      </FormDrawer>
    </>
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
            disabled={ipos.isLoading || Boolean(ipos.error)}
            onChange={(event) => onChange({ ...filters, ipo_id: event.target.value })}
          >
            <option value="">
              {ipos.isLoading ? "Loading IPOs…" : ipos.error ? "IPO list unavailable" : "All IPOs"}
            </option>
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
            disabled={accounts.isLoading || Boolean(accounts.error)}
            onChange={(event) => onChange({ ...filters, account_id: event.target.value })}
          >
            <option value="">
              {accounts.isLoading
                ? "Loading accounts…"
                : accounts.error
                  ? "Account list unavailable"
                  : "All accounts"}
            </option>
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
      {ipos.error ? (
        <div className="mt-4 space-y-2">
          <ErrorNotice error={ipos.error} />
          <Button variant="outline" onClick={() => void ipos.refetch()}>
            Retry IPO options
          </Button>
        </div>
      ) : null}
      {accounts.error ? (
        <div className="mt-4 space-y-2">
          <ErrorNotice error={accounts.error} />
          <Button variant="outline" onClick={() => void accounts.refetch()}>
            Retry account options
          </Button>
        </div>
      ) : null}
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

function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiRequestError
      ? error.message
      : error instanceof Error
        ? error.message
        : "The request could not be completed.";
  return (
    <div
      role="alert"
      className="rounded-lg border border-[#F1D9B3] bg-[#FFF9EF] p-3 text-sm text-danger"
    >
      <p>{message}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-2 border-danger/30 text-danger" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
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
