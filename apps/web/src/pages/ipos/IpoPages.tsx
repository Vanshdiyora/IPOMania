import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  DematAccount,
  IpoCategoryCode,
  IpoCategoryConfiguration,
  IpoRecord,
  IpoStatus,
} from "@ipo-mania/shared";
import { ipoCategoryConfigurationSchema, ipoSchema, ipoStatusSchema } from "@ipo-mania/validation";
import type { z } from "@ipo-mania/validation";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ApiRequestError, apiRequest } from "../../lib/api";

type IpoListResponse = {
  data: {
    ipos: IpoRecord[];
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
};
type IpoResponse = { data: IpoRecord };
type IpoCategoryResponse = { data: { configurations: IpoCategoryConfiguration[] } };
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

const categories: IpoCategoryCode[] = ["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"];
const statuses = ipoStatusSchema.options;
const secondaryLinkClass =
  "inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-white px-5 py-2 font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy";

export function IpoListPage({ calendar = false }: { calendar?: boolean }) {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    page: String(page),
    page_size: "25",
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["ipos", calendar ? "calendar" : "list", params.toString()],
    enabled: Boolean(session),
    queryFn: () => apiRequest<IpoListResponse>(`/api/ipos?${params}`, session!),
  });
  const ipos = data?.data.ipos ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">{calendar ? "IPO calendar" : "IPOs"}</h1>
          <p className="mt-2 text-base text-muted">
            {calendar
              ? "View your issue records in opening-date order."
              : "Search and manage your manually entered IPO records."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className={secondaryLinkClass} to={calendar ? "/ipos" : "/ipo-calendar"}>
            {calendar ? "IPO list" : "IPO calendar"}
          </Link>
          {!calendar ? (
            <Link
              className="inline-flex min-h-touch items-center justify-center rounded-lg bg-action px-5 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
              to="/ipos/new"
            >
              Add IPO
            </Link>
          ) : null}
        </div>
      </header>
      <Card>
        <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
          <label className="block text-sm font-semibold text-ink">
            Search company or exact symbol
            <input
              className={inputClass}
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Status
            <select
              className={inputClass}
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>
      {error ? <ErrorNotice error={error} /> : null}
      {isLoading ? <p role="status">Loading IPO records…</p> : null}
      {!isLoading && ipos.length === 0 ? (
        <Card>
          <p className="font-semibold text-ink">No IPO records match these filters.</p>
          <p className="mt-2 text-muted">Add an issue to start an issue-specific rule record.</p>
        </Card>
      ) : null}
      <div className="grid gap-4">
        {ipos.map((ipo) => (
          <Card key={ipo.id} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <Link className="text-xl font-bold text-action underline" to={`/ipos/${ipo.id}`}>
                {ipo.company_name}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {ipo.symbol} · {ipo.exchange} · Opens {formatDate(ipo.opening_date)}
              </p>
              <p className="mt-1 text-sm text-muted">
                Price {ipo.issue_price_min}–{ipo.issue_price_max} · Lot size {ipo.lot_size}
              </p>
              <p className="mt-1 text-xs text-muted">
                {ipo.data_source === "MANUAL"
                  ? ipo.last_verified_at
                    ? "Manual entry · user-marked verification date"
                    : "Manual entry · unverified"
                  : "Published source · user-entered"}
              </p>
            </div>
            <span className="rounded-full bg-[#EAF0F6] px-3 py-2 text-sm font-semibold text-navy">
              {label(ipo.status)}
            </span>
          </Card>
        ))}
      </div>
      {data && data.data.pagination.total_pages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="IPO list pages">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {data.data.pagination.total_pages}
          </span>
          <Button
            variant="outline"
            disabled={page >= data.data.pagination.total_pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

export function IpoDetailsPage() {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const archive = useMutation({
    mutationFn: () =>
      apiRequest<IpoResponse>(`/api/ipos/${ipoId}/archive`, session!, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ipos"] });
      navigate("/ipos");
    },
  });
  const ipo = ipoQuery.data?.data;

  if (ipoQuery.isLoading) return <p role="status">Loading IPO details…</p>;
  if (ipoQuery.error) return <ErrorNotice error={ipoQuery.error} />;
  if (!ipo) return <p role="alert">IPO record not found.</p>;

  const latestCategories = latestByCategory(categoriesQuery.data?.data.configurations ?? []);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">{ipo.symbol}</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">{ipo.company_name}</h1>
          <p className="mt-2 text-muted">
            {ipo.exchange} · {ipo.ipo_type} · {label(ipo.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className={secondaryLinkClass} to={`/ipos/${ipo.id}/categories`}>
            Configure categories
          </Link>
          <Link className={secondaryLinkClass} to={`/quota-calculator?ipo=${ipo.id}`}>
            Quota calculator
          </Link>
          {!ipo.archived_at ? (
            <>
              <Link className={secondaryLinkClass} to={`/ipos/${ipo.id}/edit`}>
                Edit IPO
              </Link>
              <Button
                variant="outline"
                disabled={archive.isPending}
                onClick={() => archive.mutate()}
              >
                Archive
              </Button>
            </>
          ) : null}
        </div>
      </header>
      {archive.error ? <ErrorNotice error={archive.error} /> : null}
      <Card>
        <h2 className="text-xl font-bold text-ink">Issue details</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Price range" value={`${ipo.issue_price_min}–${ipo.issue_price_max}`} />
          <Detail label="Cut-off price" value={ipo.cut_off_price ?? "Not configured"} />
          <Detail label="Lot size" value={String(ipo.lot_size)} />
          <Detail label="Issue size" value={ipo.issue_size} />
          <Detail label="Opening date" value={formatDate(ipo.opening_date)} />
          <Detail label="Closing date" value={formatDate(ipo.closing_date)} />
          <Detail label="Allotment date" value={formatDate(ipo.allotment_date)} />
          <Detail label="Listing date" value={formatDate(ipo.listing_date)} />
          <Detail label="Data source" value={ipo.data_source} />
          <Detail label="Source reference" value={ipo.source_reference ?? "Not provided"} />
          <Detail
            label="User-entered verification date"
            value={ipo.last_verified_at ? formatDateTime(ipo.last_verified_at) : "Not verified"}
          />
        </dl>
        <p className="mt-5 rounded-lg border border-[#F1D9B3] bg-[#FFF9EF] p-4 text-sm text-ink">
          This record and its source/verification date were entered by the user. The application
          does not automatically fetch or verify the source.
        </p>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">Category rule versions</h2>
            <p className="mt-1 text-sm text-muted">
              Each new configuration creates an immutable version for later calculation records.
            </p>
          </div>
          <Link className="text-action underline" to={`/ipos/${ipo.id}/categories`}>
            Manage rules
          </Link>
        </div>
        {categoriesQuery.error ? <ErrorNotice error={categoriesQuery.error} /> : null}
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
      </Card>
    </div>
  );
}

export function IpoFormPage({ editing = false }: { editing?: boolean }) {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationTime, setVerificationTime] = useState("");
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
    if (existing.data?.data) {
      const { last_verified_at, ...values } = existing.data.data;
      form.reset(values);
      setVerificationTime(last_verified_at ? toLocalDateTime(last_verified_at) : "");
    }
  }, [existing.data, form]);

  const submit = form.handleSubmit(async (values) => {
    if (!session) return;
    setErrorMessage("");
    const payload = {
      ...values,
      source_reference: values.source_reference || null,
      last_verified_at: verificationTime ? new Date(verificationTime).toISOString() : null,
    };
    try {
      const response = await apiRequest<IpoResponse>(
        editing ? `/api/ipos/${ipoId}` : "/api/ipos",
        session,
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      await queryClient.invalidateQueries({ queryKey: ["ipos"] });
      navigate(`/ipos/${response.data.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The IPO could not be saved.");
    }
  });

  if (editing && existing.isLoading) return <p role="status">Loading IPO record…</p>;
  if (editing && existing.error) return <ErrorNotice error={existing.error} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">{editing ? "Edit IPO" : "Add IPO"}</h1>
        <p className="mt-2 text-muted">
          Enter issue details from a source you can review. Manual values are never marked verified
          automatically.
        </p>
      </header>
      {errorMessage ? (
        <p role="alert" className="text-danger">
          {errorMessage}
        </p>
      ) : null}
      <Card>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <TextField form={form} name="company_name" label="Company name" />
          <TextField form={form} name="symbol" label="Symbol" />
          <TextField form={form} name="ipo_type" label="IPO type" />
          <TextField form={form} name="exchange" label="Exchange" />
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
          <TextField form={form} name="opening_date" label="Opening date" type="date" />
          <TextField form={form} name="closing_date" label="Closing date" type="date" />
          <TextField
            form={form}
            name="allotment_date"
            label="Allotment date (optional)"
            type="date"
          />
          <TextField form={form} name="listing_date" label="Listing date (optional)" type="date" />
          <SelectField form={form} name="data_source" label="Data source">
            <option value="MANUAL">Manual entry</option>
            <option value="PUBLISHED_SOURCE">Published source, entered manually</option>
          </SelectField>
          <label className="block text-sm font-semibold text-ink sm:col-span-2">
            Source reference (optional)
            <input
              className={inputClass}
              {...form.register("source_reference")}
              placeholder="Official document URL or publication reference"
            />
          </label>
          <label className="block text-sm font-semibold text-ink sm:col-span-2">
            Last verified at (optional)
            <input
              className={inputClass}
              type="datetime-local"
              value={verificationTime}
              onChange={(event) => setVerificationTime(event.target.value)}
            />
            <span className="mt-1 block font-normal text-muted">
              Leave blank unless you personally checked the referenced source.
            </span>
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : editing ? "Save changes" : "Add IPO"}
            </Button>
            <Link className={secondaryLinkClass} to={editing ? `/ipos/${ipoId}` : "/ipos"}>
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function IpoCategoryConfigurationPage() {
  const { ipoId = "" } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<IpoCategoryCode>("RETAIL");
  const [conditionId, setConditionId] = useState("");
  const [conditionDescription, setConditionDescription] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<RuleForm>(emptyRuleForm);
  const ipoQuery = useQuery({
    queryKey: ["ipo", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<IpoResponse>(`/api/ipos/${ipoId}`, session!),
  });
  const rulesQuery = useQuery({
    queryKey: ["ipo-categories", ipoId],
    enabled: Boolean(session && ipoId),
    queryFn: () => apiRequest<IpoCategoryResponse>(`/api/ipos/${ipoId}/categories`, session!),
  });
  const createRule = useMutation({
    mutationFn: (configuration: ReturnType<typeof ipoCategoryConfigurationSchema.parse>) =>
      apiRequest<{ data: IpoCategoryConfiguration }>(`/api/ipos/${ipoId}/categories`, session!, {
        method: "POST",
        body: JSON.stringify(configuration),
      }),
    onSuccess: async () => {
      setMessage("A new rule version was saved. Earlier versions remain unchanged.");
      await queryClient.invalidateQueries({ queryKey: ["ipo-categories", ipoId] });
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Rules were not saved."),
  });
  const configurations = rulesQuery.data?.data.configurations ?? [];
  const latest = latestByCategory(configurations);
  const existing = latest.get(category);

  useEffect(() => {
    if (existing) setForm(toRuleForm(existing));
    else setForm(emptyRuleForm());
  }, [category, existing]);

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
      last_verified_at: form.last_verified_at
        ? new Date(form.last_verified_at).toISOString()
        : null,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "The category rule configuration is invalid.");
      return;
    }
    createRule.mutate(parsed.data);
  };

  if (ipoQuery.isLoading) return <p role="status">Loading IPO…</p>;
  if (ipoQuery.error) return <ErrorNotice error={ipoQuery.error} />;
  if (!ipoQuery.data) return <p role="alert">IPO record not found.</p>;
  const ipo = ipoQuery.data.data;

  return (
    <div className="space-y-6">
      <header>
        <Link className="text-action underline" to={`/ipos/${ipo.id}`}>
          Back to IPO
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-navy">Category configuration</h1>
        <p className="mt-2 text-muted">
          {ipo.company_name} · {ipo.symbol}
        </p>
        <p className="mt-2 rounded-lg border border-[#F1D9B3] bg-[#FFF9EF] p-3 text-sm text-ink">
          Enter the issue-specific values you have sourced. Unknown limits stay unconfigured; they
          are never treated as unlimited. A new submission creates a new immutable rule version.
        </p>
      </header>
      <Card>
        <label className="block max-w-sm text-sm font-semibold text-ink">
          Category
          <select
            className={inputClass}
            value={category}
            onChange={(event) => setCategory(event.target.value as IpoCategoryCode)}
          >
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
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
        <p role="status" className="text-sm text-ink">
          {message}
        </p>
      ) : null}
      <Card>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
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
          <TextRuleField form={form} setForm={setForm} name="lot_increment" label="Lot increment" />
          <TextRuleField form={form} setForm={setForm} name="minimum_lots" label="Minimum lots" />
          <TextRuleField form={form} setForm={setForm} name="maximum_lots" label="Maximum lots" />
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
            form={form}
            setForm={setForm}
            name="minimum_investment"
            label="Minimum investment"
          />
          <TextRuleField
            form={form}
            setForm={setForm}
            name="maximum_investment"
            label="Maximum investment"
          />
          <TextRuleField
            form={form}
            setForm={setForm}
            name="reserved_shares"
            label="Reserved shares (optional)"
          />
          <TextRuleField
            form={form}
            setForm={setForm}
            name="reserved_percentage"
            label="Reserved percentage (optional)"
          />
          <TextRuleField
            form={form}
            setForm={setForm}
            name="shareholder_record_date"
            label="Shareholder record date"
            type="date"
          />
          <TextRuleField
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
            form={form}
            setForm={setForm}
            name="source_reference"
            label="Source reference"
          />
          <TextRuleField
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
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        eligibility_conditions: current.eligibility_conditions.filter(
                          ({ id }) => id !== condition.id,
                        ),
                      }))
                    }
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
      {rulesQuery.error ? <ErrorNotice error={rulesQuery.error} /> : null}
    </div>
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
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Quota calculator</h1>
        <p className="mt-2 text-muted">
          Calculate shares and application amount against the latest configured rule version.
        </p>
      </header>
      <p className="rounded-lg border border-[#F1D9B3] bg-[#FFF9EF] p-4 text-sm text-ink">
        IPO data and category rules are user-entered and may be unverified. Shareholder information
        and condition answers are your inputs, not verified holdings. This calculator does not
        confirm allotment or eligibility with an exchange.
      </p>
      {requestError ? (
        <p role="alert" className="text-danger">
          {requestError}
        </p>
      ) : null}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            IPO
            <select
              className={inputClass}
              value={ipoId}
              onChange={(event) => setIpoId(event.target.value)}
            >
              <option value="">Choose an IPO</option>
              {ipoOptions.map((ipo) => (
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
              value={dematAccountId}
              onChange={(event) => setDematAccountId(event.target.value)}
            >
              <option value="">Choose an account</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.holder_name} · {account.broker_name} · {account.masked_demat_identifier}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Category
            <select
              className={inputClass}
              value={category}
              onChange={(event) => setCategory(event.target.value as IpoCategoryCode)}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                  {latestRules.has(value) ? "" : " — not configured"}
                </option>
              ))}
            </select>
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
            <select
              className={inputClass}
              value={priceType}
              onChange={(event) => setPriceType(event.target.value as "BID" | "CUT_OFF")}
            >
              {priceOptions.map((type) => (
                <option key={type} value={type}>
                  {type === "BID" ? "Bid price" : "Cut-off price"}
                </option>
              ))}
            </select>
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

function toRuleForm(configuration: IpoCategoryConfiguration): RuleForm {
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
}: {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
  name: keyof RuleForm;
  label: string;
  type?: string;
}) {
  const value = typeof form[name] === "string" ? (form[name] as string) : "";
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <input
        className={inputClass}
        type={type}
        inputMode={type === "text" ? "decimal" : undefined}
        value={value}
        onChange={(event) => updateRuleForm(setForm, name, event.target.value)}
      />
    </label>
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
    <label className="block text-sm font-semibold text-ink">
      {label}
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label.replace(" limits", "") === "Rule source" ? option : labelValue(option)}
          </option>
        ))}
      </select>
    </label>
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
  type?: string;
  inputMode?: "numeric" | "decimal";
}) {
  const nullableField = ["cut_off_price", "allotment_date", "listing_date"].includes(name);
  const registration =
    name === "lot_size"
      ? form.register(name, { valueAsNumber: true })
      : nullableField
        ? form.register(name, { setValueAs: (value: string) => (value === "" ? null : value) })
        : form.register(name);
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <input
        className={inputClass}
        type={name === "lot_size" ? "number" : type}
        inputMode={inputMode}
        {...registration}
      />
      {form.formState.errors[name]?.message ? (
        <span className="mt-1 block font-normal text-danger">
          {String(form.formState.errors[name]?.message)}
        </span>
      ) : null}
    </label>
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
    <label className="block text-sm font-semibold text-ink">
      {label}
      <select className={inputClass} {...form.register(name)}>
        {children}
      </select>
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-ink">{value}</dd>
    </div>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  const message =
    error instanceof ApiRequestError ? error.message : "The request could not be completed.";
  return (
    <p role="alert" className="rounded-lg bg-[#FDECEC] p-4 text-danger">
      {message}
    </p>
  );
}

function latestByCategory(configurations: IpoCategoryConfiguration[]) {
  const latest = new Map<IpoCategoryCode, IpoCategoryConfiguration>();
  for (const configuration of configurations) {
    const current = latest.get(configuration.category);
    if (!current || configuration.rule_version > current.rule_version) {
      latest.set(configuration.category, configuration);
    }
  }
  return latest;
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

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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
