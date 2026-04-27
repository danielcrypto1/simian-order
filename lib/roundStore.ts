import { readJSON, writeJSON } from "./gistStore";

/**
 * Persistent round number, gist-backed (or local file in dev).
 *
 * Stored as `round.json` in the same gist used by applications,
 * referrals, uploads, fcfs. The shape is intentionally tiny so the
 * file stays lightweight.
 *
 * Default = 1. Admin can update via /api/admin/config PATCH.
 * Public clients read via the GET /api/round endpoint.
 */

const FILE = "round.json";

export type RoundState = {
  roundNumber: number;
};

const DEFAULT_STATE: RoundState = { roundNumber: 1 };

async function read(): Promise<RoundState> {
  const raw = await readJSON<RoundState>(FILE, DEFAULT_STATE);
  const n = Number((raw as RoundState | null)?.roundNumber);
  return {
    roundNumber: Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_STATE.roundNumber,
  };
}

async function write(s: RoundState): Promise<void> {
  await writeJSON(FILE, s);
}

export async function getRound(): Promise<RoundState> {
  return read();
}

export async function setRound(n: number): Promise<RoundState> {
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("invalid_round_number");
  }
  const next: RoundState = { roundNumber: Math.floor(n) };
  await write(next);
  return next;
}
