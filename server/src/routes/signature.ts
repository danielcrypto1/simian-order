import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { isValidWallet, normalizeWallet } from "../lib/wallet";
import { generateSignature, getSignerAddress } from "../lib/signature";

export const signatureRouter = Router();

const PHASE_GTD = 0;
const PHASE_FCFS = 1;
const PHASE_PUBLIC = 2;
type PhaseLabel = "GTD" | "FCFS" | "PUBLIC";

const body = z.object({
  wallet: z.string().refine(isValidWallet, "invalid_wallet"),
});

signatureRouter.get(
  "/signer",
  asyncHandler(async (_req, res) => {
    res.json({ signer: getSignerAddress() });
  })
);

signatureRouter.post(
  "/get-signature",
  asyncHandler(async (req, res) => {
    const parsed = body.parse(req.body);
    const wallet = normalizeWallet(parsed.wallet);

    const [userQ, cfgQ] = await Promise.all([
      pool.query(
        `SELECT application_status, fcfs_allocated FROM users WHERE wallet_address = $1`,
        [wallet]
      ),
      pool.query(
        `SELECT gtd_max_mint, fcfs_max_mint, public_max_mint FROM mint_config WHERE id = 1`
      ),
    ]);

    const cfg = cfgQ.rows[0];
    if (!cfg) throw new HttpError(500, "config_not_initialized");
    const user = userQ.rows[0] as
      | { application_status: string; fcfs_allocated: boolean }
      | undefined;

    let phase: number;
    let maxAllowed: number;
    let label: PhaseLabel;

    if (user?.application_status === "approved") {
      phase = PHASE_GTD;
      maxAllowed = cfg.gtd_max_mint;
      label = "GTD";
    } else if (user?.fcfs_allocated) {
      phase = PHASE_FCFS;
      maxAllowed = cfg.fcfs_max_mint;
      label = "FCFS";
    } else {
      phase = PHASE_PUBLIC;
      maxAllowed = cfg.public_max_mint;
      label = "PUBLIC";
    }

    const signature = await generateSignature(wallet, phase, maxAllowed);

    res.json({
      wallet,
      phase,
      phase_label: label,
      maxAllowed,
      signature,
      signer: getSignerAddress(),
    });
  })
);
