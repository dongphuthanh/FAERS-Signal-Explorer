// Try retrieval by hand.
//
//   node --env-file=.env scripts/search.mjs SEMAGLUTIDE "gastric emptying"
//   node --env-file=.env scripts/search.mjs -- "rhabdomyolysis"        (all drugs)
import { pool } from '../src/db.mjs';
import { searchLabel, drugIdFor } from '../src/search.mjs';

const [drug, ...rest] = process.argv.slice(2);
const query = rest.join(' ');
if (!drug || !query) {
  console.error('usage: search.mjs <PROD_AI|--> <query…>');
  process.exit(1);
}

const drugId = drug === '--' ? null : await drugIdFor(drug);
if (drug !== '--' && !drugId) { console.error(`no drug ${drug}`); process.exit(1); }

const t0 = Date.now();
const hits = await searchLabel({ query, drugId, k: 8 });
console.log(`\n  "${query}"${drugId ? ` in ${drug}` : ' across all drugs'} — ${hits.length} hits in ${Date.now() - t0} ms\n`);
for (const h of hits) {
  const ranks = `vec ${h.vec_rank ?? '–'}`.padEnd(8) + `kw ${h.kw_rank ?? '–'}`.padEnd(7);
  console.log(`  ${String(h.score).padEnd(8)} ${ranks} ${h.section.padEnd(22)} ${h.label_title.slice(0, 34)}`);
  console.log(`           ${h.content.replace(/\s+/g, ' ').slice(0, 160)}…\n`);
}
await pool.end();
