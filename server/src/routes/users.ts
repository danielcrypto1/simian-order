import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { isValidWallet, normalizeWallet } from "../lib/wallet";

export const usersRouter = Router();

const upsertBody = z.object({
  wallet: z.string().refine(isValidWallet, "invalid_wallet"),
  twitter_id: z.string().min(1).max(64).optional().nullable(),
  discord_id: z.string().min(1).max(64).optional().nullable(),
});

const patchBody = z.object({
  twitter_id: z.string().min(1).max(64).optional().nullable(),
  discord_id: z.string().min(1).max(64).optional().nullable(),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = upsertBody.parse(req.body);
    const wallet = normalizeWallet(body.wallet);
    const { rows } = await pool.query(
      `INSERT INTO users (wallet_address, twitter_id, discord_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address) DO UPDATE SET
         twitter_id = COALESCE(EXCLUDED.twitter_id, users.twitter_id),
         discord_id = COALESCE(EXCLUDED.discord_id, users.discord_id)
       RETURNING *`,
      [wallet, body.twitter_id ?? null, body.discord_id ?? null]
    );
    res.status(201).json(rows[0]);
  })
);

usersRouter.get(
  "/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const wallet = normalizeWallet(req.params.wallet);
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE wallet_address = $1`,
      [wallet]
    );
    if (rows.length === 0) throw new HttpError(404, "user_not_found");
    res.json(rows[0]);
  })
);

usersRouter.patch(
  "/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const wallet = normalizeWallet(req.params.wallet);
    const body = patchBody.parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.twitter_id !== undefined) {
      values.push(body.twitter_id);
      fields.push(`twitter_id = $${values.length}`);
    }
    if (body.discord_id !== undefined) {
      values.push(body.discord_id);
      fields.push(`discord_id = $${values.length}`);
    }
    if (fields.length === 0) throw new HttpError(400, "no_fields");
    values.push(wallet);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE wallet_address = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) throw new HttpError(404, "user_not_found");
    res.json(rows[0]);
  })
);
