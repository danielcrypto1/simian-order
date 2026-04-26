import fs from "node:fs";
import path from "node:path";

// Application store with two backends:
//
//  - GitHub Gist (preferred): when APPLICATIONS_GIST_ID + APPLICATIONS_GIST_TOKEN
//    are set, reads/writes go to a private Gist via the GitHub API. This is
//    shared across all Vercel lambda instances so submissions appear in the
//    admin panel immediately.
//
//  - File (fallback): when env vars are absent, writes to
//    `<repo>/data/applications.json` locally or `/tmp/applications.json` on
//    Vercel. Works for single-instance dev / single-warm-lambda demos but
//    NOT for production on serverless (per-instance only).
//
// To migrate to a real DB later, replace `read()` and `write()` only.

const GIST_ID = process.env.APPLICATIONS_GIST_ID;
const GIST_TOKEN = process.env.APPLICATIONS_GIST_TOKEN;
const USE_GIST = Boolean(GIST_ID && GIST_TOKEN);

const isVercel = process.env.VERCEL === "1";
const DATA_FILE = isVercel
  ? "/tmp/applications.json"
  : path.join(process.cwd(), "data", "applications.json");
const GIST_FILE = "applications.json";

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

// ───── File backend ───────────────────────────────────────────────────

function ensureFileDir(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function readFile(): Application[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const text = fs.readFileSync(DATA_FILE, "utf8");
    if (!text.trim()) return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Application[]) : [];
  } catch {
    return [];
  }
}
function writeFile(apps: Application[]): void {
  ensureFileDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2), "utf8");
}

// ───── Gist backend ───────────────────────────────────────────────────

async function readGist(): Promise<Application[]> {
  if (!USE_GIST) return readFile();
  try {
    const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${GIST_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        Accept: "application/vnd.github+json",
      },
      // Force fresh read every time — this is our database.
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { files?: Record<string, { content?: string }> };
    const content = j.files?.[GIST_FILE]?.content?.trim();
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as Application[]) : [];
  } catch {
    return [];
  }
}

async function writeGist(apps: Application[]): Promise<void> {
  if (!USE_GIST) { writeFile(apps); return; }
  const body = {
    files: { [GIST_FILE]: { content: JSON.stringify(apps, null, 2) } },
  };
  const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GIST_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`gist_write_failed_${r.status}: ${t.slice(0, 200)}`);
  }
}

// ───── Public API ─────────────────────────────────────────────────────

async function read(): Promise<Application[]> {
  return USE_GIST ? readGist() : readFile();
}
async function write(apps: Application[]): Promise<void> {
  return USE_GIST ? writeGist(apps) : writeFile(apps);
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
};

/**
 * Upserts an application for the given wallet. Status is always set to
 * "pending" — submission never auto-approves.
 */
export async function upsertApplication(input: CreateInput): Promise<Application> {
  const apps = await read();
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

export async function deleteApplication(wallet: string): Promise<boolean> {
  const apps = await read();
  const w = wallet.toLowerCase();
  const idx = apps.findIndex((a) => a.wallet.toLowerCase() === w);
  if (idx < 0) return false;
  apps.splice(idx, 1);
  await write(apps);
  return true;
}
