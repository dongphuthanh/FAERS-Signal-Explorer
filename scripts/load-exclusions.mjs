// Applies excluded_terms.json to the excluded_terms table. Upserts, so a
// reason can be edited in the file and re-applied; never deletes, so a term
// removed from the file must be removed from the table deliberately.
//
//   npm run terms:load
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.mjs';

const list = JSON.parse(await readFile('excluded_terms.json', 'utf8'));
let n = 0;
for (const t of list) {
  await pool.query(`
    insert into excluded_terms (term, category, reason)
    values ($1, $2, $3)
    on conflict (term) do update set category = excluded.category, reason = excluded.reason`,
    [t.term, t.category, t.reason]);
  n++;
}
const { rows: [{ present }] } = await pool.query(`
  select count(distinct x.term)::int as present
  from excluded_terms x join case_reactions cr on cr.reaction_term = x.term`);
console.log(`  ${n} exclusions loaded · ${present} of them occur in the loaded reports`);
await pool.end();
