import { NextResponse } from "next/server";
import { findByWallet } from "@/lib/applicationsStore";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

// Public: returns just the status fields for a wallet's own application so
// the user's apply page can render the post-submission view (and share
// buttons) after a reload. `why`/`discord` are intentionally not exposed
// here — they're admin-side only.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("wallet");
  if (!raw || !isWallet(raw)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const app = await findByWallet(raw);
  if (!app) return NextResponse.json({ application: null });
  return NextResponse.json({
    application: {
      id: app.id,
      wallet: app.wallet,
      twitter: app.twitter,
      status: app.status,
      createdAt: app.createdAt,
    },
  });
}
