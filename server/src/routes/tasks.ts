import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { isValidWallet, normalizeWallet } from "../lib/wallet";

export const tasksRouter = Router();

const TASKS = [
  "follow_twitter",
  "retweet",
  "join_discord",
  "tag_friends",
  "submit_wallet",
] as const;

const verifyBody = z.object({
  wallet: z.string().refine(isValidWallet, "invalid_wallet"),
  task: z.enum(TASKS),
  payload: z.record(z.unknown()).optional(),
});

function mockVerify(task: (typeof TASKS)[number], payload: unknown): boolean {
  // Mock verification: simple shape checks. Replace with real integrations later.
  if (task === "follow_twitter" || task === "retweet") {
    const p = (payload ?? {}) as { twitter_id?: string };
    return typeof p.twitter_id === "string" && p.twitter_id.length > 0;
  }
  if (task === "join_discord") {
    const p = (payload ?? {}) as { discord_id?: string };
    return typeof p.discord_id === "string" && p.discord_id.length > 0;
  }
  if (task === "tag_friends") {
    const p = (payload ?? {}) as { tweet_url?: string };
    return typeof p.tweet_url === "string" && /^https?:\/\//.test(p.tweet_url);
  }
  if (task === "submit_wallet") return true;
  return false;
}

tasksRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const body = verifyBody.parse(req.body);
    const wallet = normalizeWallet(body.wallet);

    const userQ = await pool.query(
      `SELECT 1 FROM users WHERE wallet_address = $1`,
      [wallet]
    );
    if (userQ.rows.length === 0) throw new HttpError(404, "user_not_found");

    const verified = mockVerify(body.task, body.payload);
    if (!verified) {
      return res.status(200).json({ wallet, task: body.task, verified: false });
    }

    await pool.query(
      `INSERT INTO task_completions (wallet_address, task, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address, task) DO UPDATE SET payload = EXCLUDED.payload, verified_at = now()`,
      [wallet, body.task, body.payload ?? null]
    );

    const completed = await pool.query(
      `SELECT task, verified_at FROM task_completions WHERE wallet_address = $1 ORDER BY verified_at`,
      [wallet]
    );

    res.json({
      wallet,
      task: body.task,
      verified: true,
      completed: completed.rows,
      all_done: completed.rows.length === TASKS.length,
    });
  })
);

tasksRouter.get(
  "/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const wallet = normalizeWallet(req.params.wallet);
    const { rows } = await pool.query(
      `SELECT task, verified_at, payload FROM task_completions WHERE wallet_address = $1 ORDER BY verified_at`,
      [wallet]
    );
    res.json({ wallet, completed: rows, total_tasks: TASKS.length });
  })
);
