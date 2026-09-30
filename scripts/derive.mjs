import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../src/db.mjs';

const dir = 'sql/derive';
const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();

const client = await pool.connect();
const t0 = Date.now();
try {
  await client.query('begin');
  for (const file of files) {
    const sql = await readFile(`${dir}/${file}`, 'utf8');
    const { rowCount } = await client.query(sql);
    console.log(`  ${file.padEnd(24)} ${String(rowCount ?? '').padStart(10)}`);
  }
  await client.query('commit');

  // per-term case totals for the pairwise Ω query (migration 012); stale until refreshed
  await pool.query('refresh materialized view term_cases');
  await pool.query('refresh materialized view case_profiles');        // before the three that read it
  await pool.query('refresh materialized view mention_counts');
  await pool.query('refresh materialized view mention_term_counts');
  await pool.query('refresh materialized view pair_term_cases');

  // the report: what the derive did to the data
  const [{ rows: [v] }, { rows: [x] }, { rows: [u] }] = await Promise.all([
    pool.query(`select (count(*) - count(distinct caseid))::int as n from raw_demo`),
    pool.query(`select count(*)::int as n from raw_demo d join raw_deleted x on x.caseid = d.caseid`),
    pool.query(`select (count(*) filter (where age_bracket = 'unknown'))::int as n,
                        round(100.0 * (count(*) filter (where age_bracket = 'unknown')) / count(*), 1) as pct
                 from cases`),
  ]);
  console.log(`\n  versions collapsed ${v.n} · deleted ${x.n} · age unknown ${u.n} (${u.pct}%)`);
  console.log(`  derived in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (err) {
  await client.query('rollback');
  console.error(`\n  FAILED, rolled back: ${err.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}