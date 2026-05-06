import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  process.env.REPLIT_DB_URL ||
  "postgres://postgres:postgres@localhost:5432/meet_saver";

export const pool = new Pool({
  connectionString,
  ssl:
    process.env.PGSSLMODE === "disable" || connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
});

export async function query(text, params) {
  return pool.query(text, params);
}
