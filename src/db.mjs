import pg from 'pg';
import { readFileSync } from 'node:fs';

// Locally: DATABASE_URL from .env. On AWS: DB_SECRET is the RDS secret's JSON
// (username, password, host, port, dbname), injected from Secrets Manager, and
// the connection is TLS, verified against the RDS CA bundle baked into the image.
function config() {
  if (!process.env.DB_SECRET) return { connectionString: process.env.DATABASE_URL };
  const s = JSON.parse(process.env.DB_SECRET);
  return {
    host: s.host, port: Number(s.port), user: s.username, password: s.password, database: s.dbname,
    ssl: { ca: readFileSync(process.env.PGSSLROOTCERT || 'rds-ca.pem', 'utf8') },
  };
}

// one pool for the whole process. pg manages connections.
export const pool = new pg.Pool(config());
