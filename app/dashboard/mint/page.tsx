"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";
import SimianOrderArtifact from "@/lib/abi/SimianOrder.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
const ZERO = "0x0000000000000000000000000000000000000000";
const MINT_ABI = SimianOrderArtifact.abi;
const MAX_SUPPLY = 3333;

function publicRpcFor(chainId: number | null): string | null {
  if (chainId === 33139) return "https://apechain.calderachain.xyz/http";
  if (chainId === 33111) return "https://curtis.rpc.caldera.xyz/http";
  return null;
}

function explorerTx(hash: string): string {
  const id = Number(CHAIN_ID);
  if (id === 33139) return `https://apescan.io/tx/${hash}`;
  if (id === 33111) return `https://curtis.apescan.io/tx/${hash}`;
  return `#${hash}`;
}

function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

function formatTxError(e: unknown): string {
  const err = e as { code?: string | number; reason?: string; shortMessage?: string; message?: string };
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001) return "transaction rejected";
  if (err?.code === "INSUFFICIENT_FUNDS") return "insufficient funds for gas";
  if (typeof err?.reason === "string") return err.reason;
  if (typeof err?.shortMessage === "string") return err.shortMessage;
  if (typeof err?.message === "string") return err.message;
  return "mint failed";
}

type Step = "idle" | "fetching-sig" | "awaiting-wallet" | "broadcast" | "minted" | "error";

export default function MintPage() {
  const { mintEligible, fcfsApproved, applicationStatus } = useStore();
  const { address, connect } = useWallet();
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [minted, setMinted] = useState<number>(0);
  const [supplyLoaded, setSupplyLoaded] = useState(false);

  // Read totalMinted from chain when contract is configured.
  useEffect(() => {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.toLowerCase() === ZERO) {
      setSupplyLoaded(true);
      return;
    }
    const id = CHAIN_ID ? Number(CHAIN_ID) : null;
    const rpc = publicRpcFor(id);
    if (!rpc || !id) { setSupplyLoaded(true); return; }
    let alive = true;
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(rpc, id);
        const c = new ethers.Contract(CONTRACT_ADDRESS, MINT_ABI, provider);
        const n: bigint = await c.totalMinted();
        if (alive) { setMinted(Number(n)); setSupplyLoaded(true); }
      } catch {
        if (alive) setSupplyLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const remaining = Math.max(0, MAX_SUPPLY - minted);

  const state: "locked" | "live" = useMemo(() => {
    if (!mintEligible) return "locked";
    return "live";
  }, [mintEligible]);

  async function ensureChain(provider: ethers.BrowserProvider) {
    if (!CHAIN_ID) return;
    const expected = BigInt(CHAIN_ID);
    const current = (await provider.getNetwork()).chainId;
    if (current === expected) return;
    const hex = "0x" + expected.toString(16);
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hex }],
      });
    } catch {
      throw new Error(`wrong network — switch wallet to chain ${CHAIN_ID}`);
    }
  }

  async function mint() {
    setError(null);
    setTxHash(null);

    if (!address) {
      await connect();
      return;
    }
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.toLowerCase() === ZERO) {
      setError("contract not yet deployed");
      setStep("error");
      return;
    }

    try {
      setStep("fetching-sig");
      const sigRes = await fetch("/api/signature/get-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      if (!sigRes.ok) {
        const j = await sigRes.json().catch(() => ({}));
        throw new Error(j.error || `signature_failed_${sigRes.status}`);
      }
      const {
        signature,
        phase: mintPhase,
        maxAllowed,
      } = (await sigRes.json()) as { signature: string; phase: number; maxAllowed: number };

      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("no wallet provider — install MetaMask");
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await ensureChain(provider);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, MINT_ABI, signer);
      setStep("awaiting-wallet");
      const tx = await contract.mint(qty, mintPhase, maxAllowed, signature);

      setTxHash(tx.hash);
      setStep("broadcast");
      await tx.wait();

      // Re-read total from chain.
      try {
        const total: bigint = await contract.totalMinted();
        setMinted(Number(total));
      } catch { /* keep previous */ }

      setStep("minted");
    } catch (e) {
      setError(formatTxError(e));
      setStep("error");
    }
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

  const pct = (minted / MAX_SUPPLY) * 100;
  const busy = step === "fetching-sig" || step === "awaiting-wallet" || step === "broadcast";

  const buttonLabel = !address
    ? "Connect & Mint"
    : step === "fetching-sig"
    ? "Requesting signature..."
    : step === "awaiting-wallet"
    ? "Confirm in wallet..."
    : step === "broadcast"
    ? "Minting on-chain..."
    : "Mint";

  return (
    <Panel
      title="Mint"
      right={<StatusBadge status={state === "live" ? "Open" : "Locked"} />}
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
                <span className="text-ape-100 font-mono">{supplyLoaded ? minted : "—"}</span>
                <span className="font-mono"> / {MAX_SUPPLY}</span>
              </span>
            </div>
            <div className="h-3 w-full bg-ape-950 border border-border mt-1">
              <div className="h-full bg-ape-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xxs">
            <div className="border border-border bg-ape-950 px-2 py-1">
              <div className="text-mute uppercase">remaining</div>
              <div className="text-ape-100 font-mono">{supplyLoaded ? remaining : "—"}</div>
            </div>
            <div className="border border-border bg-ape-950 px-2 py-1">
              <div className="text-mute uppercase">network</div>
              <div className="text-ape-100 font-mono">chain {CHAIN_ID ?? "?"}</div>
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
              <div className="flex gap-2 pt-1 flex-wrap">
                <Link href="/dashboard/tasks"><Button variant="primary">Open Tasks</Button></Link>
                <Link href="/dashboard/apply"><Button variant="ghost">Open Application</Button></Link>
              </div>
            </div>
          )}

          {state === "live" && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="label mb-0">qty</label>
                <div className="flex">
                  <button
                    className="btn-old px-2"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    aria-label="decrease"
                    disabled={busy}
                  >−</button>
                  <input
                    className="field w-12 text-center font-mono"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(2, Number(e.target.value) || 1)))}
                    disabled={busy}
                  />
                  <button
                    className="btn-old px-2"
                    onClick={() => setQty(Math.min(2, qty + 1))}
                    aria-label="increase"
                    disabled={busy}
                  >+</button>
                </div>
              </div>

              {step === "minted" ? (
                <div className="space-y-2 border border-ape-300 bg-ape-800 p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="Done" />
                    <span className="text-xxs uppercase tracking-wide text-ape-100">tx confirmed</span>
                  </div>
                  <p className="text-xs text-ape-100">
                    you received <span className="font-mono">{qty}</span> simian{qty > 1 ? "s" : ""}.
                    welcome.
                  </p>
                  {txHash && (
                    <div className="text-xxs font-mono break-all">
                      <a href={explorerTx(txHash)} target="_blank" rel="noreferrer" className="text-ape-300">
                        {shortHash(txHash)} ↗
                      </a>
                    </div>
                  )}
                  <Button variant="ghost" onClick={() => { setStep("idle"); setTxHash(null); }}>Mint again</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="primary"
                      onClick={mint}
                      disabled={busy || (supplyLoaded && remaining === 0)}
                    >
                      {buttonLabel}
                    </Button>
                    {!address && <span className="text-xxs text-mute">connect a wallet first</span>}
                  </div>

                  {step === "broadcast" && txHash && (
                    <div className="border border-border bg-ape-950 p-2 text-xxs space-y-1">
                      <div className="text-ape-200 uppercase tracking-wide">awaiting confirmation…</div>
                      <a
                        href={explorerTx(txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ape-300 font-mono break-all"
                      >
                        {shortHash(txHash)} ↗
                      </a>
                    </div>
                  )}

                  {step === "error" && error && (
                    <div className="border border-red-700 bg-red-950 px-2 py-2 text-xxs">
                      <div className="text-red-200 uppercase tracking-wide">error</div>
                      <div className="text-red-200 font-mono break-all">{error}</div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
