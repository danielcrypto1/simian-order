import { readJSON, writeJSON } from "./gistStore";

const FILE = "fcfs.json";

export type FcfsState = {
  total: number;
  taken: number;
  claimed: string[]; // wallets, lowercased
};

const DEFAULT_STATE: FcfsState = { total: 50, taken: 0, claimed: [] };

async function read(): Promise<FcfsState> {
  const raw = await readJSON<FcfsState>(FILE, DEFAULT_STATE);
  // Defensive normalisation in case the file got corrupted.
  return {
    total: Number.isFinite(raw?.total) ? raw.total : DEFAULT_STATE.total,
    taken: Number.isFinite(raw?.taken) ? raw.taken : 0,
    claimed: Array.isArray(raw?.claimed) ? raw.claimed.map((w) => String(w).toLowerCase()) : [],
  };
}

async function write(s: FcfsState): Promise<void> {
  await writeJSON(FILE, s);
}

export async function getFcfsState(): Promise<FcfsState> {
  return read();
}

export type ClaimResult =
  | { ok: true; state: FcfsState }
  | { ok: false; error: "already_claimed" | "fcfs_full"; state: FcfsState };

export async function claimFcfs(wallet: string): Promise<ClaimResult> {
  const w = wallet.toLowerCase();
  const s = await read();
  if (s.claimed.includes(w)) {
    return { ok: false, error: "already_claimed", state: s };
  }
  if (s.taken >= s.total) {
    return { ok: false, error: "fcfs_full", state: s };
  }
  const next: FcfsState = {
    total: s.total,
    taken: s.taken + 1,
    claimed: [...s.claimed, w],
  };
  await write(next);
  return { ok: true, state: next };
}

export async function resetFcfs(): Promise<FcfsState> {
  const cur = await read();
  const next: FcfsState = { total: cur.total, taken: 0, claimed: [] };
  await write(next);
  return next;
}

export async function setFcfsTotal(total: number): Promise<FcfsState> {
  const s = await read();
  // Don't shrink below already-claimed count.
  const next = { ...s, total: Math.max(total, s.taken) };
  await write(next);
  return next;
}
