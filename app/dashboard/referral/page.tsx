"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import RouteGuard from "@/components/RouteGuard";
import { referredUsers as seedUsers, ReferredUser } from "@/lib/mockData";
import { useStore } from "@/lib/store";

export default function ReferralPage() {
  const {
    applicationStatus,
    referralCount,
    referralLimit,
    referralCode,
    ensureReferralCode,
    addReferral,
    resetReferrals,
  } = useStore();

  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [list, setList] = useState<ReferredUser[]>(seedUsers.slice(0, referralCount || 0));

  useEffect(() => {
    setCode(ensureReferralCode());
  }, [ensureReferralCode]);

  useEffect(() => {
    setList((prev) => prev.slice(0, referralCount));
  }, [referralCount]);

  const link = code ? `https://simian.order/r/${code}` : "https://simian.order/r/...";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  function simulateInvite() {
    if (referralCount >= referralLimit) return;
    const idx = referralCount;
    const seed = seedUsers[idx % seedUsers.length];
    const next: ReferredUser = {
      handle: seed?.handle ?? `@friend${idx + 1}`,
      wallet: seed?.wallet ?? `0x..${idx}${idx}`,
      status: idx % 3 === 1 ? "Pending" : "Approved",
      date: new Date().toISOString().slice(0, 10),
    };
    if (addReferral()) {
      setList((prev) => [...prev, next]);
    }
  }

  function resetAll() {
    resetReferrals();
    setList([]);
  }

  const slots = Array.from({ length: referralLimit }, (_, i) => i < referralCount);
  const pct = (referralCount / referralLimit) * 100;

  return (
    <RouteGuard
      allow={applicationStatus === "approved"}
      title="Referrals (locked)"
      reason="referrals open after your application is approved by the order."
      cta={{ href: "/dashboard/apply", label: "Open Application" }}
    >
      <div className="space-y-3">
        <Panel title="Your Referral Link" right={<span>{referralCount}/{referralLimit} used</span>}>
          <div className="flex items-center gap-2 flex-wrap">
            <input className="field font-mono flex-1 min-w-[260px]" readOnly value={link} />
            <Button variant="primary" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
          </div>
          <div className="h-2 w-full bg-ape-950 border border-border mt-2">
            <div className="h-full bg-ape-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xxs text-mute mt-2">
            each accepted referral grants +25 pts and one tier upgrade.
          </div>
        </Panel>

        <Panel title="Referral Slots">
          <div className="grid grid-cols-5 gap-2">
            {slots.map((filled, i) => (
              <div
                key={i}
                className={`aspect-square border flex items-center justify-center font-mono text-sm ${
                  filled
                    ? "bg-ape-700 border-ape-300 text-white"
                    : "bg-ape-950 border-border text-mute border-dashed"
                }`}
              >
                {`0${i + 1}`}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xxs text-mute uppercase tracking-wide">
              {referralCount} filled &middot; {referralLimit - referralCount} open
            </span>
            <div className="flex gap-2">
              <Button variant="primary" onClick={simulateInvite} disabled={referralCount >= referralLimit}>
                Simulate Invite
              </Button>
              <Button variant="ghost" onClick={resetAll} disabled={referralCount === 0}>
                Reset
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Referred Users" padded={false}>
          <table className="w-full text-xs">
            <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
              <tr>
                <th className="text-left px-3 py-1 border-b border-border">handle</th>
                <th className="text-left px-3 py-1 border-b border-border">wallet</th>
                <th className="text-left px-3 py-1 border-b border-border">date</th>
                <th className="text-left px-3 py-1 border-b border-border">status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((u, i) => (
                <tr key={`${u.wallet}-${i}`} className="row-hover">
                  <td className="px-3 py-2 text-ape-100">{u.handle}</td>
                  <td className="px-3 py-2 font-mono text-ape-200">{u.wallet}</td>
                  <td className="px-3 py-2 text-mute">{u.date}</td>
                  <td className="px-3 py-2"><StatusBadge status={u.status} /></td>
                </tr>
              ))}
              {Array.from({ length: referralLimit - list.length }, (_, i) => (
                <tr key={`empty-${i}`} className="text-mute">
                  <td className="px-3 py-2 italic">—</td>
                  <td className="px-3 py-2 italic">slot open</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2"><StatusBadge status="Open" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </RouteGuard>
  );
}
