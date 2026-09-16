import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { labelStatus, americanize, diffDrug } from '../src/diff.mjs';
import { disproportionality } from '../src/signal.mjs';
import { drugIdFor } from '../src/search.mjs';

test('americanize: MedDRA British spellings become label American spellings', () => {
  assert.equal(americanize('Glycosylated haemoglobin decreased'), 'Glycosylated hemoglobin decreased');
  assert.equal(americanize('Optic ischaemic neuropathy'), 'Optic ischemic neuropathy');
  assert.equal(americanize('Diarrhoea'), 'Diarrhea');
  assert.equal(americanize('Oedema peripheral'), 'Edema peripheral');
  assert.equal(americanize('Aerosol'), 'Aerosol');           // word-initial ae is real
  assert.equal(americanize('Nausea'), 'Nausea');
});

test('signal: semaglutide 2x2 for impaired gastric emptying, and the ROR follows from the cells', async () => {
  const rows = await disproportionality({ drugId: await drugIdFor('SEMAGLUTIDE'), minCases: 10, limit: 200 });
  const r = rows.find(x => x.reaction_term === 'Impaired gastric emptying');
  assert.ok(r, 'term present');
  // 2025q3–2026q2. On 2026q2 alone the cells were 1073 / 15413 / 415 / 405494 (methods doc).
  assert.deepEqual([r.a, r.b, r.c, r.d], [3101, 35217, 1588, 1489547]);
  const ror = (r.a * r.d) / (r.b * r.c);
  const se = Math.sqrt(1 / r.a + 1 / r.b + 1 / r.c + 1 / r.d);
  assert.equal(r.ror, +ror.toFixed(2));
  assert.equal(r.ror025, +Math.exp(Math.log(ror) - 1.96 * se).toFixed(2));
  assert.equal(r.ror975, +Math.exp(Math.log(ror) + 1.96 * se).toFixed(2));
});

test('signal: excluded terms are absent unless asked for', async () => {
  const id = await drugIdFor('SEMAGLUTIDE');
  const without = await disproportionality({ drugId: id, minCases: 10, limit: 500 });
  const withAll = await disproportionality({ drugId: id, minCases: 10, limit: 500, includeExcluded: true });
  assert.ok(!without.some(r => r.reaction_term === 'Off label use'));
  const off = withAll.find(r => r.reaction_term === 'Off label use');
  assert.ok(off && off.excluded_reason, 'included and marked when asked for');
});

test('signal: salt-form aliases count toward the base drug', async () => {
  const id = await drugIdFor('ROSUVASTATIN');
  const rows = await disproportionality({ drugId: id, minCases: 1, limit: 1 });
  // 824 ROSUVASTATIN + 493 ROSUVASTATIN CALCIUM cases, minus overlap; well above either alone
  assert.ok(rows[0].n_d > 824, `n_d ${rows[0].n_d} should include the calcium salt`);
});

// ---- the three states, on rows checked by hand ----

test('described: a term whose words the label uses, with the right sentence', async () => {
  const id = await drugIdFor('SEMAGLUTIDE');
  const s = await labelStatus('Impaired gastric emptying', id);
  assert.equal(s.status, 'described');
  assert.match(s.evidence, /gastric emptying/i);
});

test('described: British spelling finds American label text', async () => {
  const s = await labelStatus('Dysaesthesia', await drugIdFor('SEMAGLUTIDE'));
  assert.equal(s.status, 'described');
  assert.match(s.evidence, /dysesthesia/i);
});

test('described: a statin label describes myopathy (word common in that label, rare in the corpus)', async () => {
  const s = await labelStatus('Myopathy', await drugIdFor('ATORVASTATIN'));
  assert.equal(s.status, 'described');
  assert.match(s.evidence, /myopathy/i);
});

test('not described: common words alone are not evidence', async () => {
  // "product", "dose" and "confusion" all occur in the semaglutide labels, never as this concept
  const s = await labelStatus('Product dose confusion', await drugIdFor('SEMAGLUTIDE'));
  assert.notEqual(s.status, 'described');
});

test('none: optic ischaemic neuropathy has no matching text in the semaglutide labels we hold', async () => {
  const s = await labelStatus('Optic ischaemic neuropathy', await drugIdFor('SEMAGLUTIDE'));
  assert.equal(s.status, 'none');
});

test('diffDrug: refuses a drug with no labels, and reports excluded count', async () => {
  await assert.rejects(diffDrug({ prodAi: 'CARBOPLATIN' }), /no labels/);
  const d = await diffDrug({ prodAi: 'SEMAGLUTIDE', top: 5 });
  assert.equal(d.labels.length, 3);
  assert.ok(d.excluded_terms > 0);
  assert.ok(d.rows.every(r => ['described', 'related', 'none'].includes(r.label.status)));
});

test('diffDrug: the label side is two statements, however many terms', async () => {
  // drug, labels, signal, excluded count, keyword, vector, quarters = 7. Was 93 for 30 terms.
  let n = 0;
  const original = pool.query.bind(pool);
  pool.query = (...args) => { n++; return original(...args); };
  try { await diffDrug({ prodAi: 'SEMAGLUTIDE', top: 30 }); } finally { pool.query = original; }
  assert.ok(n <= 8, `${n} queries for 30 terms`);
});

after(() => pool.end());
