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
  { id: "referrals", label: "Referrals" },
  { id: "uploads", label: "Uploads" },
  { id: "audit", label: "Link Audit" },
];

type UploadEntry = {
  name: string;
  kind: "image" | "json";
  size: number;
  contentType: string;
  uploadedAt: string;
  url: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  } | null;
};

type ReferralAdminItem = {
  wallet: string;
  code: string;
  count: number;
  limit: number;
  createdAt: string;
  referred: Array<{ wallet: string; twitter: string | null; status: string | null }>;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [apps, setApps] = useState<{ items: Application[]; total: number } | null>(null);
  const [wl, setWl] = useState<{ items: WhitelistEntry[]; total: number } | null>(null);
  const [refs, setRefs] = useState<{ items: ReferralAdminItem[]; total: number; totalReferred: number } | null>(null);
  const [uploads, setUploads] = useState<{ items: UploadEntry[]; total: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, a, w, r, u] = await Promise.all([
        adminApi.getConfig(),
        adminApi.listApplications(),
        adminApi.listWhitelist(),
        adminApi.listReferrals(),
        adminApi.listUploads(),
      ]);
      setCfg(c);
      setApps(a);
      setWl(w);
      setRefs(r);
      setUploads(u);
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
            <ReferralsSection refs={refs} onChanged={refresh} />
            <UploadsSection uploads={uploads} onChanged={refresh} />
            <LinkAuditSection />
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
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
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
        </div>
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
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-poll every 5s while enabled. Stops on tab hide via visibility check
  // (saves budget when admin walks away).
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") onAction();
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, onAction]);

  async function decide(wallet: string, action: "approve" | "reject") {
    setBusy(`${wallet}:${action}`);
    try {
      if (action === "approve") await adminApi.approveApplication(wallet);
      else await adminApi.rejectApplication(wallet);
      onAction();
    } finally { setBusy(null); }
  }
  async function remove(wallet: string) {
    if (!confirm(`Delete application for ${wallet}?\n\nThis cannot be undone.`)) return;
    setBusy(`${wallet}:delete`);
    try {
      await adminApi.deleteApplication(wallet);
      onAction();
    } finally { setBusy(null); }
  }
  return (
    <div id="apps">
      <Panel
        title="Applications"
        right={
          <span className="flex items-center gap-2">
            {apps ? `${apps.total} total` : "loading..."}
            <span className="text-mute" title="On Vercel serverless, applications persist per lambda instance (/tmp). Reads from a different instance may show 0 until the warm instance handles the GET. Swap lib/applicationsStore.ts to Vercel KV/Postgres for cross-instance consistency.">
              ⓘ
            </span>
            <button
              type="button"
              onClick={() => onAction()}
              className="text-ape-300 hover:text-white normal-case font-normal"
              title="refresh now"
            >
              ↻
            </button>
            <label className="flex items-center gap-1 normal-case font-normal text-ape-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-ape-500"
              />
              auto
            </label>
          </span>
        }
        padded={false}
      >
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
            <tr>
              <th className="text-left px-3 py-1 border-b border-border">wallet</th>
              <th className="text-left px-3 py-1 border-b border-border">twitter</th>
              <th className="text-left px-3 py-1 border-b border-border">submitted</th>
              <th className="text-left px-3 py-1 border-b border-border">status</th>
              <th className="text-left px-3 py-1 border-b border-border">actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(apps?.items ?? []).map((row) => {
              const status = row.status;
              const badge = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
              return (
                <tr key={row.id} className="row-hover">
                  <td className="px-3 py-2 font-mono text-ape-100 break-all">{row.wallet}</td>
                  <td className="px-3 py-2 text-ape-200">@{row.twitter}</td>
                  <td className="px-3 py-2 text-mute font-mono">{row.createdAt.replace("T", " ").slice(0, 16)}</td>
                  <td className="px-3 py-2"><StatusBadge status={badge as any} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        variant="primary"
                        onClick={() => decide(row.wallet, "approve")}
                        disabled={status === "approved" || busy === `${row.wallet}:approve`}
                      >Approve</Button>
                      <Button
                        onClick={() => decide(row.wallet, "reject")}
                        disabled={status === "rejected" || busy === `${row.wallet}:reject`}
                      >Reject</Button>
                      <Button
                        variant="ghost"
                        onClick={() => remove(row.wallet)}
                        disabled={busy === `${row.wallet}:delete`}
                      >Delete</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {apps && apps.items.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-3 text-mute text-center text-xxs italic">no applications</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Panel>
    </div>
  );
}

// ───── Referrals ───────────────────────────────────────────────────────

function ReferralsSection({
  refs,
  onChanged,
}: {
  refs: { items: ReferralAdminItem[]; total: number; totalReferred: number } | null;
  onChanged: () => void;
}) {
  const [referrer, setReferrer] = useState("");
  const [referee, setReferee] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function simulate() {
    if (!referrer.trim()) {
      setErr("referrer wallet required");
      return;
    }
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await adminApi.simulateReferral(referrer.trim(), referee.trim() || undefined);
      setMsg(`linked ${r.referee.slice(0, 10)}… → ${r.referrer.slice(0, 10)}…`);
      setReferee("");
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  async function remove(refr: string, refe: string) {
    if (!confirm(`Remove referral?\n  ${refe}\n  ← from referrer ${refr}`)) return;
    setBusy(true);
    try {
      await adminApi.removeReferral(refr, refe);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="referrals">
      <Panel
        title="Referrals"
        right={
          refs ? (
            <span>{refs.total} referrer{refs.total === 1 ? "" : "s"} · {refs.totalReferred} total</span>
          ) : (
            <span>loading...</span>
          )
        }
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
              <tr>
                <th className="text-left px-3 py-1 border-b border-border">referrer</th>
                <th className="text-left px-3 py-1 border-b border-border">code</th>
                <th className="text-left px-3 py-1 border-b border-border">count</th>
                <th className="text-left px-3 py-1 border-b border-border">referred wallets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(refs?.items ?? []).map((row) => (
                <tr key={row.wallet} className="row-hover">
                  <td className="px-3 py-2 font-mono text-ape-100 break-all">{row.wallet}</td>
                  <td className="px-3 py-2 font-mono text-ape-200">{row.code}</td>
                  <td className="px-3 py-2 font-mono text-ape-100">{row.count} / {row.limit}</td>
                  <td className="px-3 py-2">
                    {row.referred.length === 0 ? (
                      <span className="text-mute italic text-xxs">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {row.referred.map((r) => (
                          <li key={r.wallet} className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-ape-100 break-all">{r.wallet}</span>
                            {r.twitter && <span className="text-ape-200">@{r.twitter}</span>}
                            {r.status && (
                              <StatusBadge
                                status={
                                  r.status === "approved" ? "Approved" :
                                  r.status === "rejected" ? "Rejected" : "Pending"
                                }
                              />
                            )}
                            <button
                              onClick={() => remove(row.wallet, r.wallet)}
                              className="text-xxs text-red-300 hover:text-red-200 underline"
                              disabled={busy}
                            >
                              remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
              {refs && refs.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-mute text-center text-xxs italic">
                    no referrals yet — simulate one below to test
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border p-3 space-y-2">
          <div className="text-xxs text-mute uppercase tracking-wide">simulate referral · creates a real entry</div>
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <label className="label">referrer wallet</label>
              <input
                className="field font-mono"
                placeholder="0x..."
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
              />
            </div>
            <div>
              <label className="label">referee wallet (optional)</label>
              <input
                className="field font-mono"
                placeholder="0x... (random if blank)"
                value={referee}
                onChange={(e) => setReferee(e.target.value)}
              />
            </div>
            <Button variant="primary" onClick={simulate} disabled={busy || !referrer.trim()}>
              Simulate Referral
            </Button>
          </div>
          {msg && <div className="text-xxs text-ape-200">{msg}</div>}
          {err && (
            <div className="text-xxs text-red-300 uppercase">
              error: {err}
              {err === "limit_reached" && " (referrer already at 5/5)"}
              {err === "already_referred" && " (referee already referred by someone)"}
              {err === "self_referral" && " (referrer and referee must differ)"}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ───── Uploads ─────────────────────────────────────────────────────────

function UploadsSection({
  uploads,
  onChanged,
}: {
  uploads: { items: UploadEntry[]; total: number } | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[], replaceName?: string) {
    setError(null);
    setInfo(null);
    setBusy(true);
    let added = 0;
    let lastErr: string | null = null;
    try {
      for (const f of Array.from(files)) {
        // For "replace": rename the file in-flight to match the target name.
        const fileToSend = replaceName
          ? new File([f], replaceName, { type: f.type })
          : f;
        try {
          await adminApi.uploadAsset(fileToSend);
          added++;
        } catch (e) {
          lastErr = e instanceof ApiError ? e.message : "upload_failed";
        }
      }
      if (added > 0) setInfo(`uploaded ${added} file${added === 1 ? "" : "s"}.`);
      if (lastErr) setError(lastErr);
      if (added > 0) onChanged();
    } finally {
      setBusy(false);
      setReplaceTarget(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = e.target.files;
    if (!fs || fs.length === 0) return;
    await uploadFiles(fs, replaceTarget ?? undefined);
  }

  async function remove(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    setBusy(true);
    try {
      await adminApi.deleteUpload(name);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "delete_failed");
    } finally { setBusy(false); }
  }

  function startReplace(name: string) {
    setReplaceTarget(name);
    setError(null);
    setInfo(`replacing ${name} — choose a file…`);
    fileRef.current?.click();
  }

  const images = (uploads?.items ?? []).filter((e) => e.kind === "image");
  const metas = (uploads?.items ?? []).filter((e) => e.kind === "json");

  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div id="uploads">
      <Panel
        title="Uploads"
        right={
          uploads ? (
            <span>{uploads.total} file{uploads.total === 1 ? "" : "s"}</span>
          ) : (
            <span>loading...</span>
          )
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">file (.json, .jpg, .png — max 5MB each)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.jpg,.jpeg,.png,application/json,image/jpeg,image/png"
              multiple={!replaceTarget}
              disabled={busy}
              className="field"
              onChange={onFileChange}
            />
            <div className="text-xxs text-mute mt-1">
              {replaceTarget
                ? `replace mode: file will overwrite ${replaceTarget}`
                : "select one or more files. duplicate filenames overwrite existing entries."}
            </div>
          </div>
          {info && <div className="text-xxs text-ape-200">{info}</div>}
          {error && (
            <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">
              error: {error}
            </div>
          )}
        </div>

        <div className="divider-old" />

        <div className="space-y-2">
          <div className="text-xxs uppercase tracking-wide text-mute">
            images ({images.length})
          </div>
          {images.length === 0 ? (
            <div className="text-xxs text-mute italic">no images uploaded yet.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((img) => (
                <div
                  key={img.name}
                  className="border border-border bg-ape-950 p-2 space-y-2"
                >
                  <a href={img.url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full aspect-square object-cover border border-border"
                    />
                  </a>
                  <div className="text-xxs font-mono text-ape-200 break-all">
                    {img.name}
                  </div>
                  <div className="text-xxs text-mute">{fmtBytes(img.size)}</div>
                  <div className="flex gap-1 flex-wrap">
                    <Button onClick={() => startReplace(img.name)} disabled={busy}>
                      Replace
                    </Button>
                    <Button variant="ghost" onClick={() => remove(img.name)} disabled={busy}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider-old" />

        <div className="space-y-2">
          <div className="text-xxs uppercase tracking-wide text-mute">
            metadata ({metas.length})
          </div>
          {metas.length === 0 ? (
            <div className="text-xxs text-mute italic">no metadata files uploaded.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {metas.map((m) => (
                <div
                  key={m.name}
                  className="border border-border bg-ape-950 p-2 text-xxs space-y-1"
                >
                  <div className="font-mono text-ape-100 break-all">{m.name}</div>
                  <dl className="grid grid-cols-[80px_1fr] gap-y-1">
                    <dt className="text-mute uppercase">name</dt>
                    <dd className="text-ape-100">{m.metadata?.name ?? <span className="text-mute italic">missing</span>}</dd>
                    <dt className="text-mute uppercase">image</dt>
                    <dd className="font-mono text-ape-200 break-all">
                      {m.metadata?.image ? (
                        <a href={m.metadata.image} target="_blank" rel="noreferrer">{m.metadata.image}</a>
                      ) : (
                        <span className="text-mute italic">missing</span>
                      )}
                    </dd>
                    <dt className="text-mute uppercase">attrs</dt>
                    <dd className="text-ape-100">{m.metadata?.attributes?.length ?? 0}</dd>
                  </dl>
                  {m.metadata?.attributes && m.metadata.attributes.length > 0 && (
                    <div className="border-t border-border pt-1 space-y-0.5 max-h-28 overflow-auto">
                      {m.metadata.attributes.map((a, i) => (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="text-mute uppercase">{a.trait_type}</span>
                          <span className="text-ape-200 font-mono">{String(a.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 flex-wrap pt-1">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-old btn-old-ghost text-xxs no-underline px-2"
                    >
                      View
                    </a>
                    <Button onClick={() => startReplace(m.name)} disabled={busy}>
                      Replace
                    </Button>
                    <Button variant="ghost" onClick={() => remove(m.name)} disabled={busy}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ───── Link Audit ──────────────────────────────────────────────────────

type AuditRow = {
  path: string;
  method: string;
  group: "page" | "api-public" | "api-admin";
  label: string;
  status: "OK" | "BROKEN" | "POST-ONLY";
  code: number | null;
  expected: number[];
  ms: number | null;
};

function LinkAuditSection() {
  const [data, setData] = useState<{
    items: AuditRow[]; total: number; ok: number; broken: number; postOnly: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try {
      const r = await adminApi.auditLinks();
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "audit_failed");
    } finally { setBusy(false); }
  }

  return (
    <div id="audit">
      <Panel
        title="Link Audit"
        right={
          data
            ? <span>{data.ok}/{data.ok + data.broken} ok · {data.broken} broken · {data.postOnly} post-only</span>
            : <span>not run</span>
        }
        padded={false}
      >
        <div className="p-3 flex items-center gap-2 flex-wrap border-b border-border">
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy ? "Probing…" : data ? "Re-run audit" : "Run audit"}
          </Button>
          <span className="text-xxs text-mute">
            probes every registered route. admin-gated routes use your current
            session cookie. POST-only routes are listed but not exercised.
          </span>
          {error && (
            <span className="text-xxs text-red-300 uppercase">error: {error}</span>
          )}
        </div>

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
                <tr>
                  <th className="text-left px-3 py-1 border-b border-border">status</th>
                  <th className="text-left px-3 py-1 border-b border-border">method</th>
                  <th className="text-left px-3 py-1 border-b border-border">path</th>
                  <th className="text-left px-3 py-1 border-b border-border">label</th>
                  <th className="text-left px-3 py-1 border-b border-border">code</th>
                  <th className="text-left px-3 py-1 border-b border-border text-right pr-3">ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((row, i) => (
                  <tr
                    key={`${row.method}-${row.path}-${i}`}
                    className={
                      row.status === "BROKEN"
                        ? "bg-red-950/30"
                        : row.status === "POST-ONLY"
                        ? "opacity-60"
                        : ""
                    }
                  >
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={
                          row.status === "OK" ? "Approved" :
                          row.status === "BROKEN" ? "Rejected" : "Locked"
                        }
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-ape-200">{row.method}</td>
                    <td className="px-3 py-2 font-mono text-ape-100 break-all">{row.path}</td>
                    <td className="px-3 py-2 text-ape-200">{row.label}</td>
                    <td className="px-3 py-2 font-mono text-ape-100">
                      {row.code ?? "—"}
                      {row.code && row.expected.length > 0 && !row.expected.includes(row.code) && (
                        <span className="text-mute"> (want {row.expected.join("/")})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right pr-3 font-mono text-mute">
                      {row.ms != null ? `${row.ms}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
