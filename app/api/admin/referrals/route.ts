import { NextResponse } from "next/server";
import { listSubmissions, listGtdWallets } from "@/lib/submissionsStore";
import { getKolMap } from "@/lib/kolStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin read of every curated submission across every referrer,
 * joined with the KOL registry so the panel can render KOL badges
 * inline with each row.
 *
 *   GET /api/admin/referrals
 *   →  {
 *        items: Array<Submission & {
 *          referrer_isKOL: boolean,
 *          referrer_tag: string,    // empty string if no tag
 *        }>,
 *        total: number,             // submissions
 *        totalEntries: number,      // total entries across all
 *        approvedTotal: number,     // entries with status === "approved"
 *        pendingTotal: number,
 *        rejectedTotal: number,
 *        approvedWallets: string[], // GTD list — admin-approved entries
 *      }
 *
 * Sorted newest-activity first via listSubmissions().
 *
 * Auth: gated by the existing /api/admin/* middleware (httpOnly
 * admin-session cookie). The KOL join + status totals are computed
 * here so the admin page doesn't have to roll them itself.
 */
export async function GET() {
  const [items, approvedWallets] = await Promise.all([
    listSubmissions(),
    listGtdWallets(),
  ]);

  const kolMap = await getKolMap(items.map((s) => s.referrerWallet));

  const decorated = items.map((s) => ({
    ...s,
    referrer_isKOL: kolMap.has(s.referrerWallet),
    referrer_tag: kolMap.get(s.referrerWallet) ?? "",
  }));

  let approvedTotal = 0, pendingTotal = 0, rejectedTotal = 0, totalEntries = 0;
  for (const s of items) {
    for (const e of s.entries) {
      totalEntries++;
      if (e.status === "approved") approvedTotal++;
      else if (e.status === "rejected") rejectedTotal++;
      else pendingTotal++;
    }
  }

  return NextResponse.json({
    items: decorated,
    total: items.length,
    totalEntries,
    approvedTotal,
    pendingTotal,
    rejectedTotal,
    approvedWallets,
  });
}
