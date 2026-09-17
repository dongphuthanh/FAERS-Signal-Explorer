// A first pass at drug identity for every ingredient, not just the curated
// 43: fold salt and hydrate forms under their base ingredient via
// drugs.canonical_id. "SITAGLIPTIN PHOSPHATE" -> "SITAGLIPTIN".
//
//   npm run drugs:salts
//
// Rule: strip trailing words while each is a known salt/ester/hydrate word
// (up to three), and group only if what remains is itself a non-combination
// prod_ai. So "CALCIUM CARBONATE" is left alone (CARBONATE is not in the
// list) and "ATORVASTATIN CALCIUM TRIHYDRATE" -> "ATORVASTATIN". Groupings
// set by drugs.json aliases are never overridden. Everything done is
// counted and a sample printed, because this is a heuristic standing in
// for the RxNorm mapping until that exists.
import { pool } from '../src/db.mjs';

const SALT_WORDS = new Set(`
  HYDROCHLORIDE DIHYDROCHLORIDE HYDROBROMIDE BROMIDE CHLORIDE IODIDE
  SODIUM DISODIUM POTASSIUM CALCIUM MAGNESIUM ZINC LITHIUM ALUMINUM
  PHOSPHATE DIPHOSPHATE SULFATE SULPHATE BISULFATE BISULPHATE MESYLATE MESILATE BESYLATE BESILATE TOSYLATE TOSILATE
  MALEATE FUMARATE SUCCINATE TARTRATE BITARTRATE CITRATE LACTATE GLUCONATE ACETATE
  NITRATE BENZOATE PAMOATE DECANOATE VALERATE PROPIONATE DIPROPIONATE FUROATE XINAFOATE
  HYCLATE ESTOLATE STEARATE OXALATE MALATE SALICYLATE CAPROATE ENANTHATE CYPIONATE PIVALATE
  MONOHYDRATE DIHYDRATE TRIHYDRATE HEMIHYDRATE SESQUIHYDRATE ANHYDROUS HYDRATE
  TROMETHAMINE MEGLUMINE DIETHANOLAMINE
`.trim().split(/\s+/));

const { rows: drugs } = await pool.query(`select id, prod_ai, canonical_id, curated from drugs where not is_combination`);
const byName = new Map(drugs.map(d => [d.prod_ai, d]));

const plan = [];
const orphans = {};                                    // base name -> salt rows with no base row
for (const d of drugs) {
  if (d.canonical_id) continue;                        // already grouped (drugs.json aliases)
  if (d.curated) continue;                             // curated rows are bases: they carry the labels
  const words = d.prod_ai.split(' ');
  for (let strip = 1; strip <= 3 && words.length - strip >= 1; strip++) {
    const tail = words.slice(-strip);
    if (!tail.every(w => SALT_WORDS.has(w))) break;
    const baseName = words.slice(0, -strip).join(' ');
    if (SALT_WORDS.has(baseName)) break;               // "CALCIUM ACETATE" must not become "CALCIUM"
    const base = byName.get(baseName);
    if (base && base.id !== d.id) { plan.push({ from: d.prod_ai, to: base.canonical_id ? byName.get([...byName.values()].find(x => x.id === base.canonical_id)?.prod_ai)?.prod_ai ?? base.prod_ai : base.prod_ai, id: d.id, baseId: base.canonical_id ?? base.id }); break; }
    // no base row at all (only salt forms were ever reported, e.g. CLOPIDOGREL BISULFATE / BESILATE):
    // remember the family; a base row is created below so every spelling has one home
    if (!base && strip === 1 && !baseName.split(' ').every(w => SALT_WORDS.has(w)) && !SALT_WORDS.has(baseName.split(' ').at(-1))) { (orphans[baseName] ??= []).push(d); break; }
  }
}

const client = await pool.connect();
try {
  await client.query('begin');
  for (const p of plan) await client.query(`update drugs set canonical_id = $2 where id = $1 and canonical_id is null`, [p.id, p.baseId]);
  // salt families with no base: create the base row (it has no reports of its own; the salts carry them)
  let created = 0;
  for (const [baseName, forms] of Object.entries(orphans)) {
    if (forms.length < 2 && !/PHOSPHATE|HYDROCHLORIDE|SULFATE|BISULFATE|SODIUM|CALCIUM|MESYLATE|MALEATE|SUCCINATE|TARTRATE/.test(forms[0].prod_ai)) continue;
    const { rows: [b] } = await client.query(
      `insert into drugs (prod_ai, is_combination) values ($1, false) on conflict (prod_ai) do update set prod_ai = excluded.prod_ai returning id`, [baseName]);
    for (const f of forms) { await client.query(`update drugs set canonical_id = $2 where id = $1 and canonical_id is null`, [f.id, b.id]); plan.push({ from: f.prod_ai, to: baseName, id: f.id, baseId: b.id }); }
    created++;
  }
  await client.query('commit');
  if (created) console.log(`  ${created} base rows created for salt families that had none (e.g. ${Object.keys(orphans).slice(0, 3).join(', ')})`);
} catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }

const { rows: [s] } = await pool.query(`
  select count(*) filter (where canonical_id is not null)::int as grouped,
         count(distinct canonical_id)::int as bases,
         count(*)::int as total
  from drugs where not is_combination`);
console.log(`  ${plan.length} salt/hydrate forms grouped this run · ${s.grouped} of ${s.total} single-ingredient rows now point at ${s.bases} base ingredients`);
console.log(`  sample:`);
for (const p of plan.filter((_, i) => i % Math.ceil(plan.length / 12) === 0).slice(0, 12)) console.log(`    ${p.from.padEnd(44)} → ${p.to}`);
await pool.end();
