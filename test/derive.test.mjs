import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';

test('cases = distinct raw caseids minus the FDA deletion list', async () => {
  // holds for any number of loaded quarters: the version collapse keeps one
  // row per caseid, the deletion filter removes withdrawn ones
  const { rows: [r] } = await pool.query(`
    select (select count(*) from cases)::int as cases,
           ((select count(distinct caseid) from raw_demo)
            - (select count(distinct d.caseid) from raw_demo d join raw_deleted x on x.caseid = d.caseid))::int as expected`);
  assert.equal(r.cases, r.expected);
});

test('the newest quarter survives the version collapse whole', async () => {
  // every 2026q2 version is the newest version of its case, so all of them are kept
  const { rows } = await pool.query(`select count(*)::int as n from cases where source_quarter = $1`, ['2026q2']);
  assert.equal(rows[0].n, 422458);
});

test('semaglutide suspect cases survive the derive', async () => {
  const { rows } = await pool.query(`
    select count(distinct cd.case_id)::int as n
    from case_drugs cd
    join drugs d on d.id = cd.drug_id
    where d.prod_ai = $1 and cd.role_cod = any($2)`, ['SEMAGLUTIDE', ['PS', 'SS']]);
  assert.equal(rows[0].n, 38318);   // 2025q3–2026q2; 16486 on 2026q2 alone
});

test('age_bracket only takes the five allowed values', async () => {
  const { rows } = await pool.query(`
    select count(*)::int as n from cases
    where age_bracket <> all($1)`, [['<18', '18-44', '45-64', '65+', 'unknown']]);
  assert.equal(rows[0].n, 0);
});

after(() => pool.end());
