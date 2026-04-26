"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";

const MAX_SUPPLY = 3333;
const ROYALTY_PCT = 6.9;

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full bg-ape-950 border border-border">
      <div className="h-full bg-ape-500" style={{ width: `${pct}%` }} />
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
    <aside className="space-y-3">
      <Panel title="Collection">
        <ul className="text-xxs space-y-2">
          <li className="flex justify-between"><span className="text-mute">supply</span><span className="font-mono">{MAX_SUPPLY}</span></li>
          <li className="flex justify-between"><span className="text-mute">royalty</span><span className="font-mono">{ROYALTY_PCT}%</span></li>
          <li className="flex justify-between"><span className="text-mute">chain</span><span className="font-mono">ape-chain</span></li>
        </ul>
      </Panel>

      <Panel title="FCFS Slots" right={<span>{fcfs ? `${fcfs.remaining} left` : "—"}</span>}>
        {fcfs ? (
          <>
            <div className="text-xxs text-mute mb-2">first come, first served</div>
            <Bar value={fcfs.taken} max={Math.max(1, fcfs.total)} />
            <div className="flex justify-between text-xxs text-mute uppercase mt-1">
              <span>taken {fcfs.taken}</span>
              <span>cap {fcfs.total}</span>
            </div>
          </>
        ) : (
          <div className="text-xxs text-mute">loading…</div>
        )}
      </Panel>

      <Panel title="Notice">
        <p className="text-xxs leading-relaxed text-ape-200">
          The order is silent. The simians are watching. Submit your application before
          the gate closes.
        </p>
      </Panel>
    </aside>
  );
}
