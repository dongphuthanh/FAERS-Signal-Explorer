import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';

test('2026q2 loads the expected row counts', async () => {
  const { rows } = await pool.query(
    `select count(*)::int as n from raw_demo where source_quarter = $1`, ['2026q2']);
  assert.equal(rows[0].n, 422459);
});

test('semaglutide suspect cases', async () => {
  const { rows } = await pool.query(`
    select count(distinct caseid)::int as n
    from raw_drug
    where prod_ai = $1 and role_cod = any($2) and source_quarter = $3`, ['SEMAGLUTIDE', ['PS', 'SS'], '2026q2']);
  assert.equal(rows[0].n, 16486);
});

after(() => pool.end());