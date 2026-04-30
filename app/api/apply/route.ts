import { NextResponse } from "next/server";
import { upsertApplication } from "@/lib/applicationsStore";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

/**
 * Application submission endpoint.
 *
 *   POST /api/apply
 *   body: { wallet, twitter|handle, discord?, why?, source?: "apply"|"quest" }
 *   →  { ok: true, application }
 *
 * The legacy referrer_input field has been removed along with the
 * auto-tracked referral link system. Curated referrals now flow
 * through POST /api/referrals/submit-list (admin-approved per entry)
 * — this endpoint no longer attempts any referral linkage.
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as {
    wallet?: unknown; handle?: unknown; discord?: unknown;
    why?: unknown; twitter?: unknown;
    source?: unknown;
  };

  if (typeof b.wallet !== "string" || !isWallet(b.wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const twitterRaw = typeof b.twitter === "string" && b.twitter
    ? b.twitter
    : typeof b.handle === "string" ? b.handle : "";
  const twitter = twitterRaw.toString().replace(/^@+/, "").trim();
  if (twitter.length < 1 || twitter.length > 64) {
    return NextResponse.json({ error: "invalid_twitter" }, { status: 400 });
  }
  if (b.why !== undefined && typeof b.why !== "string") {
    return NextResponse.json({ error: "invalid_why" }, { status: 400 });
  }

  const wallet = b.wallet.toLowerCase();
  const why = typeof b.why === "string" && b.why.trim() ? b.why.trim() : null;
  const discord = typeof b.discord === "string" && b.discord.trim()
    ? b.discord.trim().slice(0, 64)
    : null;

  const source: "apply" | "quest" =
    b.source === "quest" ? "quest" : "apply";

  const application = await upsertApplication({
    wallet,
    twitter,
    why,
    discord,
    referrer_input: null,
    source,
  });

  return NextResponse.json({ ok: true, application });
}
