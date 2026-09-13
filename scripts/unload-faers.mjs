import { pool } from '../src/db.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const quarter = args.find(a => !a.startsWith('--'));
if (!/^\d{4}q[1-4]$/.test(quarter ?? '')) {
  console.error('usage: unload-faers.mjs <yyyyqN> [--dry-run]');
  process.exit(1);
}

const tables = ['raw_demo', 'raw_drug', 'raw_reac', 'raw_outc',
                'raw_indi', 'raw_ther', 'raw_rpsr', 'raw_deleted'];

const client = await pool.connect();
try {
  await client.query('begin');
  for (const t of tables) {
    const { rowCount } = await client.query(
      `delete from ${t} where source_quarter = $1`, [quarter]);
    console.log(`  ${t.padEnd(12)} ${String(rowCount).padStart(10)} deleted`);
  }
  if (dryRun) {
    await client.query('rollback');
    console.log('\n  dry run: rolled back, nothing changed');
  } else {
    await client.query('commit');
    console.log(`\n  unloaded ${quarter}`);
  }
} catch (err) {
  await client.query('rollback');
  console.error(`\n  FAILED, rolled back: ${err.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}