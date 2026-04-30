import { NextResponse } from "next/server";
import { clearAllApplications } from "@/lib/applicationsStore";
import { clearAllSubmissions } from "@/lib/submissionsStore";
import { getStore } from "@/lib/adminStore";

export const runtime = "nodejs";

// Wipes every transactional store back to empty. Mint config is preserved
// (admin-edited, not user data). Whitelist is process-local — clears for
// the current lambda only (matches existing semantics for whitelist).
// KOL registry intentionally NOT cleared — it's admin-owned metadata.
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

  const errors: Record<string, string> = {};

  let apps = 0;
  try { apps = await clearAllApplications(); }
  catch (e) { errors.applications = (e as Error).message; }

  let subs = 0;
  try { subs = await clearAllSubmissions(); }
  catch (e) { errors.submissions = (e as Error).message; }

  const store = getStore();
  const whitelistCount = store.whitelist.size;
  store.whitelist.clear();

  const status = Object.keys(errors).length === 0 ? 200 : 207; // multi-status
  return NextResponse.json(
    {
      ok: status === 200,
      cleared: {
        applications: apps,
        submissions: subs,
        whitelist: whitelistCount,
      },
      errors: Object.keys(errors).length === 0 ? undefined : errors,
    },
    { status }
  );
}
