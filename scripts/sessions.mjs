// Reads evals/sessions.jsonl back: who asked what, which tools ran, how it
// went. The questions reviewers ask unprompted are the eval set that an
// engineer cannot write; this is where they are collected.
//
//   npm run sessions              everything, newest last
//   npm run sessions -- mum       one reviewer
//   npm run sessions -- --full    include answers
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const full = args.includes('--full');
const who = args.find(a => !a.startsWith('--'));

let rows;
try { rows = (await readFile('evals/sessions.jsonl', 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); }
catch { console.log('  no sessions recorded yet (evals/sessions.jsonl)'); process.exit(0); }
if (who) rows = rows.filter(r => r.who === who);

const byWho = {};
for (const r of rows) (byWho[r.who] ??= []).push(r);
for (const [name, list] of Object.entries(byWho)) {
  console.log(`\n  ${name} — ${list.length} question(s)\n`);
  for (const r of list) {
    const tools = r.tool_calls.map(t => `${t.name}${t.is_error ? '!' : ''}`).join(', ') || '—';
    console.log(`  ${r.ts.slice(0, 16).replace('T', ' ')}  ${r.model.padEnd(16)} ${((r.ms ?? 0) / 1000).toFixed(0).padStart(3)}s  [${tools}]`);
    console.log(`    Q: ${r.question}`);
    if (r.error) console.log(`    ✗ ${r.error}`);
    if (full && r.answer) console.log(`    A: ${r.answer.replace(/\s+/g, ' ').slice(0, 400)}${r.answer.length > 400 ? '…' : ''}`);
  }
}
const cost = rows.reduce((s, r) => s + ((r.usage?.input_tokens ?? 0) * 1 + (r.usage?.output_tokens ?? 0) * 5) / 1e6, 0);
console.log(`\n  ${rows.length} question(s) total · ~$${cost.toFixed(2)} at Haiku rates\n`);
