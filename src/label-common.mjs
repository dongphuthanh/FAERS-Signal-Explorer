// Fills labels.common_ar from each label's XML (Highlights) or, failing that,
// its adverse-reactions section. Run by ingest after every load, and on its
// own with `npm run labels:common` — it touches no sections or chunks, so it
// never forces a re-embed.
import { readFile } from 'node:fs/promises';
import { commonStatementFromXml, commonStatementFromSection } from './spl/common-ar.mjs';

export async function refreshCommonStatements(db) {
  const { rows: labels } = await db.query(`
    select l.id, l.source_path, d.content as section6
    from labels l
    left join label_documents d on d.label_id = l.id and d.section = 'adverse_reactions'`);
  let found = 0;
  for (const l of labels) {
    let r = null;
    try { r = commonStatementFromXml(await readFile(l.source_path, 'utf8')); } catch { /* XML moved: fall through */ }
    if (!r && l.section6) r = commonStatementFromSection(l.section6);
    await db.query(`update labels set common_ar = $2, common_ar_source = $3 where id = $1`, [l.id, r?.statement ?? null, r?.source ?? null]);
    if (r) found++;
  }
  return { labels: labels.length, found };
}
