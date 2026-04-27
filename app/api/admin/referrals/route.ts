import { NextResponse } from "next/server";
import { listAllLinks, REFERRAL_LIMIT } from "@/lib/referralsStore";
import { listApplications } from "@/lib/applicationsStore";

export const runtime = "nodejs";

export async function GET() {
  const [links, apps] = await Promise.all([listAllLinks(), listApplications()]);

  // Hydrate each referee with their application status (if any),
  // and compute GTD: a referrer who has hit the 5-referral cap is
  // automatically GTD'd (their wallet is guaranteed access).
  const items = links.map((l) => {
    const count = l.referred.length;
    return {
      wallet: l.wallet,
      code: l.code,
      count,
      limit: REFERRAL_LIMIT,
      gtd: count >= REFERRAL_LIMIT,
      createdAt: l.createdAt,
      referred: l.referred.map((w) => {
        const app = apps.find((a) => a.wallet.toLowerCase() === w);
        return {
          wallet: w,
          twitter: app?.twitter ?? null,
          status: app?.status ?? null,
        };
      }),
    };
  });

  return NextResponse.json({
    items,
    total: items.length,
    totalReferred: items.reduce((sum, i) => sum + i.count, 0),
    gtdTotal: items.filter((i) => i.gtd).length,
  });
}
