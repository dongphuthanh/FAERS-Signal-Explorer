// Disproportionality over the core tables: for one drug, every reaction term
// with its 2x2 cells, ROR and IC. See the methods doc for what these numbers
// are and are not — they are relative reporting statistics, never rates.
//
// "Cases naming a drug (or a class) as suspect" is defined once, in SQL:
// suspect_cases(drug_id, drug_class) from migration 009. Salt forms grouped
// under a drug via drugs.canonical_id count as the drug. Terms in
// excluded_terms are dropped and counted, never silently.
//
// The comparator is a choice: 'all' (every other suspect drug in the loaded
// quarters) or 'class' (the other drugs in this drug's class). A ratio is
// meaningless without it, so every row carries the comparator it was
// measured against.
import { pool } from './db.mjs';

// order by takes an identifier, which cannot be a query parameter: allowlist
const ORDER = { ror025: 'ror025 desc', ic025: 'ic025 desc' };

export async function disproportionality({ drugId, minCases = 10, limit = 50, includeExcluded = false,
                                           comparator = 'all', orderBy = 'ror025' }) {
  if (!ORDER[orderBy]) throw new Error(`orderBy must be one of ${Object.keys(ORDER).join(', ')}`);
  if (!['all', 'class'].includes(comparator)) throw new Error(`comparator must be 'all' or 'class'`);
  let popClass = null;
  if (comparator === 'class') {
    const { rows: [d] } = await pool.query(`select drug_class from drugs where id = $1`, [drugId]);
    if (!d?.drug_class) throw new Error('class comparator needs a drug with a drug_class');
    popClass = d.drug_class;
  }
  const { rows } = await pool.query(`
    with population as (select case_id from suspect_cases(null, $5)),
    exposed    as (select case_id from suspect_cases($1)),
    totals as (
      select (select count(*) from population) as n,
             (select count(*) from exposed)    as n_d
    ),
    cells as (
      select cr.reaction_term,
             count(*)                                          as n_r,
             count(*) filter (where e.case_id is not null)     as a
      from case_reactions cr
      join population p on p.case_id = cr.case_id
      left join exposed  e on e.case_id = cr.case_id
      group by cr.reaction_term
    ),
    tbl as (
      select x.reaction_term, x.a,
             t.n_d - x.a                   as b,
             x.n_r - x.a                   as c,
             t.n - t.n_d - (x.n_r - x.a)   as d,
             t.n, t.n_d,
             (t.n_d::numeric * x.n_r) / t.n as expected     -- cases if drug and term were independent
      from cells x cross join totals t
      where x.a >= $2
    ),
    scored as (
      select reaction_term, a::int, b::int, c::int, d::int, n::int, n_d::int,
             round((a::numeric * d) / (b * c), 2) as ror,
             round((exp(ln((a::numeric * d) / (b * c))
                   - 1.96 * sqrt(1.0/a + 1.0/b + 1.0/c + 1.0/d)))::numeric, 2) as ror025,
             round((exp(ln((a::numeric * d) / (b * c))
                   + 1.96 * sqrt(1.0/a + 1.0/b + 1.0/c + 1.0/d)))::numeric, 2) as ror975,
             -- information component: log2 of observed over expected, shrunk by +0.5 so small counts sit near 0
             round(log(2, (a + 0.5) / (expected + 0.5))::numeric, 2) as ic,
             round((log(2, (a + 0.5) / (expected + 0.5))
                   - 3.3 * power(a + 0.5, -0.5) - 2 * power(a + 0.5, -1.5))::numeric, 2) as ic025
      from tbl
      where b > 0 and c > 0 and d > 0
    )
    select s.*, x.reason as excluded_reason
    from scored s
    left join excluded_terms x on x.term = s.reaction_term
    where ($3 or x.term is null)
    order by ${ORDER[orderBy]}
    limit $4`,
    [drugId, minCases, includeExcluded, limit, popClass]);
  return rows.map(r => ({ ...r, ror: +r.ror, ror025: +r.ror025, ror975: +r.ror975, ic: +r.ic, ic025: +r.ic025,
                          comparator: popClass ? `other ${popClass} drugs` : 'all other suspect drugs' }));
}

// how many terms the exclusion list removed from what would otherwise be
// the top of the ranking — reported alongside every diff, never hidden
export async function excludedCount({ drugId, minCases = 10 }) {
  const { rows: [r] } = await pool.query(`
    with exposed as (select case_id from suspect_cases($1))
    select count(*)::int as n
    from (select cr.reaction_term
          from case_reactions cr join exposed e on e.case_id = cr.case_id
          group by cr.reaction_term having count(*) >= $2) t
    join excluded_terms x on x.term = t.reaction_term`,
    [drugId, minCases]);
  return r.n;
}

// Parameterized aggregate for the pure-SQL questions: "serious hepatic
// events for statins in patients over 65". Every filter is optional and
// every value is a parameter; the model chooses arguments, never SQL.
//
//   drugId     one drug (salt forms included)      drugClass  every curated drug in a class
//   ageBracket '<18' | '18-44' | '45-64' | '65+' | 'unknown'
//   ageMin / ageMax  exact ages in years, inclusive ("over 55" -> ageMin 55); cases
//              with no recorded age are left out when either is given, and counted
//   outcomes   subset of DE LT HO DS CA RI OT       termPattern  case-insensitive regex on the reaction term
export async function reportCounts({ drugId = null, drugClass = null, ageBracket = null, ageMin = null, ageMax = null,
                                     outcomes = null, termPattern = null, minCases = 3, limit = 50 }) {
  const { rows } = await pool.query(`
    with exposed as (select case_id from suspect_cases($1, $2)),
    filtered as (
      select e.case_id from exposed e join cases c on c.id = e.case_id
      where ($3::text is null or c.age_bracket = $3)
        and ($8::numeric is null or c.age_years >= $8)
        and ($9::numeric is null or c.age_years <= $9)
        and ($4::text[] is null or exists (select 1 from case_outcomes o where o.case_id = e.case_id and o.outc_cod = any($4)))
    ),
    terms as (
      select cr.reaction_term, count(*) as cases
      from case_reactions cr join filtered f on f.case_id = cr.case_id
      left join excluded_terms x on x.term = cr.reaction_term
      where x.term is null and ($5::text is null or cr.reaction_term ~* $5)
      group by cr.reaction_term having count(*) >= $6
    )
    select reaction_term, cases::int,
           (select count(*) from exposed)::int  as exposed_cases,
           (select count(*) from filtered)::int as filtered_cases,
           (select count(distinct f.case_id) from filtered f join case_reactions cr on cr.case_id = f.case_id
             left join excluded_terms x on x.term = cr.reaction_term
             where x.term is null and ($5::text is null or cr.reaction_term ~* $5))::int as matching_cases,
           case when $8::numeric is null and $9::numeric is null then null
                else (select count(*) from exposed e join cases c on c.id = e.case_id where c.age_years is null)::int
           end as age_unknown_cases
    from terms order by cases desc, reaction_term limit $7`,
    [drugId, drugClass, ageBracket, outcomes, termPattern, minCases, limit, ageMin, ageMax]);
  return rows;
}

// Reaction-first comparison: for one reaction term (regex), the 2x2 for
// every drug at once — or for named drugs / a class. Salt forms fold into
// their base ingredient via canonical_id (drugs.json aliases plus
// npm run drugs:salts). The population is the class when a class is given,
// so a within-class comparison is measured against the class, as in
// disproportionality({ comparator: 'class' }).
const COMPARE_ORDER = { ror025: 'ror025 desc', cases: 'a desc' };

export async function compareDrugs({ termPattern, drugIds = null, drugClass = null, minCases = 10, orderBy = 'ror025', limit = 15 }) {
  if (!termPattern) throw new Error('termPattern is required');
  if (!COMPARE_ORDER[orderBy]) throw new Error(`orderBy must be one of ${Object.keys(COMPARE_ORDER)}`);
  const { rows } = await pool.query(`
    with population as (select case_id from suspect_cases(null, $4)),
    term_cases as (
      select distinct cr.case_id from case_reactions cr join population p on p.case_id = cr.case_id
      where cr.reaction_term ~* $1 and not exists (select 1 from excluded_terms x where x.term = cr.reaction_term)),
    t as (select (select count(*) from population) as n, (select count(*) from term_cases) as n_r),
    per_drug as (
      select coalesce(d.canonical_id, d.id) as drug_id,
             count(distinct cd.case_id) as n_d,
             count(distinct cd.case_id) filter (where tc.case_id is not null) as a
      from case_drugs cd
      join drugs d on d.id = cd.drug_id
      left join drugs b on b.id = d.canonical_id
      left join term_cases tc on tc.case_id = cd.case_id
      where cd.role_cod in ('PS', 'SS')
        and ($3::int[] is null or d.id = any($3) or d.canonical_id = any($3))
        and ($4::text is null or d.drug_class = $4 or b.drug_class = $4)
      group by 1),
    cells as (
      select dr.prod_ai, dr.drug_class, dr.curated, p.a, p.n_d, t.n, t.n_r,
             p.n_d - p.a as b, t.n_r - p.a as c, t.n - p.n_d - (t.n_r - p.a) as d
      from per_drug p join drugs dr on dr.id = p.drug_id cross join t
      where p.a >= $2)
    select prod_ai, drug_class, curated, a::int, n_d::int, n::int, n_r::int,
           round(100.0 * a / n_d, 2) as pct_of_drug_cases,
           round((a::numeric * d) / (b * c), 2) as ror,
           round((exp(ln((a::numeric * d) / (b * c)) - 1.96 * sqrt(1.0/a + 1.0/b + 1.0/c + 1.0/d)))::numeric, 2) as ror025,
           round((exp(ln((a::numeric * d) / (b * c)) + 1.96 * sqrt(1.0/a + 1.0/b + 1.0/c + 1.0/d)))::numeric, 2) as ror975
    from cells
    where b > 0 and c > 0 and d > 0
    order by ${COMPARE_ORDER[orderBy]}
    limit $5`,
    [termPattern, minCases, drugIds, drugClass, limit]);
  return rows.map(r => ({ ...r, pct_of_drug_cases: +r.pct_of_drug_cases, ror: +r.ror, ror025: +r.ror025, ror975: +r.ror975,
                          comparator: drugClass ? `other ${drugClass} drugs` : 'all other suspect drugs' }));
}
