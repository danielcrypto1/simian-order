"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/Button";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";
import OpenseaLink from "@/components/OpenseaLink";
import { OPENSEA_HIDDEN } from "@/lib/links";
import { useRound } from "@/lib/useRound";

/**
 * Dashboard — restructured into a scattered list of "rooms".
 *
 * No card grid, no mint flow. Each module is a raw text block on a thin
 * left border with its own slight tilt and uneven vertical gap — feels
 * like a directory listing, not a SaaS overview. The marketplace lives
 * outside the dashboard (OpenSea) since there is no public mint.
 */

type SubmissionLite = {
  entries: Array<{ status: "pending" | "approved" | "rejected" }>;
} | null;

export default function DashboardPage() {
  const {
    walletConnected,
    applicationStatus,
    tasksCompleted,
  } = useStore();
  const { address } = useWallet();
  const round = useRound();

  // Pull the live submission for this wallet so Room 03 surfaces the
  // server-truth state (no client-side ?count? — the order decides).
  const [submission, setSubmission] = useState<SubmissionLite>(null);
  useEffect(() => {
    if (!address) { setSubmission(null); return; }
    let cancelled = false;
    fetch(`/api/referrals?wallet=${address}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (!cancelled) setSubmission((j?.submission ?? null) as SubmissionLite); })
      .catch(() => { /* offline — leave null, Room 03 stays generic */ });
    return () => { cancelled = true; };
  }, [address]);

  const submittedCount  = submission?.entries.length ?? 0;
  const approvedCount   = submission?.entries.filter((e) => e.status === "approved").length ?? 0;
  const anyDecided      = submission?.entries.some((e) => e.status !== "pending") ?? false;

  const appBadge =
    applicationStatus === "approved" ? <StatusBadge status="Approved" /> :
    applicationStatus === "pending"  ? <StatusBadge status="Pending"  /> :
    applicationStatus === "rejected" ? <StatusBadge status="Rejected" /> :
                                       <StatusBadge status="Open"     />;

  const tasksBadge =
    tasksCompleted ? <StatusBadge status="Done" /> :
    walletConnected ? <StatusBadge status="Open" /> :
                      <StatusBadge status="Locked" />;

  const submissionBadge =
    applicationStatus !== "approved"        ? <StatusBadge status="Locked" /> :
    submission && submittedCount === 5 && approvedCount === 5 ? <StatusBadge status="Done" /> :
    submission                              ? <StatusBadge status="Pending" /> :
                                              <StatusBadge status="Open" />;

  return (
    <div>
      {/* Greeting block — italic serif, off-axis, no panel */}
      <section className="mb-14 tilt-l">
        <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-1">
          // greeting.txt
        </div>
        <h1 className="headline text-[28px] sm:text-5xl leading-tight mb-3">
          {walletConnected
            ? <>the order recognises you<span className="text-bleed">.</span></>
            : <>the order does not yet know you<span className="text-bleed">.</span></>}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          {appBadge}
          <span className="font-serif italic text-sm text-mute">
            &mdash; round {round ?? "—"}, applicants still considered.
          </span>
        </div>
      </section>

      {/* Quick-state strip — courier mono, single line, scrollable on mobile.
          FCFS column dropped (admin-only concern now); replaced with the
          dynamic round indicator. */}
      <section className="mb-16 border-t border-b border-border py-2 overflow-x-auto">
        <div className="flex items-center gap-x-6 font-mono text-xxs uppercase tracking-widest2 whitespace-nowrap">
          <span><span className="text-mute">round:</span> <span className="text-bone">{round ?? "—"}</span></span>
          <span className="text-mute">/</span>
          <span><span className="text-mute">tasks:</span> <span className="text-bone">{tasksCompleted ? "complete" : "open"}</span></span>
          <span className="text-mute">/</span>
          <span>
            <span className="text-mute">your 5:</span>{" "}
            <span className="text-bone">
              {applicationStatus !== "approved"
                ? "locked"
                : submission
                ? `${approvedCount}/${submittedCount} approved`
                : "not submitted"}
            </span>
          </span>
          {!OPENSEA_HIDDEN && (
            <>
              <span className="text-mute">/</span>
              <span><span className="text-mute">market:</span> <span className="text-elec">live (opensea)</span></span>
            </>
          )}
        </div>
      </section>

      {/* Primary CTA cluster — text-link primary + ghost. Off-center.
          The mint button is gone; OpenSea takes its place as a quiet
          text-link wrapped in the glitch exit transition. */}
      <section className="mb-16 ml-2 sm:ml-8 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/dashboard/tasks" className="no-underline">
          <Button variant="primary">&gt;&gt; open tasks</Button>
        </Link>
        {!OPENSEA_HIDDEN && (
          <OpenseaLink source="dashboard-cta" className="text-link">
            view on opensea ↗
          </OpenseaLink>
        )}
        <span className="font-serif italic text-mute text-sm">or wander</span>
      </section>

      {/* "Rooms" — three real entries (mint room removed) plus a quiet
          marketplace pointer at the bottom. */}
      <div className="space-y-12">
        <Room
          n="01"
          tilt="tilt-r"
          marginLeft="ml-0"
          title="application"
          state={applicationStatus === "none" ? "not submitted" : applicationStatus}
          badge={appBadge}
          href="/dashboard/apply"
          cta="manage"
          hint="the order will respond when ready."
        />

        <Room
          n="02"
          tilt="tilt-l"
          marginLeft="ml-6 sm:ml-12"
          title="tasks"
          state={tasksCompleted ? "complete" : walletConnected ? "in progress" : "locked"}
          badge={tasksBadge}
          href="/dashboard/tasks"
          cta="open quest log"
          hint="finish them. quietly."
        />

        <Room
          n="03"
          tilt="tilt-r"
          marginLeft="ml-2 sm:ml-4"
          title="select your 5"
          state={
            applicationStatus !== "approved"
              ? "locked — approval required"
              : !submission
              ? "no submission yet"
              : anyDecided
              ? `${approvedCount}/${submittedCount} approved · awaiting the rest`
              : `${submittedCount} submitted · pending review`
          }
          badge={submissionBadge}
          href="/dashboard/referral"
          cta={submission ? "open submission" : "submit list"}
          hint="five trusted simians. no more. the order decides."
        />

        {/* Room 04 — marketplace pointer. Hidden behind OPENSEA_HIDDEN
            so the dashboard reads as 3 rooms (application/tasks/refs)
            until the marketplace surface is re-enabled. */}
        {!OPENSEA_HIDDEN && (
          <OpenseaLink
            source="dashboard-room"
            className="group block no-underline tilt-l ml-10 sm:ml-20 max-w-[520px] hover-flicker"
          >
            <div className="border-l-2 border-border group-hover:border-elec pl-4 py-1 transition-colors">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-pixel text-bleed text-xl leading-none">04</span>
                <span className="font-mono text-xxs uppercase tracking-widest2 text-bone">
                  market
                </span>
                <span className="ml-auto">
                  <StatusBadge status="Live" />
                </span>
              </div>
              <div className="font-serif italic text-2xl text-bone capitalize leading-tight mb-1">
                available via opensea
              </div>
              <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
                view collection &rarr;
              </div>
              <p className="font-serif italic text-xs text-mute mt-1">
                &mdash; no public mint. entry continues there.
              </p>
            </div>
          </OpenseaLink>
        )}
      </div>
    </div>
  );
}

/** A single dashboard "room" — text block, no panel chrome. */
function Room({
  n,
  tilt,
  marginLeft,
  title,
  state,
  badge,
  href,
  cta,
  hint,
}: {
  n: string;
  tilt: string;
  marginLeft: string;
  title: string;
  state: string;
  badge: React.ReactNode;
  href: string;
  cta: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className={`group block no-underline ${tilt} ${marginLeft} max-w-[520px] hover-flicker`}
    >
      <div className="border-l-2 border-border group-hover:border-elec pl-4 py-1 transition-colors">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-pixel text-bleed text-xl leading-none">{n}</span>
          <span className="font-mono text-xxs uppercase tracking-widest2 text-bone">
            {title}
          </span>
          <span className="ml-auto">{badge}</span>
        </div>
        <div className="font-serif italic text-2xl text-bone capitalize leading-tight mb-1">
          {state}
        </div>
        <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
          {cta} &rarr;
        </div>
        <p className="font-serif italic text-xs text-mute mt-1">— {hint}</p>
      </div>
    </Link>
  );
}
