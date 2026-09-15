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
  PHOSPHATE DIPHOSPHATE SULFATE SULPHATE BISULFATE MESYLATE MESILATE BESYLATE TOSYLATE
  MALEATE FUMARATE SUCCINATE TARTRATE BITARTRATE CITRATE LACTATE GLUCONATE ACETATE
  NITRATE BENZOATE PAMOATE DECANOATE VALERATE PROPIONATE DIPROPIONATE FUROATE XINAFOATE
  HYCLATE ESTOLATE STEARATE OXALATE MALATE SALICYLATE CAPROATE ENANTHATE CYPIONATE PIVALATE
  MONOHYDRATE DIHYDRATE TRIHYDRATE HEMIHYDRATE SESQUIHYDRATE ANHYDROUS HYDRATE
  TROMETHAMINE MEGLUMINE DIETHANOLAMINE
`.trim().split(/\s+/));

const { rows: drugs } = await pool.query(`select id, prod_ai, canonical_id, curated from drugs where not is_combination`);
const byName = new Map(drugs.map(d => [d.prod_ai, d]));

const plan = [];
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
  }
}

const client = await pool.connect();
try {
  await client.query('begin');
  for (const p of plan) await client.query(`update drugs set canonical_id = $2 where id = $1 and canonical_id is null`, [p.id, p.baseId]);
  await client.query('commit');
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
