import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { isValidWallet, normalizeWallet } from "../lib/wallet";
import { newReferralCode } from "../lib/referral";

export const referralsRouter = Router();

const REFERRAL_LIMIT = Number(process.env.REFERRAL_LIMIT ?? 5);
const MAX_CODE_GEN_ATTEMPTS = 6;

const codeBody = z.object({
  wallet: z.string().refine(isValidWallet, "invalid_wallet"),
});

referralsRouter.post(
  "/code",
  asyncHandler(async (req, res) => {
    const body = codeBody.parse(req.body);
    const wallet = normalizeWallet(body.wallet);

    const userQ = await pool.query(
      `SELECT referral_code FROM users WHERE wallet_address = $1`,
      [wallet]
    );
    if (userQ.rows.length === 0) throw new HttpError(404, "user_not_found");
    if (userQ.rows[0].referral_code) {
      return res.json({ wallet, code: userQ.rows[0].referral_code });
    }

    let code: string | null = null;
    for (let i = 0; i < MAX_CODE_GEN_ATTEMPTS; i++) {
      const candidate = newReferralCode();
      const upd = await pool.query(
        `UPDATE users SET referral_code = $2
          WHERE wallet_address = $1 AND referral_code IS NULL
            AND NOT EXISTS (SELECT 1 FROM users WHERE referral_code = $2)
          RETURNING referral_code`,
        [wallet, candidate]
      );
      if (upd.rows.length > 0) {
        code = upd.rows[0].referral_code;
        break;
      }
      // Race: someone else just set it. Re-read.
      const r = await pool.query(
        `SELECT referral_code FROM users WHERE wallet_address = $1`,
        [wallet]
      );
      if (r.rows[0]?.referral_code) {
        code = r.rows[0].referral_code;
        break;
      }
    }
    if (!code) throw new HttpError(500, "code_generation_failed");
    res.status(201).json({ wallet, code });
  })
);

const redeemBody = z.object({
  wallet: z.string().refine(isValidWallet, "invalid_wallet"),
  code: z.string().min(3).max(32),
});

referralsRouter.post(
  "/redeem",
  asyncHandler(async (req, res) => {
    const body = redeemBody.parse(req.body);
    const wallet = normalizeWallet(body.wallet);
    const code = body.code.trim().toUpperCase();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO users (wallet_address) VALUES ($1)
         ON CONFLICT (wallet_address) DO NOTHING`,
        [wallet]
      );

      const userQ = await client.query(
        `SELECT referrer FROM users WHERE wallet_address = $1 FOR UPDATE`,
        [wallet]
      );
      if (userQ.rows[0].referrer) {
        await client.query("ROLLBACK");
        throw new HttpError(409, "already_referred");
      }

      const refQ = await client.query(
        `SELECT wallet_address FROM users WHERE referral_code = $1 FOR UPDATE`,
        [code]
      );
      if (refQ.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new HttpError(404, "referral_code_not_found");
      }
      const referrer = refQ.rows[0].wallet_address as string;

      if (referrer === wallet) {
        await client.query("ROLLBACK");
        throw new HttpError(400, "self_referral_not_allowed");
      }

      const countQ = await client.query(
        `SELECT COUNT(*)::int AS c FROM users WHERE referrer = $1`,
        [referrer]
      );
      if (countQ.rows[0].c >= REFERRAL_LIMIT) {
        await client.query("ROLLBACK");
        throw new HttpError(409, "referral_limit_reached");
      }

      await client.query(
        `UPDATE users SET referrer = $2 WHERE wallet_address = $1`,
        [wallet, referrer]
      );

      await client.query("COMMIT");
      res.json({ wallet, referrer, count: countQ.rows[0].c + 1, limit: REFERRAL_LIMIT });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally {
      client.release();
    }
  })
);

referralsRouter.get(
  "/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const wallet = normalizeWallet(req.params.wallet);
    const userQ = await pool.query(
      `SELECT referral_code FROM users WHERE wallet_address = $1`,
      [wallet]
    );
    if (userQ.rows.length === 0) throw new HttpError(404, "user_not_found");

    const refs = await pool.query(
      `SELECT wallet_address, application_status, fcfs_allocated, created_at
         FROM users
        WHERE referrer = $1
        ORDER BY created_at`,
      [wallet]
    );
    res.json({
      wallet,
      code: userQ.rows[0].referral_code,
      count: refs.rows.length,
      limit: REFERRAL_LIMIT,
      referred: refs.rows,
    });
  })
);
