"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";

/**
 * @deprecated — replaced by `TerminalBar` (top live-status strip) and
 * `FloatingScatter` (right-edge floating notice + links). The current
 * AppShell does not render this. File kept so any stray imports still
 * compile; safe to delete once nothing references it.
 */

const MAX_SUPPLY = 3333;
const ROYALTY_PCT = 6.9;

/** Hard 1px segmented bar — no gradient, no rounded fill. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="relative h-2 w-full bg-black border border-border">
      <div className="absolute inset-y-0 left-0 bg-elec" style={{ width: `${pct}%` }} />
      {/* hatch overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 6px, rgba(0,0,0,0.4) 6px 7px)",
        }}
      />
    </div>
  );
}

export default function RightPanel() {
  const [fcfs, setFcfs] = useState<{ total: number; taken: number; remaining: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/claim-fcfs")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive && j) setFcfs(j); })
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <aside className="space-y-4">
      <Panel title="collection">
        <ul className="font-mono text-xxs space-y-2">
          <li className="flex justify-between">
            <span className="text-mute">supply</span>
            <span className="text-bone">{MAX_SUPPLY}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-mute">royalty</span>
            <span className="text-bone">{ROYALTY_PCT}%</span>
          </li>
          <li className="flex justify-between">
            <span className="text-mute">chain</span>
            <span className="text-bone">ape-chain</span>
          </li>
        </ul>
      </Panel>

      <Panel
        title="fcfs slots"
        right={fcfs ? <span>{fcfs.remaining} left</span> : <span>--</span>}
      >
        {fcfs ? (
          <>
            <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-2">
              first come / first served
            </div>
            <Bar value={fcfs.taken} max={Math.max(1, fcfs.total)} />
            <div className="flex justify-between font-mono text-xxxs uppercase tracking-widest2 text-mute mt-1">
              <span>taken {fcfs.taken}</span>
              <span>cap {fcfs.total}</span>
            </div>
          </>
        ) : (
          <div className="font-mono text-xxs text-mute">loading…</div>
        )}
      </Panel>

      {/* Notice — looks like a stuck post-it */}
      <div className="relative tilt-r2 pl-3 pr-2 py-2 border border-bleed bg-black/70">
        <div className="absolute -top-2 left-2 sticker">notice</div>
        <p className="font-serif italic text-xs text-ape-200 leading-snug pt-2">
          The order is silent. The simians are watching.
          Enter the HIGH ORDER before the gate closes.
        </p>
      </div>
    </aside>
  );
}
