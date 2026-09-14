// Applies drugs.json to the drugs table: marks the curated rows, sets their
// class, and points salt-form aliases at their base ingredient via
// canonical_id. Re-runnable; clears the previous curation first.
//
//   npm run drugs:load
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.mjs';

const list = JSON.parse(await readFile('drugs.json', 'utf8'));

const client = await pool.connect();
try {
  await client.query('begin');
  await client.query(`update drugs set curated = false, drug_class = null, canonical_id = null`);

  let curated = 0, aliases = 0;
  const missing = [];

  for (const entry of list) {
    const { rows } = await client.query(
      `update drugs set curated = true, drug_class = $2 where prod_ai = $1 returning id`,
      [entry.prod_ai, entry.class ?? null]);
    if (rows.length === 0) { missing.push(entry.prod_ai); continue; }
    curated++;

    for (const alias of entry.aliases ?? []) {
      const { rowCount } = await client.query(
        `update drugs set canonical_id = $2 where prod_ai = $1`, [alias, rows[0].id]);
      if (rowCount === 0) missing.push(`${alias} (alias of ${entry.prod_ai})`);
      else aliases++;
    }
  }

  await client.query('commit');
  console.log(`  curated ${curated} of ${list.length} · aliases linked ${aliases}`);
  if (missing.length) {
    console.log(`  not found in drugs (no FAERS rows with this prod_ai in the loaded quarters):`);
    for (const m of missing) console.log(`    ${m}`);
  }
} catch (err) {
  await client.query('rollback');
  console.error(`  FAILED, rolled back: ${err.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
