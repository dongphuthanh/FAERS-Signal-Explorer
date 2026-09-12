import { open } from 'node:fs/promises';
import { pool } from '../src/db.mjs';

const quarter = process.argv[2];

const isValid = /^\d{4}q[1-4]$/.test(quarter);
console.log(isValid);
if (!isValid) {
    process.exit(1);
}

const tag = quarter.slice(2,6).toUpperCase();

const hostDir = `data/faers/${quarter}`;
const dbDir = `/data/faers/${quarter}`;

let allFile = ["DEMO", "DRUG", "INDI", "OUTC", "REAC", "RPSR", "THER", "DELETED"]
let fileList = [];

for (const name of allFile) {
    if (name === "DELETED") {
        fileList.push(['raw_deleted', `Deleted/DELETE${tag}.txt`]);
        continue;
    }
    const lName = name.toLowerCase();
    fileList.push([`raw_${lName}`,`ASCII/${name}${tag}.txt`]);
}

async function headerColumns(path) {
    const CHUNK_SIZE = 8192;

    let fileHandle;
  
    try {
        fileHandle = await open(path, 'r');
        const buffer = Buffer.alloc(CHUNK_SIZE);
        const { bytesRead } = await fileHandle.read(buffer, 0, CHUNK_SIZE, 0);
        const validData = buffer.subarray(0, bytesRead);
        const bufString = validData.toString('ascii', 0, bytesRead);
        const firstLine = bufString.split(/\r?\n/, 1)[0];
        const cols = firstLine.split('$').map(c => c.trim()).filter(Boolean);
        for (const c of cols) {
        if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error(`bad column name in ${path}: ${JSON.stringify(c)}`);
        }
        return cols;
    } finally {
        if (fileHandle) {
        await fileHandle.close();
        }
    }
}

const client = await pool.connect();

try {
    await client.query(`begin`);
    await client.query(`select set_config('faers.quarter', $1, true)`, [quarter]);
    for (const [table, rel] of fileList) {
        let cols;
        if (table === 'raw_deleted') {
                cols = ['caseid'];
            } else {cols = await headerColumns(`${hostDir}/${rel}`);}
        
        await client.query(`delete from ${table} where source_quarter = $1`, [quarter])
        const { rowCount } = await client.query(`
                copy ${table} (${cols.join(", ")})
                from '${dbDir}/${rel}'
                with (format csv, delimiter '$', quote E'\b', null '', header)
            `);
        console.log(`  ${table.padEnd(12)} ${String(rowCount).padStart(10)} rows`);
    }
    await client.query(`commit`);
} catch (error) {
    await client.query('rollback');
    console.error(error.message);
    process.exitCode = 1;
} finally {
    client.release();
}

await pool.end();
