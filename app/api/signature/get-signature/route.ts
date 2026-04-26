import { NextResponse } from "next/server";
import { generateSignature } from "@/lib/signature";
import { getStore } from "@/lib/adminStore";
import { findByWallet } from "@/lib/applicationsStore";
import { getFcfsState } from "@/lib/fcfsStore";

export const runtime = "nodejs";

const PHASE_GTD = 0;
const PHASE_FCFS = 1;
const PHASE_PUBLIC = 2;

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw = (body as { wallet?: unknown })?.wallet;
  if (typeof raw !== "string" || !isWallet(raw)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const wallet = raw.toLowerCase();

  const store = getStore();
  const cfg = store.mintConfig;

  const app = await findByWallet(wallet);
  const fcfs = await getFcfsState();
  const fcfsAllocated = fcfs.claimed.includes(wallet);

  let phase: number;
  let maxAllowed: number;
  if (app?.status === "approved") {
    phase = PHASE_GTD;
    maxAllowed = cfg.gtd_max_mint;
  } else if (fcfsAllocated) {
    phase = PHASE_FCFS;
    maxAllowed = cfg.fcfs_max_mint;
  } else {
    phase = PHASE_PUBLIC;
    maxAllowed = cfg.public_max_mint;
  }

  let signature: string;
  try {
    signature = await generateSignature(wallet, phase, maxAllowed);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "sign_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ signature, phase, maxAllowed });
}
