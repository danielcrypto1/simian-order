import { NextResponse } from "next/server";
import { getSubmission } from "@/lib/submissionsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public read of a referrer's own submission.
 *
 *   GET /api/referrals?wallet=0x...
 *   →  { submission: Submission | null }
 *
 * Drives the /dashboard/referral page so it can show either the
 * "SELECT YOUR 5" form (no submission yet) or the locked status
 * list (already submitted). No filtering applied — the entries
 * already only contain x/discord/wallet/status which the referrer
 * themselves provided.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
  }
  const sub = await getSubmission(wallet);
  return NextResponse.json({ submission: sub });
}
