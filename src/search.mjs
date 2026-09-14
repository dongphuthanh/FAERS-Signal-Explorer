// Hybrid retrieval over label chunks: vector similarity and keyword match,
// fused with Reciprocal Rank Fusion in one statement.
//
// Pure vector search misses exact tokens (a MedDRA term, a drug name); pure
// keyword search misses paraphrase. Each list is ranked on its own, a chunk
// scores 1/(k + rank) per list it appears in, and the sums are sorted. A
// chunk found by only one method still scores — that's the full outer join.
import { pool } from './db.mjs';
import { embed, toVectorLiteral } from './embed.mjs';

export const RRF_K = 60;

export async function searchLabel({ query, drugId = null, k = 10, perList = 50 }) {
  const [qvec] = await embed([query]);
  const { rows } = await pool.query(`
    with vec as (
      select id, row_number() over (order by embedding <=> $1::vector) as rank,
             embedding <=> $1::vector as dist
      from chunks
      where $3::int is null or drug_id = $3
      order by embedding <=> $1::vector
      limit $4
    ),
    kw_scored as (
      select id, ts_rank_cd(tsv, plainto_tsquery('english', $2)) as score
      from chunks
      where ($3::int is null or drug_id = $3)
        and tsv @@ plainto_tsquery('english', $2)
    ),
    kw as (
      select id, row_number() over (order by score desc) as rank
      from kw_scored
      limit $4
    ),
    fused as (
      select coalesce(vec.id, kw.id) as id,
             vec.rank as vec_rank,
             vec.dist as vec_dist,
             kw.rank  as kw_rank,
             coalesce(1.0 / ($5 + vec.rank), 0) + coalesce(1.0 / ($5 + kw.rank), 0) as score
      from vec full outer join kw on kw.id = vec.id
    )
    select c.id, c.document_id, c.drug_id, c.section, c.position, c.content,
           x.title as section_title, l.title as label_title, l.setid, l.version as label_version, l.effective_date,
           f.vec_rank, f.kw_rank, round(f.score::numeric, 5) as score,
           round((1 - f.vec_dist)::numeric, 3) as vec_sim
    from fused f
    join chunks c on c.id = f.id
    join label_documents x on x.id = c.document_id
    join labels l on l.id = x.label_id
    order by f.score desc, c.id
    limit $6`,
    [toVectorLiteral(qvec), query, drugId, perList, RRF_K, k]);
  return rows;
}

export async function drugIdFor(prodAi) {
  const { rows } = await pool.query(`select id from drugs where prod_ai = $1`, [prodAi]);
  return rows[0]?.id ?? null;
}
