/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalLayer } from "../../components/ui/useModalLayer";
import { useQuery } from "@tanstack/react-query";
import { adminIpoSchema } from "@ipo-mania/validation";
import { isAdminEmail } from "@ipo-mania/shared";
import { Link, Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Edit3,
  Eye,
  History,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { apiRequest } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { ConfirmButton } from "../../components/ui/ConfirmButton";
import { Button } from "../../components/ui/Button";
import { ConfirmationDialog } from "../../components/ui/ConfirmationDialog";
import { FormSection } from "../../components/ui/FormSection";
import { SearchInput, Select } from "../../components/ui/Input";
import { FormDrawer } from "../../components/ui/FormDrawer";
import { FormInput, FormSelect } from "../../components/ui/FormControls";
import { Pagination } from "../../components/ui/Pagination";
import { PageHeader, StatCard } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/Badge";
import { ErrorNotice, EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/ToastContext";
import {
  SkeletonCard,
  SkeletonFormPage,
  SkeletonStatCard,
  SkeletonTable,
} from "../../components/ui/Skeleton";
import { LoadingState } from "../../components/LoadingState";

const nav = [
  ["Overview", "/admin", BarChart3],
  ["All IPOs", "/admin/ipos", Building2],
  ["IPO Data Sync", "/admin/sync", RefreshCw],
  ["Sync History", "/admin/ipo-sync-history", History],
  ["Settings", "/admin/settings", Settings],
] as const;

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, session } = useAuth();
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user || !supabase) {
      setAdmin(false);
      return;
    }
    void supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setAdmin(isAdminEmail(user.email) && data?.role === "ADMIN"));
  }, [user]);
  if (loading || (admin === null && user)) {
    return <LoadingState label="Checking administrator access" fullPage />;
  }
  if (!user || !session) return <Navigate to="/login" replace />;
  if (!admin)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="rounded-xl border bg-white p-8 text-center">
          <h1 className="text-xl font-bold">Access denied</h1>
          <p className="mt-2 text-slate-600">This area is restricted to administrators.</p>
        </section>
      </main>
    );
  return <>{children}</>;
}

export function AdminLayout() {
  const { signOut } = useAuth();
  const { notify } = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  useModalLayer(open, mobilePanelRef, () => setOpen(false), "[data-navigation-close]");
  const title = nav.find(([, path]) => path === location.pathname)?.[0] ?? "IPO Administration";
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5 text-lg font-bold text-white">
        <span className="mr-2 grid h-8 w-8 place-items-center rounded-lg bg-white text-navy">
          I
        </span>
        IPO Mania
      </div>
      <nav aria-label="Administration" className="flex-1 space-y-1 px-3 py-5">
        {nav.map(([label, path, Icon]) => (
          <Link
            key={path}
            to={path}
            onClick={() => setOpen(false)}
            aria-current={location.pathname === path ? "page" : undefined}
            className={`flex min-h-touch items-center rounded-lg px-3 text-sm font-medium transition-colors ${location.pathname === path ? "bg-white text-navy" : "text-slate-200 hover:bg-navy-light hover:text-white"}`}
          >
            <Icon className="mr-3 h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={() =>
          void signOut()
            .then(() => notify({ title: "Signed out", tone: "success" }))
            .catch(() => notify({ title: "Sign out failed", tone: "error" }))
        }
        className="mx-3 mb-5 flex min-h-touch items-center rounded-lg px-3 text-sm font-medium text-slate-200 hover:bg-navy-light"
      >
        <LogOut className="mr-3 h-4 w-4" />
        Sign out
      </button>
    </div>
  );
  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-navy lg:block">{sidebar}</aside>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50" role="presentation">
            <button
              aria-label="Close navigation overlay"
              className="absolute inset-0 bg-navy/40"
              onClick={() => setOpen(false)}
            />
            <div
              ref={mobilePanelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              className="relative h-dvh w-64 bg-navy shadow-xl"
            >
              {sidebar}
              <button
                data-navigation-close
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="absolute right-2 top-2 grid min-h-touch min-w-touch place-items-center rounded-lg text-white"
              >
                <X />
              </button>
            </div>
          </div>,
          document.body,
        )}
      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-4 lg:px-8">
          <button
            className="mr-3 grid min-h-touch min-w-touch place-items-center rounded-lg lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div>
            <p className="text-xs text-muted">Admin / {title}</p>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
      {children}
    </section>
  );
}

export function AdminOverviewPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [overview, setOverview] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!session) return;
      const [a, b] = await Promise.all([
        apiRequest<any>("/api/admin/ipos/overview", session),
        apiRequest<any>("/api/admin/ipos/sync/status", session),
      ]);
      setOverview(a.data);
      setStatus(b.data);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error : new Error("Unable to load administration data."),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [session]);
  const sync = async () => {
    if (!session || syncing) return;
    setSyncing(true);
    setMessage("Fetching provider data and saving records…");
    try {
      const result = await apiRequest<any>("/api/admin/ipos/sync", session, { method: "POST" });
      setMessage("");
      notify({
        title: "IPO synchronization complete",
        description: `${result.data?.recordsInserted ?? 0} inserted, ${result.data?.recordsUpdated ?? 0} updated.`,
        tone: "success",
      });
      await load();
    } catch (error) {
      setMessage("");
      notify({
        title: "IPO synchronization failed",
        description: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setSyncing(false);
    }
  };
  const counts = overview?.counts ?? {};
  const syncCoolingDown = Boolean(
    status?.nextAllowedAt && new Date(status.nextAllowedAt).getTime() > Date.now(),
  );
  const cards = [
    ["Total IPOs", counts.total ?? 0],
    ["Upcoming", counts.upcoming ?? 0],
    ["Open", counts.open ?? 0],
    ["Closed", counts.closed ?? 0],
    ["Listed", counts.listed ?? 0],
  ];
  return (
    <div className="space-y-6">
      {loadError && (
        <div>
          <ErrorNotice error={loadError} />
          <Button variant="outline" className="mt-3" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      <PageHeader
        title="IPO overview"
        description="Live catalog counts and synchronization status."
        actions={
          <ConfirmButton
            disabled={
              syncing ||
              syncCoolingDown ||
              status?.remainingManualRuns === 0 ||
              status?.running ||
              !status?.providerConfigured
            }
            onConfirm={sync}
            title="Synchronize IPO data?"
            description="Fetch the latest provider records and update the shared IPO catalog."
            confirmLabel="Start synchronization"
            danger={false}
            className="inline-flex min-h-touch items-center justify-center rounded-lg bg-action px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Fetch Latest IPO Data
          </ConfirmButton>
        }
      />
      {message && (
        <div role="status" className="rounded-lg border bg-white px-4 py-3 text-sm">
          {message}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <StatCard
            key={String(label)}
            label={String(label)}
            value={overview ? String(value) : "—"}
            loading={loading && !overview}
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="font-bold">Synchronization</h3>
          <p className="mt-3 text-sm text-slate-600">
            Status: {status?.latest?.status ?? (status?.running ? "Running" : "Not run")}
          </p>
          <p className="text-sm text-slate-600">
            Provider: {status?.providerConfigured ? "Configured" : "Setup required"}
          </p>
          <p className="text-sm text-slate-600">
            Manual runs remaining: {status?.remainingManualRuns ?? 0}
          </p>
          {syncCoolingDown && (
            <p className="mt-2 text-sm text-slate-600">
              Next available: {new Date(status.nextAllowedAt).toLocaleString()}
            </p>
          )}
        </Card>
        <Card>
          <h3 className="font-bold">Recent activity</h3>
          {(overview?.recentSyncs ?? []).slice(0, 5).map((log: any) => (
            <div key={log.id} className="mt-3 flex justify-between border-t pt-3 text-sm">
              <span>
                {log.trigger_type} · {log.provider}
              </span>
              <span>{log.status}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function AdminIposPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const location = useLocation();
  const [listParams, setListParams] = useSearchParams();
  const search = listParams.get("search") ?? "";
  const statusFilter = listParams.get("status") ?? "";
  const pageValue = Number(listParams.get("page"));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const updateFilter = (key: string, value: string) => {
    setListParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
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
  const emptyForm = {
    company_name: "",
    issue_type: "mainboard",
    ipo_status: "upcoming",
    data_source: "MANUAL",
    symbol: "",
    exchange: "",
    isin: "",
    bidding_start_date: "",
    bidding_end_date: "",
    allotment_date: "",
    listing_date: "",
    price_band_min: "",
    price_band_max: "",
    issue_price: "",
    listing_price: "",
    lot_size: "",
    issue_size: "",
  };
  const [rows, setRows] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState("");
  const pageSize = 20;
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const load = async () => {
    if (!session) return;
    setLoading(true);
    setLoadError("");
    try {
      const result = await apiRequest<any>("/api/admin/ipos/catalog", session);
      setRows(result.data ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load IPO catalog.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [session]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!statusFilter || row.ipo_status === statusFilter) &&
          (!search ||
            `${row.company_name} ${row.symbol ?? ""}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [rows, search, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const openCreate = () => {
    setFieldErrors({});
    setSaveError("");
    setEditingId(null);
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setDrawerOpen(true);
  };
  const openEdit = (row: any) => {
    setFieldErrors({});
    setSaveError("");
    const value = { ...emptyForm };
    for (const key of Object.keys(emptyForm) as Array<keyof typeof emptyForm>) {
      value[key] = row[key] == null ? emptyForm[key] : String(row[key]);
    }
    setEditingId(row.id);
    setForm(value);
    setInitialForm(value);
    setDrawerOpen(true);
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const closeDrawer = () => {
    if (!saving) setDrawerOpen(false);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || saving) return;
    setSaveError("");
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        value === "" && !["company_name", "issue_type", "ipo_status"].includes(key) ? null : value,
      ]),
    );
    const parsed = adminIpoSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      if (editingId) {
        await apiRequest(`/api/admin/ipos/catalog/${editingId}`, session, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
      } else {
        await apiRequest("/api/admin/ipos/catalog", session, {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
      }
      setDrawerOpen(false);
      notify({ title: editingId ? "IPO updated" : "IPO created", tone: "success" });
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save IPO. Please try again.";
      setSaveError(message);
      notify({ title: "Unable to save IPO", description: message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  const archive = async () => {
    if (!session || !archiveId || archiving) return;
    setArchiving(true);
    try {
      await apiRequest(`/api/admin/ipos/catalog/${archiveId}`, session, { method: "DELETE" });
      setArchiveId(null);
      notify({ title: "IPO archived", tone: "success" });
      await load();
    } catch (error) {
      notify({
        title: "Unable to archive IPO",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="IPO catalog"
        description={`${filtered.length} records`}
        actions={<Button onClick={openCreate}>Add IPO</Button>}
      />
      <SearchInput
        aria-label="Search IPO catalog"
        value={search}
        onClear={() => {
          updateFilter("search", "");
        }}
        onChange={(event) => {
          updateFilter("search", event.target.value);
        }}
        placeholder="Search company or symbol"
      />

      <Select
        aria-label="Filter catalog status"
        value={statusFilter}
        onChange={(event) => {
          updateFilter("status", event.target.value);
        }}
        className="sm:max-w-xs"
      >
        <option value="">All statuses</option>
        {["upcoming", "open", "closed", "listed"].map((status) => (
          <option key={status} value={status}>
            {status[0]?.toUpperCase()}
            {status.slice(1)}
          </option>
        ))}
      </Select>
      {loadError && (
        <div role="alert" className="rounded-lg border border-danger p-4 text-danger">
          {loadError}
          <Button variant="outline" className="ml-3" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white md:overflow-x-auto">
        {loading ? (
          <div role="status" aria-label="Loading IPO catalog" aria-busy="true">
            <span className="sr-only">Loading IPO catalog…</span>
            <div className="space-y-3 p-4 md:hidden">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="hidden p-4 md:block">
              <SkeletonTable rows={6} cols={7} />
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y md:hidden">
              {visibleRows.map((row) => (
                <article key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="break-words font-semibold text-slate-950">
                        {row.company_name}
                      </h3>
                      <p className="text-sm text-slate-500">{row.symbol || "No symbol"}</p>
                    </div>
                    <StatusBadge status={row.ipo_status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Type</dt>
                      <dd>{row.issue_type}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Listing date</dt>
                      <dd>{row.listing_date ?? "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/ipos/catalog/${row.id}`}
                        state={{ from: `${location.pathname}${location.search}` }}
                      >
                        <Eye className="h-4 w-4" /> View
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="danger-outline" onClick={() => setArchiveId(row.id)}>
                      <Trash2 className="h-4 w-4" />
                      Archive
                    </Button>
                  </div>
                </article>
              ))}
              {!filtered.length && (
                <div className="p-8 text-center text-sm text-slate-500">No IPOs found.</div>
              )}
            </div>
            <table className="hidden min-w-[820px] w-full text-left text-sm md:table">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">
                    Company
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Symbol
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Listing date
                  </th>
                  <th scope="col" className="sticky right-0 bg-slate-50 px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-canvas">
                    <td
                      className="max-w-xs truncate px-4 py-3 font-semibold"
                      title={row.company_name}
                    >
                      {row.company_name}
                    </td>
                    <td className="px-4 py-3">{row.symbol ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{row.issue_type}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={row.ipo_status} />
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap">
                      {row.listing_date ?? "—"}
                    </td>
                    <td className="sticky right-0 bg-white px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            to={`/ipos/catalog/${row.id}`}
                            state={{ from: `${location.pathname}${location.search}` }}
                          >
                            <Eye className="h-4 w-4" /> View
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50"
                          onClick={() => setArchiveId(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Archive
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No IPOs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      <Pagination
        label="Catalog pagination"
        page={visiblePage}
        totalPages={totalPages}
        total={filtered.length}
        onPageChange={changePage}
      />
      <FormDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        dirty={dirty}
        busy={saving}
        title={editingId ? "Edit IPO" : "Add IPO"}
        description="Manage the company, pricing and listing details shown in the catalog."
        footer={(requestClose) => (
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={saving} onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form="ipo-catalog-form" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create IPO"}
            </Button>
          </div>
        )}
      >
        <form id="ipo-catalog-form" onSubmit={save} className="space-y-5" noValidate>
          {saveError && (
            <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">
              {saveError}
            </p>
          )}
          <FormSection
            title="Company details"
            description="The primary information used to identify this IPO."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Company name"
                required
                maxLength={160}
                fieldClassName="sm:col-span-2"
                value={form.company_name}
                error={fieldErrors.company_name}
                onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              />
              <FormInput
                label="Symbol"
                maxLength={24}
                value={form.symbol}
                error={fieldErrors.symbol}
                onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })}
              />
              <FormSelect
                label="Issue type"
                required
                value={form.issue_type}
                error={fieldErrors.issue_type}
                onChange={(event) => setForm({ ...form, issue_type: event.target.value })}
              >
                <option value="mainboard">Mainboard</option>
                <option value="SME">SME</option>
              </FormSelect>
              <FormInput
                label="Exchange"
                maxLength={40}
                value={form.exchange}
                error={fieldErrors.exchange}
                onChange={(event) => setForm({ ...form, exchange: event.target.value })}
              />
              <FormInput
                label="ISIN"
                maxLength={24}
                value={form.isin}
                error={fieldErrors.isin}
                onChange={(event) => setForm({ ...form, isin: event.target.value })}
              />
            </div>
          </FormSection>
          <FormSection title="Pricing and issue size" description="Leave unknown values blank.">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["price_band_min", "Price band minimum"],
                  ["price_band_max", "Price band maximum"],
                  ["issue_price", "Issue price"],
                  ["listing_price", "Listing price"],
                  ["lot_size", "Lot size"],
                  ["issue_size", "Issue size"],
                ] as const
              ).map(([name, label]) => (
                <FormInput
                  key={name}
                  label={label}
                  inputMode={name === "lot_size" ? "numeric" : "decimal"}
                  value={form[name]}
                  error={fieldErrors[name]}
                  onChange={(event) => setForm({ ...form, [name]: event.target.value })}
                />
              ))}
            </div>
          </FormSection>
          <FormSection title="Key dates">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["bidding_start_date", "Opening date"],
                  ["bidding_end_date", "Closing date"],
                  ["listing_date", "Listing date"],
                ] as const
              ).map(([name, label]) => (
                <FormInput
                  key={name}
                  type="date"
                  label={label}
                  value={form[name]}
                  error={fieldErrors[name]}
                  onChange={(event) => setForm({ ...form, [name]: event.target.value })}
                />
              ))}
            </div>
          </FormSection>
          <FormSection title="Catalog status">
            <FormSelect
              label="IPO status"
              required
              value={form.ipo_status}
              error={fieldErrors.ipo_status}
              onChange={(event) => setForm({ ...form, ipo_status: event.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="listed">Listed</option>
            </FormSelect>
          </FormSection>
        </form>
      </FormDrawer>
      <ConfirmationDialog
        open={Boolean(archiveId)}
        busy={archiving}
        title="Archive this IPO?"
        description={`${rows.find((row) => row.id === archiveId)?.company_name ?? "This IPO"} will be removed from the active catalog. This action can be reversed from the database.`}
        confirmLabel={archiving ? "Archiving…" : "Archive IPO"}
        danger
        onCancel={() => !archiving && setArchiveId(null)}
        onConfirm={() => void archive()}
      />
    </div>
  );
}

type SyncRun = {
  id: string;
  started_at: string;
  trigger_type: string;
  provider: string;
  status: string;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  records_failed: number;
};

export function AdminHistoryPage() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ["admin", "sync-history"],
    enabled: Boolean(session),
    queryFn: () => apiRequest<{ data: SyncRun[] }>("/api/admin/ipos/sync/history", session!),
  });
  const rows = (history.data?.data ?? []).filter((row) =>
    `${row.trigger_type} ${row.provider} ${row.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * 20, currentPage * 20);
  const metrics = [
    ["records_fetched", "Fetched"],
    ["records_inserted", "Inserted"],
    ["records_updated", "Updated"],
    ["records_failed", "Failed"],
  ] as const;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Synchronization history"
        description="Review provider runs and record changes."
      />
      <SearchInput
        aria-label="Search synchronization history"
        placeholder="Search trigger, provider or status"
        value={search}
        onClear={() => {
          setSearch("");
          setPage(1);
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {history.error && (
        <div>
          <ErrorNotice error={history.error} />
          <Button className="mt-3" variant="outline" onClick={() => void history.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {history.isLoading ? (
        <div
          role="status"
          aria-label="Loading synchronization history"
          aria-busy="true"
          className="space-y-3"
        >
          <span className="sr-only">Loading synchronization history…</span>
          <div className="space-y-3 md:hidden">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="hidden md:block">
            <SkeletonTable rows={6} cols={8} />
          </div>
        </div>
      ) : !rows.length ? (
        <EmptyState
          title="No synchronization runs found"
          description="Completed and failed provider runs appear here."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {visibleRows.map((row) => (
              <article key={row.id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {row.trigger_type} · {row.provider}
                  </p>
                  <span className="rounded-full bg-canvas px-3 py-1 text-sm">{row.status}</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {new Date(row.started_at).toLocaleString("en-IN")}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {metrics.map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-muted">{label}</dt>
                      <dd className="tabular-nums font-semibold">{row[key]}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Started", "Trigger", "Provider", "Status"].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className={`px-4 py-3 ${label === "Started" || label === "Status" ? "text-center" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                  {metrics.map(([key, label]) => (
                    <th key={key} scope="col" className="px-4 py-3 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap">
                      {new Date(row.started_at).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">{row.trigger_type}</td>
                    <td className="px-4 py-3">{row.provider}</td>
                    <td className="px-4 py-3 text-center">{row.status}</td>
                    {metrics.map(([key]) => (
                      <td key={key} className="px-4 py-3 text-right tabular-nums">
                        {row[key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            label="History pagination"
            page={currentPage}
            totalPages={totalPages}
            total={rows.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export function AdminSyncPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const syncCoolingDown = Boolean(
    status?.nextAllowedAt && new Date(status.nextAllowedAt).getTime() > Date.now(),
  );
  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (session) setStatus((await apiRequest<any>("/api/admin/ipos/sync/status", session)).data);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error : new Error("Unable to load administration data."),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [session]);
  const sync = async () => {
    if (!session) return;
    setMessage("Fetching IPO list and saving records…");
    try {
      const r = await apiRequest<any>("/api/admin/ipos/sync", session, { method: "POST" });
      setMessage("");
      notify({
        title: "IPO synchronization complete",
        description: `${r.data?.recordsInserted ?? 0} inserted, ${r.data?.recordsUpdated ?? 0} updated.`,
        tone: "success",
      });
      await load();
    } catch (e) {
      setMessage("");
      notify({
        title: "IPO synchronization failed",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="IPO data sync"
        description="Review provider availability and start a permitted synchronization run."
      />
      {loadError && (
        <div>
          <ErrorNotice error={loadError} />
          <Button variant="outline" className="mt-3" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">IPO Data Sync</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Checking provider status…"
                : loadError
                  ? "Provider status unavailable"
                  : `Provider: ${status?.providerConfigured ? "Configured" : "Not configured"}`}
            </p>
          </div>
          <ConfirmButton
            disabled={
              loading ||
              Boolean(loadError) ||
              status?.running ||
              !status?.providerConfigured ||
              status?.remainingManualRuns === 0 ||
              syncCoolingDown
            }
            onConfirm={sync}
            title="Synchronize IPO data?"
            description="Fetch the latest provider records and update the shared IPO catalog."
            confirmLabel="Start synchronization"
            danger={false}
            className="min-h-touch rounded-lg bg-slate-950 px-4 font-semibold text-white disabled:opacity-50"
          >
            Fetch Latest IPO Data
          </ConfirmButton>
        </div>
        {message && (
          <p role="status" className="mt-4 rounded bg-slate-100 p-3 text-sm">
            {message}
          </p>
        )}
      </Card>
      <Card>
        <h3 className="font-bold">Quota status</h3>
        {loading ? (
          <div
            role="status"
            aria-label="Loading synchronization quota"
            className="mt-3 space-y-2"
          >
            <span className="sr-only">Loading synchronization quota…</span>
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        ) : status ? (
          <p className="mt-2 text-sm text-slate-600">
            Runs used today: {status.runsUsedToday} · Manual runs remaining:{" "}
            {status.remainingManualRuns}
          </p>
        ) : null}
        {syncCoolingDown && (
          <p className="mt-2 text-sm text-slate-600">
            Next available: {new Date(status.nextAllowedAt).toLocaleString()}
          </p>
        )}
      </Card>
    </div>
  );
}

export function AdminSettingsPage() {
  const { session } = useAuth();
  const settings = useQuery({
    queryKey: ["admin", "settings"],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<{ data: { providerConfigured: boolean } }>("/api/admin/ipos/settings", session!),
  });
  const status = useQuery({
    queryKey: ["admin", "sync-status"],
    enabled: Boolean(session),
    queryFn: () =>
      apiRequest<{ data: { syncIntervalHours: number } }>("/api/admin/ipos/sync/status", session!),
  });
  if (settings.isLoading || status.isLoading) return <SkeletonFormPage sections={2} />;
  if (settings.error || status.error)
    return (
      <div>
        <ErrorNotice error={settings.error ?? status.error} />
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => {
            void settings.refetch();
            void status.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Administration settings"
        description="Provider connection and scheduled synchronization details."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Data provider</h2>
          <p className="mt-2 text-sm text-slate-600">
            IPO Guru:{" "}
            {settings.data?.data.providerConfigured ? "Configured" : "Requires Worker secret"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            IPO Guru attribution is shown with provider-sourced catalog records.
          </p>
        </Card>
        <Card>
          <h2 className="font-bold">Scheduling</h2>
          <p className="mt-2 text-sm text-slate-600">
            Interval: {status.data?.data.syncIntervalHours ?? "Not available"} hours
          </p>
          <p className="text-sm text-slate-600">Managed through the Worker configuration.</p>
        </Card>
      </div>
    </div>
  );
}
