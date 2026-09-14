// Splits one label section's text into chunks small enough to embed.
//
// all-MiniLM-L6-v2 reads at most 256 word-piece tokens and silently drops
// the rest, so the ceiling is ~800 characters of English. Paragraphs are
// packed whole; a paragraph longer than the ceiling is split on sentence
// boundaries, and only a single sentence longer than that is cut mid-way.
// A chunk never spans two sections because this is called per section.

export const MAX_CHARS = 800;

// the sections worth searching. patient-facing and administrative sections
// restate these in plainer words and would only add duplicate hits.
export const EMBED_SECTIONS = new Set([
  'boxed_warning',
  'indications',
  'contraindications',
  'warnings_precautions',
  'warnings',
  'precautions',
  'adverse_reactions',
  'drug_interactions',
  'specific_populations',
  'overdosage',
  'clinical_pharmacology',
  'clinical_studies',
]);

export function chunkText(text, maxChars = MAX_CHARS) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  const flush = () => { if (current) chunks.push(current); current = ''; };

  for (const p of paragraphs) {
    const pieces = p.length <= maxChars ? [p] : splitLong(p, maxChars);
    for (const piece of pieces) {
      if (!current) current = piece;
      else if (current.length + 1 + piece.length <= maxChars) current += '\n' + piece;
      else { flush(); current = piece; }
    }
  }
  flush();
  return chunks;
}

function splitLong(text, maxChars) {
  const sentences = text.split(/(?<=[.!?;])\s+/);
  const out = [];
  let current = '';
  for (const s of sentences) {
    if (s.length > maxChars) {                       // one enormous sentence: hard cut
      if (current) { out.push(current); current = ''; }
      for (let i = 0; i < s.length; i += maxChars) out.push(s.slice(i, i + maxChars));
      continue;
    }
    if (!current) current = s;
    else if (current.length + 1 + s.length <= maxChars) current += ' ' + s;
    else { out.push(current); current = s; }
  }
  if (current) out.push(current);
  return out;
}
