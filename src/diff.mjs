// The flagship: for one drug, which disproportionately reported reactions
// does its label describe, and which does it not.
//
// Two independent measurements joined on the term. The signal side ranks
// terms by ROR025 (signal.mjs). The label side, per term, decides one of:
//
//   described   the term's *informative* words all appear together in one
//               chunk of the drug's label. A word is informative if it is
//               rare across the whole label corpus: "gastric", "emptying" and
//               "myopathy" are; "product", "dose" and "increased" are not, so
//               "Product dose confusion" cannot be described by "product" and
//               "dose" alone. (Measured corpus-wide on purpose: within a
//               statin's own label "myopathy" is everywhere, and that is
//               evidence it is described, not that the word is generic.)
//   related     no chunk has the words, but the nearest chunk by embedding
//               is close enough that a reader should look at it.
//   none        no matching label text found.
//
// MedDRA spells British (haemoglobin, ischaemic, diarrhoea); US labels spell
// American. Both spellings of each term are tried.
//
// "none" is a statement about our label text and our retrieval, never about
// pharmacology. It is rendered as "no matching label text", not "absent".
//
// All terms are decided together: one statement for the keyword side of every
// term, one for the vector side of the terms keyword did not settle. Word
// frequencies come from the lexeme_df materialized view and each chunk's
// lexemes column (migration 008), not from per-term queries.
import { pool } from './db.mjs';
import { embed, toVectorLiteral } from './embed.mjs';
import { disproportionality, excludedCount } from './signal.mjs';

export const RELATED_SIM = 0.42;       // cosine; see the report for the calibration
export const COMMON_WORD_FRAC = 0.05;  // a lexeme in >5% of ALL chunks (every drug) is label-ese, not evidence on its own

// haemoglobin -> hemoglobin, ischaemic -> ischemic, oedema -> edema, diarrhoea -> diarrhea.
// 'ae' at the start of a word is left alone (aerosol).
export const americanize = s => s.replace(/\boe/gi, m => m[0] === 'O' ? 'E' : 'e').replace(/(?<=\w)(ae|oe)/gi, 'e');

// the sentence in a chunk that carries the most of the term's words, rare words weighing more
function bestSentence(content, stats) {
  const weighted = stats.map(s => ({ stem: s.lex.slice(0, 5).toLowerCase(), w: -Math.log(s.frac + 0.01) }));
  const sentences = content.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 15);
  let best = sentences[0] ?? content.slice(0, 200), bestScore = -1;
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const score = weighted.reduce((acc, { stem, w }) => acc + (lower.includes(stem) ? w : 0), 0);
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return best.length > 240 ? best.slice(0, 237) + '…' : best;
}

// Keyword side for every term in one statement. terms: [{ term_id, term }].
// Both spellings go over as rows sharing a term_id; the best spelling per
// term wins. Returns Map term_id -> row (described, counts, best chunk, stats).
export async function keywordStatuses(terms, drugId) {
  const ids = [], variants = [], texts = [];
  for (const t of terms) {
    for (const v of new Set([t.term, americanize(t.term)])) {
      ids.push(t.term_id);
      variants.push(v === t.term ? 'uk' : 'us');
      texts.push(v);
    }
  }
  const { rows } = await pool.query(`
    with input(term_id, variant, term) as (
      select * from unnest($1::int[], $2::text[], $3::text[])
    ),
    n as (select count(*)::float as total from chunks),
    lex as (
      select i.term_id, i.variant, l.lex,
             coalesce(d.ndoc, 0) / n.total as frac
      from input i cross join n
      cross join lateral unnest(tsvector_to_array(to_tsvector('english', i.term))) as l(lex)
      left join lexeme_df d on d.lex = l.lex
    ),
    agg as (
      select term_id, variant,
             array_agg(lex)                                            as all_lex,
             coalesce(array_agg(lex) filter (where frac < $5), '{}')   as inf_lex,
             json_agg(json_build_object('lex', lex, 'frac', frac))     as stats
      from lex group by term_id, variant
    ),
    best as (
      select a.term_id, a.variant, a.stats,
             cardinality(a.all_lex) as total, cardinality(a.inf_lex) as total_inf,
             c.id, c.section, c.document_id, c.content, c.section_title, c.label_title,
             coalesce(c.matched, 0) as matched, coalesce(c.matched_inf, 0) as matched_inf
      from agg a
      left join lateral (
        select c.id, c.section, c.document_id, c.content,
               x.title as section_title, l.title as label_title,
               cardinality(array(select unnest(c.lexemes) intersect select unnest(a.all_lex))) as matched,
               cardinality(array(select unnest(c.lexemes) intersect select unnest(a.inf_lex))) as matched_inf
        from chunks c
        join label_documents x on x.id = c.document_id
        join labels l on l.id = x.label_id
        where c.drug_id = $4 and c.lexemes && a.all_lex
        order by 8 desc, 7 desc, c.section = 'adverse_reactions' desc, c.id
        limit 1
      ) c on true
    )
    select *,
      (total_inf > 0 and matched_inf = total_inf
       and (case when total <= 2 then matched = total else matched::float / total >= 2.0 / 3 end)) as described
    from best order by term_id, variant`,
    [ids, variants, texts, drugId, COMMON_WORD_FRAC]);

  const byTerm = new Map();
  for (const r of rows) {
    const cur = byTerm.get(r.term_id);
    if (!cur || r.matched_inf > cur.matched_inf
             || (r.matched_inf === cur.matched_inf && r.matched > cur.matched)) {
      byTerm.set(r.term_id, r);
    }
  }
  return byTerm;
}

// Vector side for the terms keyword did not settle: nearest chunk of this
// drug per term, in one statement. Returns Map term_id -> row with sim.
export async function vectorStatuses(terms, drugId) {
  if (terms.length === 0) return new Map();

  // batchSize 1: MiniLM gives a slightly different vector for a text embedded
  // in a batch than alone, enough to move a similarity by 0.02 either way
  const vectors = await embed(terms.map(t => t.term), { batchSize: 1 });

  // exact scan over one drug's chunks. The HNSW index finds the nearest
  // chunks across every drug and filters after, and can be left with none.
  const { rows } = await pool.query(`
    with q as (
      select i as idx, v
      from unnest($1::vector[]) with ordinality as u(v, i)
    )
    select distinct on (q.idx)
           q.idx, c.id, c.section, c.document_id, c.content,
           x.title as section_title, l.title as label_title,
           round((1 - (c.embedding <=> q.v))::numeric, 3) as sim
    from q cross join chunks c
    join label_documents x on x.id = c.document_id
    join labels l on l.id = x.label_id
    where c.drug_id = $2
    order by q.idx, c.embedding <=> q.v`,
    [vectors.map(toVectorLiteral), drugId]);

  return new Map(rows.map(r => [terms[r.idx - 1].term_id, r]));
}

// The three-state decision for every term. Returns Map term_id -> label object.
export async function labelStatuses(terms, drugId) {
  const kw = await keywordStatuses(terms, drugId);
  const vec = await vectorStatuses(terms.filter(t => !kw.get(t.term_id)?.described), drugId);

  const out = new Map();
  for (const t of terms) {
    const k = kw.get(t.term_id), v = vec.get(t.term_id);
    const coverage = k?.id ? `${k.matched_inf}/${k.total_inf} rare, ${k.matched}/${k.total} all` : 'no words matched';
    if (k?.described) {
      out.set(t.term_id, { status: 'described', coverage, section: k.section, label: k.label_title,
                           chunk_id: k.id, document_id: k.document_id, evidence: bestSentence(k.content, k.stats) });
    } else if (v && Number(v.sim) >= RELATED_SIM) {
      out.set(t.term_id, { status: 'related', similarity: Number(v.sim), coverage, section: v.section, label: v.label_title,
                           chunk_id: v.id, document_id: v.document_id, evidence: bestSentence(v.content, k?.stats ?? []) });
    } else {
      out.set(t.term_id, { status: 'none', similarity: v ? Number(v.sim) : null, coverage });
    }
  }
  return out;
}

// one term, for tests and ad-hoc checks
export async function labelStatus(term, drugId) {
  return (await labelStatuses([{ term_id: 0, term }], drugId)).get(0);
}

export async function diffDrug({ prodAi, top = 25, minCases = 10, includeExcluded = false }) {
  const { rows: [drug] } = await pool.query(
    `select id, prod_ai, drug_class, curated from drugs where prod_ai = $1`, [prodAi]);
  if (!drug) throw new Error(`no drug ${prodAi}`);

  const { rows: labels } = await pool.query(
    `select setid, title, version, effective_date from labels where drug_id = $1 order by title`, [drug.id]);
  if (labels.length === 0) throw new Error(`${prodAi} has no labels loaded — is it in drugs.json?`);

  const signal = await disproportionality({ drugId: drug.id, minCases, limit: top, includeExcluded });
  const excluded = includeExcluded ? 0 : await excludedCount({ drugId: drug.id, minCases });

  const statuses = await labelStatuses(signal.map((s, i) => ({ term_id: i, term: s.reaction_term })), drug.id);
  const rows = signal.map((s, i) => ({ ...s, label: statuses.get(i) }));

  const { rows: [q] } = await pool.query(
    `select string_agg(distinct source_quarter, ', ' order by source_quarter) as quarters from cases`);

  return {
    drug: { id: drug.id, prod_ai: drug.prod_ai, drug_class: drug.drug_class },
    labels, quarters: q.quarters,
    population: signal[0] ? { n: signal[0].n, n_d: signal[0].n_d } : null,
    parameters: { top, min_cases: minCases, comparator: 'all other suspect drugs', roles: ['PS', 'SS'],
                  related_similarity: RELATED_SIM, common_word_frac: COMMON_WORD_FRAC },
    excluded_terms: excluded,
    rows,
  };
}
