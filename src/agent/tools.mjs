// The two tools the model can call. Each has a JSON-schema definition the
// API sees and a handler that runs here. The model chooses arguments; every
// argument becomes a SQL parameter or a search query. It never writes SQL
// and never computes a statistic — it receives numbers already computed.
import { resolveDrug, listCuratedDrugs } from '../drugs.mjs';
import { diffDrug } from '../diff.mjs';
import { reportCounts, compareDrugs } from '../signal.mjs';
import { searchLabel } from '../search.mjs';
import { pool } from '../db.mjs';

const AGE_BRACKETS = ['<18', '18-44', '45-64', '65+', 'unknown'];
const OUTCOMES = ['DE', 'LT', 'HO', 'DS', 'CA', 'RI', 'OT'];

export const TOOLS = [
  {
    name: 'query_adverse_events',
    description:
      'Aggregate FAERS reports. Two modes. ' +
      '"gap" (default): for one drug, the top disproportionately reported reaction terms, each with its 2x2 cells, ' +
      'reporting odds ratio (ROR) with 95% interval, and whether the drug\'s prescribing label describes it ' +
      '(described / related / none), with the label sentence as evidence. This is the "what is reported that the label ' +
      'does not describe" question. ' +
      '"counts": case counts per reaction term for a drug or a drug class, optionally filtered by age bracket, ' +
      'serious-outcome codes, and a regex on the term. Use for "how many", "in patients over 65", "serious", "hepatic events". ' +
      '"compare": start from a REACTION and compare drugs — for one term pattern, the case count and ROR with interval for each ' +
      'named drug, or each drug in a class, or (with no drugs given) the drugs with the most disproportionate reporting of it ' +
      'across the whole database. Use for "which drugs", "compare X across", "is X reported more for A than B". ' +
      'All numbers are counts of distinct FAERS cases naming the drug as a suspect. FAERS has no denominator: ' +
      'nothing here is a rate, a risk, or evidence of causation.',
    input_schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['gap', 'counts', 'compare'], description: 'gap (default), counts, or compare' },
        drugs: { type: 'array', items: { type: 'string' }, maxItems: 20, description: 'compare mode: the drugs to compare, by ingredient or product name. Omit to rank all drugs.' },
        order: { type: 'string', enum: ['ror025', 'cases'], description: 'compare mode: rank by lower-bound ROR (default) or by case count. With no drugs named, ror025 surfaces small drugs with extreme ratios — often indication confounding — while cases surfaces the big reporters; look at both.' },
        drug: { type: 'string', description: 'Ingredient or product name, e.g. "semaglutide", "Ozempic", "atorvastatin". Required unless drug_class is given.' },
        drug_class: { type: 'string', description: 'counts mode only. A curated class: glp1, statin, anti_tnf, il17, il23, il4_il13, jak, il6, pd1, doac.' },
        top: { type: 'integer', minimum: 1, maximum: 60, description: 'gap mode: how many terms to return (default 25).' },
        min_cases: { type: 'integer', minimum: 1, description: 'Minimum distinct cases for a term to be listed (default 10 in gap, 3 in counts).' },
        include_excluded: { type: 'boolean', description: 'gap mode: also show administrative/device terms that are normally suppressed.' },
        age_bracket: { type: 'string', enum: AGE_BRACKETS, description: 'counts mode: restrict to one age bracket.' },
        outcomes: { type: 'array', items: { type: 'string', enum: OUTCOMES }, description: 'counts mode: only cases with at least one of these outcome codes. DE death, LT life-threatening, HO hospitalization, DS disability, CA congenital anomaly, RI required intervention, OT other serious. For "deaths" or "fatal" use outcomes ["DE"], not a term_pattern — Death is also a reaction term, and the outcome code is the reliable one.' },
        term_pattern: { type: 'string', description: 'counts and compare modes: case-insensitive regex the reaction term must match, e.g. "hepat|liver" or "rhabdomyolysis|myopathy". Required in compare mode.' },
      },
      required: [],
    },
  },
  {
    name: 'search_label',
    description:
      'Search the FDA prescribing information (DailyMed label) of one drug, or of all loaded drugs. Hybrid vector + keyword ' +
      'retrieval over label sections: boxed warning, contraindications, warnings and precautions, adverse reactions, ' +
      'drug interactions, specific populations, overdosage, clinical pharmacology, clinical studies. Returns the best-matching ' +
      'passages with their section, the label they came from and its version and date. Use to answer "what does the label ' +
      'say about X" and to quote the exact sentence for any label claim.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for, in plain words or as a reaction term.' },
        drug: { type: 'string', description: 'Ingredient or product name to scope the search to. Omit to search every loaded label.' },
        k: { type: 'integer', minimum: 1, maximum: 15, description: 'How many passages (default 6).' },
      },
      required: ['query'],
    },
  },
];

// ---- handlers: name -> async (input) => result object ----

async function needDrug(name, { needLabels = false } = {}) {
  if (!name) throw new Error('drug is required');
  const d = await resolveDrug(name);
  if (!d) {
    const known = (await listCuratedDrugs()).map(x => x.prod_ai.toLowerCase()).join(', ');
    throw new Error(`"${name}" did not match any drug in the loaded FAERS data. Drugs with labels loaded: ${known}`);
  }
  if (needLabels && !d.has_labels) {
    throw new Error(`${d.prod_ai} is in FAERS but no prescribing label is loaded for it, so the label comparison cannot run. Try mode "counts", or one of the curated drugs.`);
  }
  return d;
}

export const HANDLERS = {
  async query_adverse_events(input) {
    const mode = input.mode ?? 'gap';
    if (mode === 'gap') {
      const countsOnly = ['age_bracket', 'outcomes', 'term_pattern', 'drug_class'].filter(k => input[k] != null);
      if (countsOnly.length) throw new Error(`${countsOnly.join(', ')} only apply in mode "counts". Gap mode has no filters; call again with mode "counts" for filtered counts, or drop the filter for the gap analysis.`);
      const d = await needDrug(input.drug, { needLabels: true });
      const r = await diffDrug({ prodAi: d.prod_ai, top: input.top ?? 25, minCases: input.min_cases ?? 10, includeExcluded: !!input.include_excluded });
      // trim to what the model needs; evidence sentences stay, chunk ids go
      return {
        mode, resolved: { input: input.drug, prod_ai: d.prod_ai, via: d.via, drug_class: d.drug_class },
        labels: r.labels.map(l => ({ title: l.title, version: l.version, effective_date: l.effective_date })),
        quarters: r.quarters, population: r.population, parameters: r.parameters, excluded_terms_suppressed: r.excluded_terms,
        rows: r.rows.map(x => ({
          term: x.reaction_term, cases: x.a, ror: x.ror, ror025: x.ror025, ror975: x.ror975,
          label_status: x.label.status, label_section: x.label.section ?? null, label_title: x.label.label ?? null,
          evidence: x.label.evidence ?? null, similarity: x.label.similarity ?? null,
          ...(x.excluded_reason ? { excluded_reason: x.excluded_reason } : {}),
        })),
      };
    }
    if (mode === 'counts') {
      if (!input.drug && !input.drug_class) throw new Error('counts mode needs drug or drug_class');
      const d = input.drug ? await needDrug(input.drug) : null;
      const rows = await reportCounts({
        drugId: d?.id ?? null, drugClass: input.drug_class ?? null, ageBracket: input.age_bracket ?? null,
        outcomes: input.outcomes?.length ? input.outcomes : null, termPattern: input.term_pattern ?? null,
        minCases: input.min_cases ?? 3, limit: 50,
      });
      const { rows: [q] } = await pool.query(`select string_agg(distinct source_quarter, ', ' order by source_quarter) as quarters from cases`);
      return {
        mode, resolved: d ? { input: input.drug, prod_ai: d.prod_ai, via: d.via } : { drug_class: input.drug_class },
        quarters: q.quarters,
        filters: { age_bracket: input.age_bracket ?? null, outcomes: input.outcomes ?? null, term_pattern: input.term_pattern ?? null, roles: ['PS', 'SS'] },
        exposed_cases: rows[0]?.exposed_cases ?? 0, filtered_cases: rows[0]?.filtered_cases ?? 0,
        terms: rows.map(r => ({ term: r.reaction_term, cases: r.cases })),
        note: 'cases = distinct FAERS cases naming a target drug as suspect and matching every filter. Not a rate.',
      };
    }
    if (mode === 'compare') {
      if (!input.term_pattern) throw new Error('compare mode needs term_pattern (a regex on the reaction term)');
      const named = [];
      for (const name of input.drugs ?? []) named.push({ name, resolved: await needDrug(name) });
      const rows = await compareDrugs({
        termPattern: input.term_pattern, drugIds: named.length ? named.map(x => x.resolved.id) : null,
        drugClass: input.drug_class ?? null, minCases: input.min_cases ?? (named.length ? 3 : 10),
        orderBy: input.order ?? 'ror025', limit: named.length ? 40 : 15,
      });
      const { rows: [q] } = await pool.query(`select string_agg(distinct source_quarter, ', ' order by source_quarter) as quarters from cases`);
      return {
        mode, term_pattern: input.term_pattern, quarters: q.quarters,
        resolved: named.map(x => ({ input: x.name, prod_ai: x.resolved.prod_ai, via: x.resolved.via })),
        scope: named.length ? 'named drugs' : input.drug_class ? `class ${input.drug_class}` : 'all suspect drugs',
        comparator: 'all other suspect drugs (a 2x2 per drug)',
        population: rows[0] ? { n: rows[0].n, cases_with_term: rows[0].n_r } : null,
        rows: rows.map(r => ({ drug: r.prod_ai, drug_class: r.drug_class, cases_with_term: r.a, drug_cases: r.n_d,
                               pct_of_drug_cases: r.pct_of_drug_cases, ror: r.ror, ror025: r.ror025, ror975: r.ror975,
                               ...(r.ungrouped_salt_form ? { ungrouped_salt_form: true } : {}) })),
        notes: [
          'Each row is its own 2x2 against all other suspect drugs; compare intervals, and say they overlap when they do.',
          'Rows marked ungrouped_salt_form are one ingredient under different spellings that the data does not group — read them together, not as separate drugs.',
          'Drugs given to treat the reaction (antiemetics for pancreatitis, enzyme replacement) rank high: this is reporting, not causation.',
        ],
      };
    }
    throw new Error(`unknown mode ${mode}`);
  },

  async search_label(input) {
    if (!input.query) throw new Error('query is required');
    const d = input.drug ? await needDrug(input.drug, { needLabels: true }) : null;
    const hits = await searchLabel({ query: input.query, drugId: d?.id ?? null, k: input.k ?? 6 });
    return {
      resolved: d ? { input: input.drug, prod_ai: d.prod_ai, via: d.via } : { scope: 'all loaded labels' },
      passages: hits.map(h => ({
        label: h.label_title, label_version: h.label_version, label_date: h.effective_date, section: h.section, section_title: h.section_title, text: h.content,
        found_by: h.vec_rank && h.kw_rank ? 'vector+keyword' : h.kw_rank ? 'keyword' : 'vector', similarity: h.vec_sim,
      })),
    };
  },
};

// Run one tool call; always returns a tool_result block, with is_error on failure.
export async function runTool(block) {
  const handler = HANDLERS[block.name];
  try {
    if (!handler) throw new Error(`no such tool ${block.name}`);
    const result = await handler(block.input ?? {});
    return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) };
  } catch (err) {
    return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: err.message };
  }
}
