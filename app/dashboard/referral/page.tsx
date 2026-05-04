"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import OpenseaLink from "@/components/OpenseaLink";
import { OPENSEA_HIDDEN } from "@/lib/links";
import { useRound } from "@/lib/useRound";
import { TWEETS, openTweet } from "@/lib/twitterShare";

/**
 * Curated submission page — "THE FIVE SUMMONING".
 *
 * Replaces the old auto-tracking referral link system. Recognised
 * users name up to five candidates (X handle, Discord, wallet).
 * The order reviews each name one at a time; only those the order
 * recognises earn GTD/eligibility.
 *
 * Two views:
 *   1. NO summoning yet → render the form (5 rows of inputs).
 *   2. Summoning exists → render the locked status list.
 *
 * Re-summon is allowed by the API only while every name is still
 * pending. Once any name has a verdict the row is locked, and
 * the page swaps the form for the status view automatically on the
 * next refresh.
 *
 * Lock state for non-recognised wallets is unchanged: a hard
 * "ACCESS DENIED" dossier with no form rendered.
 */

type SubmissionStatus = "pending" | "approved" | "rejected";

type Entry = {
  x: string;
  discord: string;
  wallet: string;
  status: SubmissionStatus;
  decidedAt?: string;
};

type Submission = {
  referrerWallet: string;
  referrerRound: number;
  entries: Entry[];
  createdAt: string;
  updatedAt: string;
};

type FormRow = {
  x: string;
  discord: string;
  wallet: string;
};

const EMPTY_ROW: FormRow = { x: "", discord: "", wallet: "" };

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export default function ReferralPage() {
  const hasHydrated = useStore((s) => s._hasHydrated);
  const applicationStatus = useStore((s) => s.applicationStatus);
  const submittedWallet = useStore((s) => s.submittedWallet);
  const submitIdentity = useStore((s) => s.submitIdentity);
  const twitterHandle = useStore((s) => s.twitterHandle);
  const round = useRound();

  // Identity wallet — the wallet whose summoning slate this page is
  // viewing. Defaults to the persisted submittedWallet (set when the
  // user filed their HIGH ORDER application or completed the tasks
  // form). If neither has happened, the page asks for a wallet first.
  const [identityWallet, setIdentityWallet] = useState<string | null>(null);
  const [walletLookup, setWalletLookup] = useState("");
  const [walletLookupError, setWalletLookupError] = useState<string | null>(null);
  useEffect(() => {
    if (submittedWallet) setIdentityWallet(submittedWallet);
  }, [submittedWallet]);

  // Post-void clearance hint — flips the status tag from "200 / clearance"
  // to "200 / clearance: partial" once the user has been deeper.
  const [voidSeen, setVoidSeen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setVoidSeen(localStorage.getItem("void_seen") === "true");
  }, []);

  // Server state: existing submission (if any) for this wallet.
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state: five draft rows the user fills in.
  const [rows, setRows] = useState<FormRow[]>([
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Soft acknowledgement on slot row tap (touch UX).
  const [slotHint, setSlotHint] = useState(false);
  const slotHintTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (slotHintTimer.current !== null) clearTimeout(slotHintTimer.current);
    },
    []
  );

  // Read existing submission on mount + whenever the identity wallet changes.
  const refresh = useCallback(async () => {
    if (!identityWallet) return;
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(`/api/referrals?wallet=${identityWallet}`, { cache: "no-store" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `http_${r.status}`);
      }
      const j = (await r.json()) as { submission: Submission | null };
      setSubmission(j.submission);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [identityWallet]);
  useEffect(() => { refresh(); }, [refresh]);

  // Also refresh the user's application status from the server, so the
  // ACCESS DENIED gate reflects the latest verdict for this wallet —
  // important now that there's no auto-connect to drive the apply page
  // refresh effect.
  const approveApplication = useStore((s) => s.approveApplication);
  const rejectApplication  = useStore((s) => s.rejectApplication);
  const submitApplicationAct = useStore((s) => s.submitApplication);
  const resetApplication = useStore((s) => s.resetApplication);
  useEffect(() => {
    if (!identityWallet) return;
    let cancelled = false;
    fetch(`/api/application?wallet=${identityWallet}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const s = j?.application?.status as
          | "pending" | "approved" | "rejected" | undefined;
        if (s === "approved") approveApplication();
        else if (s === "rejected") rejectApplication();
        else if (s === "pending") submitApplicationAct();
        else resetApplication();
      })
      .catch(() => { /* leave existing status */ });
    return () => { cancelled = true; };
  }, [identityWallet, approveApplication, rejectApplication, submitApplicationAct, resetApplication]);

  function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWalletLookupError(null);
    const w = walletLookup.trim().toLowerCase();
    if (!isWallet(w)) {
      setWalletLookupError("invalid wallet — paste a 0x… ApeChain address");
      return;
    }
    setIdentityWallet(w);
    // Persist as the canonical wallet so other pages pick it up too.
    // Use the existing submitIdentity action; if no twitter is recorded
    // yet, leave the placeholder so the apply form can fill it later.
    submitIdentity(w, twitterHandle ?? "");
  }

  // ── HYDRATION GUARD ───────────────────────────────────────────
  if (!hasHydrated) {
    return (
      <p className="font-mono text-xxs text-mute uppercase tracking-widest2">
        &gt; restoring session<span className="blink">_</span>
      </p>
    );
  }

  // ── NO IDENTITY YET — ASK FOR WALLET ─────────────────────────
  // Without a connected wallet, we need the user's wallet address to
  // look up their HIGH ORDER status and existing summoning slate.
  if (!identityWallet) {
    return (
      <div className="max-w-[640px] tilt-l">
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-elec mb-2">
          ── status / 100 / identify ──
        </p>
        <h1 className="headline text-[32px] sm:text-6xl leading-tight mb-3">
          identify yourself<span className="blink text-bleed">.</span>
        </h1>
        <p className="font-serif italic text-base text-ape-200 mb-6">
          paste your ape-chain wallet to view your summoning.
        </p>
        <div className="divider-glitch max-w-[280px] mb-6" aria-hidden />
        <form onSubmit={handleLookupSubmit} className="space-y-3 max-w-[480px]">
          <input
            type="text"
            className="field font-mono"
            placeholder="0x..."
            value={walletLookup}
            onChange={(e) => setWalletLookup(e.target.value)}
            maxLength={64}
            aria-label="wallet address"
            autoFocus
          />
          {walletLookupError && (
            <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">
              error: {walletLookupError}
            </div>
          )}
          <button
            type="submit"
            className="text-link"
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
          >
            [ identify ]
          </button>
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute pt-2">
            // no browser wallet required. paste only.
          </p>
        </form>
        <p className="font-mono text-xs text-mute leading-relaxed mt-8">
          haven&rsquo;t filed yet?{" "}
          <a href="/dashboard/apply" className="text-link">
            &gt; enter the high order
          </a>
        </p>
      </div>
    );
  }

  // ── LOCK STATE — ACCESS DENIED ───────────────────────────────
  if (applicationStatus !== "approved") {
    return (
      <div className="max-w-[640px] tilt-l">
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed mb-2">
          ── status / 401 ──
        </p>
        <h1 className="headline text-[32px] sm:text-6xl leading-tight text-bleed mb-3">
          access denied<span className="blink">.</span>
        </h1>
        <p className="font-serif italic text-base text-ape-200 mb-3">
          you are not permitted to summon.
        </p>
        <p className="font-mono text-xxs uppercase tracking-widest2 text-mute mb-6 break-all">
          // wallet: {identityWallet}{" "}
          <button
            type="button"
            onClick={() => { setIdentityWallet(null); setWalletLookup(""); }}
            className="text-ape-300 underline"
          >
            change
          </button>
        </p>
        <div className="divider-glitch max-w-[280px] mb-8" aria-hidden />
        <p className="font-mono text-xs text-mute leading-relaxed mb-6">
          the FIVE SUMMONING is reserved for those the order has already
          recognised. enter the HIGH ORDER. wait. the simians are not
          in a hurry.
        </p>
        <a href="/dashboard/apply" className="text-link">
          &gt; enter the high order
        </a>
      </div>
    );
  }

  // ── COMMON HEADER ────────────────────────────────────────────
  // System identifier (THE FIVE SUMMONING) sits in the eyebrow line as
  // a small mono-caps banner. The page TITLE is the imperative — "select
  // your five" — so the user reads the action, not the institution.
  const header = (
    <header>
      <p className="font-mono text-xxxs uppercase tracking-widest2 text-elec mb-2">
        ── status / 200 / clearance{voidSeen && <span className="text-bleed">: partial</span>} ──
      </p>
      <p className="font-mono text-xxs uppercase tracking-widest2 text-bleed mb-3">
        ── the five summoning ──
      </p>
      <h1 className="headline text-[32px] sm:text-6xl leading-tight mb-2">
        select your five<span className="blink text-bleed">.</span>
      </h1>
      <p className="font-serif italic text-base text-ape-200 mb-2">
        choose carefully.
      </p>
      <p className="font-mono text-xxs uppercase tracking-widest2 text-elec">
        // round {round ?? "—"} access
      </p>
      <p className="font-serif italic text-xs text-mute mt-1">
        no noise. no hand-holding.
      </p>
    </header>
  );

  // ── SUBMITTED VIEW (locked status list) ──────────────────────
  if (submission) {
    const allApproved =
      submission.entries.length === 5 &&
      submission.entries.every((e) => e.status === "approved");
    const anyDecided = submission.entries.some((e) => e.status !== "pending");

    return (
      <div className="max-w-[680px] space-y-10">
        {header}

        <div className="divider-glitch" aria-hidden />

        {/* SLOT STATUS — five entries with their decision state */}
        <section>
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-3">
            ── five summoned for round {submission.referrerRound} ──
          </p>

          {/* Slot circles — count of recognised/pending shows at a glance */}
          <SlotRow entries={submission.entries} onTap={() => {
            if (slotHintTimer.current !== null) clearTimeout(slotHintTimer.current);
            setSlotHint(true);
            slotHintTimer.current = window.setTimeout(() => setSlotHint(false), 1600);
          }} />

          <p className="font-mono text-sm uppercase tracking-widest2 text-bone mt-4">
            {submission.entries.filter((e) => e.status === "approved").length} / {submission.entries.length}{" "}
            <span className="text-mute">recognised</span>
          </p>
          {slotHint ? (
            <p className="reveal font-mono text-xs uppercase tracking-widest2 text-bleed mt-1">
              &gt; chosen carefully
            </p>
          ) : (
            <p className="font-serif italic text-sm text-mute mt-1">
              {anyDecided ? "the order has decided." : "awaiting the order's recognition."}
            </p>
          )}

          {allApproved && (
            <p
              className="reveal mt-4 t-display italic text-2xl sm:text-3xl text-bleed"
              style={{ transform: "rotate(-0.6deg)" }}
            >
              you have influence<span className="blink">.</span>
            </p>
          )}
        </section>

        <div className="divider-noise" aria-hidden />

        {/* ENTRY LIST — per-row decision visible */}
        <section>
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-3">
            ── log / your five ──
          </p>
          <ul className="font-mono text-xs space-y-[3px]">
            {submission.entries.map((e, i) => (
              <EntryLine key={`${e.wallet}-${i}`} entry={e} />
            ))}
          </ul>
        </section>

        <div className="flex items-baseline gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => openTweet(TWEETS.summoned())}
            className="text-link"
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
          >
            [ share on x ]
          </button>
          <span className="font-serif italic text-xs text-mute">
            without naming names.
          </span>
        </div>

        {!OPENSEA_HIDDEN && (
          <p className="font-mono text-xxs uppercase tracking-widest2 text-mute -mt-2">
            // secondary market live —{" "}
            <OpenseaLink source="referral" className="text-link">
              [ view on opensea ↗ ]
            </OpenseaLink>
          </p>
        )}

        <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute pt-4 border-t border-border">
          summoned {submission.createdAt.replace("T", " ").slice(0, 16)} utc · last
          verdict {submission.updatedAt.replace("T", " ").slice(0, 16)} utc
        </p>
      </div>
    );
  }

  // ── FORM VIEW (no submission yet) ────────────────────────────
  function updateRow(idx: number, field: keyof FormRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function clientValidate(): { ok: true; entries: FormRow[] } | { ok: false; error: string } {
    if (!identityWallet) return { ok: false, error: "identify your wallet first" };
    // Filter to filled rows — at least one must have content.
    const filled = rows
      .map((r) => ({
        x: r.x.trim().replace(/^@+/, ""),
        discord: r.discord.trim(),
        wallet: r.wallet.trim().toLowerCase(),
      }))
      .filter((r) => r.x || r.discord || r.wallet);
    if (filled.length === 0) return { ok: false, error: "fill at least one row" };
    if (filled.length > 5) return { ok: false, error: "max 5 entries" };
    const seen = new Set<string>();
    for (let i = 0; i < filled.length; i++) {
      const r = filled[i];
      if (!isWallet(r.wallet)) {
        return { ok: false, error: `row ${i + 1}: invalid wallet` };
      }
      if (r.wallet === identityWallet.toLowerCase()) {
        return { ok: false, error: `row ${i + 1}: cannot select your own wallet` };
      }
      if (seen.has(r.wallet)) {
        return { ok: false, error: `row ${i + 1}: duplicate wallet` };
      }
      seen.add(r.wallet);
      if (!r.x) return { ok: false, error: `row ${i + 1}: x handle required` };
      if (!r.discord) return { ok: false, error: `row ${i + 1}: discord required` };
    }
    return { ok: true, entries: filled };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const v = clientValidate();
    if (!v.ok) {
      setSubmitError(v.error);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/referrals/submit-list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: identityWallet,
          entries: v.entries,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSubmitError(j.error || `http_${r.status}`);
      } else {
        setSubmission(j.submission as Submission);
      }
    } catch {
      setSubmitError("network_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[760px] space-y-10">
      {header}

      <div className="divider-glitch" aria-hidden />

      <section>
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-4">
          ── round {round ?? "—"} · max 5 entries ──
        </p>

        {loadError && (
          <p className="font-mono text-xs text-bleed mb-4">
            &gt; load failed: {loadError}
          </p>
        )}
        {loading && !submission && (
          <p className="font-mono text-xs text-mute mb-4">
            &gt; resolving<span className="blink">_</span>
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          {rows.map((r, i) => (
            <RowInput
              key={i}
              index={i}
              row={r}
              onChange={(field, value) => updateRow(i, field, value)}
              disabled={submitting}
            />
          ))}

          {submitError && (
            <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">
              error: {submitError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              type="submit"
              disabled={submitting || !identityWallet}
              className="text-link"
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
            >
              [ {submitting ? "summoning…" : "summon them"} ]
            </button>
            <span className="font-serif italic text-xs text-mute">
              the order will respond when ready.
            </span>
          </div>
        </form>
      </section>

      {!OPENSEA_HIDDEN && (
        <p className="font-mono text-xxs uppercase tracking-widest2 text-mute -mt-2">
          // secondary market live —{" "}
          <OpenseaLink source="referral" className="text-link">
            [ view on opensea ↗ ]
          </OpenseaLink>
        </p>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function RowInput({
  index,
  row,
  onChange,
  disabled,
}: {
  index: number;
  row: FormRow;
  onChange: (field: keyof FormRow, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="border-l-2 border-border pl-3 py-1 hover:border-elec transition-colors">
      <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-1">
        ── slot {String(index + 1).padStart(2, "0")} ──
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <input
          type="text"
          className="field font-mono"
          placeholder="@x handle"
          value={row.x}
          onChange={(e) => onChange("x", e.target.value)}
          disabled={disabled}
          maxLength={64}
          aria-label={`row ${index + 1} x handle`}
        />
        <input
          type="text"
          className="field font-mono"
          placeholder="discord username"
          value={row.discord}
          onChange={(e) => onChange("discord", e.target.value)}
          disabled={disabled}
          maxLength={64}
          aria-label={`row ${index + 1} discord`}
        />
        <input
          type="text"
          className="field font-mono"
          placeholder="0x..."
          value={row.wallet}
          onChange={(e) => onChange("wallet", e.target.value)}
          disabled={disabled}
          maxLength={64}
          aria-label={`row ${index + 1} wallet`}
        />
      </div>
    </div>
  );
}

const SLOT_RADII = [
  "51% 49% 53% 47% / 49% 53% 47% 51%",
  "47% 53% 49% 51% / 51% 47% 53% 49%",
  "53% 47% 51% 49% / 47% 51% 49% 53%",
  "49% 51% 47% 53% / 53% 49% 51% 47%",
  "52% 48% 50% 50% / 48% 52% 50% 50%",
];
const SLOT_TILTS = [-3, 1.5, -1.2, 2.4, -2];

function SlotRow({
  entries,
  onTap,
}: {
  entries: Entry[];
  onTap: () => void;
}) {
  // Pad to 5 visible slots even if fewer were submitted.
  const slots = Array.from({ length: 5 }, (_, i) => entries[i] ?? null);
  return (
    <div
      className="flex items-center gap-3 sm:gap-4 flex-wrap cursor-pointer select-none"
      onClick={onTap}
      role="button"
      aria-label="submitted slots — five total"
    >
      {slots.map((e, i) => (
        <Slot key={i} entry={e} index={i} />
      ))}
    </div>
  );
}

function Slot({ entry, index }: { entry: Entry | null; index: number }) {
  const radius = SLOT_RADII[index % SLOT_RADII.length];
  const tilt = SLOT_TILTS[index % SLOT_TILTS.length];
  const status = entry?.status ?? null;

  // Visual rules:
  //   no entry / null  → dashed mute outline
  //   pending          → solid blue, no glow yet
  //   approved         → solid blue + electric-blue glow + red border
  //   rejected         → outlined red, dimmed
  let bg = "transparent";
  let border = "1px dashed #1a1a28";
  let shadow: string | undefined;
  let inner: React.ReactNode = null;
  if (status === "pending") {
    bg = "#0040ff";
    border = "1px solid #1a1a28";
  } else if (status === "approved") {
    bg = "#0040ff";
    border = "1px solid #ff2d2d";
    shadow = "0 0 14px rgba(0,64,255,0.55), inset 0 0 6px rgba(0,0,0,0.6)";
    inner = (
      <span
        className="block w-2 h-2"
        style={{
          borderRadius: "49% 51% 47% 53% / 51% 49% 53% 47%",
          background: "#fff",
          boxShadow: "0 0 6px #fff",
        }}
      />
    );
  } else if (status === "rejected") {
    bg = "transparent";
    border = "1px solid #ff2d2d";
  }

  return (
    <div
      aria-label={status ? `slot ${index + 1} ${status}` : `slot ${index + 1} empty`}
      className="relative inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14"
      style={{
        borderRadius: radius,
        transform: `rotate(${tilt}deg)`,
        background: bg,
        border,
        boxShadow: shadow,
        opacity: status === "rejected" ? 0.45 : 1,
        transition: "background 200ms ease, box-shadow 200ms ease",
      }}
    >
      {inner}
    </div>
  );
}

function EntryLine({ entry }: { entry: Entry }) {
  const statusClass =
    entry.status === "approved"
      ? "text-elec"
      : entry.status === "rejected"
      ? "text-bleed"
      : "text-bone";
  const wallet =
    entry.wallet.length > 12
      ? `${entry.wallet.slice(0, 6)}…${entry.wallet.slice(-4)}`
      : entry.wallet;
  // Map raw status → mystical verdict word.
  const verdict =
    entry.status === "approved" ? "recognised"
      : entry.status === "rejected" ? "refused"
      : "awaiting";
  return (
    <li className="row-hover px-1">
      <span className="text-mute">&gt;&nbsp;</span>
      <span className="text-bone">{wallet}</span>
      <span className="text-mute"> &mdash; </span>
      <span className="text-bone">@{entry.x}</span>
      <span className="text-mute"> / </span>
      <span className="text-bone">{entry.discord}</span>
      <span className="text-mute"> &mdash; </span>
      <span className={statusClass}>{verdict}</span>
    </li>
  );
}
