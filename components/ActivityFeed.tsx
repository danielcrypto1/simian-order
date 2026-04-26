"use client";

import { useEffect, useRef, useState } from "react";
import {
  ActivityItem,
  activityFeed as initial,
  feedActions,
  feedUsers,
} from "@/lib/mockData";
import Panel from "./Panel";

const TICK_MS = 4000;
const MAX_ITEMS = 12;

function makeEvent(seq: number): ActivityItem {
  const user = feedUsers[Math.floor(Math.random() * feedUsers.length)];
  const a = feedActions[Math.floor(Math.random() * feedActions.length)];
  const target = a.targets ? a.targets[Math.floor(Math.random() * a.targets.length)] : undefined;
  return {
    id: `live-${seq}-${Math.random().toString(36).slice(2, 6)}`,
    user,
    action: a.action,
    target,
    time: "now",
  };
}

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>(initial);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      seq.current += 1;
      setItems((prev) => [makeEvent(seq.current), ...prev].slice(0, MAX_ITEMS));
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel
      title="Activity Feed"
      right={
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-ape-300" style={{ animation: "pulse 1.4s infinite" }} />
          live &middot; {tick}
        </span>
      }
      padded={false}
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="row-hover px-3 py-2 flex items-start gap-3">
            <span className="w-6 h-6 bg-ape-800 border border-ape-500 text-ape-100 text-xxs flex items-center justify-center font-bold">
              {item.user.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-ape-100 text-xs">
                <span className="font-bold">{item.user}</span>{" "}
                <span className="text-ape-200">{item.action}</span>
                {item.target && <span className="text-ape-300"> &mdash; {item.target}</span>}
              </div>
              <div className="text-xxs text-mute uppercase tracking-wider">{item.time === "now" ? "just now" : `${item.time} ago`}</div>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
