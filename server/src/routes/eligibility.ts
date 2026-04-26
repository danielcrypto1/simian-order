import { Router } from "express";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { isValidWallet, normalizeWallet } from "../lib/wallet";

export const eligibilityRouter = Router();

eligibilityRouter.get(
  "/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const wallet = normalizeWallet(req.params.wallet);

    const { rows } = await pool.query(
      `SELECT wallet_address, application_status, fcfs_allocated FROM users WHERE wallet_address = $1`,
      [wallet]
    );
    if (rows.length === 0) throw new HttpError(404, "user_not_found");

    const u = rows[0];
    const reasons: string[] = [];
    const canMint =
      u.fcfs_allocated || u.application_status === "approved";

    if (!u.fcfs_allocated) reasons.push("no_fcfs_slot");
    if (u.application_status !== "approved") {
      reasons.push(`application_${u.application_status}`);
    }

    res.json({
      wallet,
      canMint,
      fcfs_allocated: u.fcfs_allocated,
      application_status: u.application_status,
      reasons: canMint ? [] : reasons,
    });
  })
);
