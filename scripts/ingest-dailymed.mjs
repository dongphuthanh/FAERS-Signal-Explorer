// Parses every label in data/dailymed/manifest.json into labels and
// label_documents. One transaction; a label is replaced wholesale on re-run.
//
//   npm run labels:ingest
import { readFile } from 'node:fs/promises';
import { parseSpl } from '../src/spl/parse.mjs';
import { pool } from '../src/db.mjs';

const manifest = JSON.parse(await readFile('data/dailymed/manifest.json', 'utf8'));

// the sections the flagship diff depends on; reported per label so a
// label that lacks one is visible, not discovered later
const KEY_SECTIONS = ['boxed_warning', 'contraindications', 'warnings_precautions', 'adverse_reactions'];

const client = await pool.connect();
const t0 = Date.now();
try {
  await client.query('begin');

  let nLabels = 0, nDocs = 0;
  const problems = [];

  for (const m of manifest) {
    const { rows: [drug] } = await client.query(`select id from drugs where prod_ai = $1`, [m.prod_ai]);
    if (!drug) { problems.push(`${m.prod_ai}: not in drugs table`); continue; }

    const { meta, sections } = parseSpl(await readFile(m.path, 'utf8'));
    if (meta.setid !== m.setid) problems.push(`${m.prod_ai}: setid in XML (${meta.setid}) differs from manifest (${m.setid})`);

    const { rows: [label] } = await client.query(`
      insert into labels (drug_id, setid, title, version, effective_date, source_path)
      values ($1, $2, $3, $4, to_date($5, 'YYYYMMDD'), $6)
      on conflict (setid) do update
        set drug_id = excluded.drug_id, title = excluded.title, version = excluded.version,
            effective_date = excluded.effective_date, source_path = excluded.source_path,
            ingested_at = now()
      returning id`,
      [drug.id, m.setid, m.title, meta.version, meta.effectiveDate, m.path]);

    await client.query(`delete from label_documents where label_id = $1`, [label.id]);
    for (const s of sections) {
      await client.query(`
        insert into label_documents (label_id, drug_id, position, section, loinc, title, content)
        values ($1, $2, $3, $4, $5, $6, $7)`,
        [label.id, drug.id, s.position, s.section, s.loinc, s.title, s.content]);
    }
    nLabels++; nDocs += sections.length;

    const have = new Set(sections.map(s => s.section));
    const missing = KEY_SECTIONS.filter(k => !have.has(k) && !(k === 'warnings_precautions' && have.has('warnings')));
    const flag = missing.filter(k => k !== 'boxed_warning');   // most drugs have no boxed warning; only flag the others
    console.log(`  ${m.prod_ai.padEnd(28)} v${String(meta.version).padEnd(3)} ${String(sections.length).padStart(3)} sections${flag.length ? '   missing: ' + flag.join(', ') : ''}`);
  }

  await client.query('commit');
  console.log(`\n  ${nLabels} labels · ${nDocs} sections · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (problems.length) {
    console.log(`  problems:`);
    for (const p of problems) console.log(`    ${p}`);
    process.exitCode = 1;
  }
} catch (err) {
  await client.query('rollback');
  console.error(`\n  FAILED, rolled back: ${err.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
