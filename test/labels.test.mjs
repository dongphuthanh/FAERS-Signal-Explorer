import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.mjs';
import { parseSpl, SECTION_KEYS } from '../src/spl/parse.mjs';

const drugsJson = JSON.parse(await readFile('drugs.json', 'utf8'));
const expectedLabels = drugsJson.reduce((n, d) => n + d.labels.length, 0);

test('every label in drugs.json was ingested', async () => {
  const { rows } = await pool.query(`select count(*)::int as n from labels`);
  assert.equal(rows[0].n, expectedLabels);
});

test('every curated drug in drugs.json is marked curated', async () => {
  const { rows } = await pool.query(
    `select count(*)::int as n from drugs where curated and prod_ai = any($1)`,
    [drugsJson.map(d => d.prod_ai)]);
  assert.equal(rows[0].n, drugsJson.length);
});

test('salt-form aliases point at their base ingredient', async () => {
  const { rows } = await pool.query(`
    select base.prod_ai
    from drugs alias join drugs base on base.id = alias.canonical_id
    where alias.prod_ai = 'ROSUVASTATIN CALCIUM'`);
  assert.equal(rows[0]?.prod_ai, 'ROSUVASTATIN');
});

test('every label has exactly one adverse_reactions and one contraindications section', async () => {
  const { rows } = await pool.query(`
    select l.setid
    from labels l
    where (select count(*) from label_documents x where x.label_id = l.id and x.section = 'adverse_reactions') <> 1
       or (select count(*) from label_documents x where x.label_id = l.id and x.section = 'contraindications') <> 1`);
  assert.deepEqual(rows, []);
});

test('every label has a warnings section in either the PLR or the older format', async () => {
  const { rows } = await pool.query(`
    select l.setid from labels l
    where not exists (select 1 from label_documents x where x.label_id = l.id
                      and x.section in ('warnings_precautions', 'warnings'))`);
  assert.deepEqual(rows, []);
});

test('the sections the diff depends on are substantive', async () => {
  // 'unclassified' legitimately holds things like "Rx only", and "None." is a
  // real contraindications section; adverse reactions and warnings never are short
  const { rows } = await pool.query(`
    select l.setid, x.section, length(x.content) as len
    from label_documents x join labels l on l.id = x.label_id
    where (x.section in ('adverse_reactions', 'warnings_precautions', 'warnings') and length(x.content) < 200)
       or (x.section = 'contraindications' and length(x.content) < 20)`);
  assert.deepEqual(rows, []);
});

test('semaglutide has three labels: two injection, one oral', async () => {
  const { rows } = await pool.query(`
    select l.title from labels l join drugs d on d.id = l.drug_id
    where d.prod_ai = 'SEMAGLUTIDE' order by l.title`);
  assert.equal(rows.length, 3);
  assert.equal(rows.filter(r => /INJECTION/.test(r.title)).length, 2);
});

test('parser: section key map covers the PLR core sections', () => {
  for (const code of ['34066-1', '34070-3', '43685-7', '34084-4', '34073-7'])
    assert.ok(SECTION_KEYS[code], `missing ${code}`);
});

test('parser: a minimal SPL document round-trips', () => {
  const xml = `<document xmlns="urn:hl7-org:v3">
    <title>TEST (drugname)</title><setId root="abc"/><versionNumber value="3"/><effectiveTime value="20260101"/>
    <component><structuredBody>
      <component><section><code code="34084-4" displayName="ADVERSE REACTIONS SECTION"/><title>6 ADVERSE REACTIONS</title>
        <text><paragraph>Nausea was &amp; common.</paragraph></text>
        <component><section><title>6.1 Trials</title><text><paragraph>Vomiting.</paragraph></text></section></component>
      </section></component>
      <component><section><code code="51945-4" displayName="PACKAGE LABEL"/><text><paragraph>skip me</paragraph></text></section></component>
    </structuredBody></component>
  </document>`;
  const { meta, sections } = parseSpl(xml);
  assert.equal(meta.setid, 'abc');
  assert.equal(meta.version, 3);
  assert.equal(sections.length, 1);                      // package label skipped
  assert.equal(sections[0].section, 'adverse_reactions');
  assert.match(sections[0].content, /Nausea was & common\./);
  assert.match(sections[0].content, /6\.1 Trials\n+Vomiting\./);  // subsection flattened in, title kept
});

after(() => pool.end());
