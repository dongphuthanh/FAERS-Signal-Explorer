// Score the regimen analyzer against evals/regimens.jsonl. No model: this
// scores the deterministic layers, which is where ranking lives.
//
//   npm run eval:regimen
//
// Three numbers, always together: precision of the default view (how many
// shown flags the reviewer marked actionable), recall (how many actionable
// items appear in the default view, and anywhere), and flags per regimen.
// A version that reaches recall 1.0 by showing forty flags fails on the
// third number, and the report says so on the same line.
//
// A flag matches an actionable item when the flag's drugs cover the item's
// members. Results are appended to evals/regimen-results.jsonl.
import { readFile, appendFile } from 'node:fs/promises';
import { pool } from '../src/db.mjs';
import { analyzeRegimen, POLICY } from '../src/regimen.mjs';

const lines = (await readFile('evals/regimens.jsonl', 'utf8')).trim().split('\n').map(l => JSON.parse(l));
const drugsOf = f => new Set(f.participants.map(p => p.drug).concat(f.victim ? [f.victim] : []).concat(f.reported.flatMap(r => r.pair)));
const covers = (flag, item) => item.members.every(m => drugsOf(flag).has(m));

let shownTotal = 0, shownHits = 0, actionableTotal = 0, recalledDefault = 0, recalledAll = 0, controlFlags = 0, controls = 0;
const perRegimen = [];
for (const e of lines) {
  const def = await analyzeRegimen({ drugs: e.regimen });
  const all = await analyzeRegimen({ drugs: e.regimen, showAll: true });
  const hits = def.flags.filter(f => e.actionable.some(a => covers(f, a)));
  const recDef = e.actionable.filter(a => def.flags.some(f => covers(f, a)));
  const recAll = e.actionable.filter(a => all.flags.some(f => covers(f, a)));
  shownTotal += def.flags.length; shownHits += hits.length;
  actionableTotal += e.actionable.length; recalledDefault += recDef.length; recalledAll += recAll.length;
  if (e.kind === 'control') { controls++; controlFlags += def.flags.length; }
  perRegimen.push({ id: e.id, kind: e.kind, shown: def.flags.length, hits: hits.length, actionable: e.actionable.length, recalled: recDef.length, unknown: def.graph_unknown });
  const mark = e.actionable.length === recDef.length && hits.length === def.flags.length ? '✔' : '·';
  console.log(`  ${mark} ${e.id} ${e.kind.padEnd(11)} shown ${def.flags.length}  actionable ${e.actionable.length}  recalled ${recDef.length}/${e.actionable.length}` +
              `  ${def.flags.map(f => (f.severity ?? 'Ω') + ':' + f.mechanism).join(', ') || '—'}` +
              (def.graph_unknown.length ? `   (graph unknown: ${def.graph_unknown.join(', ')})` : '') +
              (e.reviewer ? '' : '   [seed judgment, no reviewer]'));
}
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : 'n/a';
const summary = {
  ts: new Date().toISOString(), regimens: lines.length, reviewed: lines.filter(l => l.reviewer).length,
  precision_default: shownHits / Math.max(shownTotal, 1), recall_default: recalledDefault / Math.max(actionableTotal, 1),
  recall_show_all: recalledAll / Math.max(actionableTotal, 1),
  flags_per_regimen: shownTotal / lines.length, max_flags: Math.max(...perRegimen.map(r => r.shown)),
  control_flags: controlFlags, controls, policy: POLICY,
};
console.log(`\n  precision@default ${pct(shownHits, shownTotal)} · recall ${pct(recalledDefault, actionableTotal)} default, ${pct(recalledAll, actionableTotal)} with show_all` +
            ` · flags per regimen ${summary.flags_per_regimen.toFixed(1)} (max ${summary.max_flags}) · flags on ${controls} control regimens: ${controlFlags}`);
if (!summary.reviewed) console.log('  no regimen has a reviewer yet: these are seed judgments from the FDA table, not physician judgments');
await appendFile('evals/regimen-results.jsonl', JSON.stringify({ ...summary, per_regimen: perRegimen }) + '\n');
await pool.end();
