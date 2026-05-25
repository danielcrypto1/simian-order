"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";

/**
 * MINT CHAMBER — multi-wallet NFT minter prototype.
 *
 * Visual demo only. Nothing here calls a chain, signs anything, or
 * fetches real state. SIMIAN ORDER holder-gated tool that lets the
 * user bind multiple wallets, see which are whitelisted, configure
 * a mint, and watch a per-wallet success/fail dashboard once the
 * mint runs. Not linked from any nav — reachable only by typing
 * /mintchamber.
 */

const SIMIAN_HELD = 3;
const SLOTS_PER_SIMIAN = 5;
const SLOTS_TOTAL = SIMIAN_HELD * SLOTS_PER_SIMIAN;

const MINT_PRICE = 1.0;   // APE per NFT
const PER_WALLET = 5;     // NFTs minted per wallet per run

type MintStatus = "idle" | "minting" | "success" | "failed" | "skipped";

type Wallet = {
  id: string;
  addr: string;
  balance: number;     // APE
  whitelisted: boolean;
  status: MintStatus;
  minted: number;      // 0..PER_WALLET
  txHash: string | null;
};

const SHORT = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function randHex(n: number) {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function genWallet(whitelisted?: boolean): Wallet {
  return {
    id: "w" + Math.random().toString(36).slice(2, 10),
    addr: "0x" + randHex(40),
    balance: parseFloat((Math.random() * 8 + 2).toFixed(2)),
    whitelisted: whitelisted ?? Math.random() < 0.7,
    status: "idle",
    minted: 0,
    txHash: null,
  };
}

const INITIAL_WALLETS: Wallet[] = [
  { id: "w1", addr: "0x9a17d3b1f4c2e88d4ce8b8a7be4a6d9c1f02e771", balance: 8.42, whitelisted: true,  status: "idle", minted: 0, txHash: null },
  { id: "w2", addr: "0x6f02b41cdd3a18bb55c0e89aaa7cf201a7c4d9e3", balance: 6.18, whitelisted: true,  status: "idle", minted: 0, txHash: null },
  { id: "w3", addr: "0xbd29c8773e9a01a7e44e6f3f8cd0a2e8b9e1c4a6", balance: 5.62, whitelisted: false, status: "idle", minted: 0, txHash: null },
];

export default function MintChamberPage() {
  const [wallets, setWallets] = useState<Wallet[]>(INITIAL_WALLETS);
  const [addOpen, setAddOpen] = useState(false);
  const [addAddr, setAddAddr] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [wcConnecting, setWcConnecting] = useState(false);
  const [minting, setMinting] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Derived
  const requiredBalance = MINT_PRICE * PER_WALLET;
  const eligibleCount = wallets.filter((w) => w.whitelisted && w.balance >= requiredBalance).length;
  const ineligibleCount = wallets.length - eligibleCount;
  const totalNfts = eligibleCount * PER_WALLET;
  const totalCost = eligibleCount * PER_WALLET * MINT_PRICE;
  const atCapacity = wallets.length >= SLOTS_TOTAL;
  const canMint = eligibleCount > 0 && !minting;

  // Mint simulation: each tick advances `minted` for any minting wallet;
  // when it hits PER_WALLET, the wallet resolves to success or failed.
  useEffect(() => {
    if (!minting) return;
    const tick = setInterval(() => {
      setWallets((prev) => {
        const next = prev.map((w) => ({ ...w }));
        let stillWorking = false;
        for (const w of next) {
          if (!w.whitelisted || w.balance < requiredBalance) {
            if (w.status !== "skipped") w.status = "skipped";
            continue;
          }
          if (w.status === "success" || w.status === "failed") continue;
          stillWorking = true;
          if (w.status === "idle") {
            w.status = "minting";
            w.txHash = "0x" + randHex(12) + "…" + randHex(4);
          }
          if (w.minted < PER_WALLET) {
            w.minted += 1;
          }
          if (w.minted >= PER_WALLET) {
            w.status = Math.random() < 0.92 ? "success" : "failed";
          }
        }
        if (!stillWorking) {
          // last frame settled — flip out of minting on next macrotask
          setTimeout(() => setMinting(false), 200);
        }
        return next;
      });
    }, 600);
    return () => clearInterval(tick);
    // requiredBalance is constant; effect re-arms when `minting` flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minting]);

  // ── Wallet roster handlers ──────────────────────────────────────────
  function openAddForm() {
    setAddOpen((v) => !v);
    setAddAddr("");
    setAddError(null);
  }

  function submitAdd() {
    const v = addAddr.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(v)) {
      setAddError("invalid address — must be 0x followed by 40 hex characters");
      return;
    }
    if (wallets.some((w) => w.addr.toLowerCase() === v)) {
      setAddError("this wallet is already added");
      return;
    }
    setWallets((ws) => [
      ...ws,
      {
        ...genWallet(),
        addr: v,
      },
    ]);
    setAddOpen(false);
    setAddAddr("");
    setAddError(null);
  }

  function runWalletConnect() {
    if (atCapacity || wcConnecting) return;
    setWcConnecting(true);
    setTimeout(() => {
      setWallets((ws) => [...ws, genWallet()]);
      setWcConnecting(false);
    }, 1500);
  }

  function runImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setTimeout(() => {
      const n = Math.min(3, SLOTS_TOTAL - wallets.length);
      if (n <= 0) return;
      const newOnes: Wallet[] = Array.from({ length: n }, () => genWallet());
      setWallets((ws) => [...ws, ...newOnes]);
    }, 800);
    e.target.value = "";
  }

  function removeWallet(id: string) {
    setWallets((ws) => ws.filter((w) => w.id !== id));
  }

  // ── Mint controls ───────────────────────────────────────────────────
  function startMint() {
    if (!canMint) return;
    setWallets((ws) =>
      ws.map((w) => ({ ...w, status: "idle" as const, minted: 0, txHash: null }))
    );
    setDashboardOpen(true);
    setMinting(true);
  }

  function stopMint() {
    setMinting(false);
  }

  function reset() {
    setMinting(false);
    setDashboardOpen(false);
    setWallets(INITIAL_WALLETS.map((w) => ({ ...w })));
  }

  // Dashboard summary
  const successCount = wallets.filter((w) => w.status === "success").length;
  const failedCount  = wallets.filter((w) => w.status === "failed").length;
  const skippedCount = wallets.filter((w) => w.status === "skipped").length;
  const mintingCount = wallets.filter((w) => w.status === "minting").length;
  const mintedNfts   = wallets.reduce((s, w) => s + (w.status === "success" ? w.minted : 0), 0);

  return (
    <div className="space-y-10">
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <header className="text-center space-y-4">
        <h1 className="headline text-5xl md:text-7xl leading-none">
          mint chamber<span className="text-bleed">.</span>
        </h1>
        <p className="font-sans text-lg sm:text-xl text-ape-200 max-w-2xl mx-auto leading-relaxed">
          mint multiple NFTs across multiple wallets in a single click.
          SIMIAN ORDER holders only.
        </p>
        <div className="flex flex-wrap gap-4 items-center justify-center pt-2">
          <span
            className="badge text-elec"
            style={{ fontSize: 13, padding: "6px 12px", letterSpacing: "0.18em" }}
          >
            SIMIAN · {SIMIAN_HELD} HELD
          </span>
          <span className="font-sans text-base text-bone">
            {SLOTS_TOTAL} wallet slots unlocked
          </span>
        </div>
      </header>

      {/* ── TWO-COLUMN MAIN ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* LEFT — wallet roster */}
        <Panel
          title="wallets"
          right={
            <span className="text-sm">
              {wallets.length}/{SLOTS_TOTAL} added
              {atCapacity && <span className="ml-2 text-bleed">· FULL</span>}
            </span>
          }
        >
          {/* Add controls */}
          <div className="flex flex-wrap gap-2 mb-4">
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
              disabled={atCapacity || wcConnecting}
            >
              {wcConnecting ? "CONNECTING…" : "+ WALLETCONNECT"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={atCapacity}
            >
              IMPORT CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.json"
              onChange={runImport}
              hidden
            />
          </div>

          {/* Inline add form */}
          {addOpen && (
            <div
              className="mb-4 p-4 border border-elec"
              style={{ background: "rgba(0,64,255,0.05)" }}
            >
              <label className="block font-mono text-sm uppercase tracking-wider text-ape-200 mb-2">
                paste wallet address
              </label>
              <div className="flex flex-wrap gap-2 items-stretch">
                <input
                  className="field font-mono flex-1 min-w-[260px]"
                  style={{ padding: "10px 12px", fontSize: 14 }}
                  value={addAddr}
                  onChange={(e) => setAddAddr(e.target.value)}
                  placeholder="0x..."
                  spellCheck={false}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitAdd();
                    if (e.key === "Escape") setAddOpen(false);
                  }}
                />
                <Button variant="primary" onClick={submitAdd}>
                  ADD
                </Button>
              </div>
              {addError && (
                <p className="mt-2 font-mono text-sm text-bleed">{addError}</p>
              )}
            </div>
          )}

          {/* Empty / populated roster */}
          {wallets.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="font-sans text-lg text-bone">no wallets added yet.</p>
              <p className="font-sans text-base text-ape-200">
                use <span className="text-elec">+ ADD WALLET</span> or{" "}
                <span className="text-elec">+ WALLETCONNECT</span> above.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {wallets.map((w) => {
                const eligible = w.whitelisted && w.balance >= requiredBalance;
                return (
                  <li
                    key={w.id}
                    className="flex items-center gap-3 flex-wrap p-3 border border-border"
                    style={{ background: "rgba(10,10,14,0.6)" }}
                  >
                    {/* Status dot */}
                    <span
                      className="w-2.5 h-2.5 shrink-0"
                      style={{ background: eligible ? "#34d399" : "#ff2d2d" }}
                      aria-hidden
                    />

                    <code className="font-mono text-base text-bone">
                      {SHORT(w.addr)}
                    </code>

                    <span className="font-mono text-base text-bone ml-auto">
                      {w.balance.toFixed(2)}{" "}
                      <span className="text-ape-200">APE</span>
                    </span>

                    {w.whitelisted ? (
                      <span
                        className="font-mono text-sm uppercase tracking-wider text-emerald-400"
                        style={{ minWidth: 170, textAlign: "right" }}
                      >
                        ✓ WHITELISTED
                      </span>
                    ) : (
                      <span
                        className="font-mono text-sm uppercase tracking-wider text-bleed"
                        style={{ minWidth: 170, textAlign: "right" }}
                      >
                        ✗ NOT WHITELISTED
                      </span>
                    )}

                    {w.whitelisted && w.balance < requiredBalance && (
                      <span className="font-mono text-sm text-bleed">
                        low funds
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => removeWallet(w.id)}
                      disabled={minting}
                      title={minting ? "stop mint to remove" : "remove wallet"}
                      className="font-mono text-mute hover:text-bleed disabled:opacity-30 disabled:cursor-not-allowed px-2 leading-none"
                      style={{ fontSize: 22 }}
                      aria-label="remove wallet"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* RIGHT — mint details + mint button */}
        <div className="space-y-4">
          <Panel title="mint details">
            <dl className="space-y-3">
              <DetailRow label="price per NFT">
                {MINT_PRICE.toFixed(2)} APE
              </DetailRow>
              <DetailRow label="NFTs per wallet">{PER_WALLET}</DetailRow>
              <DetailRow label="wallets eligible">
                <span className={eligibleCount > 0 ? "text-bone" : "text-bleed"}>
                  {eligibleCount} / {wallets.length}
                </span>
              </DetailRow>
              <DetailRow label="ineligible">
                <span className={ineligibleCount > 0 ? "text-bleed" : "text-mute"}>
                  {ineligibleCount}
                </span>
              </DetailRow>
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <DetailRow label="total NFTs" highlight>
                  {totalNfts}
                </DetailRow>
                <DetailRow label="total cost" highlight>
                  {totalCost.toFixed(2)} APE
                </DetailRow>
              </div>
            </dl>
          </Panel>

          {/* Big MINT button */}
          <button
            type="button"
            onClick={minting ? stopMint : startMint}
            disabled={!minting && !canMint}
            className="w-full font-mono uppercase"
            style={{
              padding: "18px 16px",
              fontSize: 17,
              letterSpacing: "0.14em",
              border: `2px solid ${
                minting ? "#ff2d2d" : canMint ? "#0040ff" : "#1a1a28"
              }`,
              background: minting ? "#ff2d2d" : canMint ? "#0040ff" : "transparent",
              color: minting ? "#000" : canMint ? "#fff" : "#5a5a6a",
              cursor: minting || canMint ? "pointer" : "not-allowed",
              transition: "none",
            }}
          >
            {minting
              ? "■ STOP MINT"
              : eligibleCount === 0
              ? "no eligible wallets"
              : `▶ MINT — ${totalNfts} NFTS · ${totalCost.toFixed(2)} APE`}
          </button>

          {dashboardOpen && !minting && (
            <Button onClick={reset} variant="ghost" className="w-full">
              RESET CHAMBER
            </Button>
          )}

          <p className="font-sans text-sm text-ape-200 leading-relaxed">
            each eligible wallet will sign and broadcast{" "}
            <span className="text-bone">{PER_WALLET}</span> mint transactions —
            a total of{" "}
            <span className="text-bone">
              {(MINT_PRICE * PER_WALLET).toFixed(2)} APE
            </span>{" "}
            per wallet.
          </p>
        </div>
      </div>

      {/* ── DASHBOARD (full width below) ──────────────────────────── */}
      {dashboardOpen && (
        <Panel
          title="mint dashboard"
          right={
            <span className="text-sm">
              {minting ? "running…" : "complete"} &nbsp;·&nbsp;{" "}
              <span className="text-emerald-400">{successCount} ok</span> ·{" "}
              <span className="text-bleed">{failedCount} fail</span> ·{" "}
              <span className="text-ape-200">{skippedCount} skipped</span>
            </span>
          }
        >
          {/* Per-wallet progress rows */}
          <ul className="space-y-2 mb-5">
            {wallets.map((w) => {
              const eligible = w.whitelisted && w.balance >= requiredBalance;
              const pct = (w.minted / PER_WALLET) * 100;
              const barColor =
                w.status === "failed"
                  ? "#ff2d2d"
                  : w.status === "success"
                  ? "#34d399"
                  : "#0040ff";
              return (
                <li
                  key={w.id}
                  className="flex items-center gap-4 flex-wrap p-3 border border-border"
                  style={{ background: "rgba(10,10,14,0.6)" }}
                >
                  <code
                    className="font-mono text-base text-bone"
                    style={{ minWidth: 140 }}
                  >
                    {SHORT(w.addr)}
                  </code>

                  <div className="flex-1 min-w-[180px]">
                    <div
                      className="h-3 w-full border border-border"
                      style={{ background: "#050507" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${eligible ? pct : 0}%`,
                          background: barColor,
                        }}
                      />
                    </div>
                    {w.txHash && (
                      <div className="font-mono text-xs text-ape-200 mt-1">
                        tx: {w.txHash}
                      </div>
                    )}
                  </div>

                  <span
                    className="font-mono text-base text-bone"
                    style={{ minWidth: 70, textAlign: "right" }}
                  >
                    {eligible ? `${w.minted} / ${PER_WALLET}` : "—"}
                  </span>

                  <span
                    className="font-mono text-base uppercase tracking-wider"
                    style={{
                      minWidth: 170,
                      textAlign: "right",
                      color:
                        w.status === "success"
                          ? "#34d399"
                          : w.status === "failed"
                          ? "#ff2d2d"
                          : w.status === "skipped"
                          ? "#5a5a6a"
                          : w.status === "minting"
                          ? "#aaaadd"
                          : "#aaaadd",
                    }}
                  >
                    {w.status === "success"
                      ? "✓ SUCCESS"
                      : w.status === "failed"
                      ? "✗ FAILED"
                      : w.status === "skipped"
                      ? "⊘ SKIPPED"
                      : w.status === "minting"
                      ? "⟳ MINTING…"
                      : "WAITING"}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Summary block */}
          <div
            className="p-4 border space-y-2"
            style={{
              borderColor: failedCount > 0 ? "#ff2d2d" : "#0040ff",
              background:
                failedCount > 0
                  ? "rgba(255,45,45,0.06)"
                  : "rgba(0,64,255,0.06)",
            }}
          >
            <p className="font-mono text-sm uppercase tracking-wider text-elec">
              summary
            </p>
            <p className="font-sans text-lg text-bone leading-relaxed">
              <span className="text-emerald-400 font-bold">{mintedNfts}</span>{" "}
              NFT{mintedNfts === 1 ? "" : "s"} minted successfully across{" "}
              <span className="text-emerald-400 font-bold">{successCount}</span>{" "}
              wallet{successCount === 1 ? "" : "s"}.
            </p>
            {minting && mintingCount > 0 && (
              <p className="font-sans text-base text-ape-200">
                {mintingCount} wallet{mintingCount === 1 ? "" : "s"} still
                minting…
              </p>
            )}
            {failedCount > 0 && (
              <p className="font-sans text-base text-bleed">
                {failedCount} wallet{failedCount === 1 ? "" : "s"} failed to
                mint (network or revert).
              </p>
            )}
            {skippedCount > 0 && (
              <p className="font-sans text-base text-ape-200">
                {skippedCount} wallet{skippedCount === 1 ? "" : "s"} skipped —
                not whitelisted or insufficient funds.
              </p>
            )}
            {!minting &&
              successCount + failedCount + skippedCount === wallets.length && (
                <p className="font-sans text-base text-bone pt-1">
                  run complete. press{" "}
                  <span className="text-elec">RESET CHAMBER</span> to start
                  another.
                </p>
              )}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ── Small helper for the mint-details key-value rows ────────────── */
function DetailRow({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-sm uppercase tracking-wider text-ape-200">
        {label}
      </dt>
      <dd
        className={`font-mono ${
          highlight ? "text-lg text-emerald-400 font-bold" : "text-base text-bone"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}
