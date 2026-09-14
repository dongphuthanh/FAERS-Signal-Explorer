import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { chunkText, MAX_CHARS, EMBED_SECTIONS } from '../src/chunk.mjs';
import { searchLabel, drugIdFor } from '../src/search.mjs';
import { DIMS } from '../src/embed.mjs';

// ---- chunker (pure) ----

test('chunker: nothing exceeds the ceiling, nothing is lost', () => {
  const para = 'Sentence one is here. Sentence two follows it. Sentence three ends this paragraph.';
  const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}. ${para}`).join('\n\n');
  const chunks = chunkText(text);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.length <= MAX_CHARS, `chunk of ${c.length} chars`);
  const rejoined = chunks.join('\n').replace(/\s+/g, ' ');
  assert.equal(rejoined, text.replace(/\s+/g, ' '));
});

test('chunker: a paragraph longer than the ceiling splits on sentence boundaries', () => {
  const long = Array.from({ length: 40 }, (_, i) => `This is sentence number ${i} of a very long paragraph.`).join(' ');
  const chunks = chunkText(long);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.length <= MAX_CHARS);
    assert.match(c, /\.$/, 'each piece ends at a sentence boundary');
  }
});

test('chunker: short text is one chunk, empty text is none', () => {
  assert.deepEqual(chunkText('Just one short paragraph.'), ['Just one short paragraph.']);
  assert.deepEqual(chunkText(''), []);
});

// ---- the corpus ----

test('every chunk belongs to an embeddable section and matches its document', async () => {
  const { rows } = await pool.query(`
    select count(*)::int as n
    from chunks c join label_documents x on x.id = c.document_id
    where c.section <> x.section or c.drug_id <> x.drug_id or not (c.section = any($1))`,
    [[...EMBED_SECTIONS]]);
  assert.equal(rows[0].n, 0);
});

test('every embeddable section has at least one chunk', async () => {
  const { rows } = await pool.query(`
    select count(*)::int as n from label_documents x
    where x.section = any($1) and not exists (select 1 from chunks c where c.document_id = x.id)`,
    [[...EMBED_SECTIONS]]);
  assert.equal(rows[0].n, 0);
});

test('embeddings are unit vectors of the declared dimension', async () => {
  const { rows } = await pool.query(`
    select vector_dims(embedding) as dims, round((embedding <#> embedding)::numeric, 3) as neg_norm_sq
    from chunks limit 5`);
  for (const r of rows) {
    assert.equal(r.dims, DIMS);
    assert.equal(Number(r.neg_norm_sq), -1);   // <#> is negative inner product; unit vector => -1
  }
});

// ---- retrieval ----

test('keyword and vector both find "gastric emptying" in the semaglutide warnings', async () => {
  const hits = await searchLabel({ query: 'gastric emptying', drugId: await drugIdFor('SEMAGLUTIDE'), k: 5 });
  assert.ok(hits.length > 0);
  assert.equal(hits[0].section, 'warnings_precautions');
  assert.ok(hits[0].vec_rank != null && hits[0].kw_rank != null, 'top hit should appear in both lists');
  assert.match(hits[0].content, /gastric emptying/i);
});

test('a paraphrase with no keyword overlap is still found by the vector path', async () => {
  const hits = await searchLabel({ query: 'stomach empties slowly', drugId: await drugIdFor('SEMAGLUTIDE'), k: 5 });
  assert.ok(hits.some(h => /gastric emptying/i.test(h.content)));
});

test('scoping to a drug returns only that drug\'s chunks', async () => {
  const id = await drugIdFor('ATORVASTATIN');
  const hits = await searchLabel({ query: 'rhabdomyolysis', drugId: id, k: 10 });
  assert.ok(hits.length > 0);
  for (const h of hits) assert.equal(h.drug_id, id);
});

after(() => pool.end());
