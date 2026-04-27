"use client";

import { useEffect, useState } from "react";
import Button from "./Button";
import { useWallet } from "@/lib/wallet";
import { track } from "@/lib/analytics";

const ALIGNMENTS = ["aligned", "observed", "unverified"] as const;
type Alignment = typeof ALIGNMENTS[number];

const ALIGNMENT_KEY = "simian_alignment";

/**
 * Pick or recall the session alignment label.
 * Persists for the duration of the browser session via sessionStorage —
 * never localStorage, so the label resets on the next visit. Returns
 * null on the server to avoid hydration mismatch; the real label
 * resolves in useEffect once mounted.
 */
function getAlignment(): Alignment {
  if (typeof window === "undefined") return "aligned";
  try {
    const stored = sessionStorage.getItem(ALIGNMENT_KEY);
    if (stored && (ALIGNMENTS as readonly string[]).includes(stored)) {
      return stored as Alignment;
    }
    const next = ALIGNMENTS[Math.floor(Math.random() * ALIGNMENTS.length)];
    sessionStorage.setItem(ALIGNMENT_KEY, next);
    return next;
  } catch {
    return "aligned";
  }
}

export default function ConnectWalletButton({
  variant = "primary" as "primary" | "default" | "ghost",
}) {
  const { address, short, connect, disconnect, connecting } = useWallet();
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [voidSeen, setVoidSeen] = useState(false);

  // Resolve the alignment once on mount. Don't compute during SSR or the
  // hydration check would mismatch every reload.
  useEffect(() => {
    if (address) setAlignment(getAlignment());
    else setAlignment(null);
  }, [address]);

  // Detect post-void state — when true, the alignment label is
  // forced to "observed" regardless of the session-random pick.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => setVoidSeen(localStorage.getItem("void_seen") === "true");
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "void_seen") read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Post-void: the random session label is overridden to "observed"
  // so the wallet pill carries the same residue across the rest of
  // the site. Pre-void: respect the random label.
  const displayAlignment: Alignment | null =
    voidSeen ? "observed" : alignment;

  async function handleConnect() {
    track("landing_connect_wallet");
    await connect();
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xxs uppercase tracking-wide bg-ape-900 border border-border px-2 py-1 text-ape-200 font-mono">
          {short}
        </span>
        {/* Subtle session-only alignment label. Post-void it locks
            to "observed" via displayAlignment. */}
        {displayAlignment && (
          <span
            className={`alignment-label alignment-label--${displayAlignment}`}
            aria-label={`alignment ${displayAlignment}`}
          >
            // {displayAlignment}
          </span>
        )}
        <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
      </div>
    );
  }
  return (
    <Button variant={variant} onClick={handleConnect} disabled={connecting}>
      {connecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
