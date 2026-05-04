"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { useStore } from "@/lib/store";

import { TASK_LINKS, SOCIAL } from "@/lib/links";

// All quest links live in lib/links.ts. PINNED_TWEET_URL there still points
// at the X profile — update it to the actual pinned tweet status URL once
// it exists. The contract is "user-driven completion" — clicking OPEN
// just records `opened`, no API verification.
const X_PROFILE_URL = TASK_LINKS.X_PROFILE;
const PINNED_TWEET_URL = TASK_LINKS.PINNED_TWEET;
const DISCORD_URL = TASK_LINKS.DISCORD;

type Task = {
  id: string;
  label: string;
  url: string;
};

/**
 * Active quest list. Currently EMPTY — the order will publish tasks
 * here when a new round opens. While empty, the page renders a
 * "no active tasks" placeholder and the FCFS auto-claim is gated off.
 *
 * To re-enable, uncomment the entries below (or add new ones). Each
 * entry should have a unique `id`, a short `label`, and a `url` the
 * "Open" button will load in a new tab.
 *
 *   { id: "follow",  label: "Follow @SimianOrder on X",     url: X_PROFILE_URL },
 *   { id: "retweet", label: "Retweet pinned post",          url: PINNED_TWEET_URL },
 *   { id: "discord", label: "Join the Discord server",      url: DISCORD_URL },
 *   { id: "tag",     label: "Tag 3 friends in pinned post", url: PINNED_TWEET_URL },
 */
const TASKS: Task[] = [];

// Convenience flag — when true the legacy checklist + identity form +
// auto-FCFS-grant flow renders. When false, the page shows just a
// quiet "tasks coming soon" placeholder and nothing else.
const HAS_TASKS = TASKS.length > 0;

export default function TasksPage() {
  const hasHydrated = useStore((s) => s._hasHydrated);
  const {
    markTaskOpened,
    markTaskCompleted,
    submitIdentity,
    clearIdentity,
    setTasksCompleted,
  } = useStore();
  const taskStateRaw = useStore((s) => s.taskState);
  const twitterHandleRaw = useStore((s) => s.twitterHandle);
  const submittedWalletRaw = useStore((s) => s.submittedWallet);
  const tasksCompletedRaw = useStore((s) => s.tasksCompleted);
  // Match SSR (empty defaults) until rehydration completes — avoids
  // React hydration errors #418/#423/#425.
  const taskState = hasHydrated ? taskStateRaw : ({} as typeof taskStateRaw);
  const twitterHandle = hasHydrated ? twitterHandleRaw : null;
  const submittedWallet = hasHydrated ? submittedWalletRaw : null;
  const tasksCompleted = hasHydrated ? tasksCompletedRaw : false;

  // Local form state — pre-filled from the persisted identity. Identity is
  // user-entered (no wallet connection); the form below collects it.
  const [walletDraft, setWalletDraft] = useState("");
  const [twitterDraft, setTwitterDraft] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);

  // FCFS auto-claim state. Fires once per session when both gates are
  // satisfied (allDone + identity submitted). Hits POST /api/fcfs/grant,
  // which books an FCFS slot for the wallet and returns the shared drop
  // code. A ref prevents duplicate submits across renders.
  const grantPostedRef = useRef(false);
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantedCode, setGrantedCode] = useState<string | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

  // Pre-fill form from persisted store identity (apply or tasks form).
  useEffect(() => {
    if (!walletDraft) setWalletDraft(submittedWallet || "");
    if (!twitterDraft && twitterHandle) setTwitterDraft("@" + twitterHandle);
  }, [submittedWallet, twitterHandle]); // eslint-disable-line

  // Compose tasks with their store flags.
  const tasks = TASKS.map((t) => {
    const flags = taskState[t.id] || { opened: false, completed: false };
    return { ...t, opened: flags.opened, completed: flags.completed };
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  // `allDone` only counts when there are real tasks to complete —
  // an empty list shouldn't trip the auto-FCFS grant.
  const allDone = HAS_TASKS && completedCount === total;
  const identitySubmitted = !!submittedWallet && !!twitterHandle;

  // Sync the legacy `tasksCompleted` flag.
  useEffect(() => {
    if (allDone !== tasksCompleted) setTasksCompleted(allDone);
  }, [allDone, tasksCompleted, setTasksCompleted]);

  // FCFS auto-claim: when a user finishes every task AND submits their
  // identity, register their wallet in the FCFS pool. The endpoint is
  // idempotent — re-firing returns the same drop code, so users who
  // come back later still see their code.
  useEffect(() => {
    if (!allDone || !identitySubmitted) return;
    if (grantPostedRef.current) return;
    const wallet = submittedWallet;
    if (!wallet) return;

    grantPostedRef.current = true;
    setGrantSubmitting(true);
    setGrantError(null);
    fetch("/api/fcfs/grant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok && typeof j.code === "string") {
          setGrantedCode(j.code);
        } else {
          setGrantError((j && j.error) || `http_${r.status}`);
          grantPostedRef.current = false; // allow retry on transient failure
        }
      })
      .catch(() => {
        setGrantError("network_error");
        grantPostedRef.current = false;
      })
      .finally(() => setGrantSubmitting(false));
  }, [allDone, identitySubmitted, submittedWallet]);

  function open(task: Task) {
    if (typeof window !== "undefined") window.open(task.url, "_blank", "noopener,noreferrer");
    markTaskOpened(task.id);
  }

  function complete(task: Task) {
    markTaskCompleted(task.id);
  }

  function isWalletAddr(s: string) {
    return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setIdentityError(null);
    const w = walletDraft.trim();
    const t = twitterDraft.trim();
    if (!isWalletAddr(w)) {
      setIdentityError("invalid wallet address");
      return;
    }
    if (t.replace(/^@+/, "").length < 1) {
      setIdentityError("X username required");
      return;
    }
    submitIdentity(w, t);
  }

  function clearForm() {
    clearIdentity();
    setWalletDraft("");
    setTwitterDraft("");
    // Allow the auto-claim to fire again if the user re-submits a
    // different identity in this session.
    grantPostedRef.current = false;
    setGrantedCode(null);
    setGrantError(null);
  }

  // Map server-side error codes onto user-facing copy.
  function grantErrorLabel(err: string | null): string | null {
    if (!err) return null;
    switch (err) {
      case "full":                   return "FCFS list is full.";
      case "wallet_in_use":          return "this wallet is already filed elsewhere (high order or summoning).";
      case "invalid_wallet":         return "invalid wallet — paste a 0x… ape-chain address.";
      case "missing_wallet":         return "wallet required.";
      case "rate_limited":           return "too many attempts — wait a moment.";
      default:                       return `error: ${err}`;
    }
  }

  // Empty-tasks state — render a single placeholder panel and bail
  // out before the checklist / identity form would render.
  if (!HAS_TASKS) {
    return (
      <div className="space-y-3">
        <Panel title="Quest Log" right={<span className="text-mute">— / —</span>}>
          <p className="font-serif italic text-sm text-ape-100 leading-relaxed mb-2">
            no active tasks.
          </p>
          <p className="text-xxs text-mute uppercase tracking-wide leading-relaxed">
            // the order will publish tasks here when a new round opens.
            <br />
            // completing them auto-books an FCFS slot.
          </p>
          <div className="divider-glitch max-w-[220px] my-4" aria-hidden />
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed">
            check back soon.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-3">
        <Panel title="Quest Log" right={<span>{completedCount}/{total} complete</span>}>
          <div className="text-xxs text-mute mb-2">
            open the link, then mark complete. finishing every task auto-books your FCFS slot.
          </div>
          <div className="h-2 w-full bg-ape-950 border border-border">
            <div
              className="h-full bg-ape-500 transition-all"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>

          {allDone && !identitySubmitted && (
            <div className="mt-3 border border-ape-500 bg-ape-900 px-2 py-2 text-xs text-ape-200 uppercase tracking-wide">
              one step left — submit identity below to lock in your FCFS slot.
            </div>
          )}

          {/* Easter egg — quietly fades in once every task is done.
              Independent of identity submission so the user sees it
              the moment they finish the last task. */}
          {allDone && (
            <p
              className="mt-3 reveal font-serif italic text-sm text-bleed text-right tilt-r"
              aria-hidden
            >
              &mdash; you have been observed.
            </p>
          )}
        </Panel>

        <Panel title="Checklist" padded={false}>
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <li key={t.id} className="px-3 py-3 flex items-center gap-3 flex-wrap">
                <span
                  className={`w-4 h-4 border ${
                    t.completed
                      ? "bg-ape-500 border-ape-300"
                      : t.opened
                      ? "bg-ape-800 border-ape-500"
                      : "bg-ape-950 border-border"
                  } flex items-center justify-center text-white text-xxs shrink-0 font-bold select-none pointer-events-none`}
                  aria-hidden
                >
                  {t.completed ? "x" : t.opened ? "·" : ""}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${t.completed ? "text-mute line-through" : "text-ape-100"}`}>
                    {t.label}
                  </div>
                  <div className="text-xxs text-mute uppercase tracking-wide">
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-ape-300">
                      {new URL(t.url).host}↗
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.completed ? (
                    <StatusBadge status="Done" />
                  ) : !t.opened ? (
                    <Button onClick={() => open(t)}>Open</Button>
                  ) : (
                    <Button variant="primary" onClick={() => complete(t)}>Complete</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Submit Identity">
          {identitySubmitted ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status="Done" />
                <span className="text-xxs uppercase tracking-wide text-mute">
                  identity recorded
                </span>
                {allDone && grantedCode && (
                  <span
                    className="badge text-bleed"
                    aria-label="fcfs slot granted"
                    style={{ letterSpacing: "0.22em" }}
                  >
                    FCFS · GRANTED
                  </span>
                )}
                {allDone && grantSubmitting && (
                  <span className="text-xxs uppercase tracking-wide text-mute font-mono">
                    booking your slot…
                  </span>
                )}
              </div>
              <dl className="text-xxs grid grid-cols-[120px_1fr] gap-y-1">
                <dt className="text-mute uppercase">x handle</dt>
                <dd className="text-ape-100">@{twitterHandle}</dd>
                <dt className="text-mute uppercase">wallet</dt>
                <dd className="text-ape-100 font-mono break-all">{submittedWallet}</dd>
              </dl>

              {/* Code reveal — shown only after the auto-grant succeeds. */}
              {allDone && grantedCode && (
                <div className="space-y-2 pt-1">
                  <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
                    ── your fcfs code ──
                  </p>
                  <div
                    className="font-mono text-2xl sm:text-3xl tracking-[0.18em] text-bleed select-all py-1"
                    aria-label="your fcfs drop code"
                  >
                    {grantedCode}
                  </div>
                  <ol className="font-mono text-xs text-ape-100 space-y-2 leading-relaxed">
                    <li>
                      <span className="text-mute">01.</span>{" "}
                      join our discord —{" "}
                      <a
                        href={SOCIAL.DISCORD}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-elec underline hover:text-bone"
                      >
                        {SOCIAL.DISCORD.replace(/^https?:\/\//, "")}
                      </a>
                    </li>
                    <li>
                      <span className="text-mute">02.</span>{" "}
                      submit this code in discord to access the server.
                    </li>
                  </ol>
                </div>
              )}

              {allDone && grantError && (
                <p className="font-mono text-xxs text-bleed uppercase tracking-wide">
                  // could not book slot: {grantErrorLabel(grantError)}
                </p>
              )}

              <Button variant="ghost" onClick={clearForm}>Edit</Button>
            </div>
          ) : (
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <label className="label">x / twitter username</label>
                <input
                  className="field"
                  placeholder="@yourhandle"
                  value={twitterDraft}
                  onChange={(e) => setTwitterDraft(e.target.value)}
                  required
                  maxLength={64}
                />
              </div>

              <div>
                <label className="label">ape-chain wallet</label>
                <input
                  className="field font-mono"
                  placeholder="0x..."
                  value={walletDraft}
                  onChange={(e) => setWalletDraft(e.target.value)}
                  required
                  maxLength={64}
                />
                <div className="text-xxs text-mute mt-1">
                  paste your ape-chain wallet address. no browser wallet required.
                </div>
              </div>

              {identityError && (
                <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">
                  error: {identityError}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Button type="submit" variant="primary">Submit</Button>
                <span className="text-xxs text-mute">
                  {allDone
                    ? "submit to lock in your FCFS slot."
                    : `${total - completedCount} task${total - completedCount === 1 ? "" : "s"} remaining — submit anytime.`}
                </span>
              </div>
              <div className="text-xxs text-mute">
                identity is stored locally. completion is user-driven — there is no
                Twitter or Discord verification.
              </div>
            </form>
          )}
        </Panel>
      </div>
  );
}
