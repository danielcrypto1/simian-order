import { readJSON, writeJSON } from "./gistStore";

const FILE = "applications.json";

export type ApplicationStatus = "pending" | "approved" | "rejected";

/**
 * How the application landed in the queue.
 *   "apply" — submitted via the formal /dashboard/apply form (default).
 *   "quest" — auto-created when a wallet completes the quest log + submits
 *             identity via /dashboard/tasks. Tagged in admin so review
 *             priority can differ.
 *
 * Existing entries that pre-date this field read back as "apply" via the
 * coercion in `read()`.
 */
export type ApplicationSource = "apply" | "quest";

export type Application = {
  id: string;
  wallet: string;
  twitter: string;
  why: string | null;
  discord: string | null;
  referrer_input: string | null;
  status: ApplicationStatus;
  source: ApplicationSource;
  createdAt: string;
};

async function read(): Promise<Application[]> {
  const raw = await readJSON<Application[]>(FILE, []);
  if (!Array.isArray(raw)) return [];
  // Backfill source on legacy entries written before the field existed.
  return raw.map((a) => ({
    ...a,
    source: (a as Application).source === "quest" ? "quest" : "apply",
  }));
}
async function write(apps: Application[]): Promise<void> {
  await writeJSON(FILE, apps);
}

function newId(): string {
  return "app_" + Math.random().toString(36).slice(2, 10);
}

export async function listApplications(): Promise<Application[]> {
  const apps = await read();
  return apps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findByWallet(wallet: string): Promise<Application | undefined> {
  const w = wallet.toLowerCase();
  const apps = await read();
  return apps.find((a) => a.wallet.toLowerCase() === w);
}

type CreateInput = {
  wallet: string;
  twitter: string;
  why?: string | null;
  discord?: string | null;
  referrer_input?: string | null;
  source?: ApplicationSource;
};

/**
 * Upserts an application for the given wallet. Status is always set to
 * "pending" — submission never auto-approves.
 *
 * Source rules:
 *   - On a brand-new entry, use input.source (default "apply").
 *   - If an entry already exists with source="apply", DO NOT downgrade
 *     it to "quest" — the formal application carries more weight and
 *     stays the canonical record.
 *   - If existing source is "quest" and a new "apply" submit arrives,
 *     upgrade the entry to "apply" (the user filed the formal form).
 */
export async function upsertApplication(input: CreateInput): Promise<Application> {
  const apps = await read();
  const wallet = input.wallet.toLowerCase();
  const idx = apps.findIndex((a) => a.wallet.toLowerCase() === wallet);
  const wantSource: ApplicationSource = input.source ?? "apply";
  const existingSource: ApplicationSource | null =
    idx >= 0 ? apps[idx].source : null;
  const finalSource: ApplicationSource =
    existingSource === "apply" ? "apply" : wantSource;

  // Status rules:
  //   - Quest auto-submission must NEVER reset an admin's prior decision,
  //     so when an entry already exists and source="quest", preserve it.
  //   - Standard "apply" submissions (re-applies included) reset to pending,
  //     which is the original behaviour and lets rejected users retry.
  const status: ApplicationStatus =
    idx >= 0 && wantSource === "quest" ? apps[idx].status : "pending";

  const application: Application = {
    id: idx >= 0 ? apps[idx].id : newId(),
    wallet,
    twitter: input.twitter.replace(/^@+/, "").trim(),
    // For quest submissions we don't have why/discord — preserve existing
    // values rather than blanking the row out on second touch.
    why: input.why ?? (idx >= 0 ? apps[idx].why : null),
    discord: input.discord ?? (idx >= 0 ? apps[idx].discord : null),
    referrer_input:
      input.referrer_input ?? (idx >= 0 ? apps[idx].referrer_input : null),
    status,
    source: finalSource,
    createdAt: idx >= 0 ? apps[idx].createdAt : new Date().toISOString(),
  };

  if (idx >= 0) apps[idx] = application;
  else apps.unshift(application);

  await write(apps);
  return application;
}

export async function setStatus(
  wallet: string,
  status: ApplicationStatus
): Promise<Application | null> {
  const apps = await read();
  const w = wallet.toLowerCase();
  const app = apps.find((a) => a.wallet.toLowerCase() === w);
  if (!app) return null;
  app.status = status;
  await write(apps);
  return app;
}

/**
 * Bulk-flips every application in `status: "pending"` to a new status.
 * Single read-modify-write so we avoid N gist round-trips.
 *
 * `onlyValid` (default false): when true, skips entries that don't have
 * both a wallet and a twitter handle. The /api/apply route validates
 * these on submit so all current entries should pass; the toggle is
 * defensive against legacy/imported data.
 */
export async function bulkSetStatusForPending(
  newStatus: "approved" | "rejected",
  options?: { onlyValid?: boolean }
): Promise<number> {
  const apps = await read();
  let count = 0;
  for (const app of apps) {
    if (app.status !== "pending") continue;
    if (options?.onlyValid) {
      if (!app.wallet || !app.twitter) continue;
    }
    app.status = newStatus;
    count++;
  }
  if (count > 0) await write(apps);
  return count;
}

/** Wipes the entire application list. Returns the number of entries removed. */
export async function clearAllApplications(): Promise<number> {
  const before = await read();
  await write([]);
  return before.length;
}

export async function deleteApplication(wallet: string): Promise<boolean> {
  const apps = await read();
  const w = wallet.toLowerCase();
  const idx = apps.findIndex((a) => a.wallet.toLowerCase() === w);
  if (idx < 0) return false;
  apps.splice(idx, 1);
  await write(apps);
  return true;
}
