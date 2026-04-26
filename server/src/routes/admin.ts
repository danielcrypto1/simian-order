import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/error";
import { requireAdmin } from "../middleware/admin";
import { checkAdminCredentials, signAdminToken, verifyAdminToken } from "../lib/auth";
import { isValidWallet, normalizeWallet } from "../lib/wallet";

export const adminRouter = Router();

const loginBody = z.object({
  user: z.string().min(1),
  pass: z.string().min(1),
});

adminRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginBody.parse(req.body);
    if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
      throw new HttpError(503, "admin_not_configured");
    }
    if (!checkAdminCredentials(body.user, body.pass)) {
      throw new HttpError(401, "invalid_credentials");
    }
    const token = signAdminToken("admin");
    res.json({ token, user: "admin" });
  })
);

adminRouter.get(
  "/session",
  asyncHandler(async (req, res) => {
    const auth = req.header("authorization");
    if (!auth?.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized");
    }
    const payload = verifyAdminToken(auth.slice(7).trim());
    if (!payload) throw new HttpError(401, "unauthorized");
    res.json({ user: payload.sub, exp: payload.exp });
  })
);

adminRouter.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

adminRouter.use(requireAdmin);

adminRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const cfg = await pool.query(`SELECT * FROM mint_config WHERE id = 1`);
    const fcfs = await pool.query(
      `SELECT total_spots, spots_taken FROM fcfs_state WHERE id = 1`
    );
    if (cfg.rows.length === 0 || fcfs.rows.length === 0) {
      throw new HttpError(500, "config_not_initialized");
    }
    const c = cfg.rows[0];
    const f = fcfs.rows[0];
    res.json({
      mint: {
        total_supply: c.total_supply,
        gtd_allocation: c.gtd_allocation,
        fcfs_allocation: c.fcfs_allocation,
        gtd_max_mint: c.gtd_max_mint,
        fcfs_max_mint: c.fcfs_max_mint,
        public_max_mint: c.public_max_mint,
        gtd_active: c.gtd_active,
        fcfs_active: c.fcfs_active,
        public_active: c.public_active,
      },
      royalty_bps: c.royalty_bps,
      fcfs_state: {
        total: f.total_spots,
        taken: f.spots_taken,
        remaining: f.total_spots - f.spots_taken,
      },
    });
  })
);

const patchConfigBody = z
  .object({
    total_supply: z.number().int().min(0).optional(),
    gtd_allocation: z.number().int().min(0).optional(),
    fcfs_allocation: z.number().int().min(0).optional(),
    gtd_max_mint: z.number().int().min(0).optional(),
    fcfs_max_mint: z.number().int().min(0).optional(),
    public_max_mint: z.number().int().min(0).optional(),
    gtd_active: z.boolean().optional(),
    fcfs_active: z.boolean().optional(),
    public_active: z.boolean().optional(),
    royalty_bps: z.number().int().min(0).max(10000).optional(),
  })
  .strict();

adminRouter.patch(
  "/config",
  asyncHandler(async (req, res) => {
    const body = patchConfigBody.parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body)) {
      if (val === undefined) continue;
      values.push(val);
      fields.push(`${key} = $${values.length}`);
    }
    if (fields.length === 0) throw new HttpError(400, "no_fields");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const upd = await client.query(
        `UPDATE mint_config SET ${fields.join(", ")} WHERE id = 1 RETURNING *`,
        values
      );

      // Keep fcfs_state.total_spots in sync with mint_config.fcfs_allocation when changed.
      if (body.fcfs_allocation !== undefined) {
        await client.query(
          `UPDATE fcfs_state SET total_spots = $1
            WHERE id = 1 AND $1 >= spots_taken`,
          [body.fcfs_allocation]
        );
      }
      await client.query("COMMIT");
      res.json(upd.rows[0]);
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally {
      client.release();
    }
  })
);

adminRouter.post(
  "/fcfs/reset",
  asyncHandler(async (_req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE users SET fcfs_allocated = FALSE WHERE fcfs_allocated = TRUE`);
      await client.query(`UPDATE fcfs_state SET spots_taken = 0 WHERE id = 1`);
      const cfg = await client.query(`SELECT total_spots FROM fcfs_state WHERE id = 1`);
      await client.query("COMMIT");
      res.json({ reset: true, total: cfg.rows[0]?.total_spots, taken: 0 });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally {
      client.release();
    }
  })
);

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
});

adminRouter.get(
  "/applications",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const params: unknown[] = [];
    let where = "";
    if (q.status) {
      params.push(q.status);
      where = `WHERE a.status = $${params.length}`;
    }
    params.push(q.limit, q.offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await pool.query(
      `SELECT a.id, a.wallet_address, a.handle, a.discord, a.why, a.status,
              a.submitted_at, a.reviewed_at, u.twitter_id
         FROM applications a
         JOIN users u ON u.wallet_address = a.wallet_address
         ${where}
         ORDER BY a.submitted_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    const countQ = await pool.query(
      `SELECT COUNT(*)::int AS c FROM applications a ${where}`,
      q.status ? [q.status] : []
    );
    res.json({ items: rows, total: countQ.rows[0].c, limit: q.limit, offset: q.offset });
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const { rows } = await pool.query(
      `SELECT u.wallet_address, u.twitter_id, u.discord_id, u.application_status,
              u.fcfs_allocated, u.referral_code, u.referrer,
              COALESCE(rc.cnt, 0)::int AS referral_count
         FROM users u
         LEFT JOIN (
           SELECT referrer, COUNT(*) AS cnt FROM users
            WHERE referrer IS NOT NULL
           GROUP BY referrer
         ) rc ON rc.referrer = u.wallet_address
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
      [q.limit, q.offset]
    );
    const countQ = await pool.query(`SELECT COUNT(*)::int AS c FROM users`);
    res.json({ items: rows, total: countQ.rows[0].c, limit: q.limit, offset: q.offset });
  })
);

const patchUserBody = z
  .object({
    application_status: z.enum(["none", "pending", "approved", "rejected"]).optional(),
    fcfs_allocated: z.boolean().optional(),
    referrer: z.string().nullable().optional(),
    twitter_id: z.string().min(1).max(64).nullable().optional(),
    discord_id: z.string().min(1).max(64).nullable().optional(),
  })
  .strict();

adminRouter.patch(
  "/users/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidWallet(req.params.wallet)) {
      throw new HttpError(400, "invalid_wallet");
    }
    const wallet = normalizeWallet(req.params.wallet);
    const body = patchUserBody.parse(req.body);

    if (body.referrer && body.referrer !== null) {
      if (!isValidWallet(body.referrer)) throw new HttpError(400, "invalid_referrer");
      if (normalizeWallet(body.referrer) === wallet) {
        throw new HttpError(400, "self_referral_not_allowed");
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body)) {
      if (val === undefined) continue;
      values.push(key === "referrer" && typeof val === "string" ? normalizeWallet(val) : val);
      fields.push(`${key} = $${values.length}`);
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
