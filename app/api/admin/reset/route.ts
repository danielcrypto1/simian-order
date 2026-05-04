import { NextResponse } from "next/server";
import { clearAllApplications } from "@/lib/applicationsStore";
import { clearAllSubmissions } from "@/lib/submissionsStore";

export const runtime = "nodejs";

// Wipes every transactional gist store back to empty. The mint config
// + whitelist registry that this used to also clear are gone with the
// contract removal. The KOL registry and Back Room state are
// intentionally NOT cleared — they're admin-owned and have their own
// dedicated reset surfaces.
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

  const status = Object.keys(errors).length === 0 ? 200 : 207; // multi-status
  return NextResponse.json(
    {
      ok: status === 200,
      cleared: {
        applications: apps,
        submissions: subs,
      },
      errors: Object.keys(errors).length === 0 ? undefined : errors,
    },
    { status }
  );
}
