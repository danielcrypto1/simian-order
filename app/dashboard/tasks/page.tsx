"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import RouteGuard from "@/components/RouteGuard";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";

// All quest links live here. Update PINNED_TWEET_URL once the actual pinned
// tweet exists. The contract is "user-driven completion" — clicking OPEN
// just records `opened`, no API verification.
const X_PROFILE_URL = "https://x.com/SimianOrder";
const PINNED_TWEET_URL = "https://x.com/SimianOrder";
const DISCORD_URL = "https://discord.gg/simian";

type Task = {
  id: string;
  label: string;
  points: number;
  url: string;
};

const TASKS: Task[] = [
  { id: "follow",  label: "Follow @SimianOrder on X",     points: 10, url: X_PROFILE_URL },
  { id: "retweet", label: "Retweet pinned post",          points: 10, url: PINNED_TWEET_URL },
  { id: "discord", label: "Join the Discord server",     points: 15, url: DISCORD_URL },
  { id: "tag",     label: "Tag 3 friends in pinned post", points: 20, url: PINNED_TWEET_URL },
];

export default function TasksPage() {
  const {
    walletConnected,
    walletAddress,
    taskState,
    twitterHandle,
    submittedWallet,
    fcfsApproved,
    tasksCompleted,
    markTaskOpened,
    markTaskCompleted,
    submitIdentity,
    clearIdentity,
    setTasksCompleted,
  } = useStore();

  const { address } = useWallet();

  // Local form state (defaulted to connected wallet + persisted handle).
  const [walletDraft, setWalletDraft] = useState("");
  const [twitterDraft, setTwitterDraft] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [fcfsRemaining, setFcfsRemaining] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const claimedRef = useRef(false);

  // Public FCFS counter for display.
  useEffect(() => {
    let alive = true;
    fetch("/api/claim-fcfs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) setFcfsRemaining(j.remaining); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Pre-fill form from persisted store + connected wallet.
  useEffect(() => {
    if (!walletDraft) setWalletDraft(submittedWallet || address || walletAddress || "");
    if (!twitterDraft && twitterHandle) setTwitterDraft("@" + twitterHandle);
  }, [submittedWallet, twitterHandle, address, walletAddress]); // eslint-disable-line

  // Compose tasks with their store flags.
  const tasks = TASKS.map((t) => {
    const flags = taskState[t.id] || { opened: false, completed: false };
    return { ...t, opened: flags.opened, completed: flags.completed };
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const points = tasks.filter((t) => t.completed).reduce((a, t) => a + t.points, 0);
  const allDone = completedCount === total;
  const identitySubmitted = !!submittedWallet && !!twitterHandle;

  // Sync the legacy `tasksCompleted` flag.
  useEffect(() => {
    if (allDone !== tasksCompleted) setTasksCompleted(allDone);
  }, [allDone, tasksCompleted, setTasksCompleted]);

  // Trigger FCFS claim when both gates are satisfied.
  useEffect(() => {
    if (!allDone || !identitySubmitted) return;
    if (fcfsApproved || claimedRef.current) return;
    const wallet = submittedWallet || address;
    if (!wallet) return;

    claimedRef.current = true;
    setClaiming(true);
    setClaimError(null);
    fetch("/api/claim-fcfs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          useStore.setState({ fcfsApproved: true, mintEligible: true, fcfsRemaining: j.remaining ?? 0 });
          setFcfsRemaining(j.remaining ?? 0);
        } else if (r.status === 409 && j.error === "already_claimed") {
          useStore.setState({ fcfsApproved: true, mintEligible: true });
          setFcfsRemaining(j.remaining ?? null);
        } else {
          setClaimError(j.error || `http_${r.status}`);
          claimedRef.current = false;
        }
      })
      .catch(() => {
        setClaimError("network_error");
        claimedRef.current = false;
      })
      .finally(() => setClaiming(false));
  }, [allDone, identitySubmitted, submittedWallet, address, fcfsApproved]);

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
    setWalletDraft(address || walletAddress || "");
    setTwitterDraft("");
  }

  return (
    <RouteGuard
      allow={walletConnected}
      title="Tasks (locked)"
      reason="connect a wallet to unlock the quest log."
      cta={{ href: "/dashboard", label: "Connect from top bar" }}
    >
      <div className="space-y-3">
        <Panel title="Quest Log" right={<span>{completedCount}/{total} complete</span>}>
          <div className="flex justify-between text-xxs text-mute mb-2">
            <span>open the link, then mark complete.</span>
            <span className="text-ape-100">{points} pts earned</span>
          </div>
          <div className="h-2 w-full bg-ape-950 border border-border">
            <div
              className="h-full bg-ape-500 transition-all"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>

          {allDone && identitySubmitted && (
            <div className="mt-3 border border-ape-300 bg-ape-800 px-2 py-2 flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-ape-100 uppercase tracking-wide">
                {claiming ? "claiming FCFS slot…" :
                 fcfsApproved ? "FCFS slot granted" :
                 claimError ? `claim failed: ${claimError}` :
                 "FCFS waitlist full"}
              </div>
              <StatusBadge status={fcfsApproved ? "Approved" : claiming ? "Pending" : "Locked"} />
            </div>
          )}

          {allDone && !identitySubmitted && (
            <div className="mt-3 border border-ape-500 bg-ape-900 px-2 py-2 text-xs text-ape-200 uppercase tracking-wide">
              one step left — submit identity below to claim FCFS.
            </div>
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
                  } flex items-center justify-center text-white text-xxs shrink-0 font-bold`}
                  aria-hidden
                >
                  {t.completed ? "x" : t.opened ? "·" : ""}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${t.completed ? "text-mute line-through" : "text-ape-100"}`}>
                    {t.label}
                  </div>
                  <div className="text-xxs text-mute uppercase tracking-wide">
                    +{t.points} pts ·{" "}
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

        <Panel
          title="Submit Identity"
          right={<span>fcfs left: {fcfsRemaining ?? "—"}</span>}
        >
          {identitySubmitted ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={fcfsApproved ? "Approved" : "Pending"} />
                <span className="text-xxs uppercase tracking-wide text-mute">
                  identity recorded
                </span>
              </div>
              <dl className="text-xxs grid grid-cols-[120px_1fr] gap-y-1">
                <dt className="text-mute uppercase">x handle</dt>
                <dd className="text-ape-100">@{twitterHandle}</dd>
                <dt className="text-mute uppercase">wallet</dt>
                <dd className="text-ape-100 font-mono break-all">{submittedWallet}</dd>
              </dl>
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
                  placeholder={address || "0x..."}
                  value={walletDraft}
                  onChange={(e) => setWalletDraft(e.target.value)}
                  required
                />
                {address && walletDraft !== address && (
                  <button
                    type="button"
                    onClick={() => setWalletDraft(address)}
                    className="text-xxs text-ape-300 mt-1 underline"
                  >
                    use connected ({address.slice(0, 6)}…{address.slice(-4)})
                  </button>
                )}
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
                    ? "submit to claim FCFS."
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
    </RouteGuard>
  );
}
