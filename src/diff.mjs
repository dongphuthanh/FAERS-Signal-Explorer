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
import { pool } from './db.mjs';
import { searchLabel } from './search.mjs';
import { disproportionality, excludedCount } from './signal.mjs';

export const RELATED_SIM = 0.42;       // cosine; see the report for the calibration
export const COMMON_WORD_FRAC = 0.05;  // a lexeme in >5% of ALL chunks (every drug) is label-ese, not evidence on its own

// haemoglobin -> hemoglobin, ischaemic -> ischemic, oedema -> edema, diarrhoea -> diarrhea.
// 'ae' at the start of a word is left alone (aerosol).
export const americanize = s => s.replace(/\boe/gi, m => m[0] === 'O' ? 'E' : 'e').replace(/(?<=\w)(ae|oe)/gi, 'e');

// per-lexeme document frequency across ALL chunks, every drug
async function lexemeStats(term) {
  const { rows } = await pool.query(`
    with q as (select unnest(tsvector_to_array(to_tsvector('english', $1))) as lex),
         n as (select greatest(count(*), 1)::float as total from chunks)
    select q.lex,
           (select count(*) from chunks c where tsvector_to_array(c.tsv) @> array[q.lex]) / n.total as frac
    from q, n`, [term]);
  return rows.map(r => ({ lex: r.lex, frac: Number(r.frac), informative: Number(r.frac) < COMMON_WORD_FRAC }));
}

// the chunks of this drug that carry the most of the term's informative words
async function keywordCoverage(term, drugId, stats, k = 3) {
  const all = stats.map(s => s.lex);
  const inf = stats.filter(s => s.informative).map(s => s.lex);
  if (all.length === 0) return [];
  const { rows } = await pool.query(`
    select c.id, c.section, c.document_id, c.content, x.title as section_title, l.title as label_title,
           cardinality(array(select unnest(tsvector_to_array(c.tsv)) intersect select unnest($2::text[]))) as matched,
           cardinality(array(select unnest(tsvector_to_array(c.tsv)) intersect select unnest($3::text[]))) as matched_inf
    from chunks c
    join label_documents x on x.id = c.document_id
    join labels l on l.id = x.label_id
    where c.drug_id = $1 and tsvector_to_array(c.tsv) && $2::text[]
    order by matched_inf desc, matched desc, c.section = 'adverse_reactions' desc, c.id
    limit $4`,
    [drugId, all, inf, k]);
  return rows.map(r => ({ ...r, total: all.length, total_inf: inf.length }));
}

function isDescribed(hit) {
  if (!hit || hit.total_inf === 0) return false;              // nothing rare to match on
  if (hit.matched_inf < hit.total_inf) return false;           // every informative word must be there
  return hit.total <= 2 ? hit.matched === hit.total : hit.matched / hit.total >= 2 / 3;
}

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

export async function labelStatus(term, drugId) {
  // keyword side, both spellings, best wins
  const variants = [...new Set([term, americanize(term)])];
  let best = null, bestStats = null;
  for (const v of variants) {
    const stats = await lexemeStats(v);
    const [hit] = await keywordCoverage(v, drugId, stats, 1);
    if (hit && (!best || hit.matched_inf > best.matched_inf || (hit.matched_inf === best.matched_inf && hit.matched > best.matched))) {
      best = hit; bestStats = stats;
    }
  }
  const coverage = best ? `${best.matched_inf}/${best.total_inf} rare, ${best.matched}/${best.total} all` : 'no words matched';

  if (isDescribed(best)) {
    return { status: 'described', coverage, section: best.section, label: best.label_title,
             chunk_id: best.id, document_id: best.document_id, evidence: bestSentence(best.content, bestStats) };
  }

  // vector side
  const vec = await searchLabel({ query: term, drugId, k: 3 });
  const nearest = vec.filter(h => h.vec_sim != null).sort((a, b) => b.vec_sim - a.vec_sim)[0];
  if (nearest && Number(nearest.vec_sim) >= RELATED_SIM) {
    return { status: 'related', similarity: Number(nearest.vec_sim), coverage, section: nearest.section, label: nearest.label_title,
             chunk_id: nearest.id, document_id: nearest.document_id,
             evidence: bestSentence(nearest.content, bestStats ?? []) };
  }
  return { status: 'none', similarity: nearest ? Number(nearest.vec_sim) : null, coverage };
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

  const rows = [];
  for (const s of signal) rows.push({ ...s, label: await labelStatus(s.reaction_term, drug.id) });

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
