import { NextResponse } from "next/server";
import { getTasks } from "@/lib/tasksStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks
 *
 * Public read-only view of the admin-managed quest checklist consumed
 * by /dashboard/tasks. Returns:
 *   { tasks: [{ id, label, url }], updatedAt }
 *
 * Empty array is a valid response — the page falls through to its
 * "no active tasks" placeholder and the FCFS auto-grant is gated off.
 */
export async function GET() {
  const state = await getTasks();
  return NextResponse.json(
    { tasks: state.tasks, updatedAt: state.updatedAt },
    { headers: { "cache-control": "no-store" } }
  );
}
