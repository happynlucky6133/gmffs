import pg from "pg";
import type { QueryResultRow } from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

export const sqlPool =
  databaseUrl == null
    ? null
    : new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes("supabase.co")
          ? { rejectUnauthorized: false }
          : undefined,
      });

export async function sqlQuery<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  if (!sqlPool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return sqlPool.query<T>(text, values);
}
