"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import RouteGuard from "@/components/RouteGuard";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";

type ReferredEntry = {
  wallet: string;
  handle: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string | null;
};

type ReferralData = {
  wallet: string;
  code: string;
  count: number;
  limit: number;
  referred: ReferredEntry[];
};

export default function ReferralPage() {
  const { applicationStatus } = useStore();
  const { address } = useWallet();

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/referral?wallet=${address}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `http_${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const link = data?.code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard/apply?ref=${data.code}`
    : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("clipboard_unavailable");
    }
  }

  const slots = Array.from({ length: data?.limit ?? 5 }, (_, i) => i < (data?.count ?? 0));
  const pct = data ? (data.count / Math.max(1, data.limit)) * 100 : 0;

  return (
    <RouteGuard
      allow={applicationStatus === "approved"}
      title="Referrals (locked)"
      reason="referrals open after your application is approved by the order."
      cta={{ href: "/dashboard/apply", label: "Open Application" }}
    >
      <div className="space-y-3">
        <Panel
          title="Your Referral Link"
          right={data ? <span>{data.count}/{data.limit} used</span> : <span>{loading ? "loading…" : "—"}</span>}
        >
          {!address ? (
            <div className="text-xxs text-mute uppercase tracking-wide">connect a wallet to view your referral link.</div>
          ) : error ? (
            <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">error: {error}</div>
          ) : !data ? (
            <div className="text-xxs text-mute">loading…</div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <input className="field font-mono flex-1 min-w-[260px] break-all" readOnly value={link} />
                <Button variant="primary" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
              </div>
              <div className="h-2 w-full bg-ape-950 border border-border mt-2">
                <div className="h-full bg-ape-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xxs text-mute mt-2">
                share with friends. when they apply with code <span className="font-mono text-ape-200">{data.code}</span>, they're tagged to you.
              </div>
            </>
          )}
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
          <div className="text-xxs text-mute mt-2 uppercase tracking-wide">
            {data?.count ?? 0} filled · {(data?.limit ?? 5) - (data?.count ?? 0)} open
          </div>
        </Panel>

        <Panel title="Referred Users" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-ape-850 text-xxs uppercase tracking-wide text-ape-200">
                <tr>
                  <th className="text-left px-3 py-1 border-b border-border">wallet</th>
                  <th className="text-left px-3 py-1 border-b border-border">handle</th>
                  <th className="text-left px-3 py-1 border-b border-border">submitted</th>
                  <th className="text-left px-3 py-1 border-b border-border">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.referred ?? []).map((u) => (
                  <tr key={u.wallet} className="row-hover">
                    <td className="px-3 py-2 font-mono text-ape-100 break-all">{u.wallet}</td>
                    <td className="px-3 py-2 text-ape-200">{u.handle ?? "—"}</td>
                    <td className="px-3 py-2 text-mute font-mono">{u.submittedAt?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={u.status === "approved" ? "Approved" : u.status === "rejected" ? "Rejected" : "Pending"}
                      />
                    </td>
                  </tr>
                ))}
                {data && data.referred.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-mute text-center text-xxs italic">
                      no referrals yet — share your link above.
                    </td>
                  </tr>
                )}
                {!data && !loading && !error && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-mute text-center text-xxs italic">connect a wallet to view referrals</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </RouteGuard>
  );
}
