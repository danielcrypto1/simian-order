"use client";

import Panel from "./Panel";
import { stats } from "@/lib/mockData";
import { useStore, FCFS_TOTAL } from "@/lib/store";

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full bg-ape-950 border border-border">
      <div className="h-full bg-ape-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RightPanel() {
  const fcfsRemaining = useStore((s) => s.fcfsRemaining);
  const fcfsTaken = FCFS_TOTAL - fcfsRemaining;

  return (
    <aside className="space-y-3">
      <Panel title="Stats">
        <ul className="text-xxs space-y-2">
          <li className="flex justify-between"><span className="text-mute">supply</span><span>{stats.totalSupply}</span></li>
          <li className="flex justify-between"><span className="text-mute">minted</span><span>{stats.minted} / {stats.totalSupply}</span></li>
          <li><Bar value={stats.minted} max={stats.totalSupply} /></li>
          <li className="flex justify-between pt-1"><span className="text-mute">applicants</span><span>{stats.applicants.toLocaleString()}</span></li>
          <li className="flex justify-between"><span className="text-mute">approved</span><span>{stats.approved}</span></li>
          <li className="flex justify-between"><span className="text-mute">pending</span><span>{stats.pending}</span></li>
          <li className="flex justify-between"><span className="text-mute">holders</span><span>{stats.holders}</span></li>
          <li className="flex justify-between"><span className="text-mute">floor</span><span className="text-ape-100">{stats.floor}</span></li>
        </ul>
      </Panel>

      <Panel title="FCFS Slots" right={<span>{fcfsRemaining} left</span>}>
        <div className="text-xxs text-mute mb-2">first come, first served</div>
        <Bar value={fcfsTaken} max={FCFS_TOTAL} />
        <div className="flex justify-between text-xxs text-mute uppercase mt-1">
          <span>taken {fcfsTaken}</span>
          <span>cap {FCFS_TOTAL}</span>
        </div>
      </Panel>

      <Panel title="Phase Clock">
        <div className="font-mono text-center text-ape-100 text-lg leading-none py-2">
          02:14:33:09
        </div>
        <div className="text-xxs text-center text-mute uppercase tracking-wider">
          dd : hh : mm : ss
        </div>
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
