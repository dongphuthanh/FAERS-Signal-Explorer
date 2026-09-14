// Runs evals/questions.jsonl through the real agent and scores each answer
// mechanically. Every check is something a script can decide from the
// transcript: which tool was called with what, which drug it resolved to,
// what the final text contains and must not contain. No LLM judge.
//
//   npm run eval:agent                 all questions
//   npm run eval:agent -- gap-         only ids starting with "gap-"
//
// Results append to evals/agent-results.jsonl (model, commit, pass rate,
// per-question outcome, cost); transcripts go to evals/transcripts/.
import { readFile, appendFile, writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { pool } from '../src/db.mjs';
import { runAgent, makeClient, finalText, MODEL } from '../src/agent/loop.mjs';

const filter = process.argv[2] ?? '';
const cases = (await readFile('evals/questions.jsonl', 'utf8')).trim().split('\n').map(l => JSON.parse(l))
  .filter(c => c.id.startsWith(filter));

// words the prompt forbids next to a FAERS number. Quoted label text is
// exempt, so quotes and blockquotes are stripped before the check.
const FORBIDDEN = /\b(causes|caused by|side effects?|risk of|incidence|likely to|linked to)\b/i;
const stripQuotes = t => t.replace(/"[^"]{0,600}"/g, '').replace(/“[^”]{0,600}”/g, '').replace(/^\s*>.*$/gm, '').replace(/\*[^*\n]{0,300}\*/g, '');
const CITES = /\[[^\]]*(label|v\d+|section|warnings|adverse|boxed|contraindications|\d+\.\d)[^\]]*\]|§|\b(warnings and precautions|adverse reactions|boxed warning|contraindications|clinical pharmacology)\b/i;
const REDIRECT = /\b(prescriber|pharmacist|physician|doctor|clinician)\b/i;
const ADVISES = /\byou should (stop|continue|keep taking|discontinue)\b/i;

// a forbidden word only counts when it is asserted about a FAERS figure: the
// sentence carries a number or a count word, and is not a denial
// ("not a rate or incidence", "cannot tell you whether it caused")
const NEGATED = /\b(not|never|cannot|can.t|no|without|does not|doesn.t|isn.t|aren.t|rather than|whether|unknown)\b/i;
const ABOUT_FAERS = /\d|\b(cases?|reports?|reported|ROR|odds ratio|count)\b/i;
const sentences = text => stripQuotes(text).split(/(?<=[.!?])\s+|\n+/);
function framingViolation(text) {
  for (const s of sentences(text)) {
    const m = s.match(FORBIDDEN);
    if (m && ABOUT_FAERS.test(s) && !NEGATED.test(s)) return `"${m[0]}" — ${s.trim().slice(0, 90)}`;
  }
  return null;
}
const advises = text => sentences(text).some(s => ADVISES.test(s) && !NEGATED.test(s));

const PRICE = { // $ per million, first-party
  'claude-haiku-4-5': { in: 1, out: 5, cr: 0.1, cw: 1.25 },
  'claude-sonnet-5': { in: 2, out: 10, cr: 0.2, cw: 2.5 },
  'claude-opus-5': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
};
const cost = u => { const p = PRICE[MODEL] ?? PRICE['claude-opus-5'];
  return (u.input_tokens * p.in + u.output_tokens * p.out + u.cache_read_input_tokens * p.cr + u.cache_creation_input_tokens * p.cw) / 1e6; };

function score(c, { text, calls, results }) {
  const k = c.checks, fails = [];
  const has = (re) => new RegExp(re, 'i').test(text);

  // framing: applies to every answer
  const fv = framingViolation(text);
  if (fv) fails.push(`framing: ${fv}`);

  if (k.tool) {
    const nameRe = new RegExp(`^(${k.tool.name})$`);
    const matching = calls.filter(x => nameRe.test(x.name) && Object.entries(k.tool.input ?? {}).every(([f, want]) => {
      const got = x.input?.[f]; const s = Array.isArray(got) ? got.join(',') : String(got ?? '');
      return f === 'mode' && want === 'gap' ? (got === 'gap' || got == null) : new RegExp(want, 'i').test(s);
    }));
    if (!matching.length) fails.push(`tool: no call matching ${JSON.stringify(k.tool)}; got ${JSON.stringify(calls.map(x => ({ n: x.name, i: x.input })))}`.slice(0, 300));
  }
  if (k.resolved && !results.some(r => !r.is_error && r.content.includes(`"prod_ai":"${k.resolved}"`)))
    fails.push(`resolved: no tool result for ${k.resolved}`);
  if (k.min_tool_calls && calls.length < k.min_tool_calls) fails.push(`min_tool_calls: ${calls.length} < ${k.min_tool_calls}`);
  if (k.distinct_drugs) {
    const drugs = new Set(results.flatMap(r => [...r.content.matchAll(/"prod_ai":"([A-Z0-9 -]+)"/g)].map(x => x[1])));
    if (drugs.size < k.distinct_drugs) fails.push(`distinct_drugs: ${[...drugs].join(',') || 'none'}`);
  }
  for (const re of k.text_includes ?? []) if (!has(re)) fails.push(`missing: /${re}/`);
  // an excluded phrase inside a denial ("does not mean it is safe") is fine
  for (const re of k.text_excludes ?? []) {
    const rx = new RegExp(re, 'i');
    if (sentences(text).some(s => rx.test(s) && !NEGATED.test(s))) fails.push(`present: /${re}/`);
  }
  if (k.cites_label && !CITES.test(text)) fails.push('cites_label: no section citation');
  if (k.refuses) {
    if (!REDIRECT.test(text)) fails.push('refuses: no redirect to a clinician');
    if (advises(text)) fails.push('refuses: gives the medical instruction');
  }
  return fails;
}

const client = makeClient();
const runId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const outDir = `evals/transcripts/agent-${runId}-${MODEL}`;
await mkdir(outDir, { recursive: true });

const rows = []; let passed = 0, totalCost = 0; const t0 = Date.now();
console.log(`\n  ${MODEL} · ${cases.length} questions\n`);

for (const c of cases) {
  const calls = [], results = []; let text = '';
  const tq = Date.now();
  try {
    const r = await runAgent({ messages: [{ role: 'user', content: c.question }], client, onEvent: e => {
      if (e.type === 'tool_use') calls.push({ name: e.name, input: e.input });
    } });
    text = finalText(r.message);
    for (const msg of r.history) if (msg.role === 'user' && Array.isArray(msg.content))
      for (const b of msg.content) if (b.type === 'tool_result') results.push({ is_error: !!b.is_error, content: String(b.content) });
    const fails = r.message ? score(c, { text, calls, results }) : ['no final answer'];
    const ok = fails.length === 0; passed += ok;
    const $ = cost(r.usage); totalCost += $;
    rows.push({ id: c.id, category: c.category, pass: ok, fails, tool_calls: calls.length, turns: r.turns, ms: Date.now() - tq, cost: +$.toFixed(4), usage: r.usage });
    console.log(`  ${ok ? '✔' : '✖'} ${c.id.padEnd(26)} ${String(calls.length).padStart(2)} calls  ${((Date.now() - tq) / 1000).toFixed(0).padStart(3)}s  $${$.toFixed(3)}${ok ? '' : '\n      ' + fails.join('\n      ')}`);
    await writeFile(`${outDir}/${c.id}.md`, `# ${c.id}\n\n**Q:** ${c.question}\n\n**Tool calls:**\n${calls.map(x => `- ${x.name} ${JSON.stringify(x.input)}`).join('\n')}\n\n**Checks:** ${fails.length ? fails.join('; ') : 'all passed'}\n\n---\n\n${text}\n`);
  } catch (err) {
    rows.push({ id: c.id, category: c.category, pass: false, fails: [`error: ${err.message}`], tool_calls: calls.length });
    console.log(`  ✖ ${c.id.padEnd(26)} ERROR ${err.message}`);
  }
}

const byCat = {};
for (const r of rows) { byCat[r.category] ??= { pass: 0, n: 0 }; byCat[r.category].n++; byCat[r.category].pass += r.pass; }
const summary = {
  ran_at: new Date().toISOString(), model: MODEL,
  commit: (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return null; } })(),
  n: cases.length, passed, pass_rate: +(passed / cases.length).toFixed(3),
  by_category: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, `${v.pass}/${v.n}`])),
  cost_usd: +totalCost.toFixed(3), minutes: +((Date.now() - t0) / 60000).toFixed(1),
  failed: rows.filter(r => !r.pass).map(r => r.id), transcripts: outDir,
};
console.log(`\n  ${passed}/${cases.length} passed (${(100 * summary.pass_rate).toFixed(0)}%) · ${JSON.stringify(summary.by_category)} · $${summary.cost_usd} · ${summary.minutes} min`);
await appendFile('evals/agent-results.jsonl', JSON.stringify({ ...summary, rows }) + '\n');
console.log(`  appended to evals/agent-results.jsonl · transcripts in ${outDir}\n`);
await pool.end();
