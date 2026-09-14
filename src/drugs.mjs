// Turn whatever a user typed into a drugs row.
//
//   "semaglutide"  -> prod_ai exact (case-insensitive)
//   "Ozempic"      -> the ingredient reporters most often named that way
//   "rosuvastatin calcium" -> its base ingredient, via canonical_id
//
// Returns { id, prod_ai, drug_class, curated, has_labels, via } or null.
import { pool } from './db.mjs';

export async function resolveDrug(name) {
  const q = name.trim();
  if (!q) return null;

  const base = `
    select d.id, d.prod_ai, d.drug_class, d.curated,
           exists (select 1 from labels l where l.drug_id = d.id) as has_labels`;

  // 1. the ingredient itself
  let { rows } = await pool.query(`${base} from drugs d where upper(d.prod_ai) = upper($1)`, [q]);
  if (rows[0]) return await canonical(rows[0], 'ingredient');

  // 2. a product name as reporters typed it, most common ingredient wins
  ({ rows } = await pool.query(`
    with hits as (
      select drug_id, count(*) as n from case_drugs
      where upper(drugname) = upper($1) and drug_id is not null
      group by drug_id order by n desc limit 1
    )
    ${base} from hits h join drugs d on d.id = h.drug_id`, [q]));
  if (rows[0]) return await canonical(rows[0], 'product name');

  // 3. an ingredient that starts with it (typed "atorva")
  ({ rows } = await pool.query(`${base} from drugs d where upper(d.prod_ai) like upper($1) || '%' and not d.is_combination
    order by d.curated desc, length(d.prod_ai) limit 1`, [q]));
  if (rows[0]) return await canonical(rows[0], 'prefix');

  return null;
}

// salt forms point at their base; answer with the base
async function canonical(row, via) {
  const { rows } = await pool.query(`
    select b.id, b.prod_ai, b.drug_class, b.curated,
           exists (select 1 from labels l where l.drug_id = b.id) as has_labels
    from drugs a join drugs b on b.id = a.canonical_id where a.id = $1`, [row.id]);
  return { ...(rows[0] ?? row), via: rows[0] ? `${via} (salt form of ${rows[0].prod_ai})` : via };
}

export async function listCuratedDrugs() {
  const { rows } = await pool.query(`
    select d.prod_ai, d.drug_class, count(l.id)::int as labels
    from drugs d left join labels l on l.drug_id = d.id
    where d.curated group by d.id order by d.drug_class nulls last, d.prod_ai`);
  return rows;
}
