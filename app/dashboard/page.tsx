"use client";

import Link from "next/link";
import Panel from "@/components/Panel";
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
  } = useStore();

  const appBadge =
    applicationStatus === "approved" ? <StatusBadge status="Approved" /> :
    applicationStatus === "pending" ? <StatusBadge status="Pending" /> :
    applicationStatus === "rejected" ? <StatusBadge status="Rejected" /> :
    <StatusBadge status="Open" />;

  const tasksBadge =
    tasksCompleted ? <StatusBadge status="Done" /> :
    walletConnected ? <StatusBadge status="Open" /> :
    <StatusBadge status="Locked" />;

  const referralsBadge =
    applicationStatus !== "approved" ? <StatusBadge status="Locked" /> :
    referralCount >= referralLimit ? <StatusBadge status="Done" /> :
    <StatusBadge status="Open" />;

  const mintBadge = mintEligible ? <StatusBadge status="Approved" /> : <StatusBadge status="Locked" />;

  return (
    <div className="space-y-4">
      <Panel title="Welcome, primate" right={appBadge}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="text-ape-100 text-lg font-bold uppercase tracking-tight leading-tight">
              {walletConnected ? "the order recognises you." : "the order does not yet know you."}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xxs uppercase tracking-wider text-mute">
              <span>tasks: <span className="text-ape-200">{tasksCompleted ? "complete" : "open"}</span></span>
              <span>fcfs: <span className="text-ape-200">{fcfsApproved ? "granted" : "—"}</span></span>
              <span>referrals: <span className="text-ape-200">{referralCount}/{referralLimit}</span></span>
              <span>mint: <span className="text-ape-200">{mintEligible ? "eligible" : "locked"}</span></span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/dashboard/tasks"><Button variant="primary">Open Tasks</Button></Link>
            <Link href="/dashboard/mint"><Button>Go to Mint</Button></Link>
          </div>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Application"
          value={applicationStatus === "none" ? "not submitted" : applicationStatus}
          badge={appBadge}
          href="/dashboard/apply"
          cta="manage"
        />
        <DashboardCard
          title="Tasks"
          value={tasksCompleted ? "complete" : walletConnected ? "in progress" : "locked"}
          badge={tasksBadge}
          href="/dashboard/tasks"
          cta="open quest log"
        />
        <DashboardCard
          title="Referrals"
          value={`${referralCount} / ${referralLimit} slots`}
          badge={referralsBadge}
          href="/dashboard/referral"
          cta="share link"
        />
        <DashboardCard
          title="Mint"
          value={mintEligible ? "eligible" : "locked"}
          badge={mintBadge}
          href="/dashboard/mint"
          cta="open mint"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  badge,
  href,
  cta,
}: {
  title: string;
  value: string;
  badge: React.ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <Link href={href} className="no-underline group block">
      <div className="panel hover-flicker transition-colors hover:bg-ape-850 h-full">
        <div className="panel-header">
          <span>:: {title}</span>
        </div>
        <div className="p-3 space-y-3">
          <div className="text-ape-100 text-sm font-bold uppercase tracking-wide capitalize leading-tight">
            {value}
          </div>
          <div>{badge}</div>
          <div className="text-xxs text-ape-300 uppercase tracking-widest">
            {cta} &rarr;
          </div>
        </div>
      </div>
    </Link>
  );
}
