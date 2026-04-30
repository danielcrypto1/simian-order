import { NextResponse } from "next/server";
import { adminResetClaims } from "@/lib/backroomStore";

export const runtime = "nodejs";

/**
 * POST /api/admin/backroom/reset
 * body: { alsoClearPassphrase?: boolean }
 *
 * Wipes the issued-claims array. Visitor cookies remain on the
 * client; affected visitors will be able to claim again once a
 * (possibly new) passphrase is supplied. By default the passphrase
 * is preserved — pass `alsoClearPassphrase: true` to also unset it.
 */
export async function POST(req: Request) {
  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const alsoClear = !!(body as any)?.alsoClearPassphrase;
  await adminResetClaims({ alsoClearPassphrase: alsoClear });
  return NextResponse.json({ ok: true });
}
