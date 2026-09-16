// Chunks every embeddable label section, embeds the chunks, writes them to
// the chunks table. Full rebuild each run (the corpus is small); one
// transaction, so a failure leaves the previous chunks in place.
//
//   npm run labels:embed
import { pool } from '../src/db.mjs';
import { chunkText, EMBED_SECTIONS } from '../src/chunk.mjs';
import { embed, toVectorLiteral, MODEL } from '../src/embed.mjs';

const t0 = Date.now();

const { rows: docs } = await pool.query(`
  select x.id, x.drug_id, x.section, x.title, x.content
  from label_documents x
  where x.section = any($1)
  order by x.id`, [[...EMBED_SECTIONS]]);

// chunk everything first so the embedder gets big batches
const items = [];
for (const d of docs) {
  chunkText(d.content).forEach((content, position) => {
    items.push({ document_id: d.id, drug_id: d.drug_id, section: d.section, position, content,
                 // what the model sees: the section title gives the chunk its context
                 text: `${d.title ?? d.section}\n${content}` });
  });
}
console.log(`  ${docs.length} sections -> ${items.length} chunks, embedding with ${MODEL} on CPU…`);

const vectors = [];
for (let i = 0; i < items.length; i += 256) {
  vectors.push(...await embed(items.slice(i, i + 256).map(x => x.text)));
  process.stdout.write(`\r  ${Math.min(i + 256, items.length)} / ${items.length}`);
}
console.log();

const client = await pool.connect();
try {
  await client.query('begin');
  await client.query('truncate chunks');
  // multi-row insert, 200 chunks per statement
  for (let i = 0; i < items.length; i += 200) {
    const slice = items.slice(i, i + 200);
    const values = [], params = [];
    slice.forEach((x, j) => {
      const b = j * 6;
      values.push(`($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, $${b+6}::vector)`);
      params.push(x.document_id, x.drug_id, x.section, x.position, x.content, toVectorLiteral(vectors[i + j]));
    });
    await client.query(
      `insert into chunks (document_id, drug_id, section, position, content, embedding) values ${values.join(',')}`, params);
  }
  await client.query('commit');

  // the diff reads word frequencies from lexeme_df (migration 008); they describe
  // the previous corpus until refreshed. The lexemes column maintains itself.
  await pool.query('refresh materialized view lexeme_df');
  await pool.query('analyze chunks');

  const { rows: [s] } = await pool.query(`
    select count(*)::int as n, round(avg(length(content)))::int as avg_chars, max(length(content))::int as max_chars,
           count(distinct drug_id)::int as drugs from chunks`);
  console.log(`  ${s.n} chunks · avg ${s.avg_chars} chars · max ${s.max_chars} · ${s.drugs} drugs · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (err) {
  await client.query('rollback');
  console.error(`\n  FAILED, rolled back: ${err.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
