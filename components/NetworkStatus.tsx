"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cosmetic "system telemetry" block fixed to the bottom-left of the
 * viewport (above the global pixel watermark).
 *
 * Three pretend metrics — network, latency, nodes — each cycling
 * through a fixed enum. Every 10-20s ONE of the three rolls a new
 * value. The freshly-changed value briefly flashes red via the
 * .is-bumped class.
 *
 * Purely decorative; no data is fetched. Hidden on small screens
 * (≤ 480px) via media query in globals.css to avoid overlapping
 * mobile chrome.
 */

const NETWORK = ["stable", "unstable", "degraded"] as const;
const LATENCY = ["low", "medium", "high"] as const;
const NODES   = ["active", "syncing", "limited"] as const;

type Status = {
  network: typeof NETWORK[number];
  latency: typeof LATENCY[number];
  nodes:   typeof NODES[number];
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function NetworkStatus() {
  const [status, setStatus] = useState<Status>({
    network: "stable",
    latency: "low",
    nodes:   "active",
  });
  // Which key was most recently bumped — drives the .is-bumped style.
  const [bumped, setBumped] = useState<keyof Status | null>(null);

  // Stable refs to avoid stale-closure issues inside the recursive timer.
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const which = pick<keyof Status>(["network", "latency", "nodes"]);
      let next: Status[keyof Status];
      switch (which) {
        case "network":
          next = pick(NETWORK.filter((v) => v !== statusRef.current.network));
          break;
        case "latency":
          next = pick(LATENCY.filter((v) => v !== statusRef.current.latency));
          break;
        case "nodes":
          next = pick(NODES.filter((v) => v !== statusRef.current.nodes));
          break;
      }
      setStatus((s) => ({ ...s, [which]: next as never }));
      setBumped(which);
      // Clear the bump highlight after the keyframe finishes (~600ms).
      window.setTimeout(() => setBumped(null), 700);
    };
    const schedule = () => {
      const ms = 10_000 + Math.random() * 10_000; // 10s..20s
      id = window.setTimeout(() => { tick(); schedule(); }, ms);
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="netstat" aria-hidden data-no-flash>
      <Row label="network" value={status.network} bumped={bumped === "network"} />
      <Row label="latency" value={status.latency} bumped={bumped === "latency"} />
      <Row label="nodes"   value={status.nodes}   bumped={bumped === "nodes"}   />
    </div>
  );
}

function Row({
  label,
  value,
  bumped,
}: {
  label: string;
  value: string;
  bumped: boolean;
}) {
  return (
    <div className="netstat-row">
      <span className="netstat-key">{label}:</span>
      <span className={`netstat-value${bumped ? " is-bumped" : ""}`}>
        {value}
      </span>
    </div>
  );
}
