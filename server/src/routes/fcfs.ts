import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { isValidWallet, normalizeWallet } from "../lib/wallet";

export const fcfsRouter = Router();

fcfsRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT total_spots, spots_taken FROM fcfs_state WHERE id = 1`
    );
    if (rows.length === 0) throw new HttpError(500, "fcfs_not_initialized");
    const { total_spots, spots_taken } = rows[0];
    res.json({
      total: total_spots,
      taken: spots_taken,
      remaining: total_spots - spots_taken,
    });
  })
);

const claimBody = z.object({
  wallet: z.string().refine(isValidWallet, "invalid_wallet"),
});

fcfsRouter.post(
  "/claim",
  asyncHandler(async (req, res) => {
    const body = claimBody.parse(req.body);
    const wallet = normalizeWallet(body.wallet);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userQ = await client.query(
        `SELECT fcfs_allocated FROM users WHERE wallet_address = $1 FOR UPDATE`,
        [wallet]
      );
      if (userQ.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new HttpError(404, "user_not_found");
      }
      if (userQ.rows[0].fcfs_allocated) {
        await client.query("ROLLBACK");
        throw new HttpError(409, "already_allocated");
      }

      const claimQ = await client.query(
        `UPDATE fcfs_state
            SET spots_taken = spots_taken + 1
          WHERE id = 1 AND spots_taken < total_spots
        RETURNING total_spots, spots_taken`
      );
      if (claimQ.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new HttpError(409, "fcfs_full");
      }

      await client.query(
        `UPDATE users SET fcfs_allocated = TRUE WHERE wallet_address = $1`,
        [wallet]
      );

      await client.query("COMMIT");
      const { total_spots, spots_taken } = claimQ.rows[0];
      res.json({
        wallet,
        fcfs_allocated: true,
        total: total_spots,
        taken: spots_taken,
        remaining: total_spots - spots_taken,
      });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally {
      client.release();
    }
  })
);
