// Phase 4 tests. Everything here runs without an API key: the loop is
// driven by the scripted stub, the tool handlers run against the real
// database.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { runAgent, finalText } from '../src/agent/loop.mjs';
import { makeStub } from '../src/agent/stub.mjs';
import { TOOLS, HANDLERS, runTool } from '../src/agent/tools.mjs';
import { SYSTEM_PROMPT } from '../src/agent/prompt.mjs';
import { resolveDrug } from '../src/drugs.mjs';

// ---- loop ----

test('loop: tool_use -> run tool -> tool_result -> final text, with events in order', async () => {
  const stub = makeStub([
    { tool: 'search_label', input: { query: 'gastric emptying', drug: 'semaglutide', k: 2 } },
    { text: 'The Ozempic label describes delayed gastric emptying.' },
  ]);
  const events = [];
  const { message, history, turns, usage } = await runAgent({
    messages: [{ role: 'user', content: 'what does the label say?' }], client: stub, onEvent: e => events.push(e) });

  assert.equal(turns, 2);
  assert.equal(finalText(message), 'The Ozempic label describes delayed gastric emptying.');
  assert.deepEqual(events.map(e => e.type).filter(t => t !== 'text'), ['tool_use', 'tool_result', 'done']);
  assert.ok(events.filter(e => e.type === 'text').length >= 2, 'text arrived in deltas');

  // the tool_result went back as one user message with the matching id
  const toolMsg = history[2];
  assert.equal(toolMsg.role, 'user');
  assert.equal(toolMsg.content[0].type, 'tool_result');
  assert.equal(toolMsg.content[0].tool_use_id, history[1].content[0].id);
  assert.ok(!toolMsg.content[0].is_error);
  assert.match(toolMsg.content[0].content, /"section":"warnings_precautions"/);
  assert.equal(usage.input_tokens, 200);
});

test('loop: every request carries the frozen system prompt and both tools', async () => {
  const stub = makeStub([{ text: 'hi' }]);
  await runAgent({ messages: [{ role: 'user', content: 'hello' }], client: stub });
  const params = stub.seen[0];
  assert.equal(params.system[0].text, SYSTEM_PROMPT);
  assert.deepEqual(params.system[0].cache_control, { type: 'ephemeral' });
  assert.deepEqual(params.tools.map(t => t.name), ['query_adverse_events', 'search_label']);
});

test('loop: a failing tool is returned as is_error, not thrown, and the model gets another turn', async () => {
  const stub = makeStub([
    { tool: 'query_adverse_events', input: { drug: 'no such drug' } },
    { text: 'I could not find that drug.' },
  ]);
  const events = [];
  const { message, history } = await runAgent({ messages: [{ role: 'user', content: 'x' }], client: stub, onEvent: e => events.push(e) });
  assert.equal(finalText(message), 'I could not find that drug.');
  assert.ok(history[2].content[0].is_error);
  assert.match(history[2].content[0].content, /did not match any drug/);
  assert.ok(events.find(e => e.type === 'tool_result').is_error);
});

test('loop: stops after maxTurns and reports it', async () => {
  const stub = makeStub(Array.from({ length: 5 }, () => ({ tool: 'search_label', input: { query: 'x', k: 1 } })));
  const events = [];
  const r = await runAgent({ messages: [{ role: 'user', content: 'x' }], client: stub, maxTurns: 3, onEvent: e => events.push(e) });
  assert.equal(r.message, null);
  assert.equal(r.turns, 3);
  assert.match(events.at(-1).message, /stopped after 3 turns/);
});

// ---- tool definitions ----

test('tools: schemas are well-formed and the prompt names every tool', () => {
  for (const t of TOOLS) {
    assert.ok(t.name && t.description && t.input_schema?.type === 'object');
    assert.ok(SYSTEM_PROMPT.includes(t.name), `prompt mentions ${t.name}`);
    assert.ok(t.description.length < 1500);
  }
});

test('prompt: carries the framing rules', () => {
  for (const must of ['no denominator', 'never a rate', 'never evidence that the drug causes', 'no matching label text', 'prescriber or pharmacist'])
    assert.ok(SYSTEM_PROMPT.includes(must), `prompt says: ${must}`);
});

// ---- resolver ----

test('resolveDrug: ingredient, brand, salt form, prefix, unknown', async () => {
  assert.equal((await resolveDrug('semaglutide')).prod_ai, 'SEMAGLUTIDE');
  assert.equal((await resolveDrug('Ozempic')).prod_ai, 'SEMAGLUTIDE');
  assert.equal((await resolveDrug('rosuvastatin calcium')).prod_ai, 'ROSUVASTATIN');
  assert.equal((await resolveDrug('Lipitor')).prod_ai, 'ATORVASTATIN');
  assert.equal(await resolveDrug('definitely not a drug'), null);
});

// ---- handlers against the real database ----

test('query_adverse_events gap: semaglutide, trimmed result with statuses and evidence', async () => {
  const r = await HANDLERS.query_adverse_events({ drug: 'Ozempic', top: 6 });
  assert.equal(r.mode, 'gap');
  assert.equal(r.resolved.prod_ai, 'SEMAGLUTIDE');
  assert.equal(r.labels.length, 3);
  assert.equal(r.rows.length, 6);
  for (const row of r.rows) {
    assert.ok(['described', 'related', 'none'].includes(row.label_status));
    assert.ok(Number.isInteger(row.cases) && row.cases >= 10);
    assert.ok(!('chunk_id' in row));
  }
  assert.ok(r.excluded_terms_suppressed > 0);
});

test('query_adverse_events counts: statins, 65+, serious, hepatic — target question 2', async () => {
  const r = await HANDLERS.query_adverse_events({
    mode: 'counts', drug_class: 'statin', age_bracket: '65+', outcomes: ['DE', 'LT', 'HO', 'DS'], term_pattern: 'hepat|liver' });
  assert.ok(r.filtered_cases > 0 && r.filtered_cases < r.exposed_cases);
  assert.ok(r.terms.length > 0);
  for (const t of r.terms) assert.match(t.term, /hepat|liver/i);
  assert.ok(r.terms.every((t, i, a) => i === 0 || a[i - 1].cases >= t.cases), 'sorted by cases desc');
});

test('query_adverse_events gap: refuses a drug with no label, helpfully', async () => {
  const res = await runTool({ id: 't', name: 'query_adverse_events', input: { drug: 'carboplatin' } });
  assert.ok(res.is_error);
  assert.match(res.content, /no prescribing label is loaded/);
  assert.match(res.content, /mode "counts"/);
});

test('search_label: scoped to a brand name, returns passages with provenance', async () => {
  const r = await HANDLERS.search_label({ query: 'muscle symptoms', drug: 'Lipitor', k: 3 });
  assert.equal(r.resolved.prod_ai, 'ATORVASTATIN');
  assert.equal(r.passages.length, 3);
  for (const p of r.passages) {
    assert.ok(p.label && p.section && p.text);
    assert.ok(['vector', 'keyword', 'vector+keyword'].includes(p.found_by));
  }
  assert.match(r.passages[0].text, /myopathy|muscle/i);
});

test('query_adverse_events compare: pancreatitis across named diabetes drugs, salt forms grouped', async () => {
  const r = await HANDLERS.query_adverse_events({ mode: 'compare', term_pattern: 'pancreatitis', drugs: ['Ozempic', 'tirzepatide', 'sitagliptin'] });
  assert.equal(r.mode, 'compare');
  assert.equal(r.resolved.length, 3);
  const by = Object.fromEntries(r.rows.map(x => [x.drug, x]));
  assert.ok(by.SEMAGLUTIDE && by.TIRZEPATIDE, 'both GLP-1s present');
  assert.ok(by.SEMAGLUTIDE.ror025 < by.SEMAGLUTIDE.ror && by.SEMAGLUTIDE.ror < by.SEMAGLUTIDE.ror975, 'interval brackets the estimate');
  // drugs:salts folded SITAGLIPTIN PHOSPHATE under SITAGLIPTIN: one row, no phosphate row, no flag needed
  assert.ok(by.SITAGLIPTIN && !by['SITAGLIPTIN PHOSPHATE'], 'one sitagliptin row');
  assert.ok(!by.SITAGLIPTIN.ungrouped_salt_form);
  assert.ok(by.SITAGLIPTIN.drug_cases > 460, 'the phosphate cases are included');
  assert.ok(r.notes.length >= 3);
});

test('query_adverse_events compare: needs a term pattern', async () => {
  const res = await runTool({ id: 't', name: 'query_adverse_events', input: { mode: 'compare', drugs: ['semaglutide'] } });
  assert.ok(res.is_error);
  assert.match(res.content, /term_pattern/);
});

after(() => pool.end());
