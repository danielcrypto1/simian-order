import { NextResponse } from "next/server";
import { setEntryStatus, deleteSubmission } from "@/lib/submissionsStore";

export const runtime = "nodejs";

/**
 * Admin: per-entry approve / reject + per-submission delete.
 *
 *   POST /api/admin/referrals/decide
 *   body: { referrer, referee, action: "approve" | "reject" }
 *      OR { referrer, action: "delete" }   // wipes the whole submission
 *   →  200 { ok: true, submission?: Submission }
 *      400 { error: <code> }
 *      404 { error: "not_found" }
 *
 * Auth: gated by the /api/admin/* middleware.
 *
 * The action="delete" branch lets admin unblock a referrer who
 * needs to resubmit (e.g. they made a typo and the entries are
 * already locked).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as {
    referrer?: unknown;
    referee?: unknown;
    action?: unknown;
  };

  if (typeof b.referrer !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(b.referrer)) {
    return NextResponse.json({ error: "invalid_referrer" }, { status: 400 });
  }
  const action = b.action;
  if (action !== "approve" && action !== "reject" && action !== "delete") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  if (action === "delete") {
    const ok = await deleteSubmission(b.referrer);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (typeof b.referee !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(b.referee)) {
    return NextResponse.json({ error: "invalid_referee" }, { status: 400 });
  }

  const sub = await setEntryStatus(b.referrer, b.referee, action);
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, submission: sub });
}
