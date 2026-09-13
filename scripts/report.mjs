import { pool } from '../src/db.mjs';


const quarter = process.argv[2];

if (!quarter || (!/^\d{4}q[1-4]$/.test(quarter))) {
    console.log(`please enter a valid quarter`);
    process.exit(1);
}

const tables = ["raw_demo", "raw_drug", "raw_indi", "raw_outc", "raw_reac", "raw_rpsr", "raw_ther", "raw_deleted"];

console.time('report');

const counts = await Promise.all(tables.map(async t => {
  const { rows } = await pool.query(
    `select count(*)::int as n from ${t} where source_quarter = $1`, [quarter]);
  return [t, rows[0].n];
}));
console.timeEnd('report');

for (const [t, n] of counts) {
  console.log(`  ${t.padEnd(12)} ${n.toLocaleString().padStart(12)}`);
}

await pool.end();