import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { terms, threshold, commonStatementFromSection } from '../src/spl/common-ar.mjs';

const keys = s => terms(s).map(t => t.key);

// ---- the parser, on statements copied from real labels ----

test('common AR: the Highlights form, with its threshold', () => {
  const s = 'Most common adverse reactions (incidence ≥5%) are upper respiratory infection, headache, abdominal pain, constipation, and nausea.';
  assert.deepEqual(keys(s), ['upper respiratory infection', 'headache', 'abdominal pain', 'constipation', 'nausea']);
  assert.equal(threshold(s), 'incidence ≥5%');
});

test('common AR: population headers and section references are not reactions', () => {
  const s = 'Most common adverse reactions are: Plaque Psoriasis and Psoriatic Arthritis (≥ 1%): upper respiratory infections, headache, fatigue, injection site reactions, and tinea infections ( 6.1 ) Crohn\'s Disease (≥3%): anemia';
  assert.deepEqual(keys(s), ['upper respiratory infection', 'headache', 'fatigue', 'injection site reaction', 'tinea infection']);
});

test('common AR: plurals and spellings merge only where unambiguous', () => {
  assert.deepEqual(keys('Most common adverse reactions (≥1%): eye pruritus, oral herpes, gastroenteritis, and diarrhoea.'),
                   ['eye pruritus', 'oral herpes', 'gastroenteritis', 'diarrhea']);
  assert.deepEqual(keys('Most common adverse reactions (≥7%): upper respiratory tract infection, rash, and urinary tract infection'),
                   ['upper respiratory infection', 'rash', 'urinary infection']);
});

test('common AR: the reversed form and synonyms land on one key', () => {
  assert.deepEqual(keys('Bleeding, including life-threatening and fatal bleeding, is the most commonly reported adverse reaction.'), ['bleeding']);
  assert.deepEqual(keys('Most common adverse reactions to warfarin sodium are fatal and nonfatal hemorrhage from any tissue or organ.'), ['bleeding']);
  assert.deepEqual(keys('The most common (>2%) adverse reactions are tiredness, dizziness, and shortness of breath.'), ['fatigue', 'dizziness', 'dyspnea']);
});

test('common AR: one reaction\'s percentage is not a threshold; discontinuation statements are not common-AR statements', () => {
  assert.equal(threshold('The most common adverse events were headache (13%), nausea (7%), and abdominal pain (6%).'), null);
  assert.equal(threshold('Common adverse reactions (events 2% greater than placebo) by use: Hypertension: headache'), 'events 2% greater than placebo');
  assert.equal(commonStatementFromSection('The most common adverse reaction that led to discontinuation was myalgia (0.3% vs 0%).'), null);
});

test('common AR: the reporting boilerplate never becomes a reaction', () => {
  const s = 'Most common adverse reactions (≥7%): rash and cough ( 6.1 ) To report SUSPECTED ADVERSE REACTIONS, contact UCB, Inc. at 1-844-599-2273';
  assert.deepEqual(keys(s), ['rash', 'cough']);
});

// ---- what is stored ----

test('common AR: most labels state one; the stored statements parse to terms', async () => {
  const { rows } = await pool.query(`select common_ar from labels`);
  const withStatement = rows.filter(r => r.common_ar);
  assert.ok(withStatement.length >= 60, `${withStatement.length} of ${rows.length} labels`);
  for (const r of withStatement) assert.ok(terms(r.common_ar).length > 0, r.common_ar.slice(0, 80));
});

after(() => pool.end());
