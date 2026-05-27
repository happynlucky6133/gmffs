import pg from "pg";
import type { Client as PgClient, QueryResultRow } from "pg";
import { getCloudflareContextSafe } from "@/lib/cloudflare";

const { Client } = pg;

async function getDatabaseUrl() {
  const cloudflare = await getCloudflareContextSafe();
  return cloudflare?.env?.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
}

async function createClient() {
  const databaseUrl = await getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  return new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.")
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

export async function withSqlClient<T>(
  callback: (client: PgClient) => Promise<T>,
) {
  const client = await createClient();
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function withSqlTransaction<T>(
  callback: (client: PgClient) => Promise<T>,
) {
  return withSqlClient(async (client) => {
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function sqlQuery<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return withSqlClient((client) => client.query<T>(text, values));
}
