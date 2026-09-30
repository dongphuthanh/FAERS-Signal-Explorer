import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { analyzeRegimen, resolveRegimen, POLICY } from '../src/regimen.mjs';
import { HANDLERS, TOOLS } from '../src/agent/tools.mjs';

// The textbook case, and the reason compounding is convergence: two inhibitors
// of the enzyme simvastatin depends on are one flag naming both.
test('regimen: clarithromycin + amlodipine on simvastatin is one CYP3A4 flag, compounded', async () => {
  const r = await analyzeRegimen({ drugs: ['simvastatin', 'clarithromycin', 'amlodipine', 'metformin', 'lisinopril'] });
  assert.equal(r.flags.length, 1, `expected one flag, got ${r.flags.map(f => f.mechanism)}`);
  const f = r.flags[0];
  assert.equal(f.mechanism, 'CYP3A4');
  assert.equal(f.victim, 'SIMVASTATIN');
  assert.equal(f.severity, 'major');
  assert.equal(f.compounding, 2);
  assert.deepEqual(f.participants.map(p => p.drug).sort(), ['AMLODIPINE', 'CLARITHROMYCIN']);
  assert.ok(f.score >= 4.5, `score ${f.score}`);
  // the graph has no edges for metformin: reported as unknown, never as safe
  assert.deepEqual(r.graph_unknown, ['METFORMIN HYDROCHLORIDE']);
  // all three labels are loaded, and the victim's and the strong perpetrator's both describe it
  assert.ok(f.labels.some(l => l.drug === 'SIMVASTATIN' && l.status === 'described'));
  assert.ok(f.labels.some(l => l.drug === 'CLARITHROMYCIN' && l.status === 'described'));
  assert.deepEqual(f.no_label_loaded, []);
  // FAERS was checked for every pair, and the answer can say so
  assert.equal(r.faers.pairs_checked, 10);
  assert.match(r.faers.note, /checked for all 10 pair/);
});

test('regimen: four drugs on one effect node are one flag, not six pairs', async () => {
  const r = await analyzeRegimen({ drugs: ['lisinopril', 'spironolactone', 'trimethoprim', 'potassium chloride'] });
  assert.equal(r.flags.length, 1);
  assert.equal(r.flags[0].mechanism, 'hyperkalaemia');
  assert.equal(r.flags[0].compounding, 4);
  assert.equal(r.flags[0].victim, null);
});

test('regimen: the budget holds and the rest is counted, not lost', async () => {
  const r = await analyzeRegimen({ drugs: ['warfarin', 'fluconazole', 'citalopram', 'tramadol', 'ondansetron'] });
  assert.ok(r.flags.length <= POLICY.maxFlags);
  assert.ok(r.flags.every(f => f.score >= POLICY.minScore));
  assert.equal(r.flags[0].mechanism, 'CYP2C9');                    // warfarin's narrow index outranks the rest
  const all = await analyzeRegimen({ drugs: ['warfarin', 'fluconazole', 'citalopram', 'tramadol', 'ondansetron'], showAll: true });
  assert.ok(all.flags.length > r.flags.length);
  assert.equal(all.suppressed, 0);
  // scores never rise in show_all; the default view is a prefix of it
  assert.deepEqual(all.flags.slice(0, r.flags.length).map(f => f.mechanism), r.flags.map(f => f.mechanism));
});

test('regimen: co-reporting without a pathway never reaches the default view', async () => {
  const all = await analyzeRegimen({ drugs: ['simvastatin', 'clarithromycin', 'amlodipine', 'metformin', 'lisinopril'], showAll: true });
  const standalone = all.flags.filter(f => f.layer === 'reported');
  assert.ok(standalone.length > 0, 'show_all lists co-reported pairs');
  assert.ok(standalone.every(f => f.score < POLICY.minScore));
});

test('regimen: a two-hundred-drug duplicate cluster no longer reads as co-reporting', async () => {
  // clarithromycin + cephalexin: 29 "co-reported" terms that were two Canadian patients whose
  // reports list ~100 drugs each (migration 015). Now: nothing without a pathway, and FAERS was checked.
  const r = await analyzeRegimen({ drugs: ['clarithromycin', 'cephalexin'] });
  assert.equal(r.flags.length, 0);
  assert.equal(r.faers.pairs_checked, 1);
  assert.equal(r.faers.pairs_with_co_reporting_but_no_pathway, 0);
  assert.deepEqual(r.graph_unknown, ['CEPHALEXIN']);
});

test('regimen: label cross-check reads each label for the other drug, and says so when neither mentions it', async () => {
  const quiet = await analyzeRegimen({ drugs: ['clarithromycin', 'cephalexin'] });
  assert.deepEqual(quiet.label_cross_check.pairs_neither_label_mentions_the_other, [['CLARITHROMYCIN', 'CEPHALEXIN']]);
  assert.equal(quiet.label_cross_check.mentions_total, 0);

  const loud = await analyzeRegimen({ drugs: ['simvastatin', 'clarithromycin'] });
  const byName = loud.label_cross_check.mentions.find(m => m.label_of === 'CLARITHROMYCIN' && m.names === 'SIMVASTATIN');
  assert.equal(byName.section, 'contraindications');
  assert.equal(byName.by, 'name');
  assert.match(byName.sentence, /contraindicated/);                       // a sentence, not the "4.5 …" heading
  const byClass = loud.label_cross_check.mentions.find(m => m.label_of === 'SIMVASTATIN' && m.names === 'CLARITHROMYCIN');
  assert.equal(byClass.by, 'class');
  assert.match(byClass.matched, /macrolide/i);

  // two statins: a statin label saying "statins" is about itself, not a mention of the other
  const same = await analyzeRegimen({ drugs: ['atorvastatin', 'simvastatin'] });
  assert.ok(same.label_cross_check.mentions.every(m => m.by === 'name'));
});

test('regimen: side effects the labels share, each at its own label threshold, never combined', async () => {
  const r = await analyzeRegimen({ drugs: ['oxycodone', 'alprazolam', 'gabapentin', 'sertraline'] });
  const x = r.shared_label_side_effects;
  const dizziness = x.shared.find(s => s.reaction === 'dizziness');
  assert.deepEqual(dizziness.listed_by.map(d => d.drug).sort(), ['GABAPENTIN', 'OXYCODONE']);
  assert.ok(dizziness.listed_by.every(d => 'label_threshold' in d));
  assert.ok(x.shared.every(s => s.listed_by.length >= 2));
  assert.match(x.what, /not FAERS/);

  // a quiet pair still gets its shared GI effects; a drug with no label is named, not skipped
  const abx = await analyzeRegimen({ drugs: ['clarithromycin', 'cephalexin'] });
  assert.ok(['diarrhea', 'nausea'].every(k => abx.shared_label_side_effects.shared.some(s => s.reaction === k)));
  const noLabel = await analyzeRegimen({ drugs: ['warfarin', 'aspirin'] });
  assert.deepEqual(noLabel.shared_label_side_effects.drugs_without_a_label, ['ASPIRIN']);
});

test('regimen: a combination product is its ingredients; salt forms fold; nothing pairs with itself', async () => {
  const { members } = await resolveRegimen(['Janumet', 'sitagliptin phosphate', 'Ozempic']);
  assert.deepEqual(members.map(m => m.prod_ai).sort(), ['METFORMIN HYDROCHLORIDE', 'SEMAGLUTIDE', 'SITAGLIPTIN']);
  const r = await analyzeRegimen({ drugs: ['simvastatin', 'simvastatin', 'clarithromycin'] });
  assert.ok(r.flags.every(f => new Set(f.participants.map(p => p.drug).concat(f.victim ?? [])).size === f.participants.length + (f.victim ? 1 : 0)));
});

test('regimen tool: the schema is the boundary — names only, nothing about a patient', async () => {
  const tool = TOOLS.find(t => t.name === 'analyze_regimen');
  assert.equal(tool.input_schema.additionalProperties, false);
  assert.deepEqual(Object.keys(tool.input_schema.properties).sort(), ['drugs', 'show_all']);
  await assert.rejects(HANDLERS.analyze_regimen({ drugs: ['warfarin', 'fluconazole'], age: 78 }), /not a patient/);
  await assert.rejects(HANDLERS.analyze_regimen({ drugs: ['warfarin'] }), /at least two/);
  const r = await HANDLERS.analyze_regimen({ drugs: ['warfarin', 'fluconazole', 'notadrug123'] });
  assert.deepEqual(r.unresolved, ['notadrug123']);
  assert.match(r.boundary, /not a patient/);
});

after(() => pool.end());
