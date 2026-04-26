import { NextResponse } from "next/server";
import { generateSignature, getSignerAddress } from "@/lib/signature";
import { getStore } from "@/lib/adminStore";

export const runtime = "nodejs";

const PHASE_GTD = 0;
const PHASE_FCFS = 1;
const PHASE_PUBLIC = 2;

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const walletRaw = (body as { wallet?: unknown })?.wallet;
  if (typeof walletRaw !== "string" || !isWallet(walletRaw)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const wallet = walletRaw.toLowerCase();

  const store = getStore();
  const wl = store.whitelist.get(wallet);
  const app = store.applications.find((a) => a.wallet.toLowerCase() === wallet);
  const cfg = store.mintConfig;

  let phase: number;
  let maxAllowed: number;
  let label: "GTD" | "FCFS" | "PUBLIC";

  if (wl) {
    phase = wl.phase === "GTD" ? PHASE_GTD : PHASE_FCFS;
    maxAllowed = wl.maxMint;
    label = wl.phase;
  } else if (app?.status === "approved") {
    phase = PHASE_GTD;
    maxAllowed = cfg.gtd_max_mint;
    label = "GTD";
  } else {
    phase = PHASE_PUBLIC;
    maxAllowed = cfg.public_max_mint;
    label = "PUBLIC";
  }

  let signature: string;
  try {
    signature = await generateSignature(wallet, phase, maxAllowed);
  } catch (e) {
    const msg = (e as Error).message || "sign_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    wallet,
    phase,
    phase_label: label,
    maxAllowed,
    signature,
    signer: getSignerAddress(),
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
  });
}
