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

  // Run sequentially. Concurrent PATCHes against the same gist race in
  // GitHub's API and silently lose updates. Per-step try so a single
  // failure doesn't abort the whole wipe — partial success still useful.
  const errors: Record<string, string> = {};

  let apps = 0;
  try { apps = await clearAllApplications(); }
  catch (e) { errors.applications = (e as Error).message; }

  let refs = 0;
  try { refs = await clearAllReferrals(); }
  catch (e) { errors.referrals = (e as Error).message; }

  let uploads = 0;
  try { uploads = await clearAllUploads(); }
  catch (e) { errors.uploads = (e as Error).message; }

  let fcfsTotal = 0;
  let fcfsCleared = false;
  try {
    const r = await resetFcfs();
    fcfsTotal = r.total;
    fcfsCleared = true;
  } catch (e) {
    errors.fcfs = (e as Error).message;
  }

  const store = getStore();
  const whitelistCount = store.whitelist.size;
  store.whitelist.clear();

  const status = Object.keys(errors).length === 0 ? 200 : 207; // multi-status
  return NextResponse.json(
    {
      ok: status === 200,
      cleared: {
        applications: apps,
        referrers: refs,
        uploads,
        fcfsTotalPreserved: fcfsTotal,
        fcfsClaimsCleared: fcfsCleared,
        whitelist: whitelistCount,
      },
      errors: Object.keys(errors).length === 0 ? undefined : errors,
    },
    { status }
  );
}
