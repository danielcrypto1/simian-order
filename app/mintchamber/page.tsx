"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";

/**
 * MINT CHAMBER — holder-gated prototype.
 *
 * Visual demo only. Nothing here calls a chain, signs anything, or
 * fetches real state. Mock data is shaped to mirror the documented
 * Mint Chamber feature surface (wallet roster, mint config, pre-mint
 * validation, gas monitor, execution modes, retry, live tx dashboard)
 * with an ambient FOMO ticker on top: floor sparkline, mint velocity,
 * supply countdown, live cross-chamber activity feed, per-wallet P/L
 * projections, leaderboard.
 *
 * Not linked from any nav — reachable only by typing /mintchamber.
 */

type Group = "WHITELIST" | "SNIPING" | "RESERVE" | "MAIN";
type WalletStatus = "READY" | "LOW GAS" | "NOT WHITELISTED" | "INVALID";
type TxStatus = "QUEUED" | "PENDING" | "MINED" | "FAILED";

type Wallet = {
  addr: string;
  group: Group;
  balance: number; // APE
  status: WalletStatus;
  tx: TxStatus;
  hash: string | null;
  progress: number; // 0-100
};

const SHORT = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const SIMIAN_HELD = 3;
const SLOTS_PER_SIMIAN = 5;
const SLOTS_TOTAL = SIMIAN_HELD * SLOTS_PER_SIMIAN;

const SUPPLY_MAX = 5000;
const SUPPLY_START = 4420;

const INITIAL_WALLETS: Wallet[] = [
  { addr: "0x9a17d3b1f4c2e88d4ce8b8a7be4a6d9c1f02e771", group: "MAIN",      balance: 4.21, status: "READY",           tx: "QUEUED", hash: null, progress: 0 },
  { addr: "0x6f02b41cdd3a18bb55c0e89aaa7cf201a7c4d9e3", group: "WHITELIST", balance: 1.88, status: "READY",           tx: "QUEUED", hash: null, progress: 0 },
  { addr: "0xbd29c8773e9a01a7e44e6f3f8cd0a2e8b9e1c4a6", group: "SNIPING",   balance: 0.62, status: "READY",           tx: "QUEUED", hash: null, progress: 0 },
  { addr: "0x1c8be0c4a76a5d2db3c5fa8e0d12e6f3d99a01b2", group: "RESERVE",   balance: 0.04, status: "LOW GAS",         tx: "QUEUED", hash: null, progress: 0 },
  { addr: "0xeac4cf02af0a3a18f7d1d51d6e6f01e5b9c2adf0", group: "WHITELIST", balance: 2.31, status: "READY",           tx: "QUEUED", hash: null, progress: 0 },
  { addr: "0x33aa10ff8c5e0a9b3a72e8c1f9d404e2bb6e7a18", group: "MAIN",      balance: 1.45, status: "NOT WHITELISTED", tx: "QUEUED", hash: null, progress: 0 },
  { addr: "0x77c6e21d3a9f0b48c1cf52d18b4ea7c0e8f3a99d", group: "SNIPING",   balance: 0.91, status: "READY",           tx: "QUEUED", hash: null, progress: 0 },
];

type ExecMode = "SIMULTANEOUS" | "OPTIMIZED" | "SEQUENTIAL" | "SMART DELAY";
type GasTier = "HIGH" | "BALANCED" | "LOW";

const EXEC_MODES: { id: ExecMode; blurb: string }[] = [
  { id: "SIMULTANEOUS", blurb: "fire all wallets concurrently. fastest, heaviest RPC load." },
  { id: "OPTIMIZED",    blurb: "reorders + paces against live mempool conditions." },
  { id: "SEQUENTIAL",   blurb: "one wallet at a time. predictable, slow." },
  { id: "SMART DELAY",  blurb: "randomized inter-tx pauses. lowers detection footprint." },
];

const GAS_TIERS: { id: GasTier; blurb: string; gwei: string }[] = [
  { id: "HIGH",     blurb: "front of block — expensive.", gwei: "0.84" },
  { id: "BALANCED", blurb: "match network median.",        gwei: "0.62" },
  { id: "LOW",      blurb: "patient. may not land round.", gwei: "0.41" },
];

// Mock "other chambers" feed messages. New entries are constructed at
// runtime by combining a verb with a random wallet stub + amount so the
// feed feels alive without a real data source.
const FEED_VERBS = [
  "minted",
  "sniped",
  "rotated",
  "swept",
  "flipped",
  "rugged the public",
  "locked-in",
];
const FEED_CHAMBERS = [
  "alpha:nova",
  "lattice",
  "vault.13",
  "the-pit",
  "umbra",
  "obelisk",
  "/dev/null",
  "chamber:sigma",
];

function randHex(n: number) {
  let s = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function randWalletStub() {
  return `0x${randHex(4)}…${randHex(4)}`;
}

function makeFeedEntry(floor: number): string {
  const r = Math.random();
  // 40% per-wallet mint, 30% chamber sweep, 20% block landing, 10% rotation
  if (r < 0.4) {
    const gain = (Math.random() * floor * 0.9 + floor * 0.1).toFixed(2);
    return `${randWalletStub()} ${FEED_VERBS[Math.floor(Math.random() * 3)]} +${gain} ape`;
  }
  if (r < 0.7) {
    const ch = FEED_CHAMBERS[Math.floor(Math.random() * FEED_CHAMBERS.length)];
    const n = 4 + Math.floor(Math.random() * 12);
    return `chamber ${ch} ${FEED_VERBS[3]} ${n}/${n} wallets`;
  }
  if (r < 0.9) {
    const block = 18_440_000 + Math.floor(Math.random() * 9999);
    const n = 2 + Math.floor(Math.random() * 14);
    return `block ${block.toLocaleString()} — ${n} chamber mints landed`;
  }
  const gain = (Math.random() * 12 + 4).toFixed(2);
  return `rotation alpha booked +${gain} ape across chamber`;
}

export default function MintChamberPage() {
  // ── Config state ─────────────────────────────────────────────────────
  const [contract, setContract] = useState("0x4d2e8a17c8b1ee4c6e0d3f9b22ca8e7b1d2f0a55");
  const [mintFn, setMintFn] = useState("mint(uint256)");
  const [price, setPrice] = useState("0.069");
  const [perWallet, setPerWallet] = useState("1");

  const [mode, setMode] = useState<ExecMode>("OPTIMIZED");
  const [tier, setTier] = useState<GasTier>("BALANCED");

  const [maxRetries, setMaxRetries] = useState("3");
  const [autoBump, setAutoBump] = useState(true);
  const [skipOnFail, setSkipOnFail] = useState(true);

  // ── Wallet roster + add/import flows ────────────────────────────────
  const [wallets, setWallets] = useState<Wallet[]>(INITIAL_WALLETS);
  const [addOpen, setAddOpen] = useState(false);
  const [addAddr, setAddAddr] = useState("");
  const [addGroup, setAddGroup] = useState<Group>("MAIN");
  const [addError, setAddError] = useState<string | null>(null);
  const [wcStatus, setWcStatus] = useState<"idle" | "connecting">("idle");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-clear the last-action toast after a few seconds so the
  // header doesn't carry yesterday's news.
  useEffect(() => {
    if (!lastAction) return;
    const id = setTimeout(() => setLastAction(null), 3500);
    return () => clearTimeout(id);
  }, [lastAction]);

  function genWallet(group: Group, balance?: number): Wallet {
    const bal = balance ?? Math.random() * 4 + 0.2;
    const rounded = parseFloat(bal.toFixed(2));
    return {
      addr: "0x" + randHex(40),
      group,
      balance: rounded,
      status: rounded < 0.1 ? "LOW GAS" : "READY",
      tx: "QUEUED",
      hash: null,
      progress: 0,
    };
  }

  function openAddForm() {
    setAddOpen((v) => !v);
    setAddError(null);
    setAddAddr("");
    setAddGroup("MAIN");
  }

  function submitAdd() {
    const v = addAddr.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(v)) {
      setAddError("invalid address — must be 0x followed by 40 hex chars");
      return;
    }
    if (wallets.some((w) => w.addr.toLowerCase() === v)) {
      setAddError("already bound");
      return;
    }
    const bal = Math.random() * 4 + 0.2;
    const rounded = parseFloat(bal.toFixed(2));
    setWallets((ws) => [
      ...ws,
      {
        addr: v,
        group: addGroup,
        balance: rounded,
        status: rounded < 0.1 ? "LOW GAS" : "READY",
        tx: "QUEUED",
        hash: null,
        progress: 0,
      },
    ]);
    setAddOpen(false);
    setAddAddr("");
    setAddError(null);
    setLastAction(`bound ${v.slice(0, 6)}…${v.slice(-4)} · ${addGroup.toLowerCase()}`);
  }

  function runWalletConnect() {
    if (wcStatus === "connecting") return;
    setWcStatus("connecting");
    setLastAction("walletconnect · awaiting approval in wallet…");
    setTimeout(() => {
      const w = genWallet("MAIN");
      setWallets((ws) => [...ws, w]);
      setWcStatus("idle");
      setLastAction(`walletconnect bound ${w.addr.slice(0, 6)}…${w.addr.slice(-4)}`);
    }, 1800);
  }

  function runImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastAction(`parsing ${file.name}…`);
    setTimeout(() => {
      const slotsLeft = SLOTS_TOTAL - wallets.length;
      const n = Math.max(0, Math.min(3, slotsLeft));
      if (n === 0) {
        setLastAction("import failed — chamber at capacity");
        return;
      }
      const groups: Group[] = ["WHITELIST", "SNIPING", "MAIN", "RESERVE"];
      const newOnes: Wallet[] = Array.from({ length: n }, (_, i) =>
        genWallet(groups[i % groups.length])
      );
      setWallets((ws) => [...ws, ...newOnes]);
      setLastAction(`imported ${n} wallet${n === 1 ? "" : "s"} from ${file.name}`);
    }, 900);
    e.target.value = "";
  }

  function removeWallet(addr: string) {
    setWallets((ws) => ws.filter((w) => w.addr !== addr));
    setLastAction(`removed ${addr.slice(0, 6)}…${addr.slice(-4)}`);
  }

  const atCapacity = wallets.length >= SLOTS_TOTAL;

  // ── Ambient FOMO ticker — always runs, even when chamber is idle ────
  const [floorHist, setFloorHist] = useState<number[]>(() => {
    const seed = [1.0, 1.02, 1.05, 1.04, 1.08, 1.12, 1.18, 1.17, 1.22, 1.28, 1.31, 1.35, 1.42, 1.40, 1.46, 1.51, 1.55, 1.58, 1.62];
    return seed;
  });
  const [velocityHist, setVelocityHist] = useState<number[]>(() => [2, 3, 2, 4, 3, 5, 4, 6, 7, 5, 8, 9, 7, 10, 12, 11]);
  // Deterministic seed — Math.random() in initial state causes server/
  // client hydration mismatch. The ambient ticker takes over post-mount
  // and rotates these values for the live feel.
  const [mempoolHeat, setMempoolHeat] = useState<number[]>(() => {
    const seed = [0.22, 0.41, 0.55, 0.31, 0.18, 0.62, 0.48, 0.27, 0.74, 0.39, 0.51, 0.66, 0.29, 0.43, 0.58, 0.35, 0.71, 0.46, 0.23, 0.61, 0.49, 0.33, 0.57, 0.42, 0.68, 0.25, 0.53, 0.37, 0.64, 0.45, 0.59, 0.30];
    return seed;
  });
  const [supply, setSupply] = useState(SUPPLY_START);
  const [feed, setFeed] = useState<string[]>(() => [
    "0x9be1…ac42 minted +1.41 ape",
    "chamber lattice swept 12/12 wallets",
    "block 18,442,919 — 8 chamber mints landed",
    "0xfde0…11ab minted +1.38 ape",
    "0x7321…d09c sniped +1.55 ape",
    "rotation alpha booked +9.42 ape across chamber",
  ]);
  const [walletsAhead, setWalletsAhead] = useState(247);
  const [blocksToOut, setBlocksToOut] = useState(142);

  // Ambient pulse — runs forever, drives the FOMO surface even while
  // the chamber is idle. Faster than the execution tick.
  useEffect(() => {
    const id = setInterval(() => {
      // Floor: biased random walk upward, with occasional dips.
      setFloorHist((h) => {
        const last = h[h.length - 1];
        const drift = (Math.random() - 0.42) * 0.04; // upward bias
        const next = Math.max(0.8, last + drift);
        return [...h.slice(-19), parseFloat(next.toFixed(3))];
      });
      // Velocity: random oscillation around 6-12.
      setVelocityHist((v) => {
        const next = Math.max(0, Math.round(6 + Math.random() * 10));
        return [...v.slice(-19), next];
      });
      // Mempool heat — rotate slowly so the bar feels alive.
      setMempoolHeat((m) => {
        const next = m.slice(1);
        next.push(Math.random() * 0.85 + 0.1);
        return next;
      });
      // Supply creeps up — but capped just below SUPPLY_MAX so we keep
      // FOMO copy without flipping to "sold out" in the demo.
      setSupply((s) => Math.min(SUPPLY_MAX - 12, s + (Math.random() < 0.7 ? 1 : 0)));
      // Feed: 60% chance to prepend a new entry each beat.
      if (Math.random() < 0.6) {
        setFeed((f) => [makeFeedEntry(floorHist[floorHist.length - 1] || 1.5), ...f].slice(0, 14));
      }
      // Wallets-ahead & blocks-to-out tighten over time → FOMO.
      setWalletsAhead((x) => Math.max(12, x - Math.floor(Math.random() * 3)));
      setBlocksToOut((b) => Math.max(6, b - (Math.random() < 0.4 ? 1 : 0)));
    }, 1500);
    return () => clearInterval(id);
    // intentional: only set up once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Simulation engine (per-wallet tx progression) ────────────────────
  const [armed, setArmed] = useState(false);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!armed) return;
    tickRef.current = setInterval(() => setTick((t) => t + 1), 700);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [armed]);

  useEffect(() => {
    if (!armed) return;
    setWallets((prev) => {
      const next = prev.map((w) => ({ ...w }));
      const eligible = next.filter((w) => w.status === "READY");
      const concurrent =
        mode === "SIMULTANEOUS" ? eligible.length :
        mode === "OPTIMIZED"    ? Math.min(4, eligible.length) :
        mode === "SMART DELAY"  ? Math.min(2, eligible.length) :
        1;
      let advanced = 0;
      for (const w of next) {
        if (w.status !== "READY") continue;
        if (w.tx === "MINED" || w.tx === "FAILED") continue;
        if (advanced >= concurrent) continue;
        advanced++;
        if (w.tx === "QUEUED") {
          w.tx = "PENDING";
          w.hash = "0x" + randHex(8) + "…" + randHex(4);
          w.progress = 12;
        } else if (w.tx === "PENDING") {
          const step =
            tier === "HIGH"     ? 32 :
            tier === "BALANCED" ? 22 :
                                  14;
          w.progress = Math.min(100, w.progress + step + Math.floor(Math.random() * 6));
          if (w.progress >= 100) {
            if (Math.random() < 0.11) {
              w.tx = "FAILED";
            } else {
              w.tx = "MINED";
            }
          }
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // ── Derived counts + money ───────────────────────────────────────────
  const counts = useMemo(() => {
    const ready    = wallets.filter((w) => w.status === "READY").length;
    const lowGas   = wallets.filter((w) => w.status === "LOW GAS").length;
    const notWl    = wallets.filter((w) => w.status === "NOT WHITELISTED").length;
    const invalid  = wallets.filter((w) => w.status === "INVALID").length;
    const mined    = wallets.filter((w) => w.tx === "MINED").length;
    const pending  = wallets.filter((w) => w.tx === "PENDING").length;
    const failed   = wallets.filter((w) => w.tx === "FAILED").length;
    const queued   = wallets.filter((w) => w.tx === "QUEUED").length;
    const successRate = wallets.length > 0 ? Math.round((mined / wallets.length) * 100) : 0;
    return { ready, lowGas, notWl, invalid, mined, pending, failed, queued, successRate };
  }, [wallets]);

  const priceNum = parseFloat(price) || 0;
  const perWalletNum = parseInt(perWallet, 10) || 0;
  const currentFloor = floorHist[floorHist.length - 1] || 1.5;
  const prevFloor = floorHist[Math.max(0, floorHist.length - 8)] || currentFloor;
  const floorDelta = currentFloor - prevFloor;
  const floorDeltaPct = prevFloor > 0 ? (floorDelta / prevFloor) * 100 : 0;
  const currentVelocity = velocityHist[velocityHist.length - 1] || 0;

  const totalNfts = counts.ready * perWalletNum;
  const mintedNfts = counts.mined * perWalletNum;
  const totalCost = totalNfts * priceNum;
  const totalApeStr = totalCost.toFixed(3);
  const gasGwei = GAS_TIERS.find((g) => g.id === tier)?.gwei ?? "0.62";

  // Net profit projection — current floor minus mint price, times units
  // you'd land. As the floor moves the number breathes.
  const perUnitGain = Math.max(0, currentFloor - priceNum);
  const projectedGross = totalNfts * currentFloor;
  const projectedNet = totalNfts * perUnitGain;
  const realizedNet = mintedNfts * perUnitGain;
  const multiplier = priceNum > 0 ? currentFloor / priceNum : 0;
  const supplyLeft = SUPPLY_MAX - supply;
  const supplyPct = (supply / SUPPLY_MAX) * 100;

  // Per-wallet projection — used in roster + dashboard rows.
  const projPerWallet = perUnitGain * perWalletNum;

  // Leaderboard — top wallets by realized gain. While idle, project by
  // ready status; while running, by mined status.
  const leaderboard = useMemo(() => {
    return [...wallets]
      .map((w) => {
        const realized = w.tx === "MINED" ? perWalletNum * perUnitGain : 0;
        const projected = w.status === "READY" ? perWalletNum * perUnitGain : 0;
        return { ...w, realized, projected };
      })
      .sort((a, b) => (b.realized + b.projected * 0.5) - (a.realized + a.projected * 0.5))
      .slice(0, 3);
  }, [wallets, perUnitGain, perWalletNum]);

  function resetSim() {
    setArmed(false);
    setTick(0);
    setWallets(INITIAL_WALLETS.map((w) => ({ ...w })));
  }

  function toggleArm() {
    if (armed) {
      setArmed(false);
    } else {
      setWallets((prev) =>
        prev.map((w) => ({ ...w, tx: "QUEUED" as TxStatus, hash: null, progress: 0 }))
      );
      setTick(0);
      setArmed(true);
    }
  }

  return (
    <div>
      {/* ── Greeting block ── */}
      <section className="mb-10 tilt-l">
        <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-1">
          // mint_chamber.txt &nbsp;·&nbsp; restricted
        </div>
        <h1 className="headline text-[28px] sm:text-5xl leading-tight mb-3">
          the chamber recognises you<span className="text-bleed">.</span>
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="badge text-elec">SIMIAN · {SIMIAN_HELD} HELD</span>
          <span className="font-serif italic text-sm text-mute">
            &mdash; {SLOTS_TOTAL} wallet slots unlocked, {wallets.length} bound.
          </span>
        </div>
      </section>

      {/* ── Quick-state strip ── */}
      <section className="mb-8 border-t border-b border-border py-2">
        <div className="flex items-center flex-wrap gap-x-5 gap-y-1 font-mono text-xxs uppercase tracking-widest2">
          <span><span className="text-mute">chamber:</span>{" "}
            <span className={armed ? "text-bleed pulse-soft" : "text-bone"}>
              {armed ? "armed" : "idle"}
            </span>
          </span>
          <span className="text-mute">/</span>
          <span><span className="text-mute">net:</span> <span className="text-bone">ape-main</span></span>
          <span className="text-mute">/</span>
          <span><span className="text-mute">mode:</span> <span className="text-elec">{mode.toLowerCase()}</span></span>
          <span className="text-mute">/</span>
          <span><span className="text-mute">gas:</span> <span className="text-bone">{gasGwei}</span></span>
          <span className="text-mute">/</span>
          <span><span className="text-mute">edge:</span>{" "}
            <span className="text-elec">+3.2 blk</span>
          </span>
          <span className="text-mute">/</span>
          <span><span className="text-mute">lat:</span> <span className="text-bone">11ms</span></span>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          FOMO CONSOLE — 4-up hero metrics. Big VT323 numbers, live
          sparklines, color shifts on movement.
          ────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <HeroMetric
          label="EST. NET PROFIT"
          value={`+${projectedNet.toFixed(2)}`}
          unit="ape"
          sub={`${multiplier.toFixed(1)}× exit · ${totalNfts} nft`}
          tone="elec"
          pulse={armed}
          big
        />
        <Panel title="Floor · ape">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-pixel text-3xl leading-none text-bone">
              {currentFloor.toFixed(2)}
            </span>
            <span
              className="font-mono text-xxs"
              style={{ color: floorDelta >= 0 ? "#34d399" : "#ff2d2d" }}
            >
              {floorDelta >= 0 ? "▲" : "▼"} {Math.abs(floorDeltaPct).toFixed(1)}%
            </span>
          </div>
          <Sparkline data={floorHist} color="#0040ff" />
          <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mt-1">
            mint cost {priceNum.toFixed(3)} · gap +{(currentFloor - priceNum).toFixed(2)}
          </div>
        </Panel>
        <Panel title="Velocity · mint/s">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-pixel text-3xl leading-none text-bleed">
              {currentVelocity}
            </span>
            <span className="font-mono text-xxs text-mute">
              peak {Math.max(...velocityHist)}
            </span>
          </div>
          <Sparkline data={velocityHist} color="#ff2d2d" />
          <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mt-1">
            mempool busy · public can&apos;t keep up
          </div>
        </Panel>
        <Panel title="Supply left">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-pixel text-3xl leading-none text-bone">
              {supplyLeft}
            </span>
            <span className="font-mono text-xxs text-bleed pulse-soft">
              {(100 - supplyPct).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full bg-ape-950 border border-border mt-1">
            <div
              className="h-full bg-bleed transition-all"
              style={{ width: `${supplyPct}%` }}
            />
          </div>
          <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mt-1">
            {blocksToOut} blocks to mint-out
          </div>
        </Panel>
      </section>

      {/* ── Supply urgency + mempool heatmap ── */}
      <section className="mb-4 panel">
        <div className="panel-header">
          <span><span className="text-elec">&gt;</span> Mempool Heat &nbsp;·&nbsp; next 32 blocks</span>
          <span className="font-mono text-xxxs tracking-widest text-mute normal-case">
            {walletsAhead} wallets ahead of yours
          </span>
        </div>
        <div className="panel-body">
          <div className="flex items-end gap-[2px] h-10 mb-2">
            {mempoolHeat.map((v, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  height: `${10 + v * 90}%`,
                  background:
                    v > 0.75 ? "#ff2d2d" :
                    v > 0.5  ? "#0040ff" :
                    v > 0.25 ? "#aaaadd" :
                               "#1a1a28",
                  opacity: 0.4 + v * 0.6,
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between font-mono text-xxxs uppercase tracking-widest2 text-mute">
            <span>now</span>
            <span>+8 blk</span>
            <span>+16 blk</span>
            <span>+24 blk</span>
            <span>+32 blk</span>
          </div>
        </div>
      </section>

      {/* ── Live cross-chamber activity feed ── */}
      <section className="mb-6 panel">
        <div className="panel-header">
          <span>
            <span className="text-elec">&gt;</span> Live · cross-chamber feed
            <span className="ml-2 inline-block w-2 h-2 bg-bleed pulse-soft align-middle" aria-hidden />
          </span>
          <span className="font-mono text-xxxs tracking-widest text-mute normal-case">
            others are not waiting
          </span>
        </div>
        <ul className="divide-y divide-border max-h-[180px] overflow-hidden">
          {feed.slice(0, 7).map((line, i) => (
            <li
              key={`${line}-${i}`}
              className="px-3 py-2 font-mono text-xs flex items-center gap-2"
              style={{
                color: i === 0 ? "#e8e8e8" : "#aaaadd",
                opacity: Math.max(0.45, 1 - i * 0.09),
              }}
            >
              <span className="text-elec">›</span>
              <span className="truncate">{line}</span>
              {i === 0 && (
                <span className="ml-auto text-xxxs uppercase tracking-widest2 text-bleed pulse-soft">
                  just now
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-4">
        {/* ── 01 — TARGET CONTRACT ── */}
        <Panel title="Target Contract" right={<span>fn detected · supply {supply.toLocaleString()} / {SUPPLY_MAX.toLocaleString()}</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">contract address</label>
              <input
                className="field font-mono"
                value={contract}
                onChange={(e) => setContract(e.target.value)}
                spellCheck={false}
              />
              <div className="text-xxs text-mute mt-1">
                detected: <span className="text-bone">ERC-721A</span> · max per wallet{" "}
                <span className="text-bone">1</span> · public phase active ·{" "}
                <span className="text-elec">edge +3.2 blocks</span>
              </div>
            </div>

            <div>
              <label className="label">mint function</label>
              <select
                className="field"
                value={mintFn}
                onChange={(e) => setMintFn(e.target.value)}
              >
                <option>mint(uint256)</option>
                <option>publicMint(uint256)</option>
                <option>claim()</option>
                <option>mintTo(address,uint256)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">price (ape)</label>
                <input
                  className="field font-mono"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="label">per wallet</label>
                <input
                  className="field font-mono"
                  value={perWallet}
                  onChange={(e) => setPerWallet(e.target.value)}
                />
              </div>
            </div>
          </div>
        </Panel>

        {/* ── 02 — WALLET ROSTER ── */}
        <Panel
          title="Wallet Roster"
          right={
            <span>
              {wallets.length}/{SLOTS_TOTAL} bound · proj +{(counts.ready * projPerWallet).toFixed(2)} ape
              {atCapacity && <span className="ml-2 text-bleed">· FULL</span>}
            </span>
          }
          padded={false}
        >
          <div className="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-border">
            <Button
              variant="ghost"
              onClick={openAddForm}
              disabled={atCapacity && !addOpen}
            >
              {addOpen ? "× CANCEL" : "+ ADD WALLET"}
            </Button>
            <Button
              variant="ghost"
              onClick={runWalletConnect}
              disabled={atCapacity || wcStatus === "connecting"}
            >
              {wcStatus === "connecting" ? "CONNECTING…" : "+ WALLETCONNECT"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={atCapacity}
            >
              IMPORT FILE
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json"
              onChange={runImport}
              hidden
            />
            <span className="ml-auto font-mono text-xxxs uppercase tracking-widest2 text-mute">
              private keys never stored · session signing only
            </span>
          </div>

          {lastAction && (
            <div className="px-3 py-1 border-b border-border bg-ape-900/40 font-mono text-xxxs uppercase tracking-widest2 text-elec">
              › {lastAction}
            </div>
          )}

          {addOpen && (
            <div className="px-3 py-3 border-b border-border bg-ape-900/40">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
                <div>
                  <label className="label">address</label>
                  <input
                    className="field font-mono"
                    value={addAddr}
                    onChange={(e) => setAddAddr(e.target.value)}
                    placeholder="0x..."
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitAdd();
                      if (e.key === "Escape") setAddOpen(false);
                    }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">group</label>
                  <select
                    className="field"
                    value={addGroup}
                    onChange={(e) => setAddGroup(e.target.value as Group)}
                  >
                    <option value="MAIN">main</option>
                    <option value="WHITELIST">whitelist</option>
                    <option value="SNIPING">sniping</option>
                    <option value="RESERVE">reserve</option>
                  </select>
                </div>
                <div className="flex items-end pb-[1px]">
                  <Button variant="primary" onClick={submitAdd}>BIND</Button>
                </div>
              </div>
              {addError && (
                <div className="mt-2 font-mono text-xxs text-bleed uppercase tracking-wide">
                  error: {addError}
                </div>
              )}
            </div>
          )}

          {wallets.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="font-serif italic text-mute">no wallets bound. the chamber is empty.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {wallets.map((w) => {
                const ready = w.status === "READY";
                return (
                  <li key={w.addr} className="px-3 py-3 flex items-center gap-3 flex-wrap row-hover">
                    <span
                      className={`w-2 h-2 shrink-0 ${
                        w.status === "READY" ? "bg-emerald-400" :
                        w.status === "LOW GAS" ? "bg-ape-200" :
                        "bg-bleed"
                      }`}
                      aria-hidden
                    />
                    <code className="font-mono text-xs text-ape-100 break-all">{SHORT(w.addr)}</code>
                    <span className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
                      · {w.group.toLowerCase()}
                    </span>
                    <span className="ml-auto font-mono text-xxs text-bone">
                      {w.balance.toFixed(2)} <span className="text-mute">ape</span>
                    </span>
                    <span
                      className="font-mono text-xxs min-w-[80px] text-right"
                      style={{ color: ready ? "#34d399" : "#5a5a6a" }}
                    >
                      {ready ? `+${projPerWallet.toFixed(2)} proj` : "—"}
                    </span>
                    <span className="ml-2">
                      {w.status === "READY"           ? <StatusBadge status="Open"     /> :
                       w.status === "LOW GAS"         ? <StatusBadge status="Pending"  /> :
                       w.status === "NOT WHITELISTED" ? <StatusBadge status="Locked"   /> :
                                                        <StatusBadge status="Rejected" />}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeWallet(w.addr)}
                      disabled={armed}
                      title={armed ? "halt chamber to unbind" : "unbind wallet"}
                      className="font-mono text-mute hover:text-bleed disabled:opacity-30 disabled:cursor-not-allowed px-1 leading-none text-base"
                      aria-label="unbind"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* ── 03 — EXECUTION MODE ── */}
        <Panel title="Execution Mode" right={<span>{mode.toLowerCase()}</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXEC_MODES.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className="text-left"
                  style={{
                    border: `1px solid ${active ? "#0040ff" : "#1a1a28"}`,
                    background: active ? "rgba(0,64,255,0.10)" : "transparent",
                    padding: "8px 10px",
                  }}
                >
                  <div className="font-mono text-xxs uppercase tracking-widest2"
                       style={{ color: active ? "#fff" : "#e8e8e8" }}>
                    {active ? "» " : "  "}{m.id.toLowerCase()}
                  </div>
                  <div className="text-xxs text-mute mt-1 font-serif italic">{m.blurb}</div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* ── 04 — GAS PRIORITY ── */}
        <Panel title="Gas Priority" right={<span>net median 0.62 gwei</span>}>
          <div className="grid grid-cols-3 gap-2">
            {GAS_TIERS.map((g) => {
              const active = g.id === tier;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTier(g.id)}
                  className="text-left"
                  style={{
                    border: `1px solid ${active ? "#0040ff" : "#1a1a28"}`,
                    background: active ? "rgba(0,64,255,0.10)" : "transparent",
                    padding: "8px 10px",
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xxs uppercase tracking-widest2"
                          style={{ color: active ? "#fff" : "#e8e8e8" }}>
                      {active ? "» " : "  "}{g.id.toLowerCase()}
                    </span>
                    <span className="font-mono text-xxxs text-elec">{g.gwei}</span>
                  </div>
                  <div className="text-xxs text-mute mt-1 font-serif italic">{g.blurb}</div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* ── 05 — PRE-MINT VALIDATION + PROFIT GAUGE ── */}
        <Panel title="Pre-Mint Validation" right={<span>{counts.ready} ready · {wallets.length - counts.ready} blocked</span>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <ValidationStat n={counts.ready}   label="READY"           tone="bone" />
            <ValidationStat n={counts.lowGas}  label="INSUFFICIENT"    tone="ape-200" />
            <ValidationStat n={counts.notWl}   label="NOT WHITELISTED" tone="mute" />
            <ValidationStat n={counts.invalid} label="INVALID"         tone="bleed" />
          </div>

          {/* Big projection bar — mint cost vs projected exit value. */}
          <div className="mt-2 mb-3">
            <div className="flex items-baseline justify-between font-mono text-xxs uppercase tracking-widest2 mb-1">
              <span className="text-mute">cost in &nbsp;<span className="text-bone">{totalApeStr} ape</span></span>
              <span className="text-mute">value out &nbsp;<span className="text-bone">{projectedGross.toFixed(2)} ape</span></span>
            </div>
            <div className="relative h-4 w-full bg-ape-950 border border-border overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-bleed"
                style={{
                  width: `${projectedGross > 0 ? Math.min(100, (totalCost / projectedGross) * 100) : 0}%`,
                  opacity: 0.85,
                }}
              />
              <div
                className="absolute inset-y-0 bg-elec"
                style={{
                  left: `${projectedGross > 0 ? Math.min(100, (totalCost / projectedGross) * 100) : 0}%`,
                  right: 0,
                  opacity: 0.85,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center font-mono text-xxs text-bone tracking-widest2">
                NET +{projectedNet.toFixed(2)} APE &nbsp;·&nbsp; {multiplier.toFixed(1)}×
              </div>
            </div>
          </div>

          <div className="divider-glitch my-3" aria-hidden />
          <dl className="grid grid-cols-[160px_1fr] gap-y-1 font-mono text-xxs uppercase tracking-widest2">
            <dt className="text-mute">projected nfts</dt>
            <dd className="text-bone">{totalNfts}</dd>
            <dt className="text-mute">aggregate cost</dt>
            <dd className="text-bone">{totalApeStr} ape</dd>
            <dt className="text-mute">projected exit</dt>
            <dd className="text-emerald-400">+{projectedNet.toFixed(2)} ape @ floor {currentFloor.toFixed(2)}</dd>
            <dt className="text-mute">gas est. (median)</dt>
            <dd className="text-bone">~ {(counts.ready * 0.0042).toFixed(4)} ape</dd>
            <dt className="text-mute">risk flags</dt>
            <dd className={counts.lowGas + counts.notWl + counts.invalid > 0 ? "text-bleed" : "text-emerald-400"}>
              {counts.lowGas + counts.notWl + counts.invalid > 0
                ? `${counts.lowGas + counts.notWl + counts.invalid} wallet(s) will be skipped`
                : "none — chamber clean"}
            </dd>
          </dl>
        </Panel>

        {/* ── 06 — RETRY & FAIL-SAFE ── */}
        <Panel title="Retry & Fail-Safe" right={<span>auto-recover active</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">max retries</label>
              <input
                className="field font-mono"
                value={maxRetries}
                onChange={(e) => setMaxRetries(e.target.value)}
              />
              <div className="text-xxs text-mute mt-1">
                per-wallet attempts before the chamber abandons it.
              </div>
            </div>
            <ToggleRow
              label="gas auto-bump"
              hint="re-broadcast underpriced tx at next tier."
              on={autoBump}
              onChange={setAutoBump}
            />
            <ToggleRow
              label="skip on repeat fail"
              hint="excise wallets that fail twice."
              on={skipOnFail}
              onChange={setSkipOnFail}
            />
          </div>
        </Panel>

        {/* ── ARM / LAUNCH ── */}
        <div
          className="panel"
          style={{
            borderColor: armed ? "#ff2d2d" : "#0040ff",
            background: armed ? "rgba(255,45,45,0.06)" : "rgba(0,64,255,0.06)",
            boxShadow: armed ? "0 0 0 1px rgba(255,45,45,0.4)" : "none",
          }}
        >
          <div className="panel-header" style={{ borderBottomColor: armed ? "#ff2d2d" : "#0040ff" }}>
            <span><span className="text-elec">&gt;</span> Chamber Control</span>
            <span className="font-mono text-xxxs tracking-widest text-mute normal-case">
              prototype · simulation only
            </span>
          </div>
          <div className="panel-body">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant={armed ? "default" : "primary"}
                onClick={toggleArm}
                className={armed ? "" : "pulse-soft"}
                style={{ minWidth: 200, fontSize: 14, padding: "10px 16px" }}
              >
                {armed ? "■ HALT CHAMBER" : `▶ ARM — capture +${projectedNet.toFixed(2)} APE`}
              </Button>
              <Button variant="ghost" onClick={resetSim}>RESET</Button>
              <div className="ml-auto text-right">
                <div className="font-mono text-xxs uppercase tracking-widest2 text-mute">payload</div>
                <div className="font-mono text-bone">
                  {counts.ready} wallets &nbsp;·&nbsp; {totalNfts} nft &nbsp;·&nbsp; {totalApeStr} ape
                </div>
                <div className="font-mono text-xxxs uppercase tracking-widest2 text-emerald-400 mt-1">
                  exit projection · {multiplier.toFixed(1)}× &nbsp;→&nbsp; +{projectedNet.toFixed(2)} ape
                </div>
              </div>
            </div>
            <p className="font-serif italic text-xs text-mute mt-3">
              {armed
                ? `— the chamber is moving. realized so far: +${realizedNet.toFixed(2)} ape.`
                : `— hesitation costs ${(currentVelocity * 0.04).toFixed(2)} ape per second at current floor.`}
            </p>
          </div>
        </div>

        {/* ── 07 — REAL-TIME DASHBOARD ── */}
        <Panel
          title="Real-Time Mint Dashboard"
          right={
            <span>
              success {counts.successRate}% &nbsp;·&nbsp;
              mined {counts.mined} &nbsp;·&nbsp;
              pending {counts.pending} &nbsp;·&nbsp;
              failed {counts.failed} &nbsp;·&nbsp;
              <span className="text-emerald-400">+{realizedNet.toFixed(2)} ape</span>
            </span>
          }
          padded={false}
        >
          <div className="h-2 w-full bg-ape-950 border-b border-border">
            <div
              className="h-full bg-ape-500 transition-all"
              style={{ width: `${counts.successRate}%` }}
            />
          </div>
          <ul className="divide-y divide-border">
            {wallets.map((w) => {
              const blocked = w.status !== "READY";
              const mined = w.tx === "MINED";
              const failed = w.tx === "FAILED";
              const realized = mined ? perWalletNum * perUnitGain : 0;
              return (
                <li key={w.addr} className="px-3 py-3 flex items-center gap-3 flex-wrap">
                  <code className="font-mono text-xs text-ape-100">{SHORT(w.addr)}</code>
                  <span className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
                    {w.group.toLowerCase()}
                  </span>

                  <div className="flex-1 min-w-[120px] mx-2">
                    <div className="h-1 w-full bg-ape-950 border border-border">
                      <div
                        className={`h-full transition-all ${
                          failed ? "bg-bleed" :
                          mined  ? "bg-emerald-400" :
                                   "bg-ape-500"
                        }`}
                        style={{ width: `${blocked ? 0 : w.progress}%` }}
                      />
                    </div>
                  </div>

                  <code className="font-mono text-xxs text-mute min-w-[120px] text-right">
                    {w.hash ?? (blocked ? "— skipped —" : "— awaiting —")}
                  </code>

                  <span
                    className="font-mono text-xxs min-w-[72px] text-right"
                    style={{
                      color: mined ? "#34d399" : failed ? "#ff2d2d" : blocked ? "#5a5a6a" : "#aaaadd",
                    }}
                  >
                    {mined  ? `+${realized.toFixed(2)}`
                    : failed ? "−gas"
                    : blocked ? "—"
                             : `~${projPerWallet.toFixed(2)}`}
                  </span>

                  <span className="ml-2">
                    {blocked              ? <StatusBadge status="Locked"   /> :
                     w.tx === "QUEUED"    ? <StatusBadge status="Open"     /> :
                     w.tx === "PENDING"   ? <StatusBadge status="Pending"  /> :
                     mined                ? <StatusBadge status="Done"     /> :
                                            <StatusBadge status="Rejected" />}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* ── 08 — LEADERBOARD ── */}
        <Panel
          title="Chamber Leaderboard · top 3 wallets"
          right={<span>by realized + projected gain</span>}
        >
          <ol className="space-y-3">
            {leaderboard.map((w, i) => {
              const total = w.realized + w.projected;
              const max = leaderboard[0] ? (leaderboard[0].realized + leaderboard[0].projected) || 1 : 1;
              const pct = (total / max) * 100;
              return (
                <li key={w.addr} className="flex items-center gap-3">
                  <span className="font-pixel text-2xl leading-none text-bleed w-8 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <code className="font-mono text-xs text-bone">{SHORT(w.addr)}</code>
                      <span className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
                        {w.group.toLowerCase()}
                      </span>
                      <span className="ml-auto font-mono text-xs text-emerald-400">
                        +{total.toFixed(2)} ape
                      </span>
                    </div>
                    <div className="h-1 w-full bg-ape-950 border border-border">
                      <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        {/* Closing whisper — matches the dashboard's tone. */}
        <p className="font-serif italic text-xs text-mute mt-6 text-right tilt-r">
          — the chamber remembers every wallet it has ever seen.
        </p>
      </div>
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────── */

function Sparkline({
  data,
  color,
  height = 36,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const width = 200;
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Build an area fill — extend the polyline down to the baseline.
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height }}
    >
      <polygon points={area} fill={color} fillOpacity={0.15} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  );
}

function HeroMetric({
  label,
  value,
  unit,
  sub,
  tone,
  pulse,
  big,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: "elec" | "bleed" | "bone";
  pulse?: boolean;
  big?: boolean;
}) {
  const color =
    tone === "elec"  ? "#0040ff" :
    tone === "bleed" ? "#ff2d2d" :
                       "#e8e8e8";
  return (
    <div
      className="panel"
      style={{
        borderColor: color,
        background: `linear-gradient(180deg, rgba(${tone === "elec" ? "0,64,255" : tone === "bleed" ? "255,45,45" : "232,232,232"},0.08), transparent 60%)`,
      }}
    >
      <div className="panel-header" style={{ borderBottomColor: color }}>
        <span><span style={{ color }}>&gt;</span> {label}</span>
        {pulse && (
          <span className="font-mono text-xxxs tracking-widest text-bleed normal-case pulse-soft">
            live
          </span>
        )}
      </div>
      <div className="panel-body">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-pixel leading-none ${big ? "text-5xl" : "text-3xl"} ${pulse ? "pulse-soft" : ""}`}
            style={{ color }}
          >
            {value}
          </span>
          {unit && (
            <span className="font-mono text-xxs uppercase tracking-widest2 text-mute">
              {unit}
            </span>
          )}
        </div>
        {sub && (
          <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mt-2">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function ValidationStat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: "bone" | "ape-200" | "mute" | "bleed";
}) {
  const color =
    tone === "bone"    ? "#e8e8e8" :
    tone === "ape-200" ? "#aaaadd" :
    tone === "mute"    ? "#5a5a6a" :
                         "#ff2d2d";
  return (
    <div style={{ borderLeft: `2px solid ${color}` }} className="pl-3 py-1">
      <div className="font-pixel text-3xl leading-none" style={{ color }}>
        {n}
      </div>
      <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mt-1">
        {label}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="w-full flex items-center gap-2 px-2 py-1"
        style={{
          border: `1px solid ${on ? "#0040ff" : "#1a1a28"}`,
          background: on ? "rgba(0,64,255,0.10)" : "transparent",
        }}
      >
        <span
          className="inline-block w-3 h-3"
          style={{
            background: on ? "#0040ff" : "transparent",
            border: `1px solid ${on ? "#0040ff" : "#5a5a6a"}`,
          }}
          aria-hidden
        />
        <span className="font-mono text-xxs uppercase tracking-widest2 text-bone">
          {on ? "engaged" : "off"}
        </span>
      </button>
      <div className="text-xxs text-mute mt-1 font-serif italic">{hint}</div>
    </div>
  );
}
