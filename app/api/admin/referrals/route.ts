import { NextResponse } from "next/server";
import { listAllLinks, REFERRAL_LIMIT } from "@/lib/referralsStore";
import { listApplications } from "@/lib/applicationsStore";

export const runtime = "nodejs";

export async function GET() {
  const [links, apps] = await Promise.all([listAllLinks(), listApplications()]);

  // Hydrate each referee with their application status (if any).
  const items = links.map((l) => ({
    wallet: l.wallet,
    code: l.code,
    count: l.referred.length,
    limit: REFERRAL_LIMIT,
    createdAt: l.createdAt,
    referred: l.referred.map((w) => {
      const app = apps.find((a) => a.wallet.toLowerCase() === w);
      return {
        wallet: w,
        twitter: app?.twitter ?? null,
        status: app?.status ?? null,
      };
    }),
  }));

  return NextResponse.json({
    items,
    total: items.length,
    totalReferred: items.reduce((sum, i) => sum + i.count, 0),
  });
}
