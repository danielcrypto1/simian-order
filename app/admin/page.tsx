"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import AdminTopBar from "@/components/AdminTopBar";
import { adminApi, ApiError, type Application, type Cfg, type WhitelistEntry } from "@/lib/adminApi";

const sections = [
  { id: "whitelist-upload", label: "Whitelist Upload" },
  { id: "whitelist-table", label: "Whitelist Table" },
  { id: "mint", label: "Mint Controls" },
  { id: "fcfs", label: "FCFS" },
  { id: "apps", label: "Applications" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [apps, setApps] = useState<{ items: Application[]; total: number } | null>(null);
  const [wl, setWl] = useState<{ items: WhitelistEntry[]; total: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, a, w] = await Promise.all([
        adminApi.getConfig(),
        adminApi.listApplications(),
        adminApi.listWhitelist(),
      ]);
      setCfg(c);
      setApps(a);
      setWl(w);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/admin/login");
        return;
      }
      setError(e instanceof ApiError ? e.message : "unknown");
    }
  }, [router]);

  useEffect(() => {
    adminApi
      .session()
      .then((s) => {
        setAuthUser(s.user);
        refresh();
      })
      .catch(() => router.replace("/admin/login"));
  }, [refresh, router]);

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
                <div className="text-xxs text-red-300 uppercase tracking-wide">{error}</div>
              </Panel>
            )}

            <WhitelistUploadSection onUploaded={refresh} />
            <WhitelistTableSection wl={wl} onChanged={refresh} />
            <MintControlsSection cfg={cfg} onSaved={refresh} />
            <FcfsSection cfg={cfg} onSaved={refresh} />
            <ApplicationsSection apps={apps} onAction={refresh} />
          </main>
        </div>
      </div>
    </div>
  );
}

// ───── Whitelist upload ───────────────────────────────────────────────

function WhitelistUploadSection({ onUploaded }: { onUploaded: () => void }) {
  const [mode, setMode] = useState<"append" | "overwrite">("append");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ row: number; reason: string }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null); setErrors(null);
    try {
      const r = await adminApi.uploadWhitelist(f, mode);
      setMsg(`${mode === "overwrite" ? "Overwrote" : "Appended"}: ${r.added} entries (total ${r.total}).`);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (e) {
      if (e instanceof ApiError && e.message === "validation_failed" && Array.isArray(e.details)) {
        setErrors(e.details as { row: number; reason: string }[]);
        setMsg("validation failed — fix the rows below and re-upload.");
      } else {
        setMsg(e instanceof ApiError ? `error: ${e.message}` : "upload failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="whitelist-upload">
      <Panel title="Whitelist Upload" right={<span>.csv / .xlsx</span>}>
        <form onSubmit={upload} className="space-y-3">
          <div>
            <label className="label">file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              required
              className="field"
            />
            <div className="text-xxs text-mute mt-1">
              expected columns: <span className="font-mono text-ape-200">wallet, phase, maxMint</span>
              &nbsp;— phase ∈ <span className="font-mono">GTD | FCFS</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="label mb-0">mode</span>
            <label className="flex items-center gap-1 text-xxs uppercase tracking-wide cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === "append"}
                onChange={() => setMode("append")}
              /> append
            </label>
            <label className="flex items-center gap-1 text-xxs uppercase tracking-wide cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === "overwrite"}
                onChange={() => setMode("overwrite")}
              /> overwrite
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Uploading..." : "Upload"}
            </Button>
            {msg && <span className="text-xxs text-ape-200">{msg}</span>}
          </div>

          {errors && errors.length > 0 && (
            <div className="border border-red-700 bg-red-950 px-2 py-2 text-xxs space-y-1">
              <div className="text-red-200 uppercase tracking-wide">
                {errors.length} validation error{errors.length > 1 ? "s" : ""}
              </div>
              <ul className="font-mono text-red-200 max-h-32 overflow-auto">
                {errors.slice(0, 50).map((er, i) => (
                  <li key={i}>row {er.row}: {er.reason}</li>
                ))}
                {errors.length > 50 && <li>…and {errors.length - 50} more</li>}
              </ul>
            </div>
          )}
        </form>
      </Panel>
    </div>
  );
}

// ───── Whitelist table ─────────────────────────────────────────────────

function WhitelistTableSection({
  wl,
  onChanged,
}: {
  wl: { items: WhitelistEntry[]; total: number } | null;
  onChanged: () => void;
}) {
  return (
    <div id="whitelist-table">
      <Panel
        title="Whitelist"
        right={wl ? <span>{wl.total} entries</span> : <span>loading...</span>}
        padded={false}
      >
        <table className="w-full text-xs">
          <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
            <tr>
              <th className="text-left px-3 py-1 border-b border-border">wallet</th>
              <th className="text-left px-3 py-1 border-b border-border">phase</th>
              <th className="text-left px-3 py-1 border-b border-border">maxMint</th>
              <th className="text-left px-3 py-1 border-b border-border">actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(wl?.items ?? []).map((row) => (
              <WhitelistRow key={row.wallet} row={row} onChanged={onChanged} />
            ))}
            {wl && wl.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-mute text-center text-xxs italic">
                  no whitelist entries — upload a .csv or .xlsx above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function WhitelistRow({
  row,
  onChanged,
}: {
  row: WhitelistEntry;
  onChanged: () => void;
}) {
  const [phase, setPhase] = useState<"GTD" | "FCFS">(row.phase);
  const [maxMint, setMaxMint] = useState<number>(row.maxMint);
  const [busy, setBusy] = useState(false);

  const dirty = phase !== row.phase || maxMint !== row.maxMint;

  async function save() {
    setBusy(true);
    try {
      await adminApi.updateWhitelist(row.wallet, { phase, maxMint });
      onChanged();
    } finally { setBusy(false); }
  }

  async function del() {
    if (!confirm(`Delete ${row.wallet}?`)) return;
    setBusy(true);
    try {
      await adminApi.deleteWhitelist(row.wallet);
      onChanged();
    } finally { setBusy(false); }
  }

  return (
    <tr className="row-hover">
      <td className="px-3 py-2 font-mono text-ape-100 break-all">{row.wallet}</td>
      <td className="px-3 py-2">
        <select
          className="field py-0 px-1 w-20"
          value={phase}
          onChange={(e) => setPhase(e.target.value as "GTD" | "FCFS")}
        >
          <option value="GTD">GTD</option>
          <option value="FCFS">FCFS</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          className="field py-0 px-1 w-16 font-mono"
          value={maxMint}
          onChange={(e) => setMaxMint(Math.max(1, Number(e.target.value) || 1))}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button variant="primary" disabled={!dirty || busy} onClick={save}>
            Save
          </Button>
          <Button onClick={del} disabled={busy}>Delete</Button>
        </div>
      </td>
    </tr>
  );
}

// ───── Mint controls ───────────────────────────────────────────────────

function MintControlsSection({ cfg, onSaved }: { cfg: Cfg | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    gtd_max_mint: 0,
    fcfs_max_mint: 0,
    public_max_mint: 0,
    gtd_active: false,
    fcfs_active: false,
    public_active: false,
  });
  const [busy, setBusy] = useState(false);

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
          <Toggle label="GTD active" value={form.gtd_active} onChange={(v) => setForm({ ...form, gtd_active: v })} />
          <Toggle label="FCFS active" value={form.fcfs_active} onChange={(v) => setForm({ ...form, fcfs_active: v })} />
          <Toggle label="Public active" value={form.public_active} onChange={(v) => setForm({ ...form, public_active: v })} />
        </div>
        <div className="divider-old" />
        <Button variant="primary" disabled={!cfg || busy} onClick={save}>
          {busy ? "Saving..." : "Save mint controls"}
        </Button>
      </Panel>
    </div>
  );
}

// ───── FCFS ────────────────────────────────────────────────────────────

function FcfsSection({ cfg, onSaved }: { cfg: Cfg | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function reset() {
    if (!confirm("Reset FCFS? All claimed slots will be cleared.")) return;
    setBusy(true);
    try { await adminApi.resetFcfs(); onSaved(); } finally { setBusy(false); }
  }
  return (
    <div id="fcfs">
      <Panel title="FCFS Controls" right={cfg ? <span>{cfg.fcfs_state.remaining} left</span> : null}>
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

// ───── Applications ────────────────────────────────────────────────────

function ApplicationsSection({
  apps,
  onAction,
}: {
  apps: { items: Application[]; total: number } | null;
  onAction: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  async function decide(wallet: string, action: "approve" | "reject") {
    setBusy(`${wallet}:${action}`);
    try {
      if (action === "approve") await adminApi.approveApplication(wallet);
      else await adminApi.rejectApplication(wallet);
      onAction();
    } finally { setBusy(null); }
  }
  return (
    <div id="apps">
      <Panel
        title="Applications"
        right={apps ? <span>{apps.total} total</span> : <span>loading...</span>}
        padded={false}
      >
        <table className="w-full text-xs">
          <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
            <tr>
              <th className="text-left px-3 py-1 border-b border-border">wallet</th>
              <th className="text-left px-3 py-1 border-b border-border">handle</th>
              <th className="text-left px-3 py-1 border-b border-border">status</th>
              <th className="text-left px-3 py-1 border-b border-border">actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(apps?.items ?? []).map((row) => {
              const status = row.status;
              const badge = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
              return (
                <tr key={row.wallet} className="row-hover">
                  <td className="px-3 py-2 font-mono text-ape-100 break-all">{row.wallet}</td>
                  <td className="px-3 py-2 text-ape-200">{row.handle ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={badge as any} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="primary"
                        onClick={() => decide(row.wallet, "approve")}
                        disabled={status === "approved" || busy === `${row.wallet}:approve`}
                      >Approve</Button>
                      <Button
                        onClick={() => decide(row.wallet, "reject")}
                        disabled={status === "rejected" || busy === `${row.wallet}:reject`}
                      >Reject</Button>
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

// ───── Helpers ─────────────────────────────────────────────────────────

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min={0}
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
