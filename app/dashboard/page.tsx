"use client";

import Link from "next/link";
import Panel from "@/components/Panel";
import ActivityFeed from "@/components/ActivityFeed";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/Button";
import { useStore } from "@/lib/store";

export default function DashboardPage() {
  const {
    walletConnected,
    applicationStatus,
    tasksCompleted,
    fcfsApproved,
    referralCount,
    referralLimit,
    mintEligible,
    fcfsRemaining,
  } = useStore();

  const appBadge =
    applicationStatus === "approved" ? <StatusBadge status="Approved" /> :
    applicationStatus === "pending" ? <StatusBadge status="Pending" /> :
    applicationStatus === "rejected" ? <StatusBadge status="Rejected" /> :
    <StatusBadge status="Open" />;

  return (
    <div className="space-y-3">
      <Panel
        title="Welcome, primate"
        right={appBadge}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-ape-100 text-base font-bold uppercase tracking-wide">
              {walletConnected ? "the order recognises you." : "the order does not yet know you."}
            </div>
            <div className="text-xxs text-mute">
              tasks: {tasksCompleted ? "complete" : "open"} &middot;
              fcfs: {fcfsApproved ? "granted" : `${fcfsRemaining} left`} &middot;
              referrals: {referralCount}/{referralLimit} &middot;
              mint: {mintEligible ? "eligible" : "locked"}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/tasks"><Button variant="primary">Open Tasks</Button></Link>
            <Link href="/dashboard/mint"><Button>Go to Mint</Button></Link>
          </div>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-3 gap-3">
        <Panel title="Application">
          <div className="text-xs text-ape-100 capitalize">{applicationStatus === "none" ? "not submitted" : applicationStatus}</div>
          <div className="mt-1">{appBadge}</div>
          <div className="text-xxs text-mute mt-2">
            <Link href="/dashboard/apply" className="no-underline text-ape-300">manage &rarr;</Link>
          </div>
        </Panel>
        <Panel title="Tasks">
          <div className="text-xs text-ape-100">{tasksCompleted ? "complete" : "in progress"}</div>
          <div className="mt-1"><StatusBadge status={tasksCompleted ? "Done" : "Open"} /></div>
          <div className="text-xxs text-mute mt-2">
            <Link href="/dashboard/tasks" className="no-underline text-ape-300">open quest log &rarr;</Link>
          </div>
        </Panel>
        <Panel title="Referrals">
          <div className="text-xs text-ape-100">{referralCount} / {referralLimit} slots</div>
          <div className="mt-1"><StatusBadge status={applicationStatus === "approved" ? "Open" : "Locked"} /></div>
          <div className="text-xxs text-mute mt-2">
            <Link href="/dashboard/referral" className="no-underline text-ape-300">share link &rarr;</Link>
          </div>
        </Panel>
      </div>

      <ActivityFeed />
    </div>
  );
}
