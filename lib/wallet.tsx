"use client";

import { useCallback, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import { useStore } from "./store";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const MOCK_ADDRESS = "0x9A3f000000000000000000000000000000c00DE";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useWallet() {
  const walletAddress = useStore((s) => s.walletAddress);
  const walletConnected = useStore((s) => s.walletConnected);
  const connectStore = useStore((s) => s.connectWallet);
  const disconnectStore = useStore((s) => s.disconnectWallet);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      if (typeof window !== "undefined" && window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts[0]) connectStore(accounts[0]);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        connectStore(MOCK_ADDRESS);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  }, [connectStore]);

  const disconnect = useCallback(() => {
    disconnectStore();
  }, [disconnectStore]);

  const short = useMemo(() => {
    if (!walletAddress) return "";
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  return {
    address: walletAddress,
    connected: walletConnected,
    connecting,
    connect,
    disconnect,
    short,
  };
}
