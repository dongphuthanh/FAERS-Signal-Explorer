import pg from 'pg';

// one pool for the whole process. pg manages connections.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });