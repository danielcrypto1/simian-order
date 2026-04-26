import fs from "node:fs";
import path from "node:path";

// File-backed application store.
//
// Local dev: writes to `<repo>/data/applications.json` (gitignored, persists
//   across server restarts).
// Vercel: writes to `/tmp/applications.json`. The project filesystem is
//   read-only on Vercel, but `/tmp` is writeable per lambda instance
//   (ephemeral, ~hours of warmth, not shared across instances). For multi-
//   instance durability swap to Vercel KV / Postgres / Supabase by
//   replacing `read()` and `write()` here only.

const isVercel = process.env.VERCEL === "1";
const DATA_FILE = isVercel
  ? "/tmp/applications.json"
  : path.join(process.cwd(), "data", "applications.json");

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type Application = {
  id: string;
  wallet: string;
  twitter: string;
  why: string | null;
  discord: string | null;
  referrer_input: string | null;
  status: ApplicationStatus;
  createdAt: string;
};

function ensureDir(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function read(): Application[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const text = fs.readFileSync(DATA_FILE, "utf8");
    if (!text.trim()) return [];
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed as Application[];
  } catch {
    return [];
  }
}

function write(apps: Application[]): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2), "utf8");
}

function newId(): string {
  return "app_" + Math.random().toString(36).slice(2, 10);
}

export function listApplications(): Application[] {
  // Newest first.
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findByWallet(wallet: string): Application | undefined {
  const w = wallet.toLowerCase();
  return read().find((a) => a.wallet.toLowerCase() === w);
}

type CreateInput = {
  wallet: string;
  twitter: string;
  why?: string | null;
  discord?: string | null;
  referrer_input?: string | null;
};

/**
 * Upserts an application for the given wallet. Status is always set to
 * "pending" — submission never auto-approves.
 */
export function upsertApplication(input: CreateInput): Application {
  const apps = read();
  const wallet = input.wallet.toLowerCase();
  const idx = apps.findIndex((a) => a.wallet.toLowerCase() === wallet);

  const application: Application = {
    id: idx >= 0 ? apps[idx].id : newId(),
    wallet,
    twitter: input.twitter.replace(/^@+/, "").trim(),
    why: input.why ?? null,
    discord: input.discord ?? null,
    referrer_input: input.referrer_input ?? null,
    status: "pending",
    createdAt: idx >= 0 ? apps[idx].createdAt : new Date().toISOString(),
  };

  if (idx >= 0) apps[idx] = application;
  else apps.unshift(application);

  write(apps);
  return application;
}

export function setStatus(
  wallet: string,
  status: Exclude<ApplicationStatus, "pending"> | "pending"
): Application | null {
  const apps = read();
  const w = wallet.toLowerCase();
  const app = apps.find((a) => a.wallet.toLowerCase() === w);
  if (!app) return null;
  app.status = status;
  write(apps);
  return app;
}

export function deleteApplication(wallet: string): boolean {
  const apps = read();
  const w = wallet.toLowerCase();
  const idx = apps.findIndex((a) => a.wallet.toLowerCase() === w);
  if (idx < 0) return false;
  apps.splice(idx, 1);
  write(apps);
  return true;
}
