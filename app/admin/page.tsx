"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import AdminTopBar from "@/components/AdminTopBar";
import { adminApi, ApiError, getAdminToken, setAdminToken } from "@/lib/adminApi";

type Cfg = Awaited<ReturnType<typeof adminApi.getConfig>>;
type Apps = Awaited<ReturnType<typeof adminApi.listApplications>>;
type Users = Awaited<ReturnType<typeof adminApi.listUsers>>;

const sections = [
  { id: "mint", label: "Mint Controls" },
  { id: "supply", label: "Supply" },
  { id: "fcfs", label: "FCFS" },
  { id: "apps", label: "Applications" },
  { id: "refs", label: "Referrals" },
  { id: "royalty", label: "Royalty" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [apps, setApps] = useState<Apps | null>(null);
  const [users, setUsers] = useState<Users | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, a, u] = await Promise.all([
        adminApi.getConfig(),
        adminApi.listApplications(),
        adminApi.listUsers(),
      ]);
      setCfg(c);
      setApps(a);
      setUsers(u);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAdminToken(null);
        router.replace("/admin/login");
        return;
      }
      setError(e instanceof ApiError ? e.message : "unknown error");
    }
  }, [router]);

  useEffect(() => {
    setHydrated(true);
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    adminApi
      .session()
      .then((s) => {
        setAuthUser(s.user);
        refresh();
      })
      .catch(() => {
        setAdminToken(null);
        router.replace("/admin/login");
      });
  }, [router, refresh]);

  if (!hydrated) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <AdminTopBar user={authUser} />
      <div className="max-w-[1200px] w-full mx-auto px-3 py-3 flex-1">
        <div className="grid lg:grid-cols-[180px_1fr] grid-cols-1 gap-3">
          <aside>
            <Panel title="Sections" padded={false}>
              <ul>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block px-3 py-1 no-underline text-ape-200 hover:bg-ape-850 hover:text-white border-l-2 border-transparent hover:border-ape-500"
                    >
                      &gt; {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>

          <main className="space-y-3 min-w-0">
            {error && (
              <Panel title="Error">
                <div className="text-xxs text-red-300 uppercase tracking-wide">
                  {error}
                </div>
              </Panel>
            )}

            <MintSection cfg={cfg} onSaved={refresh} />
            <SupplySection cfg={cfg} onSaved={refresh} />
            <FcfsSection cfg={cfg} onSaved={refresh} />
            <ApplicationsSection apps={apps} onAction={refresh} />
            <ReferralsSection users={users} onSaved={refresh} />
            <RoyaltySection cfg={cfg} onSaved={refresh} />
          </main>
        </div>
      </div>
    </div>
  );
}

function MintSection({ cfg, onSaved }: { cfg: Cfg | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    gtd_max_mint: 0,
    fcfs_max_mint: 0,
    public_max_mint: 0,
    gtd_active: false,
    fcfs_active: false,
    public_active: false,
  });

  useEffect(() => {
    if (!cfg) return;
    setForm({
      gtd_max_mint: cfg.mint.gtd_max_mint,
      fcfs_max_mint: cfg.mint.fcfs_max_mint,
      public_max_mint: cfg.mint.public_max_mint,
      gtd_active: cfg.mint.gtd_active,
      fcfs_active: cfg.mint.fcfs_active,
      public_active: cfg.mint.public_active,
    });
  }, [cfg]);

  async function save() {
    setBusy(true);
    try { await adminApi.patchConfig(form); onSaved(); } finally { setBusy(false); }
  }

  return (
    <div id="mint">
      <Panel title="Mint Controls" right={cfg ? <StatusBadge status="Open" /> : <span>loading...</span>}>
        <div className="grid sm:grid-cols-3 gap-3">
          <NumberField label="GTD max mint" value={form.gtd_max_mint} onChange={(v) => setForm({ ...form, gtd_max_mint: v })} />
          <NumberField label="FCFS max mint" value={form.fcfs_max_mint} onChange={(v) => setForm({ ...form, fcfs_max_mint: v })} />
          <NumberField label="Public max mint" value={form.public_max_mint} onChange={(v) => setForm({ ...form, public_max_mint: v })} />
        </div>
        <div className="divider-old" />
        <div className="grid sm:grid-cols-3 gap-2">
          <Toggle label="GTD phase active" value={form.gtd_active} onChange={(v) => setForm({ ...form, gtd_active: v })} />
          <Toggle label="FCFS phase active" value={form.fcfs_active} onChange={(v) => setForm({ ...form, fcfs_active: v })} />
          <Toggle label="Public phase active" value={form.public_active} onChange={(v) => setForm({ ...form, public_active: v })} />
        </div>
        <div className="divider-old" />
        <Button variant="primary" disabled={!cfg || busy} onClick={save}>
          {busy ? "Saving..." : "Save mint controls"}
        </Button>
      </Panel>
    </div>
  );
}

function SupplySection({ cfg, onSaved }: { cfg: Cfg | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ total_supply: 3333, gtd_allocation: 0, fcfs_allocation: 0 });

  useEffect(() => {
    if (!cfg) return;
    setForm({
      total_supply: cfg.mint.total_supply,
      gtd_allocation: cfg.mint.gtd_allocation,
      fcfs_allocation: cfg.mint.fcfs_allocation,
    });
  }, [cfg]);

  const remaining = form.total_supply - form.gtd_allocation - form.fcfs_allocation;
  const invalid = remaining < 0;

  async function save() {
    setBusy(true);
    try { await adminApi.patchConfig(form); onSaved(); } finally { setBusy(false); }
  }

  return (
    <div id="supply">
      <Panel title="Supply Controls" right={<span>{remaining} public</span>}>
        <div className="grid sm:grid-cols-3 gap-3">
          <NumberField label="Total supply" value={form.total_supply} onChange={(v) => setForm({ ...form, total_supply: v })} />
          <NumberField label="GTD allocation" value={form.gtd_allocation} onChange={(v) => setForm({ ...form, gtd_allocation: v })} />
          <NumberField label="FCFS allocation" value={form.fcfs_allocation} onChange={(v) => setForm({ ...form, fcfs_allocation: v })} />
        </div>
        <div className="grid sm:grid-cols-4 gap-2 mt-3 text-xxs">
          <KV label="GTD" value={form.gtd_allocation} />
          <KV label="FCFS" value={form.fcfs_allocation} />
          <KV label="Public (auto)" value={Math.max(0, remaining)} />
          <KV label="Total" value={form.total_supply} />
        </div>
        {invalid && (
          <div className="mt-2 border border-red-700 bg-red-950 text-red-200 px-2 py-1 text-xxs uppercase">
            allocations exceed total supply
          </div>
        )}
        <div className="divider-old" />
        <Button variant="primary" disabled={!cfg || busy || invalid} onClick={save}>
          {busy ? "Saving..." : "Save supply"}
        </Button>
      </Panel>
    </div>
  );
}

function FcfsSection({ cfg, onSaved }: { cfg: Cfg | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function reset() {
    if (!confirm("Reset FCFS? All claimed slots will be cleared.")) return;
    setBusy(true);
    try { await adminApi.resetFcfs(); onSaved(); } finally { setBusy(false); }
  }
  return (
    <div id="fcfs">
      <Panel title="FCFS System" right={cfg ? <span>{cfg.fcfs_state.remaining} left</span> : null}>
        <div className="grid sm:grid-cols-3 gap-2 text-xxs">
          <KV label="total spots" value={cfg?.fcfs_state.total ?? "—"} />
          <KV label="claimed" value={cfg?.fcfs_state.taken ?? "—"} />
          <KV label="remaining" value={cfg?.fcfs_state.remaining ?? "—"} />
        </div>
        <div className="divider-old" />
        <Button onClick={reset} disabled={!cfg || busy}>
          {busy ? "Resetting..." : "Reset FCFS"}
        </Button>
      </Panel>
    </div>
  );
}

function ApplicationsSection({ apps, onAction }: { apps: Apps | null; onAction: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function decide(wallet: string, action: "approve" | "reject") {
    setBusy(wallet + ":" + action);
    try {
      if (action === "approve") await adminApi.approveApplication(wallet);
      else await adminApi.rejectApplication(wallet);
      onAction();
    } catch {} finally { setBusy(null); }
  }
  return (
    <div id="apps">
      <Panel title="Applications" right={apps ? <span>{apps.total} total</span> : <span>loading...</span>} padded={false}>
        <table className="w-full text-xs">
          <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
            <tr>
              <th className="text-left px-3 py-1 border-b border-border">wallet</th>
              <th className="text-left px-3 py-1 border-b border-border">twitter</th>
              <th className="text-left px-3 py-1 border-b border-border">status</th>
              <th className="text-left px-3 py-1 border-b border-border">actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(apps?.items ?? []).map((row) => {
              const status = row.status as "pending" | "approved" | "rejected" | "withdrawn";
              const badge = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : status === "pending" ? "Pending" : "Open";
              return (
                <tr key={row.id} className="row-hover">
                  <td className="px-3 py-2 font-mono text-ape-100">{row.wallet_address}</td>
                  <td className="px-3 py-2 text-ape-200">{row.twitter_id ?? row.handle ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={badge as any} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="primary"
                        onClick={() => decide(row.wallet_address, "approve")}
                        disabled={status !== "pending" || busy === row.wallet_address + ":approve"}
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => decide(row.wallet_address, "reject")}
                        disabled={status !== "pending" || busy === row.wallet_address + ":reject"}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {apps && apps.items.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-3 text-mute text-center text-xxs italic">no applications</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function ReferralsSection({ users, onSaved }: { users: Users | null; onSaved: () => void }) {
  const [target, setTarget] = useState("");
  const [referrer, setReferrer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function setRef(clear = false) {
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      await adminApi.patchUser(target, { referrer: clear ? null : referrer });
      onSaved();
      if (!clear) setReferrer("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="refs">
      <Panel title="Referrals" right={users ? <span>{users.total} users</span> : <span>loading...</span>} padded={false}>
        <table className="w-full text-xs">
          <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
            <tr>
              <th className="text-left px-3 py-1 border-b border-border">wallet</th>
              <th className="text-left px-3 py-1 border-b border-border">code</th>
              <th className="text-left px-3 py-1 border-b border-border">referrer</th>
              <th className="text-left px-3 py-1 border-b border-border text-right pr-3">count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(users?.items ?? []).map((u) => (
              <tr key={u.wallet_address} className="row-hover">
                <td className="px-3 py-2 font-mono text-ape-100">{u.wallet_address}</td>
                <td className="px-3 py-2 font-mono text-ape-200">{u.referral_code ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-ape-200">{u.referrer ?? "—"}</td>
                <td className="px-3 py-2 text-right pr-3 font-mono text-ape-100">{u.referral_count}</td>
              </tr>
            ))}
            {users && users.items.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-3 text-mute text-center text-xxs italic">no users</td></tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-border p-3 space-y-2">
          <div className="text-xxs text-mute uppercase tracking-wide">manual adjustment</div>
          <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
            <div>
              <label className="label">target wallet</label>
              <input className="field font-mono" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x..." />
            </div>
            <div>
              <label className="label">new referrer</label>
              <input className="field font-mono" value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="0x..." />
            </div>
            <Button variant="primary" disabled={!target || !referrer || busy} onClick={() => setRef(false)}>
              {busy ? "Saving..." : "Set referrer"}
            </Button>
            <Button variant="ghost" disabled={!target || busy} onClick={() => setRef(true)}>Clear</Button>
          </div>
          {err && <div className="text-xxs text-red-300 uppercase">error: {err}</div>}
        </div>
      </Panel>
    </div>
  );
}

function RoyaltySection({ cfg, onSaved }: { cfg: Cfg | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [bps, setBps] = useState(690);
  useEffect(() => { if (cfg) setBps(cfg.royalty_bps); }, [cfg]);

  async function save() {
    setBusy(true);
    try { await adminApi.patchConfig({ royalty_bps: bps }); onSaved(); } finally { setBusy(false); }
  }

  return (
    <div id="royalty">
      <Panel title="Royalty" right={<span>{(bps / 100).toFixed(2)}%</span>}>
        <div className="grid sm:grid-cols-[200px_1fr] gap-3 items-end">
          <NumberField label="basis points (1% = 100)" value={bps} onChange={setBps} />
          <div className="text-xs">
            <span className="text-mute uppercase text-xxs tracking-wide">current</span>
            <div className="font-mono text-ape-100 text-2xl leading-none">
              {(bps / 100).toFixed(2)}%
            </div>
          </div>
        </div>
        <div className="divider-old" />
        <Button variant="primary" disabled={!cfg || busy} onClick={save}>
          {busy ? "Saving..." : "Save royalty"}
        </Button>
      </Panel>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="field font-mono"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-2 border px-2 py-1 text-xxs uppercase tracking-wide ${
        value ? "bg-ape-700 border-ape-300 text-white" : "bg-ape-950 border-border text-mute"
      }`}
    >
      <span className={`w-3 h-3 border ${value ? "bg-ape-300 border-ape-100" : "bg-ape-900 border-border"}`} />
      {label} :: {value ? "on" : "off"}
    </button>
  );
}

function KV({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border bg-ape-950 px-2 py-1">
      <div className="text-mute uppercase text-xxs">{label}</div>
      <div className="text-ape-100 font-mono">{value}</div>
    </div>
  );
}
