"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Panel from "@/components/Panel";
import Button from "@/components/Button";

// Browser-extension wallet (MetaMask, Rabby, Phantom, etc.) is exposed
// as an EIP-1193 provider. When several are installed they fight over
// window.ethereum (notably Phantom hijacks the slot), so we discover
// them via EIP-6963 and pick MetaMask explicitly.
type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EthProvider[]; // legacy multi-provider field
};

type EIP6963ProviderDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EthProvider;
};

declare global {
  interface Window {
    ethereum?: EthProvider;
  }
}

// Sepolia testnet config — used to switch / add the chain in MM.
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111
const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: "Sepolia",
  nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.org", "https://ethereum-sepolia.publicnode.com"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

// keccak256("mint(uint256)").slice(0, 10) — standard ERC721A-style
// public-mint selector. Combined with a 32-byte uint256 quantity.
const MINT_SELECTOR = "0xa0712d68";

/**
 * Find the MetaMask EIP-1193 provider, even when other wallets
 * (Phantom, Coinbase, Rabby…) are installed and squatting on
 * window.ethereum.
 *
 * Strategy:
 *   1. EIP-6963 — broadcast `eip6963:requestProvider`, listen for
 *      announcements, pick the one whose rdns is "io.metamask".
 *   2. Fall back to window.ethereum.providers[] (legacy multi-wallet
 *      shim) and filter for `isMetaMask && !isPhantom`.
 *   3. Last resort: window.ethereum itself, only if it claims to be
 *      MetaMask and not Phantom / Coinbase.
 *
 * Returns the resolved provider or null.
 */
function findMetaMaskProvider(timeoutMs = 250): Promise<EthProvider | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const candidates: EIP6963ProviderDetail[] = [];

    function onAnnounce(e: Event) {
      const detail = (e as CustomEvent<EIP6963ProviderDetail>).detail;
      if (detail?.info && detail.provider) candidates.push(detail);
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);

      // 1. Prefer the EIP-6963 MetaMask announcement.
      const mm6963 =
        candidates.find((c) => c.info.rdns === "io.metamask") ||
        candidates.find((c) => /metamask/i.test(c.info.name));
      if (mm6963) {
        resolve(mm6963.provider);
        return;
      }

      // 2. Legacy: window.ethereum.providers[] array.
      const eth = window.ethereum;
      if (eth?.providers && Array.isArray(eth.providers)) {
        const mm = eth.providers.find(
          (p) => p.isMetaMask && !p.isPhantom && !p.isCoinbaseWallet
        );
        if (mm) { resolve(mm); return; }
      }

      // 3. Last resort: window.ethereum itself, only if it really is MM.
      if (eth && eth.isMetaMask && !eth.isPhantom && !eth.isCoinbaseWallet) {
        resolve(eth);
        return;
      }

      resolve(null);
    }, timeoutMs);
  });
}

/**
 * MINT CHAMBER — premium multi-wallet NFT minter (prototype).
 *
 * Wallet roster, execution-mode tiles, gas-priority tiles, and the
 * dashboard are all visual demo. The MINT button itself now triggers
 * the REAL MetaMask popup via window.ethereum / eth_sendTransaction;
 * on user sign the demo simulation runs and the connected wallet's
 * real tx hash is shown in the dashboard.
 * Not linked from any nav — direct URL only.
 */

const SIMIAN_HELD = 3;
const SLOTS_PER_SIMIAN = 5;
const SLOTS_TOTAL = SIMIAN_HELD * SLOTS_PER_SIMIAN;

const COLLECTION_NAME = "TEST COLLECTION";
const COLLECTION_NETWORK = "Sepolia";
const COLLECTION_SUPPLY_MAX = 5000;
const COLLECTION_IMAGE = "/media/void.png";

// Block-explorer helpers — used so the demo's tx hashes and contract
// address can be clicked through to a real explorer page. Wallets +
// contract on this page are mock, so destinations 404 — fine for a
// recording, makes the UI look legit. Using Sepolia + test ETH so the
// minting "funds" look like a normal EVM testnet mint, since ApeChain
// has no public testnet equivalent.
const EXPLORER_BASE = "https://sepolia.etherscan.io";
const explorerAddr = (a: string) => `${EXPLORER_BASE}/address/${a}`;
const explorerTx   = (h: string) => `${EXPLORER_BASE}/tx/${h}`;

type ExecMode = "SIMULTANEOUS" | "OPTIMIZED" | "STAGGERED" | "RECALL";
type GasTier = "HIGH" | "BALANCED" | "LOW";
type MintStatus = "idle" | "minting" | "success" | "failed" | "skipped";

type Wallet = {
  id: string;
  label: string;
  addr: string;
  balance: number;     // ETH (test ETH on Sepolia)
  whitelisted: boolean;
  status: MintStatus;
  minted: number;
  txHashes: string[];  // one full-length hash per NFT minted
  queuePos: number | null;
  gasUsed: number;     // ETH (test ETH)
};

const EXEC_MODES: {
  id: ExecMode;
  icon: string;
  label: string;
  blurb: string;
}[] = [
  { id: "SIMULTANEOUS", icon: "»",  label: "simultaneous", blurb: "fire all wallets in one batch — fastest." },
  { id: "OPTIMIZED",    icon: "✦",  label: "optimized",    blurb: "auto-paced against live network conditions." },
  { id: "STAGGERED",    icon: "≡",  label: "staggered",    blurb: "spread broadcasts with randomised delays." },
  { id: "RECALL",       icon: "↺",  label: "recall",       blurb: "auto-retry up to 3× on failure." },
];

const GAS_TIERS: {
  id: GasTier;
  icon: string;
  label: string;
  gwei: string;
  blurb: string;
}[] = [
  { id: "HIGH",     icon: "▲", label: "high",     gwei: "0.84", blurb: "front of block" },
  { id: "BALANCED", icon: "◆", label: "balanced", gwei: "0.62", blurb: "network median" },
  { id: "LOW",      icon: "▽", label: "low",      gwei: "0.41", blurb: "patient bidder" },
];

const SHORT = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function randHex(n: number) {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

const LABEL_POOL = ["Sniper", "Vault", "Reserve", "Main", "Alt", "Drop", "Bench", "Quiet"];

function genWallet(): Wallet {
  return {
    id: "w" + Math.random().toString(36).slice(2, 10),
    label: LABEL_POOL[Math.floor(Math.random() * LABEL_POOL.length)] + "-" + Math.floor(Math.random() * 99 + 1),
    addr: "0x" + randHex(40),
    balance: parseFloat((Math.random() * 8 + 2).toFixed(2)),
    whitelisted: Math.random() < 0.7,
    status: "idle",
    minted: 0,
    txHashes: [],
    queuePos: null,
    gasUsed: 0,
  };
}

const INITIAL_WALLETS: Wallet[] = [
  { id: "w1", label: "Main",      addr: "0x9a17d3b1f4c2e88d4ce8b8a7be4a6d9c1f02e771", balance: 8.42, whitelisted: true,  status: "idle", minted: 0, txHashes: [], queuePos: null, gasUsed: 0 },
  { id: "w2", label: "Sniper-12", addr: "0x6f02b41cdd3a18bb55c0e89aaa7cf201a7c4d9e3", balance: 6.18, whitelisted: true,  status: "idle", minted: 0, txHashes: [], queuePos: null, gasUsed: 0 },
  { id: "w3", label: "Reserve",   addr: "0xbd29c8773e9a01a7e44e6f3f8cd0a2e8b9e1c4a6", balance: 5.62, whitelisted: false, status: "idle", minted: 0, txHashes: [], queuePos: null, gasUsed: 0 },
];

export default function MintChamberPage() {
  // ── Mint config ─────────────────────────────────────────────────────
  // Fresh fake contract — no resemblance to any real deployment. Safe
  // for screen-recording without needing to blur the address.
  const [contract, setContract]   = useState("0x6f9c4e8b3a7d5f2c1e9b8d4a0f3e7c2b5d9a8f1c");
  // Default 0.001 ETH × 5 = 0.005 ETH per batch — small enough that a
  // common Sepolia faucet drop (~0.05 ETH) covers it many times over,
  // and MetaMask won't flag the tx as suspicious. Override via the
  // price / max inputs in the configure strip.
  const [priceStr, setPriceStr]   = useState("0.001");
  const [maxStr, setMaxStr]       = useState("5");

  // Blur the contract address on screen so a recording doesn't expose
  // the deployment. State value is untouched — eth_sendTransaction
  // still gets the real bytes. Click the 👁 toggle to reveal.
  const [addrBlurred, setAddrBlurred] = useState(true);
  const [supply, setSupply]       = useState(4420);

  const price   = Math.max(0, parseFloat(priceStr) || 0);
  const maxMint = Math.max(0, parseInt(maxStr, 10) || 0);

  // Slow ambient supply tick — collection feels alive while the page sits.
  useEffect(() => {
    const id = setInterval(() => {
      setSupply((s) => Math.min(COLLECTION_SUPPLY_MAX - 8, s + (Math.random() < 0.5 ? 1 : 0)));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // ── Execution + gas ──────────────────────────────────────────────────
  const [mode, setMode] = useState<ExecMode>("OPTIMIZED");
  const [tier, setTier] = useState<GasTier>("BALANCED");

  // ── Wallet roster ────────────────────────────────────────────────────
  const [wallets, setWallets] = useState<Wallet[]>(INITIAL_WALLETS);
  const [addOpen, setAddOpen] = useState(false);
  const [addAddr, setAddAddr] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [wcConnecting, setWcConnecting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function canWalletMint(w: Wallet) {
    if (!w.whitelisted) return 0;
    if (price <= 0) return 0;
    const byBalance = Math.floor(w.balance / price);
    return Math.min(maxMint, Math.max(0, byBalance));
  }

  // ── Run state ────────────────────────────────────────────────────────
  const [minting, setMinting] = useState(false);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Live elapsed counter while minting.
  useEffect(() => {
    if (!runStart) return;
    const id = setInterval(() => setElapsedMs(Date.now() - runStart), 250);
    return () => clearInterval(id);
  }, [runStart]);

  // Simulation engine — concurrency follows the mode, tick speed follows
  // the gas tier, and RECALL retries failed wallets once.
  useEffect(() => {
    if (!minting) return;
    const tickMs = tier === "HIGH" ? 380 : tier === "BALANCED" ? 540 : 720;
    const tick = setInterval(() => {
      setWallets((prev) => {
        const next = prev.map((w) => ({ ...w }));
        const eligible = next.filter((w) => canWalletMint(w) > 0);
        const eligibleIds = new Set(eligible.map((w) => w.id));
        const concurrent =
          mode === "SIMULTANEOUS" ? eligible.length :
          mode === "OPTIMIZED"    ? Math.min(4, eligible.length) :
          mode === "STAGGERED"    ? Math.min(2, eligible.length) :
          /* RECALL */              Math.min(3, eligible.length);

        // Assign queue positions to eligible wallets that haven't started.
        let q = 1;
        for (const w of next) {
          if (!eligibleIds.has(w.id)) { w.queuePos = null; continue; }
          if (w.status === "minting" || w.status === "success") {
            w.queuePos = null;
          } else if (w.status === "failed" && mode !== "RECALL") {
            w.queuePos = null;
          } else if (w.status === "idle") {
            w.queuePos = q++;
          }
        }

        // Mark ineligible as skipped once.
        for (const w of next) {
          if (!eligibleIds.has(w.id) && w.status !== "skipped") {
            w.status = "skipped";
          }
        }

        // Advance up to `concurrent` wallets.
        let inFlight = next.filter((w) => w.status === "minting").length;
        for (const w of next) {
          if (w.status !== "idle" && w.status !== "minting" && !(w.status === "failed" && mode === "RECALL")) continue;
          if (!eligibleIds.has(w.id)) continue;
          if (w.status === "idle" && inFlight >= concurrent) continue;

          if (w.status === "idle" || w.status === "failed") {
            // First transition into minting — clear hashes from prior runs.
            // RECALL preserves the minted count but starts a fresh sequence.
            w.txHashes = [];
            w.status = "minting";
            w.queuePos = null;
            inFlight += 1;
            continue;
          }
          // status === "minting" → advance one mint, push a new tx hash.
          if (w.minted < canWalletMint(w)) {
            w.minted += 1;
            w.gasUsed = parseFloat((w.gasUsed + 0.0009 + Math.random() * 0.0006).toFixed(4));
            w.txHashes = [...w.txHashes, "0x" + randHex(64)];
          }
          if (w.minted >= canWalletMint(w)) {
            w.status = Math.random() < 0.88 ? "success" : "failed";
          }
        }

        // Done? — if no one is still progressing (excluding RECALL retries).
        const stillWorking = next.some(
          (w) =>
            w.status === "minting" ||
            (w.status === "idle"   && eligibleIds.has(w.id)) ||
            (w.status === "failed" && mode === "RECALL")
        );
        if (!stillWorking) {
          setTimeout(() => setMinting(false), 200);
        }
        return next;
      });
    }, tickMs);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minting, mode, tier]);

  // ── Derived totals ──────────────────────────────────────────────────
  const eligibleWallets = wallets.filter((w) => canWalletMint(w) > 0);
  const totalNfts = eligibleWallets.reduce((s, w) => s + canWalletMint(w), 0);
  const totalCost = totalNfts * price;
  const atCapacity = wallets.length >= SLOTS_TOTAL;
  const canMint = eligibleWallets.length > 0 && !minting && price > 0 && maxMint > 0;

  const mintedNfts   = wallets.reduce((s, w) => s + (w.status === "success" ? w.minted : w.status === "minting" ? w.minted : 0), 0);
  const successCount = wallets.filter((w) => w.status === "success").length;
  const failedCount  = wallets.filter((w) => w.status === "failed").length;
  const skippedCount = wallets.filter((w) => w.status === "skipped").length;
  const mintingCount = wallets.filter((w) => w.status === "minting").length;
  const queuedCount  = wallets.filter((w) => w.queuePos !== null && w.status === "idle").length;
  const totalGas     = parseFloat(wallets.reduce((s, w) => s + w.gasUsed, 0).toFixed(4));
  const totalSpent   = parseFloat((mintedNfts * price + totalGas).toFixed(4));
  const successRate  = wallets.length > 0
    ? Math.round((successCount / Math.max(1, wallets.length - skippedCount)) * 100)
    : 0;

  // ── Handlers ────────────────────────────────────────────────────────
  function openAdd() {
    setAddOpen((v) => !v);
    setAddAddr("");
    setAddLabel("");
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
    const lbl = addLabel.trim() || `Wallet ${String.fromCharCode(65 + wallets.length)}`;
    setWallets((ws) => [
      ...ws,
      { ...genWallet(), addr: v, label: lbl },
    ]);
    setAddOpen(false);
    setAddAddr("");
    setAddLabel("");
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
      setWallets((ws) => [...ws, ...Array.from({ length: n }, () => genWallet())]);
    }, 800);
    e.target.value = "";
  }
  function removeWallet(id: string) {
    setWallets((ws) => ws.filter((w) => w.id !== id));
  }
  function startMint() {
    if (!canMint) return;
    setWallets((ws) =>
      ws.map((w) => ({
        ...w,
        status: "idle" as const,
        minted: 0,
        txHashes: [],
        queuePos: null,
        gasUsed: 0,
      }))
    );
    setDashboardOpen(true);
    setElapsedMs(0);
    setRunStart(Date.now());
    setMinting(true);
  }

  // ── Real MetaMask integration ──────────────────────────────────────
  // Replaces the prior fake sign-popup. Detects window.ethereum, lets
  // the user connect, switches/adds Sepolia, and triggers a real
  // eth_sendTransaction (which opens MetaMask's own confirm dialog).
  // The wallet-roster simulation still runs visually after sign.
  type WalletStatus =
    | { kind: "no-mm" }
    | { kind: "disconnected" }
    | { kind: "connecting" }
    | { kind: "ready"; address: string; chainId: string }
    | { kind: "wrong-chain"; address: string; chainId: string }
    | { kind: "switching" }
    | { kind: "awaiting-signature" }
    | { kind: "error"; message: string };

  const [walletStatus, setWalletStatus] = useState<WalletStatus>({ kind: "disconnected" });
  const [lastRealTxHash, setLastRealTxHash] = useState<string | null>(null);

  // Resolved MetaMask provider (via EIP-6963). null until discovery
  // completes. Stored in a ref so handlers don't have to thread it
  // through state — they always read the latest reference.
  const mmRef = useRef<EthProvider | null>(null);

  // Resolve MetaMask via EIP-6963, attach listeners, read state. Runs
  // once on mount. If only Phantom is present, mmRef stays null and
  // the WalletBar shows the "no-mm" message.
  useEffect(() => {
    let cleanedUp = false;

    async function init() {
      const mm = await findMetaMaskProvider();
      if (cleanedUp) return;
      if (!mm) {
        setWalletStatus({ kind: "no-mm" });
        return;
      }
      mmRef.current = mm;

      // Read current accounts without prompting.
      try {
        const accs = (await mm.request({ method: "eth_accounts" })) as string[];
        if (!accs?.length) {
          setWalletStatus({ kind: "disconnected" });
        } else {
          const chainId = (await mm.request({ method: "eth_chainId" })) as string;
          if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
            setWalletStatus({ kind: "wrong-chain", address: accs[0], chainId });
          } else {
            setWalletStatus({ kind: "ready", address: accs[0], chainId });
          }
        }
      } catch {
        setWalletStatus({ kind: "disconnected" });
      }

      // Listen on the resolved MM provider (NOT window.ethereum, which
      // might be Phantom).
      const onAccounts = (...args: unknown[]) => {
        const accs = args[0];
        const list = Array.isArray(accs) ? (accs as string[]) : [];
        if (list.length === 0) {
          setWalletStatus({ kind: "disconnected" });
        } else {
          setWalletStatus((prev) => {
            if (prev.kind === "ready" || prev.kind === "wrong-chain") {
              return { ...prev, address: list[0] };
            }
            return { kind: "ready", address: list[0], chainId: SEPOLIA_CHAIN_ID_HEX };
          });
        }
      };
      const onChain = (...args: unknown[]) => {
        const chainId = args[0];
        const cid = typeof chainId === "string" ? chainId : "";
        setWalletStatus((prev) => {
          if (prev.kind === "ready" || prev.kind === "wrong-chain") {
            return cid === SEPOLIA_CHAIN_ID_HEX
              ? { kind: "ready", address: prev.address, chainId: cid }
              : { kind: "wrong-chain", address: prev.address, chainId: cid };
          }
          return prev;
        });
      };
      mm.on?.("accountsChanged", onAccounts);
      mm.on?.("chainChanged", onChain);

      // Capture for cleanup
      (mmRef as { current: EthProvider | null; cleanup?: () => void }).cleanup = () => {
        mm.removeListener?.("accountsChanged", onAccounts);
        mm.removeListener?.("chainChanged", onChain);
      };
    }

    init();

    return () => {
      cleanedUp = true;
      const ref = mmRef as { current: EthProvider | null; cleanup?: () => void };
      ref.cleanup?.();
    };
  }, []);

  async function connectMetaMask() {
    // Re-run discovery on click in case the user just installed MM
    // and reloaded, or unlocked a previously dormant extension.
    let mm = mmRef.current;
    if (!mm) {
      mm = await findMetaMaskProvider();
      if (mm) mmRef.current = mm;
    }
    if (!mm) {
      setWalletStatus({ kind: "no-mm" });
      return;
    }
    setWalletStatus({ kind: "connecting" });
    try {
      const accs = (await mm.request({ method: "eth_requestAccounts" })) as string[];
      if (!accs?.length) {
        setWalletStatus({ kind: "disconnected" });
        return;
      }
      const chainId = (await mm.request({ method: "eth_chainId" })) as string;
      if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
        setWalletStatus({ kind: "wrong-chain", address: accs[0], chainId });
      } else {
        setWalletStatus({ kind: "ready", address: accs[0], chainId });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "connect rejected";
      setWalletStatus({ kind: "error", message: msg });
    }
  }

  async function ensureSepolia(): Promise<boolean> {
    const mm = mmRef.current;
    if (!mm) return false;
    setWalletStatus((prev) => (prev.kind === "wrong-chain" ? { kind: "switching" } : prev));
    try {
      await mm.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      return true;
    } catch (e: unknown) {
      // 4902 = chain not added; try to add it.
      const code = (e as { code?: number })?.code;
      if (code === 4902) {
        try {
          await mm.request({
            method: "wallet_addEthereumChain",
            params: [SEPOLIA_PARAMS],
          });
          return true;
        } catch (addErr) {
          const msg = addErr instanceof Error ? addErr.message : "could not add Sepolia";
          setWalletStatus({ kind: "error", message: msg });
          return false;
        }
      }
      const msg = e instanceof Error ? e.message : "could not switch network";
      setWalletStatus({ kind: "error", message: msg });
      return false;
    }
  }

  // 1 ETH = 1e18 wei. Convert a decimal string (e.g. "1.00") to a hex
  // wei value MetaMask expects. Avoids floating-point on big numbers.
  function ethToWeiHex(eth: string): string {
    const trimmed = (eth || "0").trim();
    const [intPart = "0", decPartRaw = ""] = trimmed.split(".");
    const decPart = (decPartRaw + "000000000000000000").slice(0, 18);
    const cleanInt = intPart.replace(/[^0-9]/g, "") || "0";
    const cleanDec = decPart.replace(/[^0-9]/g, "").padEnd(18, "0");
    const wei = BigInt(cleanInt + cleanDec);
    return "0x" + wei.toString(16);
  }

  function mintCalldata(amount: number): string {
    const hex = BigInt(Math.max(0, amount)).toString(16).padStart(64, "0");
    return MINT_SELECTOR + hex;
  }

  async function clickMintBtn() {
    if (minting) { stopMint(); return; }
    if (!canMint) return;

    // Resolve MM (re-run discovery if needed).
    let mm = mmRef.current;
    if (!mm) {
      mm = await findMetaMaskProvider();
      if (mm) mmRef.current = mm;
    }
    if (!mm) {
      setWalletStatus({ kind: "no-mm" });
      return;
    }

    // Auto-connect if needed.
    if (walletStatus.kind === "disconnected" || walletStatus.kind === "error") {
      await connectMetaMask();
    }

    // Pull a fresh address from the resolved MM provider.
    let addr: string | undefined;
    try {
      const accs = (await mm.request({ method: "eth_accounts" })) as string[];
      addr = accs?.[0];
    } catch {
      addr = undefined;
    }
    if (!addr) {
      try {
        const accs = (await mm.request({ method: "eth_requestAccounts" })) as string[];
        addr = accs?.[0];
      } catch {
        return;
      }
    }
    if (!addr) return;

    // Make sure we're on Sepolia.
    let chainId = (await mm.request({ method: "eth_chainId" })) as string;
    if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
      const ok = await ensureSepolia();
      if (!ok) return;
      chainId = (await mm.request({ method: "eth_chainId" })) as string;
      if (chainId !== SEPOLIA_CHAIN_ID_HEX) return;
    }

    // Send the real transaction — triggers the real MetaMask popup.
    setWalletStatus({ kind: "awaiting-signature" });
    try {
      const valueHex = ethToWeiHex((maxMint * price).toFixed(18));
      const data = mintCalldata(maxMint);
      const txHash = (await mm.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: addr,
            to: contract,
            value: valueHex,
            data,
          },
        ],
      })) as string;

      setLastRealTxHash(txHash);
      setWalletStatus({ kind: "ready", address: addr, chainId });
      startMint();
    } catch (e: unknown) {
      const code = (e as { code?: number })?.code;
      // 4001 = user rejected. Don't treat as error; quietly return.
      if (code === 4001) {
        setWalletStatus({ kind: "ready", address: addr, chainId });
        return;
      }
      const msg = e instanceof Error ? e.message : "transaction failed";
      setWalletStatus({ kind: "error", message: msg });
    }
  }

  function stopMint() {
    setMinting(false);
    setRunStart(null);
  }
  function reset() {
    setMinting(false);
    setDashboardOpen(false);
    setRunStart(null);
    setElapsedMs(0);
    setWallets(INITIAL_WALLETS.map((w) => ({ ...w })));
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* MetaMask popup is the REAL one now — clicking MINT triggers
          window.ethereum / eth_sendTransaction. See clickMintBtn. */}

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <header className="text-center space-y-3">
        <h1 className="headline text-5xl md:text-6xl leading-none">
          mint chamber<span className="text-bleed">.</span>
        </h1>
        <p className="font-sans text-base sm:text-lg text-ape-200 max-w-xl mx-auto leading-relaxed">
          a multi-wallet NFT minter for EVM-compatible testnets. SIMIAN ORDER holders only.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
          <span
            className="badge text-elec"
            style={{ fontSize: 12, padding: "5px 12px", letterSpacing: "0.18em" }}
          >
            SIMIAN · {SIMIAN_HELD} HELD
          </span>
          <span className="font-sans text-sm text-bone">
            {SLOTS_TOTAL} slots · {wallets.length} active
          </span>
        </div>
      </header>

      {/* ── COLLECTION (hero card) ────────────────────────────────── */}
      <Panel
        title="collection"
        right={
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 bg-emerald-400 pulse-soft"
              aria-hidden
            />
            <span className="text-emerald-400">MINT LIVE</span>
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 md:gap-6">
          {/* Image */}
          <div
            className="aspect-square w-full md:w-[180px] border border-border relative overflow-hidden"
            style={{ background: "rgba(0,64,255,0.06)" }}
          >
            <Image
              src={COLLECTION_IMAGE}
              alt={COLLECTION_NAME}
              fill
              sizes="180px"
              className="object-contain p-3"
              priority
            />
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-ape-200 mb-1">
                {COLLECTION_NETWORK}
              </div>
              <div className="font-serif italic text-3xl sm:text-4xl text-bone leading-none">
                {COLLECTION_NAME}
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <code
                  className="font-mono text-sm text-ape-200"
                  style={
                    addrBlurred
                      ? { filter: "blur(5px)", userSelect: "none" }
                      : undefined
                  }
                  aria-label={addrBlurred ? "contract address (hidden)" : SHORT(contract)}
                >
                  {SHORT(contract)}
                </code>
                <button
                  type="button"
                  onClick={() => setAddrBlurred((b) => !b)}
                  className="font-mono text-xs uppercase tracking-wider text-mute hover:text-elec"
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 6px" }}
                  title={addrBlurred ? "show contract address" : "hide contract address"}
                  aria-label={addrBlurred ? "show contract address" : "hide contract address"}
                >
                  {addrBlurred ? "👁 show" : "🙈 hide"}
                </button>
                <a
                  href={addrBlurred ? "#" : explorerAddr(contract)}
                  onClick={(e) => { if (addrBlurred) e.preventDefault(); }}
                  target={addrBlurred ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-elec hover:text-bone"
                  style={addrBlurred ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                  title={addrBlurred ? "reveal the contract address to open Etherscan" : "view on etherscan"}
                >
                  view on etherscan ↗
                </a>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="price">
                <span className="font-pixel text-2xl text-bone">{price.toFixed(2)}</span>
                <span className="font-mono text-sm text-ape-200 ml-1">ETH</span>
              </Stat>
              <Stat label="max / wallet">
                <span className="font-pixel text-2xl text-bone">{maxMint}</span>
              </Stat>
              <Stat label="minted">
                <span className="font-pixel text-2xl text-bone">{supply.toLocaleString()}</span>
                <span className="font-mono text-sm text-ape-200 ml-1">/ {COLLECTION_SUPPLY_MAX.toLocaleString()}</span>
              </Stat>
              <Stat label="phase">
                <span className="font-mono text-base text-emerald-400 uppercase">public</span>
              </Stat>
            </dl>

            {/* Supply progress */}
            <div>
              <div className="h-1.5 w-full bg-ape-950 border border-border">
                <div
                  className="h-full bg-elec transition-all"
                  style={{ width: `${(supply / COLLECTION_SUPPLY_MAX) * 100}%` }}
                />
              </div>
              <div className="font-mono text-xs text-ape-200 mt-1.5">
                {COLLECTION_SUPPLY_MAX - supply} left · {((1 - supply / COLLECTION_SUPPLY_MAX) * 100).toFixed(1)}% remaining
              </div>
            </div>
          </div>
        </div>

        {/* Configure strip */}
        <div className="mt-6 pt-5 border-t border-border">
          <div className="font-mono text-sm uppercase tracking-wider text-bone mb-3">
            configure mint
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px] gap-3">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-ape-200 mb-1.5 flex items-center gap-2">
                contract address
                <button
                  type="button"
                  onClick={() => setAddrBlurred((b) => !b)}
                  className="font-mono text-xxs uppercase tracking-wider text-mute hover:text-elec"
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  title={addrBlurred ? "show contract address" : "hide contract address"}
                >
                  {addrBlurred ? "👁 show" : "🙈 hide"}
                </button>
              </label>
              <input
                className="field font-mono"
                style={{
                  padding: "10px 12px",
                  fontSize: 14,
                  ...(addrBlurred ? { filter: "blur(5px)" } : null),
                }}
                value={contract}
                onChange={(e) => setContract(e.target.value)}
                spellCheck={false}
                placeholder="0x..."
                aria-label="contract address"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-ape-200 mb-1.5">
                price (ETH)
              </label>
              <input
                className="field font-mono"
                style={{ padding: "10px 12px", fontSize: 14 }}
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-ape-200 mb-1.5">
                max / wallet
              </label>
              <input
                className="field font-mono"
                style={{ padding: "10px 12px", fontSize: 14 }}
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
        </div>
      </Panel>

      {/* ── EXECUTION + GAS ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <Panel title="execution mode" right={<span>{mode.toLowerCase()}</span>}>
          <p className="font-sans text-sm text-ape-200 mb-4 leading-relaxed">
            how the chamber fans out signed transactions across your wallets.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXEC_MODES.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className="text-left transition-none"
                  style={{
                    padding: "14px 14px",
                    border: `${active ? 2 : 1}px solid ${active ? "#0040ff" : "#1a1a28"}`,
                    background: active ? "rgba(0,64,255,0.08)" : "rgba(10,10,14,0.5)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="font-pixel text-3xl leading-none"
                      style={{ color: active ? "#0040ff" : "#aaaadd" }}
                    >
                      {m.icon}
                    </span>
                    {active && (
                      <span className="inline-block w-2 h-2 bg-elec" aria-hidden />
                    )}
                  </div>
                  <div
                    className="font-mono text-base uppercase tracking-wider mb-1"
                    style={{ color: active ? "#fff" : "#e8e8e8" }}
                  >
                    {m.label}
                  </div>
                  <div className="font-sans text-sm text-ape-200 leading-snug">{m.blurb}</div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="gas priority" right={<span>{tier.toLowerCase()} · {GAS_TIERS.find((g) => g.id === tier)?.gwei} gwei</span>}>
          <p className="font-sans text-sm text-ape-200 mb-4 leading-relaxed">
            how aggressive to bid for blockspace.
          </p>
          <div className="space-y-2">
            {GAS_TIERS.map((g) => {
              const active = g.id === tier;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTier(g.id)}
                  className="w-full text-left transition-none flex items-center gap-3"
                  style={{
                    padding: "12px 14px",
                    border: `${active ? 2 : 1}px solid ${active ? "#0040ff" : "#1a1a28"}`,
                    background: active ? "rgba(0,64,255,0.08)" : "rgba(10,10,14,0.5)",
                  }}
                >
                  <span
                    className="font-pixel text-2xl leading-none"
                    style={{ color: active ? "#0040ff" : "#aaaadd" }}
                  >
                    {g.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-mono text-base uppercase tracking-wider"
                      style={{ color: active ? "#fff" : "#e8e8e8" }}
                    >
                      {g.label}
                    </div>
                    <div className="font-sans text-xs text-ape-200">{g.blurb}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-pixel text-xl leading-none"
                      style={{ color: active ? "#0040ff" : "#aaaadd" }}
                    >
                      {g.gwei}
                    </div>
                    <div className="font-mono text-xs text-ape-200">gwei</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── WALLETS ───────────────────────────────────────────────── */}
      <Panel
        title="wallets"
        right={
          <span>
            {wallets.length}/{SLOTS_TOTAL} added
            {atCapacity && <span className="ml-2 text-bleed">· FULL</span>}
          </span>
        }
      >
        <p className="font-sans text-sm text-ape-200 mb-4 leading-relaxed">
          each wallet you bind can mint up to <span className="text-bone">{maxMint}</span> NFTs.
          non-whitelisted or under-funded wallets are skipped automatically.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="ghost" onClick={openAdd} disabled={atCapacity && !addOpen}>
            {addOpen ? "× CANCEL" : "+ ADD WALLET"}
          </Button>
          <Button variant="ghost" onClick={runWalletConnect} disabled={atCapacity || wcConnecting}>
            {wcConnecting ? "CONNECTING…" : "+ WALLETCONNECT"}
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={atCapacity}>
            IMPORT CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt,.json" onChange={runImport} hidden />
        </div>

        {addOpen && (
          <div
            className="mb-4 p-4 border border-elec"
            style={{ background: "rgba(0,64,255,0.05)" }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-ape-200 mb-1.5">
                  wallet address
                </label>
                <input
                  className="field font-mono"
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
              </div>
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-ape-200 mb-1.5">
                  label (optional)
                </label>
                <input
                  className="field font-mono"
                  style={{ padding: "10px 12px", fontSize: 14 }}
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="Vault, Sniper, …"
                />
              </div>
              <Button variant="primary" onClick={submitAdd}>BIND</Button>
            </div>
            {addError && (
              <p className="mt-3 font-mono text-sm text-bleed">{addError}</p>
            )}
          </div>
        )}

        {wallets.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="font-sans text-lg text-bone">no wallets bound yet.</p>
            <p className="font-sans text-base text-ape-200">
              use <span className="text-elec">+ ADD WALLET</span> or{" "}
              <span className="text-elec">+ WALLETCONNECT</span> above.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {wallets.map((w) => {
              const canMintN = canWalletMint(w);
              const eligible = canMintN > 0;
              return (
                <li
                  key={w.id}
                  className="grid grid-cols-[10px_1fr_auto] sm:grid-cols-[10px_1.4fr_1fr_auto_auto_auto] items-center gap-3 sm:gap-4 p-3.5 border border-border"
                  style={{ background: "rgba(10,10,14,0.55)" }}
                >
                  <span
                    className="w-2.5 h-2.5 shrink-0"
                    style={{ background: eligible ? "#34d399" : "#ff2d2d" }}
                    aria-hidden
                  />

                  {/* Label + address */}
                  <div className="min-w-0">
                    <div className="font-mono text-base text-bone leading-none mb-1 truncate">
                      {w.label}
                    </div>
                    <code className="font-mono text-xs text-ape-200">{SHORT(w.addr)}</code>
                  </div>

                  {/* Balance — hidden on mobile, inline in third row */}
                  <div className="hidden sm:block">
                    <div className="font-mono text-base text-bone leading-none">
                      {w.balance.toFixed(2)} <span className="text-ape-200">ETH</span>
                    </div>
                    <div className="font-mono text-xs text-ape-200 mt-0.5">balance</div>
                  </div>

                  {/* Whitelist tag */}
                  <div
                    className="hidden sm:flex items-center justify-end font-mono text-sm uppercase tracking-wider"
                    style={{
                      color: w.whitelisted ? "#34d399" : "#ff2d2d",
                      minWidth: 160,
                    }}
                  >
                    {w.whitelisted ? "✓ whitelisted" : "✗ not whitelisted"}
                  </div>

                  {/* Can mint */}
                  <div
                    className="hidden sm:flex flex-col items-end"
                    style={{ minWidth: 80 }}
                  >
                    <div
                      className="font-pixel text-2xl leading-none"
                      style={{ color: eligible ? "#34d399" : "#5a5a6a" }}
                    >
                      {canMintN}
                    </div>
                    <div className="font-mono text-xs text-ape-200 mt-0.5">can mint</div>
                  </div>

                  {/* Remove */}
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

                  {/* Mobile-only inline meta row */}
                  <div className="sm:hidden col-span-3 -mt-1 flex items-center justify-between flex-wrap gap-y-1 gap-x-3">
                    <span className="font-mono text-sm text-bone">
                      {w.balance.toFixed(2)} ETH
                    </span>
                    <span
                      className="font-mono text-xs uppercase tracking-wider"
                      style={{ color: w.whitelisted ? "#34d399" : "#ff2d2d" }}
                    >
                      {w.whitelisted ? "✓ whitelisted" : "✗ not whitelisted"}
                    </span>
                    <span className="font-mono text-sm" style={{ color: eligible ? "#34d399" : "#5a5a6a" }}>
                      can mint <span className="font-pixel text-lg align-middle">{canMintN}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── MINT BUTTON ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl space-y-3">
        {/* Wallet connection bar — shows current MM state and a connect
            / switch-chain CTA when needed. */}
        <WalletBar
          status={walletStatus}
          onConnect={connectMetaMask}
          onSwitch={ensureSepolia}
        />

        <button
          type="button"
          onClick={clickMintBtn}
          disabled={(!minting && !canMint) || walletStatus.kind === "awaiting-signature" || walletStatus.kind === "switching"}
          className="w-full font-mono uppercase"
          style={{
            padding: "22px 16px",
            fontSize: 19,
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
            : walletStatus.kind === "awaiting-signature"
            ? "⏳ check metamask…"
            : walletStatus.kind === "switching"
            ? "⇄ switching to sepolia…"
            : eligibleWallets.length === 0
            ? "no eligible wallets"
            : `▶ mint ${totalNfts} NFTs · ${totalCost.toFixed(2)} ETH`}
        </button>
        <p className="font-sans text-sm text-ape-200 text-center">
          {eligibleWallets.length} of {wallets.length} wallets eligible · mode{" "}
          <span className="text-bone">{mode.toLowerCase()}</span> · gas{" "}
          <span className="text-bone">{tier.toLowerCase()}</span>
        </p>
        {dashboardOpen && !minting && (
          <Button onClick={reset} variant="ghost" className="w-full">
            RESET CHAMBER
          </Button>
        )}
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────────── */}
      {dashboardOpen && (
        <Panel
          title="mint dashboard"
          right={
            <span className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 ${minting ? "bg-bleed pulse-soft" : "bg-emerald-400"}`}
                aria-hidden
              />
              <span>{minting ? "running" : "complete"}</span>
            </span>
          }
        >
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5 pb-5 border-b border-border">
            <BigStat n={mintedNfts}   label="NFTs minted" tone="emerald" />
            <BigStat n={`${successCount}/${wallets.length}`} label="success" tone="bone" />
            <BigStat n={totalGas.toFixed(4)}   label="gas (ETH)"   tone="ape-200" />
            <BigStat n={totalSpent.toFixed(2)} label="spent (ETH)" tone="bone" />
            <BigStat n={fmtElapsed(elapsedMs)} label="elapsed"     tone="ape-200" />
          </div>

          {/* Per-wallet rows */}
          <ul className="space-y-2">
            {wallets.map((w) => {
              const canMintN = canWalletMint(w);
              const eligible = canMintN > 0;
              const pct = canMintN > 0 ? (w.minted / canMintN) * 100 : 0;
              const barColor =
                w.status === "failed"  ? "#ff2d2d" :
                w.status === "success" ? "#34d399" :
                                         "#0040ff";
              const statusColor =
                w.status === "success" ? "#34d399" :
                w.status === "failed"  ? "#ff2d2d" :
                w.status === "skipped" ? "#5a5a6a" :
                w.status === "minting" ? "#0040ff" :
                                         "#aaaadd";
              const statusLabel =
                w.status === "success" ? "✓ success" :
                w.status === "failed"  ? "✗ failed"  :
                w.status === "skipped" ? "⊘ skipped" :
                w.status === "minting" ? "⟳ minting" :
                w.queuePos              ? `queued #${w.queuePos}` :
                                          "waiting";
              return (
                <li
                  key={w.id}
                  className="p-3.5 border border-border"
                  style={{ background: "rgba(10,10,14,0.55)" }}
                >
                  {/* Top row: label · address · status */}
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <div className="font-mono text-base text-bone">{w.label}</div>
                    <code className="font-mono text-sm text-ape-200">{SHORT(w.addr)}</code>
                    <span
                      className="ml-auto font-mono text-sm uppercase tracking-wider"
                      style={{ color: statusColor }}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="h-2.5 w-full border border-border mb-2"
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

                  {/* Bottom row: minted / gas / total */}
                  <div className="flex items-center gap-4 flex-wrap font-mono text-sm">
                    <span className="text-bone">
                      <span className="font-pixel text-lg align-middle mr-1">{w.minted}</span>
                      / {canMintN || maxMint} <span className="text-ape-200">minted</span>
                    </span>
                    <span className="text-ape-200">
                      {w.gasUsed.toFixed(4)} <span className="text-mute">ETH gas</span>
                    </span>
                    <span className="text-ape-200">
                      {(w.minted * price + w.gasUsed).toFixed(2)} <span className="text-mute">ETH total</span>
                    </span>
                  </div>

                  {/* Per-NFT transaction hashes — one explorer link per
                      minted NFT. Each row shows token index + truncated
                      hash and opens the explorer in a new tab. */}
                  {w.txHashes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="font-mono text-xs uppercase tracking-wider text-ape-200 mb-2">
                        transactions ({w.txHashes.length})
                      </div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                        {w.txHashes.map((h, i) => (
                          <li key={h}>
                            <a
                              href={explorerTx(h)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-elec hover:text-bone inline-block"
                              title={h}
                            >
                              <span className="text-ape-200">#{i + 1}</span>{" "}
                              {h.slice(0, 10)}…{h.slice(-6)} ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Summary */}
          <div
            className="mt-5 p-4 border space-y-2"
            style={{
              borderColor: failedCount > 0 ? "#ff2d2d" : "#0040ff",
              background: failedCount > 0 ? "rgba(255,45,45,0.06)" : "rgba(0,64,255,0.06)",
            }}
          >
            <p className="font-mono text-sm uppercase tracking-wider text-elec">summary</p>
            <p className="font-sans text-lg text-bone leading-relaxed">
              <span className="text-emerald-400 font-bold">{mintedNfts}</span>{" "}
              NFT{mintedNfts === 1 ? "" : "s"} minted across{" "}
              <span className="text-emerald-400 font-bold">{successCount}</span>{" "}
              wallet{successCount === 1 ? "" : "s"} for{" "}
              <span className="text-bone font-bold">{totalSpent.toFixed(2)}</span> ETH
              {" "}({totalGas.toFixed(4)} ETH gas).
            </p>
            {minting && mintingCount + queuedCount > 0 && (
              <p className="font-sans text-base text-ape-200">
                {mintingCount} minting · {queuedCount} queued
              </p>
            )}
            {failedCount > 0 && (
              <p className="font-sans text-base text-bleed">
                {failedCount} wallet{failedCount === 1 ? "" : "s"} failed
                {mode === "RECALL" ? " — RECALL will retry" : ""}.
              </p>
            )}
            {skippedCount > 0 && (
              <p className="font-sans text-base text-ape-200">
                {skippedCount} wallet{skippedCount === 1 ? "" : "s"} skipped (not whitelisted or insufficient funds).
              </p>
            )}
            {!minting && (
              <p className="font-sans text-base text-bone pt-1">
                run complete · success rate{" "}
                <span className="text-emerald-400 font-bold">{successRate}%</span>
              </p>
            )}
            {lastRealTxHash && (
              <p className="font-sans text-sm text-ape-200 pt-2 border-t border-border">
                your signed transaction:{" "}
                <a
                  href={explorerTx(lastRealTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-elec hover:text-bone"
                >
                  {lastRealTxHash.slice(0, 12)}…{lastRealTxHash.slice(-8)} ↗
                </a>
              </p>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ─── WalletBar ──────────────────────────────────────────────────── */

type WalletBarStatus =
  | { kind: "no-mm" }
  | { kind: "disconnected" }
  | { kind: "connecting" }
  | { kind: "ready"; address: string; chainId: string }
  | { kind: "wrong-chain"; address: string; chainId: string }
  | { kind: "switching" }
  | { kind: "awaiting-signature" }
  | { kind: "error"; message: string };

function WalletBar({
  status,
  onConnect,
  onSwitch,
}: {
  status: WalletBarStatus;
  onConnect: () => void;
  onSwitch: () => void;
}) {
  // Common pill style for the right-hand action.
  const pillBase: React.CSSProperties = {
    padding: "8px 14px",
    fontSize: 13,
    fontFamily: "ui-monospace, 'Courier New', monospace",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    cursor: "pointer",
    border: "1px solid #0040ff",
    background: "#0040ff",
    color: "#fff",
  };

  let left: React.ReactNode;
  let right: React.ReactNode;
  let tone: "ok" | "warn" | "err" | "info" = "info";

  switch (status.kind) {
    case "no-mm":
      tone = "warn";
      left = (
        <span className="font-sans text-sm text-bleed">
          MetaMask not detected — install{" "}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-elec hover:text-bone underline"
          >
            metamask.io
          </a>{" "}
          to mint.
        </span>
      );
      break;
    case "disconnected":
      tone = "info";
      left = (
        <span className="font-sans text-sm text-ape-200">
          connect your wallet to sign and mint.
        </span>
      );
      right = (
        <button type="button" onClick={onConnect} style={pillBase}>
          🦊 connect metamask
        </button>
      );
      break;
    case "connecting":
      tone = "info";
      left = (
        <span className="font-sans text-sm text-ape-200">
          opening metamask…
        </span>
      );
      break;
    case "wrong-chain":
      tone = "warn";
      left = (
        <span className="font-sans text-sm text-bleed">
          wrong network — switch your wallet to Sepolia testnet.
        </span>
      );
      right = (
        <button type="button" onClick={onSwitch} style={pillBase}>
          ⇄ switch to sepolia
        </button>
      );
      break;
    case "switching":
      tone = "info";
      left = (
        <span className="font-sans text-sm text-ape-200">
          switching network in metamask…
        </span>
      );
      break;
    case "awaiting-signature":
      tone = "info";
      left = (
        <span className="font-sans text-sm text-ape-200">
          ⏳ check metamask — sign the transaction to proceed.
        </span>
      );
      break;
    case "ready":
      tone = "ok";
      left = (
        <span className="font-sans text-sm text-bone flex items-center gap-2 flex-wrap">
          <span
            className="inline-block w-2 h-2"
            style={{ background: "#34d399", borderRadius: "50%" }}
            aria-hidden
          />
          <span>connected:</span>
          <code className="font-mono text-bone">
            {status.address.slice(0, 6)}…{status.address.slice(-4)}
          </code>
          <span className="text-ape-200">· Sepolia</span>
        </span>
      );
      break;
    case "error":
      tone = "err";
      left = (
        <span className="font-sans text-sm text-bleed">
          {status.message.slice(0, 100)}
        </span>
      );
      right = (
        <button type="button" onClick={onConnect} style={pillBase}>
          retry
        </button>
      );
      break;
  }

  const borderColor =
    tone === "ok"   ? "#34d399" :
    tone === "warn" ? "#ff2d2d" :
    tone === "err"  ? "#ff2d2d" :
                      "#1a1a28";
  const bg =
    tone === "ok"   ? "rgba(52,211,153,0.05)" :
    tone === "warn" ? "rgba(255,45,45,0.05)" :
    tone === "err"  ? "rgba(255,45,45,0.05)" :
                      "rgba(0,64,255,0.04)";

  return (
    <div
      className="flex items-center justify-between gap-3 flex-wrap"
      style={{
        padding: "10px 14px",
        border: `1px solid ${borderColor}`,
        background: bg,
      }}
    >
      <div className="flex-1 min-w-0">{left}</div>
      {right}
    </div>
  );
}

/* ─── small helpers ──────────────────────────────────────────────── */

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wider text-ape-200 mb-1">
        {label}
      </div>
      <div className="leading-none">{children}</div>
    </div>
  );
}

function BigStat({
  n,
  label,
  tone,
}: {
  n: number | string;
  label: string;
  tone: "bone" | "emerald" | "ape-200" | "bleed";
}) {
  const color =
    tone === "emerald" ? "#34d399" :
    tone === "ape-200" ? "#aaaadd" :
    tone === "bleed"   ? "#ff2d2d" :
                         "#e8e8e8";
  return (
    <div>
      <div className="font-pixel text-3xl leading-none" style={{ color }}>
        {n}
      </div>
      <div className="font-mono text-xs uppercase tracking-wider text-ape-200 mt-1.5">
        {label}
      </div>
    </div>
  );
}

function fmtElapsed(ms: number): string {
  if (!ms) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

