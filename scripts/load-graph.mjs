// Load graph_seed.json into graph_nodes / graph_edges, mapping every drug
// name onto our drugs rows through drug_name_aliases with a recorded match
// method. Prints the match rate, because an interaction graph whose drugs
// are not FAERS's drugs would count one thing and warn about another.
//
//   npm run graph:load
//
// Matching, in order: exact prod_ai; the base ingredient of a salt form
// (prefix match on a single-ingredient row, resolved through canonical_id);
// unmatched (kept, drug_id null, so the miss is visible).
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.mjs';

const seed = JSON.parse(await readFile('graph_seed.json', 'utf8'));

async function resolve(rawName) {
  const name = rawName.toUpperCase().trim();
  const exact = await pool.query(`select id, canonical_id from drugs where prod_ai = $1 and not is_combination`, [name]);
  if (exact.rows[0]) return { drugId: exact.rows[0].canonical_id ?? exact.rows[0].id, method: 'exact', confidence: 1 };
  const prefix = await pool.query(`
    select coalesce(canonical_id, id) as id from drugs
    where not is_combination and prod_ai like $1 || ' %'
    order by length(prod_ai) limit 1`, [name]);
  if (prefix.rows[0]) return { drugId: prefix.rows[0].id, method: 'prefix', confidence: 0.9 };
  return { drugId: null, method: 'unmatched', confidence: 0 };
}

const client = await pool.connect();
const stats = { exact: 0, prefix: 0, unmatched: [] };
try {
  await client.query('begin');
  for (const m of seed.mechanisms) {
    await client.query(`insert into graph_nodes (kind, name) values ($1, $2) on conflict (kind, name) do nothing`, [m.kind, m.name]);
  }
  const nodeOf = new Map();           // raw drug name -> graph node id (or null when unmatched)
  const names = [...new Set(seed.edges.flatMap(e => e.drugs))];
  for (const raw of names) {
    const r = await resolve(raw);
    await client.query(`
      insert into drug_name_aliases (drug_id, source, raw_name, match_method, confidence)
      values ($1, 'seed:graph', $2, $3, $4)
      on conflict (source, raw_name) do update set drug_id = excluded.drug_id, match_method = excluded.match_method, confidence = excluded.confidence`,
      [r.drugId, raw, r.method, r.confidence]);
    if (!r.drugId) { stats.unmatched.push(raw); nodeOf.set(raw, null); continue; }
    stats[r.method]++;
    const { rows: [d] } = await client.query(`select prod_ai from drugs where id = $1`, [r.drugId]);
    const { rows: [n] } = await client.query(`
      insert into graph_nodes (kind, name, drug_id) values ('drug', $1, $2)
      on conflict (kind, name) do update set drug_id = excluded.drug_id returning id`, [d.prod_ai, r.drugId]);
    nodeOf.set(raw, n.id);
  }
  let edges = 0;
  for (const e of seed.edges) {
    const { rows: [t] } = await client.query(`select id from graph_nodes where name = $1 and kind <> 'drug'`, [e.target]);
    if (!t) throw new Error(`unknown mechanism ${e.target}`);
    for (const raw of e.drugs) {
      const src = nodeOf.get(raw);
      if (!src) continue;
      await client.query(`
        insert into graph_edges (src, dst, type, strength, evidence, source, description)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (src, dst, type, source) do update set strength = excluded.strength, evidence = excluded.evidence, description = excluded.description`,
        [src, t.id, e.type, e.strength, e.evidence, e.source, e.description ?? null]);
      edges++;
    }
  }
  // documented pairs: drug -> drug edges with a severity of their own
  for (const pr of seed.pairs ?? []) {
    const [a, b] = pr.drugs;
    for (const raw of pr.drugs) if (!nodeOf.has(raw)) {
      const r = await resolve(raw);
      if (!r.drugId) { nodeOf.set(raw, null); continue; }
      const { rows: [d] } = await client.query(`select prod_ai from drugs where id = $1`, [r.drugId]);
      const { rows: [n] } = await client.query(`insert into graph_nodes (kind, name, drug_id) values ('drug', $1, $2) on conflict (kind, name) do update set drug_id = excluded.drug_id returning id`, [d.prod_ai, r.drugId]);
      nodeOf.set(raw, n.id);
    }
    if (!nodeOf.get(a) || !nodeOf.get(b)) continue;
    await client.query(`
      insert into graph_edges (src, dst, type, severity, evidence, source, description) values ($1, $2, 'interacts_with', $3, $4, $5, $6)
      on conflict (src, dst, type, source) do update set severity = excluded.severity, evidence = excluded.evidence, description = excluded.description`,
      [nodeOf.get(a), nodeOf.get(b), pr.severity, pr.evidence, pr.source, pr.description ?? null]);
    edges++;
  }
  // drug nodes left pointing at a salt form by an earlier load (before the base row existed):
  // move their edges to the base ingredient's node and drop them, so one drug is one node
  const { rows: stale } = await client.query(`
    select n.id as old_id, b.id as base_drug, n.name from graph_nodes n
    join drugs d on d.id = n.drug_id join drugs b on b.id = d.canonical_id where n.kind = 'drug'`);
  for (const st of stale) {
    const { rows: [bn] } = await client.query(`
      insert into graph_nodes (kind, name, drug_id) select 'drug', prod_ai, id from drugs where id = $1
      on conflict (kind, name) do update set drug_id = excluded.drug_id returning id`, [st.base_drug]);
    await client.query(`insert into graph_edges (src, dst, type, strength, severity, evidence, source, source_ref, description)
                        select $2, dst, type, strength, severity, evidence, source, source_ref, description from graph_edges where src = $1
                        on conflict do nothing`, [st.old_id, bn.id]);
    await client.query(`insert into graph_edges (src, dst, type, strength, severity, evidence, source, source_ref, description)
                        select src, $2, type, strength, severity, evidence, source, source_ref, description from graph_edges where dst = $1
                        on conflict do nothing`, [st.old_id, bn.id]);
    await client.query(`delete from graph_edges where src = $1 or dst = $1`, [st.old_id]);
    await client.query(`delete from graph_nodes where id = $1`, [st.old_id]);
  }
  if (stale.length) console.log(`  ${stale.length} salt-form node(s) merged into their base: ${stale.map(x => x.name).join(', ')}`);
  await client.query('commit');
  const matched = stats.exact + stats.prefix;
  console.log(`  ${names.length} drug names: ${stats.exact} exact, ${stats.prefix} via salt form, ${stats.unmatched.length} unmatched` +
              ` → match rate ${(100 * matched / names.length).toFixed(1)}%`);
  if (stats.unmatched.length) console.log(`  unmatched: ${stats.unmatched.join(', ')}`);
  console.log(`  ${seed.mechanisms.length} mechanism nodes · ${matched} drug nodes · ${edges} edges`);
} catch (err) {
  await client.query('rollback'); throw err;
} finally { client.release(); await pool.end(); }
