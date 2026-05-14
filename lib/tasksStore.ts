import { readJSON, writeJSON } from "./gistStore";
import { TASK_LINKS } from "./links";

/**
 * Tasks store.
 *
 * The quest checklist at /dashboard/tasks is admin-editable now —
 * the source of truth lives in a single JSON gist file (`tasks.json`)
 * instead of hardcoded in the page. Empty list → the page renders
 * the "no active tasks" placeholder (auto-FCFS grant is gated off
 * by the same flag).
 *
 * Storage: { tasks: Task[] }. Reads/writes are atomic — the admin
 * editor replaces the whole list in one PUT rather than doing CRUD
 * per row. Simpler, and ordering is preserved.
 */

const FILE = "tasks.json";

export type Task = {
  id: string;     // slug-safe unique id (a-z 0-9 _ -). Persists across edits.
  label: string;  // visible task text on /dashboard/tasks
  url: string;    // "Open" button destination (must be http/https)
};

export type TasksState = {
  tasks: Task[];
  updatedAt: string;
};

/**
 * Initial seed used when the gist has never been written. Matches the
 * round-1 quest checklist that shipped before the admin editor — any
 * deploy without a prior gist write still renders the canonical list.
 */
const DEFAULT_TASKS: Task[] = [
  { id: "follow",       label: "Follow @SimianOrder on X",     url: TASK_LINKS.X_PROFILE },
  { id: "like_retweet", label: "Like & Retweet",               url: TASK_LINKS.PINNED_TWEET },
  { id: "tag",          label: "Tag 2 SIMIANS in pinned post", url: TASK_LINKS.PINNED_TWEET },
];

const DEFAULT_STATE: TasksState = {
  tasks: DEFAULT_TASKS,
  updatedAt: new Date(0).toISOString(),
};

const ID_RE = /^[a-z0-9_-]{1,32}$/i;
const LABEL_MAX = 100;
const URL_MAX = 500;
const MAX_TASKS = 16;

export async function getTasks(): Promise<TasksState> {
  const s = await readJSON<TasksState>(FILE, DEFAULT_STATE);
  // Defensive shape — gist file may have been edited by hand or
  // legacy. Drop anything malformed silently so a bad entry doesn't
  // brick the whole tasks page.
  const tasks = Array.isArray(s?.tasks)
    ? s.tasks.filter(isValidTask).slice(0, MAX_TASKS)
    : DEFAULT_TASKS;
  return {
    tasks,
    updatedAt: typeof s?.updatedAt === "string" ? s.updatedAt : DEFAULT_STATE.updatedAt,
  };
}

export async function replaceTasks(next: Task[]): Promise<TasksState> {
  const out: Task[] = [];
  const seen = new Set<string>();
  for (const t of next) {
    if (!isValidTask(t)) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({
      id: t.id.trim().toLowerCase(),
      label: t.label.trim().slice(0, LABEL_MAX),
      url: t.url.trim().slice(0, URL_MAX),
    });
    if (out.length >= MAX_TASKS) break;
  }
  const state: TasksState = { tasks: out, updatedAt: new Date().toISOString() };
  await writeJSON(FILE, state);
  return state;
}

/** Pure validator — exported for the admin API to surface row-level
 *  problems before saving. */
export function isValidTask(t: unknown): t is Task {
  if (!t || typeof t !== "object") return false;
  const r = t as Record<string, unknown>;
  if (typeof r.id !== "string" || !ID_RE.test(r.id.trim())) return false;
  if (typeof r.label !== "string" || !r.label.trim()) return false;
  if (r.label.length > LABEL_MAX) return false;
  if (typeof r.url !== "string" || !r.url.trim()) return false;
  if (r.url.length > URL_MAX) return false;
  if (!/^https?:\/\//i.test(r.url.trim())) return false;
  return true;
}

export const TASKS_LIMITS = {
  MAX_TASKS,
  LABEL_MAX,
  URL_MAX,
};
