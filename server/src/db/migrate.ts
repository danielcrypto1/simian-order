import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../db";

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const total = Number(process.env.FCFS_TOTAL_SPOTS ?? 50);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      `INSERT INTO fcfs_state (id, total_spots, spots_taken)
       VALUES (1, $1, 0)
       ON CONFLICT (id) DO UPDATE SET total_spots = EXCLUDED.total_spots`,
      [total]
    );
    await client.query(
      `INSERT INTO mint_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
    );
    await client.query("COMMIT");
    console.log(`schema applied. fcfs_total_spots=${total}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
