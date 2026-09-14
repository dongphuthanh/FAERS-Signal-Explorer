// The two tools the model can call. Each has a JSON-schema definition the
// API sees and a handler that runs here. The model chooses arguments; every
// argument becomes a SQL parameter or a search query. It never writes SQL
// and never computes a statistic — it receives numbers already computed.
import { resolveDrug, listCuratedDrugs } from '../drugs.mjs';
import { diffDrug } from '../diff.mjs';
import { reportCounts } from '../signal.mjs';
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
      'All numbers are counts of distinct FAERS cases naming the drug as a suspect. FAERS has no denominator: ' +
      'nothing here is a rate, a risk, or evidence of causation.',
    input_schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['gap', 'counts'], description: 'gap (default) or counts' },
        drug: { type: 'string', description: 'Ingredient or product name, e.g. "semaglutide", "Ozempic", "atorvastatin". Required unless drug_class is given.' },
        drug_class: { type: 'string', description: 'counts mode only. A curated class: glp1, statin, anti_tnf, il17, il23, il4_il13, jak, il6, pd1, doac.' },
        top: { type: 'integer', minimum: 1, maximum: 60, description: 'gap mode: how many terms to return (default 25).' },
        min_cases: { type: 'integer', minimum: 1, description: 'Minimum distinct cases for a term to be listed (default 10 in gap, 3 in counts).' },
        include_excluded: { type: 'boolean', description: 'gap mode: also show administrative/device terms that are normally suppressed.' },
        age_bracket: { type: 'string', enum: AGE_BRACKETS, description: 'counts mode: restrict to one age bracket.' },
        outcomes: { type: 'array', items: { type: 'string', enum: OUTCOMES }, description: 'counts mode: only cases with at least one of these outcome codes. DE death, LT life-threatening, HO hospitalization, DS disability, CA congenital anomaly, RI required intervention, OT other serious.' },
        term_pattern: { type: 'string', description: 'counts mode: case-insensitive regex the reaction term must match, e.g. "hepat|liver" or "rhabdomyolysis|myopathy".' },
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
