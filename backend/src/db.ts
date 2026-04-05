import { Pool, PoolClient } from 'pg';

const dbUser = process.env.DB_USER;
const dbHost = process.env.DB_HOST;
const dbName = process.env.DB_NAME;
const dbPassword = process.env.DB_PASSWORD;
const dbPort = process.env.DB_PORT;

if (!dbUser || !dbHost || !dbName || !dbPassword || !dbPort) {
  throw new Error('Database environment variables are not fully set');
}

export const pool = new Pool({
  user: dbUser,
  host: dbHost,
  database: dbName,
  password: dbPassword,
  port: Number(dbPort),
});

export async function withDbClient<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}
