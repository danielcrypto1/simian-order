"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { stats } from "@/lib/mockData";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";

const MINT_DURATION_MS = 90_000;

function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export default function MintPage() {
  const { mintEligible, fcfsApproved, applicationStatus } = useStore();
  const { address, connect } = useWallet();
  const [qty, setQty] = useState(1);
  const [phase, setPhase] = useState<"idle" | "minting" | "minted">("idle");
  const [minted, setMinted] = useState(stats.minted);
  const [now, setNow] = useState(() => Date.now());

  const [mintStart, setMintStart] = useState(() => {
    if (typeof window === "undefined") return Date.now() + MINT_DURATION_MS;
    const stored = window.sessionStorage.getItem("simian:mint-start");
    if (stored) return Number(stored);
    const next = Date.now() + MINT_DURATION_MS;
    window.sessionStorage.setItem("simian:mint-start", String(next));
    return next;
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = stats.totalSupply - minted;

  const state: "locked" | "countdown" | "live" = useMemo(() => {
    if (!mintEligible) return "locked";
    if (now < mintStart) return "countdown";
    return "live";
  }, [mintEligible, now, mintStart]);

  function skipCountdown() {
    const next = Date.now() - 1;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("simian:mint-start", String(next));
    }
    setMintStart(next);
  }

  async function mint() {
    if (!address) {
      await connect();
      return;
    }
    setPhase("minting");
    await new Promise((r) => setTimeout(r, 1100));
    setMinted((m) => Math.min(stats.totalSupply, m + qty));
    setPhase("minted");
  }

  const reasonLocked = !mintEligible
    ? applicationStatus === "rejected"
      ? "your application was rejected. mint requires approval or an FCFS slot."
      : applicationStatus === "pending"
      ? "your application is pending. await the order's verdict."
      : fcfsApproved
      ? ""
      : "complete tasks while FCFS spots remain, or wait for application approval."
    : "";

  const pct = (minted / stats.totalSupply) * 100;

  return (
    <div className="space-y-3">
      <Panel
        title="Mint"
        right={
          <span>
            <StatusBadge
              status={state === "live" ? "Open" : state === "countdown" ? "Pending" : "Locked"}
            />
          </span>
        }
      >
        <div className="grid md:grid-cols-[200px_1fr] gap-4">
          <div className="bg-ape-950 border border-border aspect-square flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 scanline" />
            <div className="text-center relative">
              <div className="text-ape-300 text-xxs uppercase tracking-widest">simian.order</div>
              <div className="text-ape-100 text-5xl font-bold leading-none mt-2">S</div>
              <div className="text-ape-300 text-xxs uppercase tracking-widest mt-2">primate edition</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xxs text-mute uppercase tracking-wide">
                <span>minted</span>
                <span>
                  <span className="text-ape-100 font-mono">{minted}</span> /
                  <span className="font-mono"> {stats.totalSupply}</span>
                </span>
              </div>
              <div className="h-3 w-full bg-ape-950 border border-border mt-1">
                <div className="h-full bg-ape-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xxs">
              <div className="border border-border bg-ape-950 px-2 py-1">
                <div className="text-mute uppercase">price</div>
                <div className="text-ape-100 font-mono">0.42 APE</div>
              </div>
              <div className="border border-border bg-ape-950 px-2 py-1">
                <div className="text-mute uppercase">max / wallet</div>
                <div className="text-ape-100 font-mono">2</div>
              </div>
              <div className="border border-border bg-ape-950 px-2 py-1">
                <div className="text-mute uppercase">remaining</div>
                <div className="text-ape-100 font-mono">{remaining}</div>
              </div>
            </div>

            <div className="divider-old" />

            {state === "locked" && (
              <div className="space-y-2 border border-border bg-ape-950 p-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status="Locked" />
                  <span className="text-xxs uppercase tracking-wide text-mute">mint not eligible</span>
                </div>
                <p className="text-xs text-ape-200 leading-relaxed">
                  {reasonLocked || "you are not currently eligible to mint."}
                </p>
                <div className="flex gap-2 pt-1">
                  <Link href="/dashboard/tasks"><Button variant="primary">Open Tasks</Button></Link>
                  <Link href="/dashboard/apply"><Button variant="ghost">Open Application</Button></Link>
                </div>
              </div>
            )}

            {state === "countdown" && (
              <div className="space-y-2">
                <div className="text-xxs text-mute uppercase tracking-wider">mint opens in</div>
                <div className="font-mono text-3xl text-ape-100 leading-none">
                  {formatRemaining(mintStart - now)}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" disabled>Mint not open</Button>
                  <Button variant="ghost" onClick={skipCountdown}>DEV: Skip</Button>
                </div>
              </div>
            )}

            {state === "live" && (
              <>
                <div className="flex items-center gap-2">
                  <label className="label mb-0">qty</label>
                  <div className="flex">
                    <button
                      className="btn-old px-2"
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      aria-label="decrease"
                    >−</button>
                    <input
                      className="field w-12 text-center font-mono"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Math.min(2, Number(e.target.value) || 1)))}
                    />
                    <button
                      className="btn-old px-2"
                      onClick={() => setQty(Math.min(2, qty + 1))}
                      aria-label="increase"
                    >+</button>
                  </div>
                  <span className="text-xxs text-mute ml-2 font-mono">
                    total: {(qty * 0.42).toFixed(2)} APE
                  </span>
                </div>

                {phase === "minted" ? (
                  <div className="space-y-2">
                    <StatusBadge status="Done" />
                    <p className="text-xs text-ape-100">
                      you received <span className="font-mono">{qty}</span> simian{qty > 1 ? "s" : ""}.
                      welcome.
                    </p>
                    <Button variant="ghost" onClick={() => setPhase("idle")}>Mint again</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="primary" onClick={mint} disabled={phase === "minting" || remaining === 0}>
                      {phase === "minting" ? "Minting..." : address ? "Mint" : "Connect & Mint"}
                    </Button>
                    <span className="text-xxs text-mute">
                      UI only &mdash; contract not wired.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Recent Mints" padded={false}>
        <ul className="divide-y divide-border text-xs">
          {[
            { id: "#0421", who: "ordervassal", time: "44m" },
            { id: "#0420", who: "primape", time: "6h" },
            { id: "#0419", who: "0x77...4f1", time: "9h" },
            { id: "#0418", who: "monkebro", time: "12h" },
          ].map((m) => (
            <li key={m.id} className="row-hover px-3 py-2 flex items-center justify-between">
              <span className="font-mono text-ape-100">{m.id}</span>
              <span className="text-ape-200">{m.who}</span>
              <span className="text-xxs text-mute uppercase">{m.time} ago</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
