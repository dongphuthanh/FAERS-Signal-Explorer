import { pool } from '../src/db.mjs';

const caseid = process.argv[2];
if (!/^\d+$/.test(caseid ?? '')) {
  console.error('usage: case.mjs <caseid>');
  process.exit(1);
}

const demo = await pool.query(`
  select * from raw_demo
  where caseid = $1
  order by caseversion::int desc
  limit 1`, [caseid]);

if (demo.rowCount === 0) {
  console.log(`no case ${caseid} in the loaded quarters`);
  await pool.end();
  process.exit(0);
}

const d = demo.rows[0];
console.log(`case ${d.caseid} v${d.caseversion}  ${d.age ?? '?'} ${d.age_cod ?? ''} ${d.sex ?? '?'}  ${d.occr_country ?? '?'}  event ${d.event_dt ?? '-'}  fda ${d.fda_dt}`);

const [drugs, reacs, outcs] = await Promise.all([
  pool.query(`select drug_seq, role_cod, drugname, prod_ai
              from raw_drug where primaryid = $1 order by drug_seq::int`, [d.primaryid]),
  pool.query(`select pt from raw_reac where primaryid = $1`, [d.primaryid]),
  pool.query(`select outc_cod from raw_outc where primaryid = $1`, [d.primaryid]),
]);

console.log('\ndrugs');
console.table(drugs.rows);
console.log('reactions');
for (const r of reacs.rows) console.log(`  ${r.pt}`);
console.log('outcomes');
console.log(outcs.rowCount
  ? `  ${outcs.rows.map(o => o.outc_cod).join(', ')}`
  : '  (none recorded)');

await pool.end();