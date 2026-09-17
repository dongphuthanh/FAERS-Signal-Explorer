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

const PATHS_SQL = await readFile(new URL('../sql/regimen/paths.sql', import.meta.url), 'utf8');
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
  const byName = new Map(members.map(m => [m.prod_ai, m.id]));

  // ---- layer 3: Ω for the pairs the graph flagged (default), or every pair (show all) ----
  const flaggedPairs = [];
  for (const p of paths) {
    const names = p.participants.concat(p.victim ? [p.victim] : []);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) flaggedPairs.push([byName.get(names[i]), byName.get(names[j])]);
  }
  const pairArgs = showAll ? [null, null] : [flaggedPairs.map(x => x[0]), flaggedPairs.map(x => x[1])];
  const termFilter = showAll ? null : [...new Set(paths.map(p => EXPECTED_TERMS[p.mechanism]?.source).filter(Boolean))].join('|') || null;
  const { rows: omega } = (showAll || flaggedPairs.length)
    ? await pool.query(OMEGA_SQL, [ids, Math.min(policy.minObserved, 5), ...pairArgs, termFilter]) : { rows: [] };
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

  // ---- layer 3 on its own: never in the default view on four quarters. Co-reporting without a
  // pathway is dominated by shared indication and by duplicate clusters; it is listed under
  // show_all, scored below the floor, for an analyst who wants to look.
  if (showAll) {
    const seenPairs = new Set();
    for (const r of reported) {
      if (r.cluster_like || r.omega025 < policy.minOmega025 || r.observed < policy.minObserved) continue;
      const key = [r.drug_a, r.drug_b].join('|');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
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
  const { rows: [q] } = await pool.query(`select string_agg(distinct source_quarter, ', ' order by source_quarter) as quarters from cases`);
  return {
    boundary: 'This characterizes a combination of drugs, not a patient. No age, weight, organ function, indication or history is used.',
    resolved: members, unresolved, graph_unknown, quarters: q.quarters,
    flags: showAll ? flags : shown,
    suppressed: showAll ? 0 : flags.length - shown.length,
    policy: { max_flags: policy.maxFlags, min_score: policy.minScore, min_omega025: policy.minOmega025, min_observed: policy.minObserved },
    reported_candidates: reported.filter(r => !r.cluster_like).length,
    cluster_like_suppressed: reported.filter(r => r.cluster_like).length,
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
