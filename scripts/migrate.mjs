import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../src/db.mjs';


await pool.query(`
    create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
    );
    `
);

const { rows } = await pool.query('select name from schema_migrations');
const applied = new Set(rows.map(r => r.name));


const files = (await readdir('migrations')).filter(f => f.endsWith('.sql')).sort();


for (const name of files) {
    if (applied.has(name)) {
        console.log("skip", name);
        continue;
    }

    const sql = await readFile(`migrations/${name}`, "utf8");
    const client = await pool.connect();

    try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [name]);
        await client.query('commit');
        console.log("applied", name);
    } catch (error) {
        await client.query('rollback');
        console.error(error.message);
        process.exitCode = 1;
        break;
    } finally {
        client.release();
    }
    


}

await pool.end();

