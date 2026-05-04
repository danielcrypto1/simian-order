"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import AdminTopBar from "@/components/AdminTopBar";
import { adminApi, ApiError, type Application, type Cfg } from "@/lib/adminApi";

const sections = [
  { id: "round", label: "Round Control" },
  { id: "apps", label: "High Order" },
  { id: "submitted-referrals", label: "The Five Summoning" },
  { id: "backroom", label: "Back Room" },
  { id: "audit", label: "Link Audit" },
  { id: "system-test", label: "System Test" },
  { id: "reset", label: "Reset Data" },
];

/** One curated submission, with the KOL join already applied by
 *  /api/admin/referrals (referrer_isKOL + referrer_tag). */
type SubmissionAdminItem = {
  referrerWallet: string;
  referrerRound: number;
  referrer_isKOL: boolean;
  referrer_tag: string;
  entries: Array<{
    x: string;
    discord: string;
    wallet: string;
    status: "pending" | "approved" | "rejected";
    decidedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

type ReferralListResponse = {
  items: SubmissionAdminItem[];
  total: number;
  totalEntries: number;
  approvedTotal: number;
  pendingTotal: number;
  rejectedTotal: number;
  approvedWallets: string[];
};

export default function AdminDashboard() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [apps, setApps] = useState<{ items: Application[]; total: number } | null>(null);
  const [refs, setRefs] = useState<ReferralListResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, a, r] = await Promise.all([
        adminApi.getConfig(),
        adminApi.listApplications(),
        adminApi.listReferrals(),
      ]);
      setCfg(c);
      setApps(a);
      setRefs(r);
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

            <RoundSection cfg={cfg} onSaved={refresh} />
            <ApplicationsSection apps={apps} onAction={refresh} />
            <SubmittedReferralsSection refs={refs} onChanged={refresh} />
            <BackroomSection />
            <LinkAuditSection />
            <SystemTestSection />
            <ResetSection onReset={refresh} />
          </main>
        </div>
      </div>
    </div>
  );
}

// ───── Round Control ───────────────────────────────────────────────────
// Reads the current round (cfg.round_number) and lets admin push a new
// value via POST /api/admin/set-round. Edits don't auto-save — the
// admin types a number and clicks UPDATE ROUND to commit. Dirty state
// (value !== cfg.round_number) is shown as a faint "(unsaved)" tag.

function RoundSection({ cfg, onSaved }: { cfg: Cfg | null; onSaved: () => void }) {
  const [value, setValue] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the input in sync with the latest server value when cfg
  // refreshes — but don't clobber an in-flight edit.
  useEffect(() => {
    if (!cfg) return;
    setValue(cfg.round_number ?? 1);
  }, [cfg]);

  const current = cfg?.round_number ?? null;
  const dirty = current !== null && Math.floor(value) !== current;

  async function save() {
    setError(null);
    if (!Number.isFinite(value) || value < 1) {
      setError("round must be an integer ≥ 1");
      return;
    }
    setBusy(true);
    try {
      await adminApi.setRound(Math.floor(value));
      onSaved();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "update_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="round">
      <Panel
        title="Round Control"
        right={
          cfg ? (
            <span>
              round {current}
              {dirty && (
                <span className="ml-2 text-bleed normal-case">(unsaved)</span>
              )}
            </span>
          ) : (
            <span>loading...</span>
          )
        }
      >
        {/* Current round — read-only display so the admin can see what's
            live before they edit. */}
        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-mono text-xxs uppercase tracking-wide text-mute">
            current round:
          </span>
          <span
            className="font-pixel text-bleed text-2xl leading-none"
            aria-label={`current round ${current ?? "loading"}`}
          >
            [ {current ?? "—"} ]
          </span>
        </div>

        <div className="divider-old" />

        {/* Editable input + UPDATE ROUND button */}
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="label" htmlFor="round-input">
              new round number
            </label>
            <input
              id="round-input"
              type="number"
              min={1}
              step={1}
              className="field"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              disabled={!cfg || busy}
              onKeyDown={(e) => {
                // Enter from the input fires Save — fewer mouse trips.
                if (e.key === "Enter" && !busy) save();
              }}
            />
          </div>
          <Button
            variant="primary"
            disabled={!cfg || busy || !dirty}
            onClick={save}
          >
            {busy ? "Updating..." : savedFlash ? "Updated ✓" : "Update Round"}
          </Button>
        </div>

        {error && (
          <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200 mt-2">
            error: {error}
          </div>
        )}

        {/* Tagline + scope. Italic serif so it reads as flavour copy
            rather than instructional text — sets the tone the admin sees
            every time they bump the round. */}
        <p className="font-serif italic text-xs text-mute mt-3">
          &mdash; earlier rounds establish influence.
        </p>
        <p className="text-xxs text-mute mt-1">
          propagates to headlines, terminal bar, and the approval-share
          tweet on the next poll. no client cache to bust.
        </p>
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
  const [bulkBusy, setBulkBusy] = useState(false);
  const [onlyValid, setOnlyValid] = useState(true);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  // Source filter: "all" | "apply" | "quest". Filters the table client-side.
  const [sourceFilter, setSourceFilter] = useState<"all" | "apply" | "quest">("all");
  // Wallet/twitter search — case-insensitive substring match.
  const [search, setSearch] = useState("");
  // Pagination — keeps the DOM size bounded at 1000+ applications.
  const [pageSize, setPageSize] = useState<25 | 50 | 100 | 0>(50); // 0 = all
  const [page, setPage] = useState(0);
  const [exportFlash, setExportFlash] = useState<string | null>(null);

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

  const allItems = apps?.items ?? [];
  const filteredItems = sourceFilter === "all" ? allItems : allItems.filter((a) => a.source === sourceFilter);

  // Wallet / twitter substring filter — applied on top of source filter.
  const searchedItems = search.trim()
    ? filteredItems.filter((a) => {
        const q = search.trim().toLowerCase();
        return (
          a.wallet.toLowerCase().includes(q) ||
          (a.twitter ?? "").toLowerCase().includes(q)
        );
      })
    : filteredItems;

  // Pagination — at 1000+ rows the DOM cost of rendering every row in
  // one <tbody> dominates. 50/100/all selectable.
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(searchedItems.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems =
    pageSize === 0
      ? searchedItems
      : searchedItems.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const pendingCount = allItems.filter((a) => a.status === "pending").length;
  const questCount = allItems.filter((a) => a.source === "quest").length;
  const applyCount = allItems.length - questCount;

  // Reset paging when filter / search / data shape changes so the user
  // never lands on a now-empty page after a refresh.
  useEffect(() => {
    setPage(0);
  }, [sourceFilter, search, allItems.length]);

  // ── Export helpers ───────────────────────────────────────────────
  // Both run against `allItems` (every application, ignoring the
  // active filter / search / page) so the export is a snapshot of the
  // entire queue regardless of what the admin is currently looking at.

  function downloadFile(filename: string, content: string, mime: string) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportFlash(filename);
      setTimeout(() => setExportFlash(null), 1800);
    } catch {
      setExportFlash("export_failed");
      setTimeout(() => setExportFlash(null), 1800);
    }
  }

  function todayStamp(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function exportWallets() {
    if (allItems.length === 0) {
      setExportFlash("no_applications");
      setTimeout(() => setExportFlash(null), 1500);
      return;
    }
    // Newline-separated wallet addresses — directly drop into OpenSea
    // allowlist input or any whitelist tool.
    const body = allItems.map((a) => a.wallet).join("\n");
    downloadFile(`simian-wallets-${todayStamp()}.txt`, body, "text/plain;charset=utf-8");
  }

  function exportCsv() {
    if (allItems.length === 0) {
      setExportFlash("no_applications");
      setTimeout(() => setExportFlash(null), 1500);
      return;
    }
    // CSV with a header row. address_type maps to the source column
    // ("apply" formal application, "quest" auto-filed via tasks).
    const rows = allItems.map((a) => `${a.wallet},${a.source}`);
    const body = `wallet,address_type\n${rows.join("\n")}\n`;
    downloadFile(`simian-applicants-${todayStamp()}.csv`, body, "text/csv;charset=utf-8");
  }

  async function bulkAction(action: "approve" | "reject") {
    const verb = action === "approve" ? "approve" : "reject";
    const filterCopy = onlyValid ? " (skipping entries missing wallet or twitter)" : "";
    if (!confirm(
      `Are you sure you want to ${verb} all ${pendingCount} pending application${pendingCount === 1 ? "" : "s"}?${filterCopy}\n\nThis cannot be undone.`
    )) return;

    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const r = action === "approve"
        ? await adminApi.acceptAllPending(onlyValid)
        : await adminApi.rejectAllPending(onlyValid);
      const past = action === "approve" ? "approved" : "rejected";
      setBulkMessage(`${r.count} application${r.count === 1 ? "" : "s"} ${past}.`);
      onAction();
    } catch (e) {
      setBulkMessage(`error: ${e instanceof ApiError ? e.message : "bulk_failed"}`);
    } finally { setBulkBusy(false); }
  }
  return (
    <div id="apps">
      <Panel
        title="High Order — Applications"
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
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              onClick={() => bulkAction("approve")}
              disabled={bulkBusy || pendingCount === 0}
            >
              {bulkBusy ? "Working…" : `Accept All Pending (${pendingCount})`}
            </Button>
            <Button
              onClick={() => bulkAction("reject")}
              disabled={bulkBusy || pendingCount === 0}
            >
              {`Reject All Pending`}
            </Button>
            <a
              href="/api/admin/export/high-order"
              download="high-order.csv"
              className="text-xxs uppercase tracking-wide px-2 py-1 border border-ape-500 text-ape-100 hover:bg-ape-800 no-underline"
              title="OpenSea-ready CSV — wallet_address,quantity (qty=1, deduped)"
            >
              Download CSV
            </a>
            <label className="flex items-center gap-1 text-xxs uppercase tracking-wide text-ape-200 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={onlyValid}
                onChange={(e) => setOnlyValid(e.target.checked)}
                className="accent-ape-500"
              />
              only approve valid entries
            </label>
          </div>
          <div className="text-xxs text-red-300 uppercase tracking-wide">
            ⚠ this will {pendingCount === 0 ? "do nothing — no pending applications" : `apply to ALL ${pendingCount} pending application${pendingCount === 1 ? "" : "s"}`}
          </div>
          {bulkMessage && (
            <div className={`text-xxs px-2 py-1 border ${
              bulkMessage.startsWith("error")
                ? "bg-red-950 border-red-700 text-red-200"
                : "bg-ape-800 border-ape-300 text-ape-100"
            }`}>
              {bulkMessage}
            </div>
          )}

          {/* Source filter — All / Standard / Quest. Filters the table
              below client-side; bulk actions still operate on every
              pending entry regardless of the active filter. */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-xxs uppercase tracking-wide text-mute mr-1">filter:</span>
            <FilterTab
              label={`All (${allItems.length})`}
              active={sourceFilter === "all"}
              onClick={() => setSourceFilter("all")}
            />
            <FilterTab
              label={`Standard (${applyCount})`}
              active={sourceFilter === "apply"}
              onClick={() => setSourceFilter("apply")}
            />
            <FilterTab
              label={`Quest Applicants (${questCount})`}
              active={sourceFilter === "quest"}
              onClick={() => setSourceFilter("quest")}
            />
          </div>

          {/* Search + page-size — keeps the DOM bounded at 1000+ rows.
              The bulk + export buttons remain scoped to the underlying
              dataset, not to the visible page. */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <input
              type="search"
              placeholder="search wallet or @handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field flex-1 min-w-[200px] max-w-[360px] py-0 px-2 text-xs"
              aria-label="search applications"
            />
            <label className="flex items-center gap-1 text-xxs uppercase tracking-wide text-mute">
              show
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as 25 | 50 | 100 | 0)}
                className="field py-0 px-1 text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>all</option>
              </select>
            </label>
            <span className="text-xxs uppercase tracking-wide text-mute">
              {searchedItems.length} match{searchedItems.length === 1 ? "" : "es"}
              {pageSize !== 0 && totalPages > 1 && (
                <> · page {safePage + 1}/{totalPages}</>
              )}
            </span>
          </div>

          {/* Export — operates on every application, regardless of
              filter / search / page. .txt = newline-separated wallets
              for OpenSea allowlist. .csv = wallet,address_type with
              header for spreadsheet tools. */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-xxs uppercase tracking-wide text-mute mr-1">export:</span>
            <Button onClick={exportWallets} disabled={allItems.length === 0}>
              Export Wallets
            </Button>
            <Button onClick={exportCsv} disabled={allItems.length === 0}>
              Export CSV
            </Button>
            {exportFlash && (
              <span className={`text-xxs uppercase tracking-wide ${
                exportFlash.startsWith("no_") || exportFlash.includes("failed")
                  ? "text-red-300" : "text-ape-200"
              }`}>
                {exportFlash.startsWith("simian-")
                  ? `↓ ${exportFlash}`
                  : exportFlash === "no_applications"
                  ? "no applications to export"
                  : "export failed"}
              </span>
            )}
            <span className="text-xxs text-mute ml-auto">
              exports {allItems.length} application{allItems.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[820px]">
          <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
            <tr>
              <th className="text-left px-3 py-1 border-b border-border">wallet</th>
              <th className="text-left px-3 py-1 border-b border-border">twitter</th>
              <th className="text-left px-3 py-1 border-b border-border">source</th>
              <th className="text-left px-3 py-1 border-b border-border">submitted</th>
              <th className="text-left px-3 py-1 border-b border-border">status</th>
              <th className="text-left px-3 py-1 border-b border-border">actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageItems.map((row) => {
              const status = row.status;
              const badge = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
              return (
                <tr key={row.id} className="row-hover">
                  <td className="px-3 py-2 font-mono text-ape-100 break-all">{row.wallet}</td>
                  <td className="px-3 py-2 text-ape-200">@{row.twitter}</td>
                  <td className="px-3 py-2">
                    {row.source === "quest" ? (
                      <span
                        className="badge text-bleed"
                        style={{ letterSpacing: "0.22em" }}
                        title="auto-filed via tasks page"
                      >
                        QUEST
                      </span>
                    ) : (
                      <span className="font-mono text-xxs uppercase tracking-wide text-mute">
                        apply
                      </span>
                    )}
                  </td>
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
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-3 text-mute text-center text-xxs italic">
                  {allItems.length === 0
                    ? "no applications"
                    : search.trim()
                    ? `no applications match "${search.trim()}"`
                    : `no ${sourceFilter === "quest" ? "quest applicants" : sourceFilter === "apply" ? "standard applications" : "applications"} match this filter`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination nav — first / prev / N / next / last. Hidden when
            there's only one page. Buttons are wide-tap-friendly mono
            caps to match the rest of the admin chrome. */}
        {pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center gap-2 flex-wrap p-3 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setPage(0)}
              disabled={safePage === 0}
            >« first</Button>
            <Button
              variant="ghost"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >‹ prev</Button>
            <span className="font-mono text-xxs uppercase tracking-wide text-bone">
              {safePage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
            >next ›</Button>
            <Button
              variant="ghost"
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
            >last »</Button>
            <span className="ml-auto text-xxs text-mute">
              showing {pageItems.length} of {searchedItems.length}
            </span>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Tiny tab-style filter button used by ApplicationsSection. */
function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-[2px] font-mono text-xxs uppercase tracking-wide border ${
        active
          ? "bg-ape-700 border-ape-300 text-white"
          : "bg-transparent border-border text-mute hover:text-ape-100 hover:border-ape-500"
      }`}
    >
      {label}
    </button>
  );
}

// ───── Submitted Referrals ─────────────────────────────────────────────
// Curated submission system. Each referrer (an approved applicant)
// submits up to 5 candidates. Admin approves/rejects each entry; an
// approved entry's wallet earns GTD. Wallet-collision and self-referral
// are validated server-side. KOL registry is joined in by /api/admin/
// referrals so badges + tags render inline.

function SubmittedReferralsSection({
  refs,
  onChanged,
}: {
  refs: ReferralListResponse | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openTagFor, setOpenTagFor] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  const items = refs?.items ?? [];

  async function decide(
    referrer: string,
    referee: string,
    action: "approve" | "reject"
  ) {
    const key = `${referrer}:${referee}:${action}`;
    setErr(null);
    setBusy(key);
    try {
      await adminApi.decideReferralEntry(referrer, referee, action);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "unknown");
    } finally {
      setBusy(null);
    }
  }

  async function deleteSubmission(referrer: string) {
    if (!confirm(`Delete entire submission from\n  ${referrer}?\n\nThis lets them re-submit.`)) return;
    setErr(null);
    setBusy(`del:${referrer}`);
    try {
      await adminApi.deleteSubmission(referrer);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "unknown");
    } finally {
      setBusy(null);
    }
  }

  async function toggleKol(wallet: string, isKol: boolean, currentTag: string) {
    setErr(null);
    if (isKol) {
      if (!confirm(`Remove KOL tag from\n  ${wallet}?`)) return;
      setBusy(`kol:${wallet}`);
      try {
        await adminApi.removeKol(wallet);
        onChanged();
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "unknown");
      } finally {
        setBusy(null);
      }
    } else {
      setOpenTagFor(wallet);
      setTagDraft(currentTag || "");
    }
  }

  async function saveKol(wallet: string) {
    setErr(null);
    setBusy(`kol:${wallet}`);
    try {
      await adminApi.setKol(wallet, tagDraft.trim());
      setOpenTagFor(null);
      setTagDraft("");
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "unknown");
    } finally {
      setBusy(null);
    }
  }

  async function copyApproved() {
    const wallets = refs?.approvedWallets ?? [];
    if (wallets.length === 0) {
      setErr("no approved entries yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(wallets.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr("clipboard_unavailable");
    }
  }

  return (
    <div id="submitted-referrals">
      <Panel
        title="The Five Summoning"
        right={
          refs ? (
            <span>
              {refs.total} summoner{refs.total === 1 ? "" : "s"} · {refs.totalEntries} name
              {refs.totalEntries === 1 ? "" : "s"} · {refs.approvedTotal} recognised
            </span>
          ) : (
            <span>loading...</span>
          )
        }
        padded={false}
      >
        <div className="p-3 flex flex-wrap items-center gap-2 border-b border-border">
          <Button
            variant="primary"
            onClick={copyApproved}
            disabled={!refs || refs.approvedWallets.length === 0}
          >
            {copied ? "Copied ✓" : `Copy ${refs?.approvedWallets.length ?? 0} recognised wallets`}
          </Button>
          <span className="text-xxs text-mute leading-relaxed">
            recognised names earn GTD. each summoner names up to 5 candidates
            (X handle · discord · wallet). once any verdict is given, the
            summoner&rsquo;s slate is locked — delete the summoning to let them
            re-summon.
          </span>
          {err && (
            <span className="text-xxs text-red-300 uppercase tracking-wide ml-auto">
              error: {err}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-6 text-xxs text-mute italic text-center">
            no submissions yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((row) => {
              const submissionDel = busy === `del:${row.referrerWallet}`;
              const kolBusy = busy === `kol:${row.referrerWallet}`;
              const tagOpen = openTagFor === row.referrerWallet;
              return (
                <div key={row.referrerWallet} className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ape-100 break-all">
                      {row.referrerWallet}
                    </span>
                    <span className="text-xxs text-mute uppercase tracking-wide">
                      round {row.referrerRound}
                    </span>
                    {row.referrer_isKOL && (
                      <span className="text-xxs uppercase tracking-widest px-2 py-0.5 border border-bleed text-bleed">
                        KOL
                      </span>
                    )}
                    {row.referrer_tag && (
                      <span className="text-xxs italic text-ape-200">
                        “{row.referrer_tag}”
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() =>
                          toggleKol(row.referrerWallet, row.referrer_isKOL, row.referrer_tag)
                        }
                        disabled={kolBusy}
                        className="text-xxs uppercase tracking-wide text-ape-200 hover:text-bleed underline"
                      >
                        {row.referrer_isKOL ? "remove KOL" : "tag KOL"}
                      </button>
                      <button
                        onClick={() => deleteSubmission(row.referrerWallet)}
                        disabled={submissionDel}
                        className="text-xxs uppercase tracking-wide text-red-300 hover:text-red-200 underline"
                      >
                        {submissionDel ? "deleting…" : "delete submission"}
                      </button>
                    </div>
                  </div>

                  {tagOpen && (
                    <div className="flex flex-wrap items-center gap-2 bg-ape-850 px-2 py-2 border border-border">
                      <label className="text-xxs uppercase tracking-wide text-ape-200">
                        tag (optional)
                      </label>
                      <input
                        className="field font-mono flex-1 min-w-[140px]"
                        placeholder="e.g. ALPHA OG, mod, partner"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value.slice(0, 64))}
                      />
                      <Button
                        variant="primary"
                        onClick={() => saveKol(row.referrerWallet)}
                        disabled={kolBusy}
                      >
                        save KOL
                      </Button>
                      <button
                        onClick={() => {
                          setOpenTagFor(null);
                          setTagDraft("");
                        }}
                        className="text-xxs uppercase tracking-wide text-mute hover:text-ape-200 underline"
                      >
                        cancel
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xxs min-w-[640px]">
                      <thead className="bg-ape-850 uppercase tracking-wide text-ape-200">
                        <tr>
                          <th className="text-left px-2 py-1 border-b border-border">#</th>
                          <th className="text-left px-2 py-1 border-b border-border">x</th>
                          <th className="text-left px-2 py-1 border-b border-border">discord</th>
                          <th className="text-left px-2 py-1 border-b border-border">wallet</th>
                          <th className="text-left px-2 py-1 border-b border-border">status</th>
                          <th className="text-right px-2 py-1 border-b border-border">action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {row.entries.map((entry, idx) => {
                          const apvKey = `${row.referrerWallet}:${entry.wallet}:approve`;
                          const rjKey = `${row.referrerWallet}:${entry.wallet}:reject`;
                          const decided = entry.status !== "pending";
                          return (
                            <tr key={`${row.referrerWallet}-${idx}-${entry.wallet}`} className="row-hover">
                              <td className="px-2 py-1.5 text-mute font-mono">{idx + 1}</td>
                              <td className="px-2 py-1.5 text-ape-200">@{entry.x}</td>
                              <td className="px-2 py-1.5 text-ape-200">{entry.discord || "—"}</td>
                              <td className="px-2 py-1.5 font-mono text-ape-100 break-all">
                                {entry.wallet}
                              </td>
                              <td className="px-2 py-1.5">
                                <StatusBadge
                                  status={
                                    entry.status === "approved"
                                      ? "Approved"
                                      : entry.status === "rejected"
                                      ? "Rejected"
                                      : "Pending"
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      decide(row.referrerWallet, entry.wallet, "approve")
                                    }
                                    disabled={
                                      busy === apvKey || entry.status === "approved"
                                    }
                                    className={`text-xxs uppercase tracking-wide underline ${
                                      entry.status === "approved"
                                        ? "text-mute cursor-not-allowed"
                                        : "text-emerald-300 hover:text-emerald-200"
                                    }`}
                                  >
                                    {busy === apvKey ? "…" : decided && entry.status === "approved" ? "approved" : "approve"}
                                  </button>
                                  <button
                                    onClick={() =>
                                      decide(row.referrerWallet, entry.wallet, "reject")
                                    }
                                    disabled={busy === rjKey || entry.status === "rejected"}
                                    className={`text-xxs uppercase tracking-wide underline ${
                                      entry.status === "rejected"
                                        ? "text-mute cursor-not-allowed"
                                        : "text-red-300 hover:text-red-200"
                                    }`}
                                  >
                                    {busy === rjKey ? "…" : decided && entry.status === "rejected" ? "rejected" : "reject"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-xxs text-mute font-mono">
                    submitted {row.createdAt.slice(0, 10)} · last decision {row.updatedAt.slice(0, 10)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ───── Back Room ───────────────────────────────────────────────────────
// Hidden 500-claim easter egg. Admin sets the passphrase + drop code
// here; the /backroom public page checks the passphrase, binds the
// claimer's wallet to the SAME shared drop code that all 500 receive.

type BackroomAdminState = {
  passphrase: string | null;
  dropCode: string | null;
  total: number;
  remaining: number;
  claimed: number;
  full: boolean;
  claims: Array<{
    code: string;
    wallet?: string;
    visitorId: string;
    ipHash: string;
    claimedAt: string;
  }>;
  updatedAt: string;
};

function BackroomSection() {
  const [data, setData] = useState<BackroomAdminState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  // Drop code editor state — separate from passphrase so each save
  // button does one thing and one thing only.
  const [dropDraft, setDropDraft] = useState("");
  const [dropSavedFlash, setDropSavedFlash] = useState(false);
  const [revealPass, setRevealPass] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await adminApi.getBackroom();
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "load_failed");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-fill the drafts once on first hydration so admin can edit
  // without retyping. Don't override later if they're typing.
  useEffect(() => {
    if (data && !draft) setDraft(data.passphrase ?? "");
    if (data && !dropDraft) setDropDraft(data.dropCode ?? "");
    // intentionally only on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function savePassphrase() {
    setError(null);
    if (!draft.trim()) {
      setError("passphrase cannot be empty");
      return;
    }
    setBusy(true);
    try {
      await adminApi.setBackroomPassphrase(draft.trim());
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "save_failed");
    } finally { setBusy(false); }
  }

  async function saveDropCode() {
    setError(null);
    setBusy(true);
    try {
      const trimmed = dropDraft.trim();
      await adminApi.setBackroomDropCode(trimmed.length === 0 ? null : trimmed);
      setDropSavedFlash(true);
      setTimeout(() => setDropSavedFlash(false), 1500);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "save_failed");
    } finally { setBusy(false); }
  }

  async function regenerateDropCode() {
    if (!confirm(
      "Regenerate the shared drop code?\n\n" +
      "Already-issued claims keep the old code. Future claims will receive the new value."
    )) return;
    setError(null);
    setBusy(true);
    try {
      const r = await adminApi.regenerateBackroomDropCode();
      setDropDraft(r.dropCode);
      setDropSavedFlash(true);
      setTimeout(() => setDropSavedFlash(false), 1500);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "regen_failed");
    } finally { setBusy(false); }
  }

  async function reset(alsoClearPassphrase: boolean) {
    const msg = alsoClearPassphrase
      ? `Reset back-room data?\n\n  • wipes ${data?.claimed ?? 0} issued code(s)\n  • CLEARS the passphrase (door sealed)\n\nThis cannot be undone.`
      : `Reset back-room claims?\n\n  • wipes ${data?.claimed ?? 0} issued code(s)\n  • passphrase preserved — visitors who already typed it will be able to claim again\n\nThis cannot be undone.`;
    if (!confirm(msg)) return;
    setError(null);
    setBusy(true);
    try {
      await adminApi.resetBackroom(alsoClearPassphrase);
      if (alsoClearPassphrase) setDraft("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "reset_failed");
    } finally { setBusy(false); }
  }

  async function copyCodes() {
    if (!data || data.claims.length === 0) return;
    const payload = data.claims
      .map((c) => `${c.code}\t${c.wallet ?? ""}\t${c.claimedAt}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("clipboard_unavailable");
    }
  }

  return (
    <div id="backroom">
      <Panel
        title="Back Room"
        right={
          data ? (
            <span>
              {data.full ? "FULL · " : ""}
              {data.claimed} / {data.total} claimed · {data.remaining} remaining
            </span>
          ) : (
            <span>loading...</span>
          )
        }
      >
        <div className="space-y-4">
          <p className="text-xxs text-mute leading-relaxed">
            hidden /backroom page. visitors who type the passphrase + their wallet
            receive the SAME shared drop code (set below). one claim per browser
            cookie · cap {data?.total ?? 500}. resetting wipes issued claims only
            (passphrase + drop code preserved unless you also seal the door).
          </p>

          {/* Passphrase row */}
          <div className="space-y-2">
            <label className="label">passphrase</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type={revealPass ? "text" : "password"}
                className="field font-mono flex-1 min-w-[200px]"
                placeholder="set the passphrase visitors must type"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setRevealPass((v) => !v)}
                className="text-xxs uppercase tracking-wide text-ape-200 hover:text-white underline"
              >
                {revealPass ? "hide" : "reveal"}
              </button>
              <Button variant="primary" onClick={savePassphrase} disabled={busy}>
                {savedFlash ? "Saved ✓" : busy ? "Saving…" : "Save Passphrase"}
              </Button>
            </div>
            <p className="text-xxs text-mute">
              matched case-insensitively, trimmed. max 128 chars.
              {data && !data.passphrase && (
                <span className="text-bleed"> · door currently sealed (no passphrase set)</span>
              )}
            </p>
          </div>

          <div className="divider-old" />

          {/* Drop-code row — the SINGLE shared code returned to every
              successful claimer. All 500 claims receive the same value
              here. Admin can set it explicitly or auto-generate. */}
          <div className="space-y-2">
            <label className="label">drop code (shared by all 500)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                className="field font-mono flex-1 min-w-[200px] tracking-[0.18em]"
                placeholder="auto-generated on first claim if empty"
                value={dropDraft}
                onChange={(e) => setDropDraft(e.target.value)}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
              />
              <Button variant="primary" onClick={saveDropCode} disabled={busy}>
                {dropSavedFlash ? "Saved ✓" : busy ? "Saving…" : "Save Drop Code"}
              </Button>
              <Button variant="ghost" onClick={regenerateDropCode} disabled={busy}>
                Regenerate
              </Button>
            </div>
            <p className="text-xxs text-mute">
              every successful claimer receives THIS code. clear the field
              + Save to make the next claim auto-generate a fresh value.
              changing the code does NOT update already-issued claims.
              {data?.dropCode ? (
                <>
                  {" · "}current:{" "}
                  <span className="font-mono text-bleed tracking-[0.18em]">
                    {data.dropCode}
                  </span>
                </>
              ) : (
                <span className="text-bleed"> · no drop code set yet — first claim will auto-generate one</span>
              )}
            </p>
          </div>

          <div className="divider-old" />

          {/* Reset controls + CSV export */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => reset(false)} disabled={busy}>
              Reset Claims
            </Button>
            <Button variant="ghost" onClick={() => reset(true)} disabled={busy}>
              Reset + Seal Door
            </Button>
            <a
              href="/api/admin/export/fcfs"
              download="fcfs.csv"
              className="text-xxs uppercase tracking-wide px-2 py-1 border border-ape-500 text-ape-100 hover:bg-ape-800 no-underline"
              title="OpenSea-ready CSV — wallet_address,quantity (qty=1, deduped)"
            >
              Download CSV
            </a>
            {error && (
              <span className="text-xxs text-red-300 uppercase tracking-wide">
                error: {error}
              </span>
            )}
          </div>

          <div className="divider-old" />

          {/* Claimed codes table */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCodes((v) => !v)}
                className="text-xxs uppercase tracking-wide text-ape-200 hover:text-white underline"
              >
                {showCodes ? "hide" : "show"} claimed codes ({data?.claimed ?? 0})
              </button>
              {showCodes && data && data.claims.length > 0 && (
                <Button variant="ghost" onClick={copyCodes}>
                  {copied ? "Copied ✓" : "Copy codes (TSV)"}
                </Button>
              )}
            </div>

            {showCodes && data && (
              data.claims.length === 0 ? (
                <p className="text-xxs text-mute italic">
                  no claims issued yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
                      <tr>
                        <th className="text-left px-3 py-1 border-b border-border">#</th>
                        <th className="text-left px-3 py-1 border-b border-border">code</th>
                        <th className="text-left px-3 py-1 border-b border-border">wallet</th>
                        <th className="text-left px-3 py-1 border-b border-border">claimed at</th>
                        <th className="text-left px-3 py-1 border-b border-border">visitor (cookie hash)</th>
                        <th className="text-left px-3 py-1 border-b border-border">ip hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.claims.map((c, idx) => (
                        <tr key={c.code} className="row-hover">
                          <td className="px-3 py-1.5 text-mute font-mono">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-mono text-bleed tracking-wider">
                            {c.code}
                          </td>
                          <td className="px-3 py-1.5 text-ape-100 font-mono break-all">
                            {c.wallet ? (
                              <>
                                {c.wallet.slice(0, 6)}…{c.wallet.slice(-4)}
                              </>
                            ) : (
                              <span className="text-mute italic">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-mute font-mono">
                            {c.claimedAt.replace("T", " ").slice(0, 19)}
                          </td>
                          <td className="px-3 py-1.5 text-ape-200 font-mono">
                            {c.visitorId.slice(0, 8)}…{c.visitorId.slice(-4)}
                          </td>
                          <td className="px-3 py-1.5 text-mute font-mono">
                            {c.ipHash}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
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

// ───── System Test ─────────────────────────────────────────────────────

type SystemTestId = "application" | "approval" | "submission";
type SystemTestRow = {
  id: SystemTestId;
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  ms: number;
};

const SYSTEM_TESTS: { id: SystemTestId; label: string; subtitle: string }[] = [
  { id: "application", label: "High Order Flow",       subtitle: "Submit → admin sees → cleanup" },
  { id: "approval",    label: "Recognition Flow",      subtitle: "Recognise → status persists → unlocks summoning" },
  { id: "submission",  label: "Five Summoning Flow",   subtitle: "Summon five → admin recognises one → status persists" },
];

function SystemTestSection() {
  const [results, setResults] = useState<Record<SystemTestId, SystemTestRow | undefined>>({} as any);
  const [running, setRunning] = useState<Set<SystemTestId>>(new Set());
  const [allBusy, setAllBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRow(r: SystemTestRow) {
    setResults((prev) => ({ ...prev, [r.id]: r }));
  }

  async function runOne(id: SystemTestId) {
    setError(null);
    setRunning((prev) => new Set(prev).add(id));
    try {
      const r = await adminApi.runSystemTest(id);
      const row = r.tests[0];
      if (row) setRow(row);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "test_failed");
    } finally {
      setRunning((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function runAll() {
    setError(null);
    setAllBusy(true);
    try {
      const r = await adminApi.runSystemTest();
      const merged: Record<SystemTestId, SystemTestRow | undefined> = {} as any;
      for (const row of r.tests) merged[row.id] = row;
      setResults(merged);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "system_test_failed");
    } finally { setAllBusy(false); }
  }

  const passed = Object.values(results).filter((r) => r?.status === "PASS").length;
  const failed = Object.values(results).filter((r) => r?.status === "FAIL").length;
  const totalSeen = passed + failed;

  return (
    <div id="system-test">
      <Panel
        title="System Test"
        right={
          totalSeen > 0
            ? (
              <span>
                {passed}/{totalSeen} pass{failed > 0 ? ` · ${failed} fail` : ""}
              </span>
            )
            : <span>not run</span>
        }
        padded={false}
      >
        <div className="p-3 flex items-center gap-2 flex-wrap border-b border-border">
          <Button variant="primary" onClick={runAll} disabled={allBusy}>
            {allBusy ? "Running all…" : totalSeen >= SYSTEM_TESTS.length ? "Re-run all" : "Run all tests"}
          </Button>
          <span className="text-xxs text-mute">
            each test seeds its own random wallet, asserts the expected store mutation,
            and cleans up. fail rows persist after re-runs of other tests.
          </span>
          {error && (
            <span className="text-xxs text-red-300 uppercase">error: {error}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
              <tr>
                <th className="text-left px-3 py-1 border-b border-border">result</th>
                <th className="text-left px-3 py-1 border-b border-border">test</th>
                <th className="text-left px-3 py-1 border-b border-border">message</th>
                <th className="text-left px-3 py-1 border-b border-border text-right pr-2">ms</th>
                <th className="text-left px-3 py-1 border-b border-border">action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SYSTEM_TESTS.map((t) => {
                const row = results[t.id];
                const isRunning = running.has(t.id) || allBusy;
                return (
                  <tr
                    key={t.id}
                    className={row?.status === "FAIL" ? "bg-red-950/30" : ""}
                  >
                    <td className="px-3 py-2">
                      {row ? (
                        <StatusBadge status={row.status === "PASS" ? "Approved" : "Rejected"} />
                      ) : (
                        <span className="text-mute text-xxs italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-ape-100 font-bold uppercase tracking-wide">{t.label}</div>
                      <div className="text-xxs text-mute">{t.subtitle}</div>
                    </td>
                    <td className="px-3 py-2 text-ape-200 break-all">
                      {row?.message ?? <span className="text-mute italic">not run</span>}
                    </td>
                    <td className="px-3 py-2 text-right pr-2 font-mono text-mute">
                      {row ? row.ms : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="primary"
                        onClick={() => runOne(t.id)}
                        disabled={isRunning}
                      >
                        {running.has(t.id) ? "Running…" : row ? "Re-run" : "Run"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ───── Reset System Data ──────────────────────────────────────────────

function ResetSection({ onReset }: { onReset: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const armed = confirmText === "RESET";

  async function run() {
    if (!armed) return;
    if (!confirm(
      "Wipe ALL transactional data?\n\n" +
      "  • applications (gist)\n" +
      "  • submissions (gist) — curated /referral lists\n\n" +
      "KOL registry + Back Room are preserved (each has its own reset).\n" +
      "This cannot be undone."
    )) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await adminApi.resetAllData();
      const c = r.cleared;
      setResult(
        `cleared: ${c.applications} applications · ${c.submissions} submissions`
      );
      setConfirmText("");
      onReset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "reset_failed");
    } finally { setBusy(false); }
  }

  return (
    <div id="reset">
      <div className="panel shadow-hard border-red-700">
        <div className="panel-header bg-red-950 border-b-red-700 text-red-200">
          <span>:: Reset System Data</span>
          <span className="text-red-300 normal-case font-normal">danger zone</span>
        </div>
        <div className="p-3 space-y-3">
          <p className="text-xs text-red-200 leading-relaxed">
            Wipes every transactional store back to empty: applications and
            curated /referral submissions. The KOL registry and Back Room
            state are preserved (each has its own reset).
            <strong> This cannot be undone.</strong>
          </p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="label">type RESET to enable the button</label>
              <input
                className="field font-mono"
                placeholder="RESET"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.trim())}
              />
            </div>
            <Button
              onClick={run}
              disabled={!armed || busy}
              className={armed ? "!bg-red-700 !border-red-500 !text-white" : ""}
            >
              {busy ? "Wiping…" : "Reset System Data"}
            </Button>
          </div>
          {result && (
            <div className="border border-ape-300 bg-ape-800 px-2 py-2 text-xxs text-ape-100 break-all">
              ✓ {result}
            </div>
          )}
          {error && (
            <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">
              error: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// (Helpers NumberField/Toggle/KV were removed along with the Mint
//  Controls + Whitelist sections — they had no remaining consumers.)
