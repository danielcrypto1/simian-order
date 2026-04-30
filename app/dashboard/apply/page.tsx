"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { TWEETS, openTweet } from "@/lib/twitterShare";
import { useRound, fetchRound } from "@/lib/useRound";
import RoundHistory from "@/components/RoundHistory";

type Status = "idle" | "loading" | "submitting" | "submitted" | "error";
type ServerApp = {
  id: string;
  wallet: string;
  twitter: string;
  why: string | null;
  discord: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

const STORY_MAX = 1500;
const STORY_MIN = 60;

/**
 * Four-pillar qualification manifesto rendered above the form.
 * Each pillar is one short imperative line — no marketing copy. The
 * tone is dossier, not landing-page.
 */
const PILLARS: { num: string; title: string; line: string }[] = [
  {
    num: "I.",
    title: "PROVEN DEGEN STATUS",
    line: "scars over hype. the chain remembers your address.",
  },
  {
    num: "II.",
    title: "APECHAIN ALIGNMENT",
    line: "home is not a buzzword. you live here.",
  },
  {
    num: "III.",
    title: "DISCIPLINE OVER EMOTION",
    line: "you sold green and held red — both with steady hands.",
  },
  {
    num: "IV.",
    title: "UNDERSTANDING THE ORDER",
    line: "this is not a club. it does not need members.",
  },
];

export default function ApplyPage() {
  const {
    approveApplication, rejectApplication, submitApplication,
    resetApplication, applicationStatus,
    submittedWallet, twitterHandle, submitIdentity,
  } = useStore();
  const round = useRound();

  const [serverApp, setServerApp] = useState<ServerApp | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    handle: "",
    wallet: "",
    why: "",
    discord: "",
  });

  // Public lookup so the post-submission view (and share buttons) persist
  // across reloads. /api/application returns only public-safe fields.
  // Source of "the user's wallet" is the persisted submittedWallet — set
  // by the most recent identity submission (this form, or the tasks form).
  const refresh = useCallback(async (wallet: string | null) => {
    if (!wallet) { setServerApp(null); setStatus("idle"); return; }
    setStatus("loading");
    try {
      const r = await fetch(`/api/application?wallet=${wallet}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j.application) {
          setServerApp({
            id: j.application.id,
            wallet: j.application.wallet,
            twitter: j.application.twitter,
            why: null,
            discord: null,
            status: j.application.status,
            createdAt: j.application.createdAt,
          });
        } else {
          setServerApp(null);
        }
      }
    } catch { /* fall through to idle */ }
    setStatus("idle");
  }, []);

  useEffect(() => { refresh(submittedWallet ?? null); }, [submittedWallet, refresh]);

  // Pre-fill the form from the persisted identity so the user doesn't
  // have to re-type their wallet/handle on every visit.
  useEffect(() => {
    setForm((f) => ({
      ...f,
      wallet: f.wallet || submittedWallet || "",
      handle: f.handle || (twitterHandle ? "@" + twitterHandle : ""),
    }));
    // intentionally only on initial hydration of these store fields
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedWallet, twitterHandle]);

  // Reflect server state into local zustand status display.
  useEffect(() => {
    if (!serverApp) return;
    if (serverApp.status === "approved" && applicationStatus !== "approved") approveApplication();
    else if (serverApp.status === "rejected" && applicationStatus !== "rejected") rejectApplication();
    else if (serverApp.status === "pending" && applicationStatus !== "pending") submitApplication();
  }, [serverApp, applicationStatus, approveApplication, rejectApplication, submitApplication]);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    track("apply_submit");
    const handle = form.handle.trim().replace(/^@+/, "");
    const wallet = form.wallet.trim().toLowerCase();
    const story = form.why.trim();
    if (!isWallet(wallet)) {
      setErrorMsg("invalid wallet — paste a 0x… ApeChain address");
      return;
    }
    if (handle.length < 1) {
      setErrorMsg("X / twitter handle required");
      return;
    }
    if (story.length < STORY_MIN) {
      setErrorMsg(`your story is too short (${story.length} / ${STORY_MIN} chars min)`);
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          twitter: handle,
          discord: form.discord.trim() || null,
          why: story || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `http_${res.status}`);
      // Server is source of truth — reflect the returned application.
      setServerApp(j.application as ServerApp);
      // Persist identity so other pages (referral, dashboard) can look up
      // this wallet's state without re-asking.
      submitIdentity(wallet, handle);
      submitApplication();
      track("apply_success");
      setStatus("submitted");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "submit_failed");
      setStatus("error");
    }
  }

  function reapply() {
    setServerApp(null);
    resetApplication();
    setStatus("idle");
  }

  // Show the post-submission view only if we have actually submitted this
  // session OR the server returned an existing application for this wallet.
  const showSubmittedView = serverApp !== null && status !== "submitting";

  if (showSubmittedView && serverApp) {
    const s = serverApp.status;
    const statusBadge =
      s === "approved" ? <StatusBadge status="Approved" /> :
      s === "rejected" ? <StatusBadge status="Rejected" /> :
      <StatusBadge status="Pending" />;
    // Title carries the round so the user (and any screenshot they share)
    // is anchored to the cycle they were considered in.
    const title =
      s === "approved" ? `Recognised — Round ${round ?? "—"}` :
      // Spec rewrite: rejected users see a softened, round-bound title
      // that doesn't lean into the "rejection" framing.
      s === "rejected" ? `Not Recognised — Round ${round ?? "—"}` :
      `HIGH ORDER — Filed for Round ${round ?? "—"}`;
    // Rejection message is intentionally hedged — "further rounds may
    // open" carries no commitment, satisfies the "do not promise
    // future access" rule.
    const message =
      s === "approved"
        ? "the FIVE SUMMONING is open to you."
        : s === "rejected"
        ? "further rounds may open."
        : "submitted for recognition. the order will respond when ready.";

    return (
      <>
      <Panel title={title} right={statusBadge}>
        <div className="space-y-3">
          {/* Body header — kept brief on approved/pending; rejected
              branch has nothing here so the copy stays minimal and
              the hedged "further rounds may open" carries the line. */}
          {s !== "rejected" && (
            <div className="text-ape-100 text-base font-bold uppercase">
              {s === "approved" ? "recognised." : "submitted."}
            </div>
          )}
          <p className="text-xxs text-mute leading-relaxed">{message}</p>
          <div className="divider-old" />
          <dl className="text-xxs grid grid-cols-[120px_1fr] gap-y-1">
            <dt className="text-mute uppercase">x handle</dt>
            <dd className="text-ape-100">@{serverApp.twitter}</dd>
            <dt className="text-mute uppercase">wallet</dt>
            <dd className="font-mono text-ape-100 break-all">{serverApp.wallet}</dd>
            {serverApp.discord && (<>
              <dt className="text-mute uppercase">discord</dt>
              <dd className="text-ape-100">{serverApp.discord}</dd>
            </>)}
            <dt className="text-mute uppercase">submitted</dt>
            <dd className="text-mute font-mono">{serverApp.createdAt.replace("T", " ").slice(0, 19)} UTC</dd>
          </dl>

          {(s === "approved" || s === "rejected") && (
            <div className="pt-2">
              <div className="text-xxs uppercase tracking-wide text-mute mb-1">
                share the verdict
              </div>
              <Button
                variant="primary"
                onClick={async () => {
                  if (s === "approved") {
                    // Resolve round on demand so the latest admin-set value
                    // is in the tweet even if the page rendered with stale.
                    const r = round ?? (await fetchRound());
                    openTweet(TWEETS.approval(r));
                  } else {
                    openTweet(TWEETS.rejection());
                  }
                }}
              >
                {s === "approved" ? "Share Recognition" : "Share Verdict"}
              </Button>
            </div>
          )}

          {s !== "approved" && (
            <div className="pt-1">
              <Button variant="ghost" onClick={reapply}>Re-submit for Recognition</Button>
            </div>
          )}
        </div>
      </Panel>
      <RoundHistory />
      </>
    );
  }

  const storyLen = form.why.trim().length;
  const storyShort = storyLen > 0 && storyLen < STORY_MIN;

  return (
    <>
    <Panel
      title={`Enter the HIGH ORDER — Round ${round ?? "—"}`}
      right={<span>open</span>}
    >
      {/* Subtle psychological layer — round-bound intake state + scarcity
          cue. Two mono caps lines, electric for "active", red for
          "limited". Reads as system telemetry, not marketing copy.
          Plus a one-line tagline. */}
      <div className="font-mono text-xxxs uppercase tracking-widest2 leading-relaxed mb-3">
        <p className="text-elec">// round {round ?? "—"} recognition active</p>
        <p className="text-bleed">// few will be recognised</p>
      </div>
      <p className="font-serif italic text-xs text-mute mb-6 -mt-1">
        submit for recognition. the order chooses who walks through.
      </p>

      {/* ─── QUALIFICATION CRITERIA ──────────────────────────────────────
          Four-pillar manifesto block. Minimal chrome — a thin top/bottom
          rule, mono caps header, then each pillar on its own row with
          a pixel roman numeral, an uppercase title, and a single italic
          serif line of substance. No card, no gradient, no buttons. */}
      <section
        className="mb-6 border-t border-b border-border py-5 px-1"
        aria-label="HIGH ORDER qualification criteria"
      >
        <div className="flex items-baseline gap-3 mb-4 flex-wrap">
          <span className="font-mono text-xxxs uppercase tracking-widest2 text-bleed">
            ──
          </span>
          <h2 className="font-mono text-xs sm:text-sm uppercase tracking-widest2 text-bone">
            HIGH ORDER &mdash; QUALIFICATION CRITERIA
          </h2>
          <span className="font-mono text-xxxs uppercase tracking-widest2 text-bleed">
            ──
          </span>
        </div>

        <ol className="space-y-4 list-none pl-0">
          {PILLARS.map((p) => (
            <li
              key={p.num}
              className="grid grid-cols-[44px_1fr] sm:grid-cols-[60px_1fr] gap-x-3 sm:gap-x-5 items-baseline"
            >
              <span
                className="font-pixel text-bleed text-xl sm:text-2xl leading-none select-none"
                aria-hidden
              >
                {p.num}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-xs sm:text-sm uppercase tracking-widest2 text-bone leading-tight">
                  {p.title}
                </div>
                <div className="font-serif italic text-xs sm:text-sm text-ape-200 leading-snug mt-1">
                  {p.line}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="divider-glitch max-w-[220px] my-5" aria-hidden />

        {/* FINAL NOTE — italic serif, slight tilt, the only flourish in
            the section. The two lines stand alone; no surrounding chrome. */}
        <div className="tilt-r2">
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-2">
            ── final note ──
          </p>
          <blockquote className="font-serif italic text-base sm:text-lg text-ape-100 leading-snug">
            &ldquo;Not everyone who applies will be accepted.
            <br />
            And not everyone who is accepted will remain.&rdquo;
          </blockquote>
        </div>
      </section>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">x username</label>
            <input
              className="field"
              placeholder="@yourhandle"
              value={form.handle}
              onChange={(e) => update("handle", e.target.value)}
              required
              maxLength={64}
            />
          </div>
          <div>
            <label className="label">discord (optional)</label>
            <input
              className="field"
              placeholder="user#0000"
              value={form.discord}
              onChange={(e) => update("discord", e.target.value)}
              maxLength={64}
            />
          </div>
        </div>

        <div>
          <label className="label">ape-chain wallet</label>
          <input
            className="field font-mono"
            placeholder="0x..."
            value={form.wallet}
            onChange={(e) => update("wallet", e.target.value)}
            required
            maxLength={64}
          />
          <div className="text-xxs text-mute mt-1">
            paste your ape-chain wallet address. no browser wallet required.
          </div>
        </div>

        {/* ── YOUR STORY ──
            The substance of the application. Minimal label, strong
            placeholder that frames the three things the order wants
            to read about. Higher character ceiling so people can
            actually tell the story. */}
        <div>
          <label className="label">your story</label>
          <p className="font-serif italic text-xs text-mute mb-2 -mt-1">
            tell the order, in your own words:
            <br />
            &mdash; how you got rugged.
            <br />
            &mdash; why you stayed.
            <br />
            &mdash; what you have lived through on chain.
          </p>
          <textarea
            className="field min-h-[220px] leading-relaxed"
            placeholder="speak plainly. the order does not reward polish."
            value={form.why}
            onChange={(e) => update("why", e.target.value)}
            maxLength={STORY_MAX}
            required
          />
          <div className="flex items-center justify-between text-xxs mt-1 gap-3 flex-wrap">
            <span className={storyShort ? "text-bleed" : "text-mute"}>
              {storyShort
                ? `${STORY_MIN - storyLen} more characters required.`
                : storyLen === 0
                ? `${STORY_MIN} characters minimum.`
                : "the order reads everything."}
            </span>
            <span className="text-mute font-mono">
              {form.why.length} / {STORY_MAX}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">
            error: {errorMsg}
          </div>
        )}

        <div className="divider-old" />

        <div className="flex items-center gap-2 flex-wrap">
          <Button type="submit" variant="primary" disabled={status === "submitting"}>
            {status === "submitting" ? "Submitting…" : "Submit for Recognition"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setForm({ handle: "", wallet: "", why: "", discord: "" }); setErrorMsg(null); setStatus("idle"); }}
          >
            Reset
          </Button>
          <span className="ml-auto text-xxs text-mute">filed as PENDING. the order reviews manually.</span>
        </div>
      </form>
    </Panel>
    <RoundHistory />
    </>
  );
}
