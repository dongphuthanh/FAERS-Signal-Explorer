import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';

test('one case per caseid, none deleted', async () => {
  const { rows } = await pool.query(`select count(*)::int as n from cases`);
  assert.equal(rows[0].n, 422458);
});

test('semaglutide suspect cases survive the derive', async () => {
  const { rows } = await pool.query(`
    select count(distinct cd.case_id)::int as n
    from case_drugs cd
    join drugs d on d.id = cd.drug_id
    where d.prod_ai = $1 and cd.role_cod = any($2)`, ['SEMAGLUTIDE', ['PS', 'SS']]);
  assert.equal(rows[0].n, 16486);
});

test('age_bracket only takes the five allowed values', async () => {
  const { rows } = await pool.query(`
    select count(*)::int as n from cases
    where age_bracket <> all($1)`, [['<18', '18-44', '45-64', '65+', 'unknown']]);
  assert.equal(rows[0].n, 0);
});

after(() => pool.end());