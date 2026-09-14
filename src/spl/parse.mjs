// SPL (Structured Product Labeling) XML -> { meta, sections[] }
//
// A label is document > component > structuredBody > component[] > section.
// Each top-level section carries a LOINC code that says what it is
// (34084-4 = Adverse Reactions, 43685-7 = Warnings and Precautions, ...).
// Subsections (5.1, 5.2, ...) are nested inside their parent and are
// flattened into it, titles included, so a section boundary is exactly one
// top-level section. That is the boundary chunking must respect later.
import { XMLParser } from 'fast-xml-parser';

// LOINC section code -> normalized key. Anything else becomes 'other' with
// the code kept, so nothing is silently dropped.
export const SECTION_KEYS = {
  '34066-1': 'boxed_warning',
  '43683-2': 'recent_major_changes',
  '34067-9': 'indications',
  '34068-7': 'dosage_administration',
  '43678-2': 'dosage_forms',
  '34070-3': 'contraindications',
  '43685-7': 'warnings_precautions',
  '34071-1': 'warnings',               // pre-PLR format
  '42232-9': 'precautions',            // pre-PLR format
  '34084-4': 'adverse_reactions',
  '34073-7': 'drug_interactions',
  '43684-0': 'specific_populations',
  '34088-5': 'overdosage',
  '34089-3': 'description',
  '34090-1': 'clinical_pharmacology',
  '43680-8': 'nonclinical_toxicology',
  '34092-7': 'clinical_studies',
  '34069-5': 'how_supplied',
  '34076-0': 'patient_information',
  '42231-1': 'medguide',
  '59845-8': 'instructions_for_use',
  '42229-5': 'unclassified',
};

// not prose: structured product data and the carton images
const SKIP_CODES = new Set(['48780-1', '51945-4']);

// elements that start/end a line when flattened to text
const BLOCK = new Set(['paragraph', 'title', 'item', 'tr', 'table', 'caption', 'list', 'section']);
const CELL = new Set(['td', 'th']);
// excerpt = the highlights summary repeated inside each section; a duplicate of
// the section's own text, dropped so nothing is indexed twice
const DROP = new Set(['code', 'id', 'effectiveTime', 'renderMultiMedia', 'observationMedia', 'templateId', 'author', 'subject', 'excerpt']);

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  htmlEntities: true,
  trimValues: false,
});

const tagOf = n => Object.keys(n).find(k => k !== ':@');
const attrs = n => n[':@'] ?? {};
const kids  = (n, name) => (n[tagOf(n)] ?? []).filter(c => tagOf(c) === name);
const kid   = (n, name) => kids(n, name)[0];

function flatten(nodes, out) {
  for (const n of nodes) {
    if ('#text' in n) { out.push(String(n['#text'])); continue; }
    const tag = tagOf(n);
    if (!tag || DROP.has(tag)) continue;
    if (BLOCK.has(tag)) out.push('\n');
    flatten(n[tag], out);
    if (CELL.has(tag)) out.push(' | ');
    if (BLOCK.has(tag) || tag === 'br') out.push('\n');
  }
}

export function textOf(node) {
  if (!node) return '';
  const out = [];
  flatten(node[tagOf(node)], out);
  return out.join('')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/•\n+/g, '• ')          // a bullet glyph on its own line joins its item
    .trim();
}

export function parseSpl(xml) {
  const root = parser.parse(xml);
  const doc = root.find(n => tagOf(n) === 'document');
  if (!doc) throw new Error('no <document> root');

  const meta = {
    setid:         attrs(kid(doc, 'setId')).root ?? null,
    version:       Number(attrs(kid(doc, 'versionNumber')).value) || null,
    effectiveDate: attrs(kid(doc, 'effectiveTime')).value ?? null,   // YYYYMMDD
    title:         textOf(kid(doc, 'title')).replace(/\n+/g, ' '),
  };

  const body = kid(kid(doc, 'component'), 'structuredBody');
  if (!body) throw new Error('no structuredBody');

  const sections = [];
  let position = 0;
  for (const comp of kids(body, 'component')) {
    const sec = kid(comp, 'section');
    if (!sec) continue;
    const code = attrs(kid(sec, 'code'));
    if (SKIP_CODES.has(code.code)) continue;
    const content = textOf(sec);
    if (!content) continue;
    sections.push({
      position: position++,
      loinc:    code.code ?? null,
      section:  SECTION_KEYS[code.code] ?? 'other',
      title:    textOf(kid(sec, 'title')).replace(/\n+/g, ' ') || code.displayName || null,
      content,
    });
  }
  return { meta, sections };
}
