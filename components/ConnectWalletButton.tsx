"use client";

import Button from "./Button";
import { useWallet } from "@/lib/wallet";
import { track } from "@/lib/analytics";

export default function ConnectWalletButton({ variant = "primary" as "primary" | "default" | "ghost" }) {
  const { address, short, connect, disconnect, connecting } = useWallet();
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
