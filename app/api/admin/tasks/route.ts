import { NextResponse } from "next/server";
import { getTasks, isValidTask, replaceTasks, TASKS_LIMITS } from "@/lib/tasksStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: edit the quest checklist served at /dashboard/tasks.
 *
 *   GET  /api/admin/tasks
 *   →  { tasks: Task[], updatedAt, limits }
 *
 *   PUT  /api/admin/tasks
 *   body: { tasks: Task[] }
 *   →  { ok: true, state }
 *
 * Validation (per row): id matches /^[a-z0-9_-]{1,32}$/, label non-
 * empty + ≤100 chars, url is http(s) + ≤500 chars. Duplicate ids in
 * the payload are dropped (first occurrence wins). The whole list is
 * replaced atomically — no per-row CRUD endpoints.
 *
 * Auth: gated by the /api/admin/* middleware (cookie session).
 */
export async function GET() {
  const state = await getTasks();
  return NextResponse.json({
    tasks: state.tasks,
    updatedAt: state.updatedAt,
    limits: TASKS_LIMITS,
  });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { tasks?: unknown };
  if (!Array.isArray(b.tasks)) {
    return NextResponse.json({ error: "invalid_tasks" }, { status: 400 });
  }
  if (b.tasks.length > TASKS_LIMITS.MAX_TASKS) {
    return NextResponse.json(
      { error: "too_many_tasks", limit: TASKS_LIMITS.MAX_TASKS },
      { status: 400 }
    );
  }
  // Surface row-level rejections rather than silently dropping. The
  // store strips invalid rows on write too, but a 400 lets the admin
  // UI flag the problem instead of saving a partial list.
  const rejected = b.tasks
    .map((t, i) => ({ i, ok: isValidTask(t) }))
    .filter((r) => !r.ok)
    .map((r) => r.i);
  if (rejected.length > 0) {
    return NextResponse.json(
      { error: "invalid_row", rows: rejected },
      { status: 400 }
    );
  }
  const ids = (b.tasks as Array<{ id: string }>).map((t) => t.id.trim().toLowerCase());
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "duplicate_id" }, { status: 400 });
  }
  const state = await replaceTasks(b.tasks as never);
  return NextResponse.json({ ok: true, state });
}
