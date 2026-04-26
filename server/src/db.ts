import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See server/.env.example.");
}

export const pool = new Pool({ connectionString });

pool.on("error", (err) => {
  console.error("[pg] idle client error", err);
});
