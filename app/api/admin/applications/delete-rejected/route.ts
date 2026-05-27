import { NextResponse } from "next/server";
import { deleteRejectedApplications } from "@/lib/applicationsStore";

export const runtime = "nodejs";

/**
 * POST /api/admin/applications/delete-rejected
 *
 * Removes every application currently in `status: "rejected"`. Returns
 * { success, count } where count is the number of rows removed. Single
 * gist round-trip regardless of how many were dropped. Auth-gated by
 * the /api/admin/* middleware.
 */
export async function POST() {
  const count = await deleteRejectedApplications();
  return NextResponse.json({ success: true, count });
}
