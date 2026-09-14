// The flagship question, from the command line, with no model in the loop.
//
//   npm run diff -- SEMAGLUTIDE
//   npm run diff -- ATORVASTATIN --top 40 --min 5
//   npm run diff -- SEMAGLUTIDE --json > out.json
//   npm run diff -- SEMAGLUTIDE --all          (include excluded terms, marked)
import { pool } from '../src/db.mjs';
import { diffDrug } from '../src/diff.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const prodAi = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
if (!prodAi) { console.error('usage: diff.mjs <PROD_AI> [--top N] [--min N] [--all] [--json]'); process.exit(1); }

const result = await diffDrug({
  prodAi, top: +flag('--top', 25), minCases: +flag('--min', 10), includeExcluded: args.includes('--all'),
}).catch(e => { console.error(`  ${e.message}`); process.exit(1); });

if (args.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const { drug, labels, quarters, population, parameters, excluded_terms, rows } = result;
  const STATUS = { described: 'described', related: 'related', none: 'no matching text' };

  console.log(`\n  ${drug.prod_ai}${drug.drug_class ? ` (${drug.drug_class})` : ''} — FAERS ${quarters}, suspect roles, vs ${parameters.comparator}`);
  console.log(`  ${population.n_d.toLocaleString()} cases name it; population ${population.n.toLocaleString()}. Labels searched:`);
  for (const l of labels) console.log(`    ${l.title.slice(0, 60).padEnd(62)} v${l.version}  ${l.effective_date.toISOString().slice(0, 10)}`);
  console.log();
  console.log(`  ${'reaction term'.padEnd(40)} ${'cases'.padStart(6)} ${'ROR025'.padStart(7)}  ${'label'.padEnd(17)} ${'section'.padEnd(22)} evidence`);
  console.log(`  ${'-'.repeat(40)} ${'-'.repeat(6)} ${'-'.repeat(7)}  ${'-'.repeat(17)} ${'-'.repeat(22)} ${'-'.repeat(40)}`);
  for (const r of rows) {
    const L = r.label;
    const ev = L.evidence ? L.evidence.replace(/\s+/g, ' ') : (L.similarity != null ? `(nearest chunk sim ${L.similarity})` : '');
    console.log(`  ${(r.excluded_reason ? '⊘ ' : '') + r.reaction_term.slice(0, 40).padEnd(40)} ${String(r.a).padStart(6)} ${String(r.ror025).padStart(7)}  ${STATUS[L.status].padEnd(17)} ${(L.section ?? '').padEnd(22)} ${ev.slice(0, 100)}`);
  }
  const counts = rows.reduce((m, r) => (m[r.label.status] = (m[r.label.status] ?? 0) + 1, m), {});
  console.log();
  console.log(`  ${rows.length} terms shown (a ≥ ${parameters.min_cases}) · described ${counts.described ?? 0} · related ${counts.related ?? 0} · no matching text ${counts.none ?? 0}`);
  if (excluded_terms) console.log(`  ${excluded_terms} term(s) with a ≥ ${parameters.min_cases} suppressed by excluded_terms (medication error / device / non-event) — run with --all to see them`);
  console.log(`  ROR is a ratio of reporting proportions against ${parameters.comparator}; it is not a rate, a risk, or evidence of causation.`);
  console.log(`  "no matching text" means no label text was found for the term in the versions listed above, nothing more.\n`);
}
await pool.end();
