// Runs evals/retrieval.jsonl against searchLabel and reports hit rates.
// Ground truth is mechanical: each expected phrase was verified to exist in
// the expected section of that drug's label, so this measures whether
// retrieval can find text that is known to be there.
//
//   npm run eval:retrieval
//
// Two hit definitions at k:
//   section  — some top-k chunk is from the expected section
//   phrase   — some top-k chunk contains the expected phrase (stricter)
// Results are appended to evals/retrieval-results.jsonl so runs can be
// compared before and after any change to chunking, embedding, or the query.
import { readFile, appendFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { pool } from '../src/db.mjs';
import { searchLabel, drugIdFor } from '../src/search.mjs';
import { MODEL } from '../src/embed.mjs';
import { MAX_CHARS } from '../src/chunk.mjs';

const K = 5;
const cases = (await readFile('evals/retrieval.jsonl', 'utf8')).trim().split('\n').map(l => JSON.parse(l));

const results = [];
let sectionHits = 0, phraseHits = 0, rrSum = 0, ms = 0;

for (const c of cases) {
  const drugId = await drugIdFor(c.drug);
  const t0 = Date.now();
  const hits = await searchLabel({ query: c.query, drugId, k: K });
  ms += Date.now() - t0;

  const phraseRank = hits.findIndex(h => h.content.toLowerCase().includes(c.phrase.toLowerCase())) + 1;
  const sectionRank = hits.findIndex(h => h.section === c.section) + 1;
  const sectionHit = sectionRank > 0, phraseHit = phraseRank > 0;
  sectionHits += sectionHit; phraseHits += phraseHit;
  rrSum += phraseRank ? 1 / phraseRank : 0;

  results.push({ id: c.id, sectionHit, sectionRank, phraseHit, phraseRank, topSection: hits[0]?.section ?? null });
  const mark = phraseHit ? '✔' : sectionHit ? '~' : '✖';
  console.log(`  ${mark} ${c.id.padEnd(20)} phrase@${phraseRank || '–'}  section@${sectionRank || '–'}  top: ${hits[0]?.section ?? '(none)'}`);
}

const n = cases.length;
const summary = {
  ran_at: new Date().toISOString(),
  commit: (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return null; } })(),
  model: MODEL, max_chars: MAX_CHARS, k: K, n,
  section_hit_rate: +(sectionHits / n).toFixed(3),
  phrase_hit_rate:  +(phraseHits / n).toFixed(3),
  phrase_mrr:       +(rrSum / n).toFixed(3),
  avg_ms:           Math.round(ms / n),
  misses: results.filter(r => !r.phraseHit).map(r => r.id),
};

console.log(`\n  n=${n}  section@${K} ${(100 * summary.section_hit_rate).toFixed(0)}%  phrase@${K} ${(100 * summary.phrase_hit_rate).toFixed(0)}%  phrase MRR ${summary.phrase_mrr}  avg ${summary.avg_ms} ms`);
if (summary.misses.length) console.log(`  phrase misses: ${summary.misses.join(', ')}`);

await appendFile('evals/retrieval-results.jsonl', JSON.stringify({ ...summary, results }) + '\n');
console.log(`  appended to evals/retrieval-results.jsonl`);
await pool.end();
