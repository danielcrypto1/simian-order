import { NextResponse } from "next/server";
import { clearAllApplications } from "@/lib/applicationsStore";
import { clearAllReferrals } from "@/lib/referralsStore";
import { clearAllUploads } from "@/lib/uploadsStore";
import { resetFcfs } from "@/lib/fcfsStore";
import { getStore } from "@/lib/adminStore";

export const runtime = "nodejs";

// Wipes every transactional store back to empty. Mint config is preserved
// (admin-edited, not user data). FCFS `total` is preserved; only `claimed`
// + `taken` reset. Whitelist is process-local — clears for the current
// lambda only (matches existing semantics for whitelist).
export async function POST(req: Request) {
  let body: unknown = {};
  try { body = await req.json(); } catch {}
  const confirm = (body as { confirm?: unknown })?.confirm === true;
  if (!confirm) {
    return NextResponse.json(
      { error: "missing_confirm", hint: "POST { confirm: true } to wipe" },
      { status: 400 }
    );
  }

  const [apps, refs, uploads, fcfs] = await Promise.all([
    clearAllApplications(),
    clearAllReferrals(),
    clearAllUploads(),
    resetFcfs(),
  ]);

  const store = getStore();
  const whitelistCount = store.whitelist.size;
  store.whitelist.clear();

  return NextResponse.json({
    ok: true,
    cleared: {
      applications: apps,
      referrers: refs,
      uploads,
      fcfsTotalPreserved: fcfs.total,
      fcfsClaimsCleared: true,
      whitelist: whitelistCount,
    },
  });
}
