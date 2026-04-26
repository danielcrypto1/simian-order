import { readJSON, writeJSON } from "./gistStore";

const FILE = "applications.json";

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

async function read(): Promise<Application[]> {
  const raw = await readJSON<Application[]>(FILE, []);
  return Array.isArray(raw) ? raw : [];
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
