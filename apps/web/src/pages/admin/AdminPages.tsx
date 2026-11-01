/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isAdminEmail } from "@ipo-mania/shared";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { BarChart3, Building2, History, LogOut, Menu, RefreshCw, Settings, X } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { apiRequest } from "../../lib/api";
import { supabase } from "../../lib/supabase";

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
          disabled={syncing || status?.remainingManualRuns === 0 || !status?.providerConfigured}
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
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    issue_type: "mainboard",
    ipo_status: "upcoming",
    symbol: "",
  });
  const load = async () => {
    if (!session) return;
    const result = await apiRequest<any>("/api/admin/ipos/catalog", session);
    setRows(result.data ?? []);
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
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    await apiRequest("/api/admin/ipos/catalog", session, {
      method: "POST",
      body: JSON.stringify(form),
    });
    setShowForm(false);
    await load();
  };
  const archive = async (id: string) => {
    if (!session || !window.confirm("Archive this IPO instead of permanently deleting it?")) return;
    await apiRequest(`/api/admin/ipos/catalog/${id}`, session, { method: "DELETE" });
    await load();
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">IPO catalog</h2>
          <p className="text-sm text-slate-500">{filtered.length} records</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="min-h-touch rounded-lg bg-slate-950 px-4 font-semibold text-white"
        >
          Add IPO
        </button>
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search company or symbol"
        className="w-full rounded-lg border px-4 py-3"
      />
      {showForm && (
        <form
          onSubmit={create}
          className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2"
        >
          <label>
            Company name
            <input
              required
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label>
            Symbol
            <input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label>
            Issue type
            <select
              value={form.issue_type}
              onChange={(e) => setForm({ ...form, issue_type: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="mainboard">Mainboard</option>
              <option value="SME">SME</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={form.ipo_status}
              onChange={(e) => setForm({ ...form, ipo_status: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="upcoming">Upcoming</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="listed">Listed</option>
            </select>
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button className="min-h-touch rounded-lg bg-slate-950 px-5 font-semibold text-white">
              Create IPO
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-touch rounded-lg border px-5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Listing date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{row.company_name}</td>
                <td className="px-4 py-3">{row.symbol ?? "—"}</td>
                <td className="px-4 py-3">{row.issue_type}</td>
                <td className="px-4 py-3">{row.ipo_status}</td>
                <td className="px-4 py-3">{row.listing_date ?? "—"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => void archive(row.id)} className="text-red-700">
                    Archive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
              !status?.providerConfigured ||
              status?.remainingManualRuns === 0 ||
              Boolean(
                status?.nextAllowedAt && new Date(status.nextAllowedAt).getTime() > Date.now(),
              )
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
