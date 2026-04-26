"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import RouteGuard from "@/components/RouteGuard";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";

export default function TasksPage() {
  const {
    walletConnected,
    walletAddress,
    twitterConnected,
    discordJoined,
    retweeted,
    tagged,
    tasksCompleted,
    fcfsApproved,
    fcfsRemaining,
    setTwitterConnected,
    setDiscordJoined,
    setRetweeted,
    setTagged,
    setTasksCompleted,
    tryGrantFcfs,
  } = useStore();

  const { address } = useWallet();
  const [walletInput, setWalletInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const tasks = [
    { id: "twitter", title: "Follow @SimianOrder on X", points: 10, done: twitterConnected, toggle: () => setTwitterConnected(!twitterConnected) },
    { id: "rt", title: "Retweet pinned post", points: 10, done: retweeted, toggle: () => setRetweeted(!retweeted) },
    { id: "discord", title: "Join the Discord server", points: 15, done: discordJoined, toggle: () => setDiscordJoined(!discordJoined) },
    { id: "tag", title: "Tag 3 friends in pinned post", points: 20, done: tagged, toggle: () => setTagged(!tagged) },
    { id: "wallet", title: "Submit ApeChain wallet", points: 5, done: submitted || !!walletAddress, toggle: () => setSubmitted((s) => !s) },
  ];

  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const points = tasks.filter((t) => t.done).reduce((a, t) => a + t.points, 0);
  const allDone = done === total;

  useEffect(() => {
    if (allDone && !tasksCompleted) {
      setTasksCompleted(true);
      tryGrantFcfs();
    } else if (!allDone && tasksCompleted) {
      setTasksCompleted(false);
    }
  }, [allDone, tasksCompleted, setTasksCompleted, tryGrantFcfs]);

  function submitWallet(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <RouteGuard
      allow={walletConnected}
      title="Tasks (locked)"
      reason="connect a wallet to unlock the quest log."
      cta={{ href: "/dashboard", label: "Connect from top bar" }}
    >
      <div className="space-y-3">
        <Panel title="Quest Log" right={<span>{done}/{total} complete</span>}>
          <div className="flex justify-between text-xxs text-mute mb-2">
            <span>complete the rites to ascend</span>
            <span className="text-ape-100">{points} pts earned</span>
          </div>
          <div className="h-2 w-full bg-ape-950 border border-border">
            <div className="h-full bg-ape-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          {allDone && (
            <div className="mt-3 border border-ape-300 bg-ape-800 px-2 py-2 flex items-center justify-between">
              <div className="text-xs text-ape-100 uppercase tracking-wide">
                {fcfsApproved ? "FCFS slot granted" : "FCFS waitlist full"}
              </div>
              <StatusBadge status={fcfsApproved ? "Approved" : "Locked"} />
            </div>
          )}
        </Panel>

        <Panel title="Checklist" padded={false}>
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <li key={t.id} className="row-hover px-3 py-2 flex items-center gap-3">
                <button
                  onClick={t.toggle}
                  aria-label={t.done ? "mark as not done" : "mark as done"}
                  className={`w-4 h-4 border ${t.done ? "bg-ape-500 border-ape-300" : "bg-ape-950 border-border"} flex items-center justify-center text-white text-xxs`}
                >
                  {t.done ? "x" : ""}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${t.done ? "text-mute line-through" : "text-ape-100"}`}>{t.title}</div>
                  <div className="text-xxs text-mute uppercase tracking-wide">+{t.points} pts</div>
                </div>
                <StatusBadge status={t.done ? "Done" : "Open"} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Submit ApeChain Wallet" right={<span>fcfs left: {fcfsRemaining}</span>}>
          {submitted ? (
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={fcfsApproved ? "Approved" : "Pending"} />
              <span className="text-xxs text-ape-200 font-mono break-all">
                {walletInput || address}
              </span>
              <Button variant="ghost" onClick={() => setSubmitted(false)}>Edit</Button>
            </div>
          ) : (
            <form onSubmit={submitWallet} className="space-y-2">
              <label className="label">ape-chain address</label>
              <input
                className="field font-mono"
                placeholder={address || "0x..."}
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button type="submit" variant="primary">Submit</Button>
                {address && (
                  <Button type="button" variant="ghost" onClick={() => setWalletInput(address)}>
                    Use connected
                  </Button>
                )}
              </div>
              <div className="text-xxs text-mute">
                completing all tasks with FCFS spots remaining grants instant approval.
              </div>
            </form>
          )}
        </Panel>
      </div>
    </RouteGuard>
  );
}
