// Regimen analysis: characterize a SET of drugs given together. Three layers,
// then one ranking with a small budget, because an interaction checker that
// returns forty alerts is one nobody reads.
//
//   1. pathways   sql/regimen/paths.sql — the interaction graph, walked
//   2. labels     labelStatuses() over each flag's terms, per drug in the set
//   3. reports    sql/regimen/omega.sql — reactions reported for a pair more
//                 than the two drugs' separate reporting predicts (Ω)
//
// This characterizes a combination of drugs, never a patient. The function
// takes names and nothing else; there is no parameter for age, labs or
// indication, and there will not be one.
import { readFile } from 'node:fs/promises';
import { pool } from './db.mjs';
import { resolveDrug } from './drugs.mjs';
import { labelStatuses } from './diff.mjs';
import { terms as arTerms, threshold as arThreshold } from './spl/common-ar.mjs';

const PATHS_SQL = await readFile(new URL('../sql/regimen/paths.sql', import.meta.url), 'utf8');
const CURATED = JSON.parse(await readFile(new URL('../drugs.json', import.meta.url), 'utf8'));
const OMEGA_SQL = await readFile(new URL('../sql/regimen/omega.sql', import.meta.url), 'utf8');

// the policy. Numbers are first guesses; evals/regimens.jsonl is what moves them.
export const POLICY = {
  maxFlags: 5,               // default view
  minScore: 2.0,             // layer 1: at least 'moderate' on its own, or minor + compounding
  minOmega025: 1.0,          // layer 3: lower bound of log2(obs/exp) — four-fold
  minObserved: 10,           // layer 3: de-duplicated cases with both drugs and the term
  clusterRateBoth: 0.20,     // layer 3: a rare term in a fifth of the pair's cases is a templated batch, not a signal
  clusterBaseRate: 0.005,
  corroborationBonus: 1.0,   // a layer-1 pathway whose reaction also shows in layer 3 for the same pair
};

// reactions we expect to see if a pathway matters: mechanism/effect -> term pattern
const EXPECTED_TERMS = {
  'myopathy': /myopathy|rhabdomyolysis|myalgia|creatine|myositis/i,
  'QT prolongation': /QT|torsade|ventricular tachy|sudden cardiac/i,
  'serotonergic activity': /serotonin syndrome|hyperthermia|clonus|agitation/i,
  'bleeding': /haemorrhage|hemorrhage|bleeding|INR|haematoma|epistaxis|melaena/i,
  'hyperkalaemia': /hyperkalaemia|hyperkalemia|potassium/i,
  'CNS depression': /respiratory depression|somnolence|sedation|loss of consciousness|coma/i,
  'CYP3A4': /rhabdomyolysis|myopathy|toxicity|drug level increased|overdose/i,
  'CYP2C9': /INR|haemorrhage|hemorrhage|bleeding|toxicity/i,
  'CYP2C19': /drug ineffective|therapeutic response decreased|thrombosis|drug level/i,
  'CYP2D6': /toxicity|drug ineffective|drug level|bradycardia/i,
  'P-gp': /toxicity|drug level increased|overdose/i,
};

// ---- label cross-check: does one drug's label name the other? ----
// Read only the sections where labels state interactions and restrictions.
const MENTION_SECTIONS = ['boxed_warning', 'contraindications', 'warnings_precautions', 'warnings', 'precautions', 'drug_interactions'];
const SECTION_RANK = Object.fromEntries(MENTION_SECTIONS.map((x, i) => [x, i]));
// How labels usually name another drug's class in an interaction statement.
const CLASS_TERMS = {
  CLARITHROMYCIN: ['macrolide'], AZITHROMYCIN: ['macrolide'], CEPHALEXIN: ['cephalosporin'],
  AMOXICILLIN: ['penicillin'], CIPROFLOXACIN: ['fluoroquinolone', 'quinolone'], DOXYCYCLINE: ['tetracycline'],
  FLUCONAZOLE: ['azole antifungal'], WARFARIN: ['anticoagulant', 'vitamin K antagonist'], APIXABAN: ['anticoagulant'],
  RIVAROXABAN: ['anticoagulant'], CLOPIDOGREL: ['antiplatelet', 'P2Y12'], ASPIRIN: ['antiplatelet', 'NSAID'],
  IBUPROFEN: ['NSAID'], NAPROXEN: ['NSAID'], AMLODIPINE: ['calcium channel blocker'], DILTIAZEM: ['calcium channel blocker'],
  LISINOPRIL: ['ACE inhibitor'], LOSARTAN: ['angiotensin receptor blocker', 'ARB'], METOPROLOL: ['beta-blocker', 'beta blocker'],
  SPIRONOLACTONE: ['potassium-sparing diuretic'], FUROSEMIDE: ['loop diuretic'], DIGOXIN: ['digitalis', 'cardiac glycoside'],
  AMIODARONE: ['antiarrhythmic'], SERTRALINE: ['SSRI', 'selective serotonin reuptake inhibitor'],
  CITALOPRAM: ['SSRI', 'selective serotonin reuptake inhibitor'], FLUOXETINE: ['SSRI', 'selective serotonin reuptake inhibitor'],
  TRAMADOL: ['opioid'], OXYCODONE: ['opioid'], ALPRAZOLAM: ['benzodiazepine'], QUETIAPINE: ['antipsychotic'],
  ONDANSETRON: ['5-HT3'], OMEPRAZOLE: ['proton pump inhibitor', 'PPI'], SITAGLIPTIN: ['DPP-4'],
  'METFORMIN HYDROCHLORIDE': ['biguanide'], 'INSULIN GLARGINE': ['insulin'],
  ATORVASTATIN: ['statin', 'HMG-CoA reductase inhibitor'], SIMVASTATIN: ['statin', 'HMG-CoA reductase inhibitor'],
  ROSUVASTATIN: ['statin', 'HMG-CoA reductase inhibitor'], PRAVASTATIN: ['statin', 'HMG-CoA reductase inhibitor'],
  LOVASTATIN: ['statin', 'HMG-CoA reductase inhibitor'], 'FLUVASTATIN SODIUM': ['statin', 'HMG-CoA reductase inhibitor'],
  PITAVASTATIN: ['statin', 'HMG-CoA reductase inhibitor'], SEMAGLUTIDE: ['GLP-1'], TIRZEPATIDE: ['GLP-1'],
  LIRAGLUTIDE: ['GLP-1'], DULAGLUTIDE: ['GLP-1'], EXENATIDE: ['GLP-1'], TACROLIMUS: ['calcineurin inhibitor'],
  PREDNISONE: ['corticosteroid'], DEXAMETHASONE: ['corticosteroid'],
};
// therapeutic classes labels use for whole groups ("antidiabetic agents", "CNS depressants")
const GROUP_TERMS = [
  [['antidiabetic', 'hypoglycemic agent'], ['METFORMIN HYDROCHLORIDE', 'SITAGLIPTIN', 'INSULIN GLARGINE', 'SEMAGLUTIDE', 'TIRZEPATIDE', 'LIRAGLUTIDE', 'DULAGLUTIDE', 'EXENATIDE']],
  [['antihypertensive'], ['AMLODIPINE', 'DILTIAZEM', 'LISINOPRIL', 'LOSARTAN', 'METOPROLOL', 'SPIRONOLACTONE', 'FUROSEMIDE']],
  [['diuretic'], ['SPIRONOLACTONE', 'FUROSEMIDE']],
  [['antidepressant'], ['SERTRALINE', 'CITALOPRAM', 'FLUOXETINE']],
  [['CNS depressant'], ['TRAMADOL', 'OXYCODONE', 'ALPRAZOLAM', 'GABAPENTIN', 'QUETIAPINE']],
];
for (const [terms, drugs] of GROUP_TERMS) for (const d of drugs) CLASS_TERMS[d] = [...(CLASS_TERMS[d] ?? []), ...terms];
const SALT_WORDS = new Set('HYDROCHLORIDE SODIUM POTASSIUM CALCIUM MAGNESIUM ACETATE PHOSPHATE BISULFATE MESYLATE BESYLATE MALEATE TARTRATE SUCCINATE FUMARATE HYCLATE MONOHYDRATE'.split(' '));
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ingredient name, brand names from drugs.json, and class words
function mentionTerms(prodAi) {
  const words = prodAi.split(' ');
  while (words.length > 1 && SALT_WORDS.has(words.at(-1)) && !SALT_WORDS.has(words[0])) words.pop();
  const generic = words.join(' ').replace(/-[A-Z]{4}$/, '').toLowerCase();
  const names = new Set([generic]);
  for (const l of CURATED.find(e => e.prod_ai === prodAi)?.labels ?? []) {
    const b = l.search.toLowerCase();
    if (!b.includes(generic)) names.add(b);          // a brand, not the generic spelled again
  }
  return { names: [...names], classes: (CLASS_TERMS[prodAi] ?? []).map(c => c.toLowerCase()) };
}

// For every pair, in both directions: does A's label name B (ingredient, brand, or class)
// in the sections where labels state interactions? Quotes the first such sentence.
async function labelCrossCheck(members) {
  const withLabels = members.filter(m => m.has_labels);
  const { rows: docs } = withLabels.length ? await pool.query(
    `select drug_id, section, content from label_documents where drug_id = any($1) and section = any($2)`,
    [withLabels.map(m => m.id), MENTION_SECTIONS]) : { rows: [] };
  const mentions = [], without = [], oneSided = [], unchecked = [];
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    const pair = [members[i], members[j]];
    const found = [];
    let checked = 0;
    for (const [a, b] of [[pair[0], pair[1]], [pair[1], pair[0]]]) {
      if (!a.has_labels) continue;
      checked++;
      const tb = mentionTerms(b.prod_ai), ta = mentionTerms(a.prod_ai);
      const sameClass = tb.classes.some(c => ta.classes.includes(c));   // a statin label saying "statins" is about itself
      const byName = new RegExp(`\\b(${tb.names.map(esc).join('|')})\\b`, 'i');
      const byClass = !sameClass && tb.classes.length ? new RegExp(`\\b(${tb.classes.map(esc).join('|')})s?\\b`, 'i') : null;
      const ordered = docs.filter(x => x.drug_id === a.id).sort((x, y) => SECTION_RANK[x.section] - SECTION_RANK[y.section]);
      let hit = null;
      for (const d of ordered) {
        const parts = d.content.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean);
        const matches = [];
        parts.forEach((sentence, k) => {
          const m = sentence.match(byName) ?? (byClass ? sentence.match(byClass) : null);
          if (m) matches.push({ k, m, sentence });
        });
        if (!matches.length) continue;
        // a match inside a real sentence beats a heading or a table cell ("Simvastatin")
        // "4.5 Lomitapide, Lovastatin, and Simvastatin" is a heading: quote the sentence under it
        const heading = x => x.sentence.length < 40 || (/^\d+(\.\d+)*\s/.test(x.sentence) && x.sentence.length < 90);
        const pick = matches.find(x => !heading(x)) ?? matches[0];
        let text = pick.sentence;
        if (heading(pick) && parts[pick.k + 1]) text = `${text}: ${parts[pick.k + 1]}`;
        hit = { label_of: a.prod_ai, names: b.prod_ai, matched: pick.m[0], by: byName.test(pick.sentence) ? 'name' : 'class',
                section: d.section, sentence: text.length > 300 ? text.slice(0, 297) + '…' : text };
        break;
      }
      if (hit) found.push(hit);
    }
    const names = pair.map(m => m.prod_ai);
    if (!checked) unchecked.push(names);
    else if (found.length) mentions.push(...found);
    else (checked === 2 ? without : oneSided).push(names);
  }
  // names before classes, then by section (boxed warning, contraindications, … drug interactions)
  mentions.sort((x, y) => (x.by === 'name' ? 0 : 1) - (y.by === 'name' ? 0 : 1) || SECTION_RANK[x.section] - SECTION_RANK[y.section]);
  return {
    sections_read: MENTION_SECTIONS,
    mentions: mentions.slice(0, 12), mentions_total: mentions.length,
    pairs_neither_label_mentions_the_other: without,
    pairs_checked_one_way_only: oneSided,          // only one of the two has a label loaded
    pairs_not_checked: unchecked,                  // neither has a label loaded
  };
}

// ---- shared side effects: reactions two or more labels list among their most common ----
// From each label's own one-sentence statement (labels.common_ar, migration 016).
// These are clinical-trial incidences, each at that label's own threshold: they are
// quoted side by side, never combined, and never mixed with FAERS numbers.
async function sharedSideEffects(members) {
  const { rows } = await pool.query(
    `select drug_id, common_ar, common_ar_source from labels where drug_id = any($1) order by drug_id, id`,
    [members.map(m => m.id)]);
  const byDrug = new Map();                                  // drug -> { statement, terms by key }
  for (const r of rows) {
    const m = members.find(x => x.id === r.drug_id);
    const entry = byDrug.get(m.prod_ai) ?? { statement: null, threshold: null, source: null, terms: new Map() };
    if (r.common_ar) {
      entry.statement ??= r.common_ar; entry.threshold ??= arThreshold(r.common_ar); entry.source ??= r.common_ar_source;
      for (const t of arTerms(r.common_ar)) if (!entry.terms.has(t.key)) entry.terms.set(t.key, t.as_written);
    }
    byDrug.set(m.prod_ai, entry);
  }
  const index = new Map();                                   // reaction -> drugs listing it
  for (const [drug, e] of byDrug) for (const [key, asWritten] of e.terms) {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ drug, as_written: asWritten, label_threshold: e.threshold });
  }
  const shared = [...index].filter(([, ds]) => ds.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([reaction, drugs]) => ({ reaction, listed_by: drugs }));
  return {
    what: 'Reactions that two or more labels in this set list among their own most common adverse reactions. Each is that label\'s clinical-trial statement at its own threshold — not FAERS, and not an incidence for the combination.',
    shared: shared.slice(0, 10), shared_total: shared.length,
    statements: [...byDrug].filter(([, e]) => e.statement)
      .map(([drug, e]) => ({ drug, from: e.source, statement: e.statement.length > 260 ? e.statement.slice(0, 257) + '…' : e.statement })),
    labels_without_a_statement: [...byDrug].filter(([, e]) => !e.statement).map(([d]) => d),
    drugs_without_a_label: members.filter(m => !byDrug.has(m.prod_ai)).map(m => m.prod_ai),
  };
}

export async function resolveRegimen(names) {
  const members = [], unresolved = [];
  for (const raw of names) {
    const d = await resolveDrug(raw);
    if (!d) { unresolved.push(raw); continue; }
    // a combination product is its ingredients; each gets its own seat
    const { rows: parts } = await pool.query(`
      select coalesce(b.id, p.id) as id, coalesce(b.prod_ai, p.prod_ai) as prod_ai
      from drugs c
      cross join lateral unnest(string_to_array(c.prod_ai, '\\')) as ing(name)
      join drugs p on p.prod_ai = ing.name and not p.is_combination
      left join drugs b on b.id = p.canonical_id
      where c.id = $1 and c.is_combination`, [d.id]);
    const seats = parts.length ? parts : [{ id: d.id, prod_ai: d.prod_ai }];
    for (const s of seats) if (!members.some(m => m.id === s.id)) members.push({ input: raw, id: s.id, prod_ai: s.prod_ai, via: d.via, has_labels: d.has_labels, from_combination: parts.length > 0 });
  }
  return { members, unresolved };
}

export async function analyzeRegimen({ drugs, showAll = false, policy = POLICY }) {
  if (!Array.isArray(drugs) || drugs.length < 2) throw new Error('a regimen is at least two drug names');
  if (drugs.length > 12) throw new Error('at most 12 drugs');
  const { members, unresolved } = await resolveRegimen(drugs);
  if (members.length < 2) throw new Error(`fewer than two drugs resolved (unresolved: ${unresolved.join(', ') || 'none'})`);
  const ids = members.map(m => m.id);

  // graph coverage: a drug with no edges is unknown to the graph, not safe
  const { rows: known } = await pool.query(`
    select distinct n.drug_id from graph_nodes n join graph_edges e on e.src = n.id or e.dst = n.id where n.drug_id = any($1)`, [ids]);
  const knownIds = new Set(known.map(r => r.drug_id));
  const graph_unknown = members.filter(m => !knownIds.has(m.id)).map(m => m.prod_ai);

  // ---- layer 1: the graph walk ----
  const { rows: paths } = await pool.query(PATHS_SQL, [ids]);

  // ---- layer 3: Ω for every pair in the set, every term. Always run, so an answer can never
  // imply FAERS was checked when it was not (it used to run only for pairs the graph flagged).
  const { rows: omega } = await pool.query(OMEGA_SQL, [ids, Math.min(policy.minObserved, 5), null, null, null]);
  const pairsChecked = ids.length * (ids.length - 1) / 2;
  const reported = omega.map(r => ({
    ...r, observed: +r.observed, observed_raw: +r.observed_raw, cases_with_both: +r.cases_with_both, expected: +r.expected,
    omega: +r.omega, omega025: +r.omega025, rate_both: +r.rate_both, base_rate: +r.base_rate,
    cluster_like: +r.rate_both >= policy.clusterRateBoth && +r.base_rate < policy.clusterBaseRate,
  }));

  // ---- flags from layer 1, corroborated by layer 3 where the expected reaction shows for the same pair ----
  const flags = paths.map(p => {
    const pattern = EXPECTED_TERMS[p.mechanism];
    const pair = new Set(p.participants.concat(p.victim ? [p.victim] : []));
    const corroborating = pattern ? reported.filter(r => !r.cluster_like && pair.has(r.drug_a) && pair.has(r.drug_b)
                                                      && pattern.test(r.reaction_term) && r.omega025 > 0) : [];
    return {
      layer: 'pathway', kind: p.action, severity: p.severity, mechanism: p.mechanism, mechanism_kind: p.mechanism_kind,
      victim: p.victim, participants: p.participant_detail, compounding: p.compounding, sources: p.sources,
      score: +p.score + (corroborating.length ? policy.corroborationBonus : 0),
      reported: corroborating.slice(0, 3).map(r => ({ pair: [r.drug_a, r.drug_b], term: r.reaction_term, observed: r.observed, expected: r.expected, omega025: r.omega025 })),
      why: describePath(p),
    };
  });

  // ---- layer 3 on its own: never a flag in the default view. Co-reporting without a pathway is
  // dominated by shared indication and by duplicate report clusters (checked on everyday
  // regimens: statin + metformin gives "Cerebral hypoperfusion", "Binocular eye movement
  // disorder" — one known cluster). The default view reports how many there were; show_all
  // lists them, scored below the floor, for an analyst who wants to look.
  const withoutPathway = [];
  { const seenPairs = new Set();
    for (const r of reported) {
      if (r.cluster_like || r.omega025 < policy.minOmega025 || r.observed < policy.minObserved) continue;
      const key = [r.drug_a, r.drug_b].join('|');
      if (seenPairs.has(key) || flags.some(f => f.reported.some(x => x.pair.join('|') === key))) continue;
      seenPairs.add(key);
      withoutPathway.push(r);
    }
  }
  if (showAll) {
    for (const r of withoutPathway) {
      flags.push({
        layer: 'reported', kind: 'co-reported', severity: null, mechanism: null, victim: null,
        participants: [{ drug: r.drug_a }, { drug: r.drug_b }], compounding: 2, sources: ['FAERS'],
        score: Math.min(r.omega025 / 4, policy.minScore - 0.1),
        reported: [{ pair: [r.drug_a, r.drug_b], term: r.reaction_term, observed: r.observed, expected: r.expected, omega025: r.omega025 }],
        why: `${r.reaction_term} is reported for cases mentioning both ${r.drug_a} and ${r.drug_b} more than either drug's own reporting predicts (${r.observed} de-duplicated cases, ${r.expected} expected). Co-reporting, not causation; no pathway in the graph, and the two drugs may share an indication.`,
      });
    }
  }

  flags.sort((a, b) => b.score - a.score);

  // ---- layer 2: what the labels in the set say about each flag ----
  const withLabels = members.filter(m => m.has_labels);
  for (const f of flags) {
    const terms = [f.mechanism, ...(f.reported.map(r => r.term))].filter(Boolean)
      .concat(f.layer === 'pathway' ? f.participants.map(p => p.drug.toLowerCase()) : []);
    f.labels = [];
    for (const m of withLabels) {
      if (f.layer === 'pathway' && !f.participants.some(p => p.drug === m.prod_ai) && f.victim !== m.prod_ai) continue;
      if (f.layer === 'reported' && !f.reported[0].pair.includes(m.prod_ai)) continue;
      const st = await labelStatuses(terms.map((t, i) => ({ term_id: i, term: t })), m.id);
      const best = [...st.values()].sort((a, b) => rank(a) - rank(b))[0];
      f.labels.push({ drug: m.prod_ai, status: best?.status ?? 'none', section: best?.section ?? null, evidence: best?.evidence ?? null });
    }
    const involved = f.layer === 'pathway' ? f.participants.map(p => p.drug).concat(f.victim ? [f.victim] : []) : f.reported[0].pair;
    f.no_label_loaded = involved.filter(d => !withLabels.some(m => m.prod_ai === d));
  }

  const shown = flags.filter(f => f.score >= policy.minScore).slice(0, policy.maxFlags);
  const label_cross_check = await labelCrossCheck(members);
  const shared_label_side_effects = await sharedSideEffects(members);
  const { rows: [q] } = await pool.query(`select string_agg(distinct source_quarter, ', ' order by source_quarter) as quarters from cases`);
  return {
    boundary: 'This characterizes a combination of drugs, not a patient. No age, weight, organ function, indication or history is used.',
    resolved: members, unresolved, graph_unknown, quarters: q.quarters,
    flags: showAll ? flags : shown,
    suppressed: showAll ? 0 : flags.length - shown.length,
    policy: { max_flags: policy.maxFlags, min_score: policy.minScore, min_omega025: policy.minOmega025, min_observed: policy.minObserved },
    label_cross_check,
    shared_label_side_effects,
    faers: {
      pairs_checked: pairsChecked,
      pairs_with_co_reporting_but_no_pathway: withoutPathway.length,
      population: 'reports listing 30 drugs or fewer, duplicates collapsed by demographics, event date and reaction list',
      note: pairsChecked
        ? `FAERS was checked for all ${pairsChecked} pair(s). ` + (withoutPathway.length
            ? `${withoutPathway.length} pair(s) have a reaction reported together more than expected but no pathway in the graph; these are usually shared indication or duplicate reports, and are listed only under show_all.`
            : 'No pair without a pathway had a reaction reported together above threshold.')
        : 'Fewer than two drugs resolved; FAERS was not checked.',
    },
  };
}

const rank = s => ({ described: 0, related: 1, none: 2 })[s.status] ?? 3;

function describePath(p) {
  if (p.action === 'interacts_with') {
    const pair = p.participant_detail.map(x => x.drug).concat(p.victim ? [p.victim] : []);
    return `${pair.join(' + ')}: a documented interaction (${p.sources.join(', ')}).${p.description ? ' ' + p.description : ''}`;
  }
  const who = p.participant_detail.map(x => `${x.drug} (${x.strength ?? 'documented'})`).join(', ');
  if (p.action === 'inhibits') return `${who} inhibit${p.compounding > 1 ? '' : 's'} ${p.mechanism}; ${p.victim} depends on it for clearance (${p.victim_strength} substrate). Exposure to ${p.victim} may rise.`;
  if (p.action === 'induces') return `${who} induce${p.compounding > 1 ? '' : 's'} ${p.mechanism}; ${p.victim} is a ${p.victim_strength} substrate. Exposure to ${p.victim} may fall.`;
  return `${p.compounding} drugs in the set contribute to ${p.mechanism}: ${who}.`;
}
