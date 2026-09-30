// A label's own statement of its most common adverse reactions, and the
// reaction terms in it. Used by regimen analysis to find side effects that
// several labels in a regimen list in common.
//
// Where the statement comes from, in order:
//   1. Highlights (PLR labels): "Most common adverse reactions (incidence ≥5%)
//      are: nausea, diarrhea, …". The canonical, one-sentence form. The section
//      parser drops Highlights (they duplicate the full text), so this reads the
//      raw XML.
//   2. Section 6, first sentence naming the most common/frequent adverse
//      reactions — older-format labels have no Highlights.
// A label with neither gets no statement; nothing is inferred from tables.
//
// These are clinical-trial incidences, with a denominator — a different kind of
// number from anything in FAERS, and reported separately.

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&ge;': '≥', '&le;': '≤', '&#8805;': '≥', '&#8804;': '≤', '&#8226;': '•', '&nbsp;': ' ' };
const stripTags = x => x.replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;|&#[0-9]+;/g, e => ENTITIES[e] ?? ' ')
  .replace(/\s+/g, ' ').trim();

// abbreviations whose full stop is not the end of a sentence
const protect = x => x.replace(/\b(e\.g|i\.e|etc|vs|approx|incl)\./gi, m => m.replace(/\./g, '․'));
const restore = x => x.replace(/․/g, '.');

// "Most common adverse reactions (≥5%) are", "Common adverse reactions are",
// "Adverse reactions reported in ≥5% of patients … are" — not "less common adverse reactions"
const LEADS = /(?<!less |un)\b(?:(?:most )?(?:common(?:ly)?|frequent(?:ly)?)(?: reported| observed)?|commonly observed) (?:treatment[- ](?:emergent|related) )?adverse (?:reactions?|events?)\b|\badverse reactions reported in (?:≥|>|greater than)/i;
// the reverse form: "Bleeding, including …, is the most commonly reported adverse reaction."
const REVERSED = /^(.+?),?\s+(?:is|are|was|were) the most (?:common(?:ly reported)?|frequent(?:ly reported)?) adverse (?:reactions?|events?)/i;
// statements about something other than overall frequency
const OFF_TOPIC = /discontinu|led to|leading to|resulting in|grade 3|grade 4|serious adverse/i;

function firstStatement(text) {
  const flat = protect(text).replace(/\s*To report SUSPECTED ADVERSE REACTIONS[\s\S]*$/i, '');
  for (const sentence of flat.split(/(?<=\.)\s+/)) {
    if (REVERSED.test(sentence) && !OFF_TOPIC.test(sentence)) return restore(sentence).trim();
    const at = sentence.search(LEADS);
    if (at < 0 || OFF_TOPIC.test(sentence)) continue;
    const s = sentence.slice(at);
    // a statement lists something: a colon, or are/were/include(s)/is followed by words
    if (!/(:|\b(?:are|were|include[sd]?|is|was)\b)\s*\S/.test(s)) continue;
    return restore(s).trim();
  }
  return null;
}

export function commonStatementFromXml(xml) {
  for (const m of xml.matchAll(/<excerpt>([\s\S]*?)<\/excerpt>/g)) {
    const s = firstStatement(stripTags(m[1]));
    if (s && terms(s).length) return { statement: s, source: 'highlights' };
  }
  return null;
}

export function commonStatementFromSection(text) {
  const s = firstStatement(text.replace(/\s+/g, ' '));
  return s && terms(s).length ? { statement: s, source: 'section 6' } : null;
}

// the incidence threshold the label states, e.g. "(incidence ≥5%)" -> "incidence ≥5%".
// A lone "(13%)" is one reaction's figure, not a threshold.
export function threshold(statement) {
  const m = statement.match(/\(([^()]*(?:(?:≥|>|greater than|at least|incidence|rate|frequency)[^()]*%|%[^()]*(?:greater|more|higher) than)[^()]*)\)/i)
         ?? statement.match(/((?:≥|>|greater than or equal to)\s*\d+\s*%)/i);
  return m ? m[1].trim() : null;
}

// fillers and population words that are not reactions
const NOT_A_TERM = /^(?:adults?|pediatric|children|patients?|in|the|and|or|as a single agent|with|combination|placebo|incidence|clinical trials?|other|e\.g|including|similar to adults)$/i;

const BRITISH = [[/diarrhoea/g, 'diarrhea'], [/\boedema/g, 'edema'], [/\boesophag/g, 'esophag'], [/haem/g, 'hem'],
                 [/anaemi/g, 'anemi'], [/dyspnoea/g, 'dyspnea'], [/ischaem/g, 'ischem'], [/paraesthe/g, 'paresthe'],
                 [/leukaemi/g, 'leukemi'], [/\boestr/g, 'estr'], [/foetal/g, 'fetal']];
export const americanize = s => BRITISH.reduce((x, [re, to]) => x.replace(re, to), s);

// plural to singular only where unambiguous: "infections" -> "infection",
// but not "pruritus", "herpes", "diabetes mellitus", "psoriasis", "stress"
const singular = w => (w.length > 4 && w.endsWith('s') && !/(?:us|is|ss|es)$/.test(w) ? w.slice(0, -1) : w);

// A few clinical synonyms, so the same reaction written two ways is shared.
const SYNONYMS = [[/hemorrhage|bleeding$/, 'bleeding'], [/^tiredness$/, 'fatigue'], [/^pyrexia$/, 'fever'],
                  [/^loose stool$/, 'diarrhea'], [/^shortness of breath$/, 'dyspnea'], [/^drowsiness$/, 'somnolence']];

// Reaction terms, as written and normalized. Normalization is deliberately
// light: lowercase, American spelling, drop "tract", singular. It merges
// "upper respiratory tract infections" with "upper respiratory infection" and
// no more; anything subtler is left unmerged rather than merged wrongly.
export function terms(statement) {
  let list;
  const reversed = statement.match(REVERSED);
  if (reversed) list = reversed[1];
  else {
    list = statement.slice(Math.max(0, statement.search(LEADS)));
    const colon = list.indexOf(':');
    const verb = list.search(/\b(?:are|were|include[sd]?|is|was)\b/i);
    list = colon >= 0 && (verb < 0 || colon < verb + 12) ? list.slice(colon + 1)
         : verb >= 0 ? list.slice(verb).replace(/^\S+/, '') : list;
  }
  list = list
    .replace(/\(\s*\d+(?:\.\d+)*\s*(?:,\s*\d+(?:\.\d+)*\s*)*\)[\s\S]*$/, '')   // stop at the first "(6.1)": later groups are other populations
    .replace(/\([^()]*\)/g, ' ')                                              // (≥5%), (18%), (general)
    .replace(/\b\d+(?:\.\d+)?\s*%/g, ' ')
    .replace(/(^|[;•.])[^;•.:]*:/g, '$1')                                     // population headers: "Plaque Psoriasis and Psoriatic Arthritis:"
    .replace(/[•;]/g, ',')
    .replace(/,?\s*except that[\s\S]*$/i, '')
    .replace(/\.\s*$/, '');
  const out = [];
  const add = raw => {
    raw = raw.trim().replace(/^(?:and|or|related to)\s+/i, '').replace(/\s+(?:and|or)$/i, '').trim();
    if (/^including\b/i.test(raw)) return;                   // "Bleeding, including life-threatening bleeding"
    if (!raw || raw.length > 70 || NOT_A_TERM.test(raw) || /\d/.test(raw) || raw.split(' ').length > 10) return;
    let key = americanize(raw.toLowerCase()).replace(/\btract\b/g, '').replace(/\s+/g, ' ').trim().split(' ').map(singular).join(' ');
    key = SYNONYMS.find(([re]) => re.test(key))?.[1] ?? key;
    if (key && !out.some(t => t.key === key)) out.push({ as_written: raw, key });
  };
  for (const item of list.split(/,|\//)) {
    // "abdominal pain and constipation" is two terms; "fatal and nonfatal hemorrhage from any tissue or organ" is one
    const halves = item.trim().split(/\s+(?:and|or)\s+/i);
    if (halves.length === 2 && halves.every(h => h.trim().split(' ').length <= 3)) halves.forEach(add);
    else add(item);
  }
  return out;
}
