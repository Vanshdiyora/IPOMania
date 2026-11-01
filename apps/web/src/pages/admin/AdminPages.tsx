/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { isAdminEmail } from "@ipo-mania/shared";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Edit3,
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
import { Button } from "../../components/ui/Button";
import { ConfirmationDialog } from "../../components/ui/ConfirmationDialog";
import { FormSection } from "../../components/ui/FormSection";
import { FormField, SearchInput, Select, Input } from "../../components/ui/Input";
import { SideDrawer } from "../../components/ui/SideDrawer";
import { Toast, ToastViewport, type ToastProps } from "../../components/ui/Toast";

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
  if (loading || (admin === null && user))
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        Checking administrator access…
      </main>
    );
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
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const title = nav.find(([, path]) => path === location.pathname)?.[0] ?? "IPO Administration";
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5 text-lg font-bold text-white">
        <span className="mr-2 grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-950">
          I
        </span>
        IPO Mania
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5">
        {nav.map(([label, path, Icon]) => (
          <Link
            key={path}
            to={path}
            onClick={() => setOpen(false)}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${location.pathname === path ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
          >
            <Icon className="mr-3 h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={() => void signOut()}
        className="mx-3 mb-5 flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
      >
        <LogOut className="mr-3 h-4 w-4" />
        Sign out
      </button>
    </div>
  );
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:flex">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-slate-950 lg:block">{sidebar}</aside>
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 shadow-xl transition-transform lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebar}
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 text-white"
        >
          <X />
        </button>
      </div>
      {open && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:px-8">
          <button
            className="mr-3 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div>
            <p className="text-xs text-slate-500">Admin / {title}</p>
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </section>
  );
}

export function AdminOverviewPage() {
  const { session } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!session) return;
    const [a, b] = await Promise.all([
      apiRequest<any>("/api/admin/ipos/overview", session),
      apiRequest<any>("/api/admin/ipos/sync/status", session),
    ]);
    setOverview(a.data);
    setStatus(b.data);
  };
  useEffect(() => {
    void load();
  }, [session]);
  const sync = async () => {
    if (!session || !window.confirm("Start a manual IPO data synchronization now?")) return;
    setSyncing(true);
    setMessage("Fetching provider data and saving records…");
    try {
      const result = await apiRequest<any>("/api/admin/ipos/sync", session, { method: "POST" });
      setMessage(
        `Completed: ${result.data?.recordsInserted ?? 0} inserted, ${result.data?.recordsUpdated ?? 0} updated.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Synchronization failed.");
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Live IPO catalog and synchronization status.
          </p>
        </div>
        <button
          disabled={
            syncing ||
            syncCoolingDown ||
            status?.remainingManualRuns === 0 ||
            !status?.providerConfigured
          }
          onClick={() => void sync()}
          className="inline-flex min-h-touch items-center justify-center rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          Fetch Latest IPO Data
        </button>
      </div>
      {message && (
        <div role="status" className="rounded-lg border bg-white px-4 py-3 text-sm">
          {message}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <Card key={String(label)}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{String(value)}</p>
          </Card>
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
  const emptyForm = {
    company_name: "",
    issue_type: "mainboard",
    ipo_status: "upcoming",
    symbol: "",
  };
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const notify = (title: string, tone: ToastProps["tone"] = "info", description?: ReactNode) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, title, tone, description, onDismiss: dismissToast }]);
  };
  const load = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await apiRequest<any>("/api/admin/ipos/catalog", session);
      setRows(result.data ?? []);
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
          !search ||
          `${row.company_name} ${row.symbol ?? ""}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  );
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setDrawerOpen(true);
  };
  const openEdit = (row: any) => {
    const value = {
      company_name: row.company_name ?? "",
      issue_type: row.issue_type ?? "mainboard",
      ipo_status: row.ipo_status ?? "upcoming",
      symbol: row.symbol ?? "",
    };
    setEditingId(row.id);
    setForm(value);
    setInitialForm(value);
    setDrawerOpen(true);
  };
  const closeDrawer = useCallback(() => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm)) setDiscardOpen(true);
    else setDrawerOpen(false);
  }, [form, initialForm]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiRequest(`/api/admin/ipos/catalog/${editingId}`, session, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest("/api/admin/ipos/catalog", session, {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      setDrawerOpen(false);
      notify(editingId ? "IPO updated" : "IPO created", "success");
      await load();
    } catch (error) {
      notify("Unable to save IPO", "error", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };
  const archive = async () => {
    if (!session || !archiveId) return;
    setArchiving(true);
    try {
      await apiRequest(`/api/admin/ipos/catalog/${archiveId}`, session, { method: "DELETE" });
      setArchiveId(null);
      notify("IPO archived", "success");
      await load();
    } catch (error) {
      notify("Unable to archive IPO", "error", error instanceof Error ? error.message : undefined);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">IPO catalog</h2>
          <p className="text-sm text-slate-500">{filtered.length} records</p>
        </div>
        <Button onClick={openCreate}>Add IPO</Button>
      </div>
      <SearchInput
        aria-label="Search IPO catalog"
        value={search}
        onClear={() => setSearch("")}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search company or symbol"
      />

      <div className="overflow-hidden rounded-xl border bg-white md:overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500" role="status">
            Loading IPO catalog…
          </div>
        ) : (
          <>
            <div className="divide-y md:hidden">
              {filtered.map((row) => (
                <article key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{row.company_name}</h3>
                      <p className="text-sm text-slate-500">{row.symbol || "No symbol"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize">
                      {row.ipo_status}
                    </span>
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
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Listing date</th>
                  <th className="sticky right-0 bg-slate-50 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">{row.company_name}</td>
                    <td className="px-4 py-3">{row.symbol ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{row.issue_type}</td>
                    <td className="px-4 py-3 capitalize">{row.ipo_status}</td>
                    <td className="px-4 py-3">{row.listing_date ?? "—"}</td>
                    <td className="sticky right-0 bg-white px-4 py-2">
                      <div className="flex justify-end gap-1">
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

      <SideDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingId ? "Edit IPO" : "Add IPO"}
        description="Manage the company and listing details shown in the catalog."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button type="submit" form="ipo-catalog-form" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create IPO"}
            </Button>
          </div>
        }
      >
        <form id="ipo-catalog-form" onSubmit={save} className="space-y-5">
          <FormSection
            title="Company details"
            description="The primary information used to identify this IPO."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                className="sm:col-span-2"
                label="Company name"
                htmlFor="company-name"
                required
              >
                <Input
                  id="company-name"
                  autoFocus
                  required
                  value={form.company_name}
                  onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                />
              </FormField>
              <FormField label="Symbol" htmlFor="ipo-symbol">
                <Input
                  id="ipo-symbol"
                  value={form.symbol}
                  onChange={(event) =>
                    setForm({ ...form, symbol: event.target.value.toUpperCase() })
                  }
                />
              </FormField>
              <FormField label="Issue type" htmlFor="issue-type">
                <Select
                  id="issue-type"
                  value={form.issue_type}
                  onChange={(event) => setForm({ ...form, issue_type: event.target.value })}
                >
                  <option value="mainboard">Mainboard</option>
                  <option value="SME">SME</option>
                </Select>
              </FormField>
            </div>
          </FormSection>
          <FormSection title="Catalog status">
            <FormField label="IPO status" htmlFor="ipo-status">
              <Select
                id="ipo-status"
                value={form.ipo_status}
                onChange={(event) => setForm({ ...form, ipo_status: event.target.value })}
              >
                <option value="upcoming">Upcoming</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="listed">Listed</option>
              </Select>
            </FormField>
          </FormSection>
        </form>
      </SideDrawer>
      <ConfirmationDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        description="Your changes will be lost if you close this drawer."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          setDrawerOpen(false);
        }}
      />
      <ConfirmationDialog
        open={Boolean(archiveId)}
        title="Archive this IPO?"
        description="It will be removed from the active catalog. This action can be reversed from the database."
        confirmLabel={archiving ? "Archiving…" : "Archive IPO"}
        danger
        onCancel={() => !archiving && setArchiveId(null)}
        onConfirm={() => void archive()}
      />
      <ToastViewport>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </ToastViewport>
    </div>
  );
}

export function AdminHistoryPage() {
  const { session } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (session)
      void apiRequest<any>("/api/admin/ipos/sync/history", session).then((r) =>
        setRows(r.data ?? []),
      );
  }, [session]);
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Started",
              "Trigger",
              "Provider",
              "Status",
              "Fetched",
              "Inserted",
              "Updated",
              "Failed",
            ].map((h) => (
              <th key={h} className="px-4 py-3 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-4 py-3">{new Date(row.started_at).toLocaleString("en-IN")}</td>
              <td className="px-4 py-3">{row.trigger_type}</td>
              <td className="px-4 py-3">{row.provider}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{row.records_fetched}</td>
              <td className="px-4 py-3">{row.records_inserted}</td>
              <td className="px-4 py-3">{row.records_updated}</td>
              <td className="px-4 py-3">{row.records_failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSyncPage() {
  const { session } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState("");
  const syncCoolingDown = Boolean(
    status?.nextAllowedAt && new Date(status.nextAllowedAt).getTime() > Date.now(),
  );
  const load = async () => {
    if (session) setStatus((await apiRequest<any>("/api/admin/ipos/sync/status", session)).data);
  };
  useEffect(() => {
    void load();
  }, [session]);
  const sync = async () => {
    if (!session || !window.confirm("Start synchronization?")) return;
    setMessage("Fetching IPO list and saving records…");
    try {
      const r = await apiRequest<any>("/api/admin/ipos/sync", session, { method: "POST" });
      setMessage(`Completed: ${JSON.stringify(r.data)}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Synchronization failed.");
    }
  };
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">IPO Data Sync</h2>
            <p className="mt-1 text-sm text-slate-500">
              Provider: {status?.providerConfigured ? "Configured" : "Not configured"}
            </p>
          </div>
          <button
            disabled={
              !status?.providerConfigured || status?.remainingManualRuns === 0 || syncCoolingDown
            }
            onClick={() => void sync()}
            className="min-h-touch rounded-lg bg-slate-950 px-4 font-semibold text-white disabled:opacity-50"
          >
            Fetch Latest IPO Data
          </button>
        </div>
        {message && (
          <p role="status" className="mt-4 rounded bg-slate-100 p-3 text-sm">
            {message}
          </p>
        )}
      </Card>
      <Card>
        <h3 className="font-bold">Quota status</h3>
        <p className="mt-2 text-sm text-slate-600">
          Runs used today: {status?.runsUsedToday ?? 0} · Manual runs remaining:{" "}
          {status?.remainingManualRuns ?? 0}
        </p>
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
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => {
    if (session)
      void apiRequest<any>("/api/admin/ipos/settings", session).then((r) => setSettings(r.data));
  }, [session]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="font-bold">Data provider</h2>
        <p className="mt-2 text-sm text-slate-600">
          IPO Guru: {settings?.providerConfigured ? "Configured" : "Requires Worker secret"}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          IPO Guru attribution is shown with provider-sourced catalog records.
        </p>
      </Card>
      <Card>
        <h2 className="font-bold">Scheduling</h2>
        <p className="mt-2 text-sm text-slate-600">Automatic sync: enabled</p>
        <p className="text-sm text-slate-600">
          Every 3 hours · configurable with IPO_SYNC_INTERVAL_HOURS
        </p>
      </Card>
    </div>
  );
}
