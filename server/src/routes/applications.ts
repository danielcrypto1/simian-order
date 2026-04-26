import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { isValidWallet, normalizeWallet } from "../lib/wallet";
import { requireAdmin } from "../middleware/admin";

export const applicationsRouter = Router();

const submitBody = z.object({
  wallet: z.string().refine(isValidWallet, "invalid_wallet"),
  handle: z.string().min(1).max(64),
  discord: z.string().min(1).max(64).optional().nullable(),
  why: z.string().min(1).max(2000),
  referrer_input: z.string().min(1).max(64).optional().nullable(),
});

applicationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = submitBody.parse(req.body);
    const wallet = normalizeWallet(body.wallet);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Ensure user exists.
      await client.query(
        `INSERT INTO users (wallet_address) VALUES ($1)
         ON CONFLICT (wallet_address) DO NOTHING`,
        [wallet]
      );

      const ins = await client.query(
        `INSERT INTO applications (wallet_address, handle, discord, why, referrer_input)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [wallet, body.handle, body.discord ?? null, body.why, body.referrer_input ?? null]
      );

      await client.query(
        `UPDATE users SET application_status = 'pending' WHERE wallet_address = $1`,
        [wallet]
      );

      await client.query("COMMIT");
      res.status(201).json(ins.rows[0]);
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally {
      client.release();
    }
  })
);

applicationsRouter.get(
  "/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const wallet = normalizeWallet(req.params.wallet);

    const userQ = await pool.query(
      `SELECT application_status FROM users WHERE wallet_address = $1`,
      [wallet]
    );
    if (userQ.rows.length === 0) throw new HttpError(404, "user_not_found");

    const apps = await pool.query(
      `SELECT * FROM applications WHERE wallet_address = $1 ORDER BY submitted_at DESC`,
      [wallet]
    );

    res.json({
      wallet,
      application_status: userQ.rows[0].application_status,
      applications: apps.rows,
    });
  })
);

async function review(wallet: string, status: "approved" | "rejected") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE applications
          SET status = $2, reviewed_at = now()
        WHERE wallet_address = $1 AND status = 'pending'
        RETURNING *`,
      [wallet, status]
    );
    if (upd.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new HttpError(404, "no_pending_application");
    }
    await client.query(
      `UPDATE users SET application_status = $2 WHERE wallet_address = $1`,
      [wallet, status]
    );
    await client.query("COMMIT");
    return upd.rows[0];
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

applicationsRouter.post(
  "/:wallet/approve",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const row = await review(normalizeWallet(req.params.wallet), "approved");
    res.json(row);
  })
);

applicationsRouter.post(
  "/:wallet/reject",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const row = await review(normalizeWallet(req.params.wallet), "rejected");
    res.json(row);
  })
);
