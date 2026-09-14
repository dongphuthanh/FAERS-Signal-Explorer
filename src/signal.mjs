// Disproportionality over the core tables: for one drug, every reaction term
// with its 2x2 cells and ROR. See the methods doc for what these numbers
// are and are not — they are relative reporting statistics, never rates.
//
// The comparator is all other suspect drugs in the loaded quarters. Salt
// forms grouped under the drug via drugs.canonical_id count as the drug.
// Terms in excluded_terms are dropped and counted, never silently.
import { pool } from './db.mjs';

export const ROLES = ['PS', 'SS'];

export async function disproportionality({ drugId, minCases = 10, limit = 50, roles = ROLES, includeExcluded = false }) {
  const { rows } = await pool.query(`
    with drug_ids as (
      select id from drugs where id = $1 or canonical_id = $1
    ),
    population as (
      select distinct case_id from case_drugs where role_cod = any($2)
    ),
    exposed as (
      select distinct case_id from case_drugs
      where role_cod = any($2) and drug_id in (select id from drug_ids)
    ),
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
             t.n, t.n_d
      from cells x cross join totals t
      where x.a >= $3
    )
    select t.reaction_term, t.a::int, t.b::int, t.c::int, t.d::int, t.n::int, t.n_d::int,
           round((t.a::numeric * t.d) / (t.b * t.c), 2) as ror,
           round((exp(ln((t.a::numeric * t.d) / (t.b * t.c))
                 - 1.96 * sqrt(1.0/t.a + 1.0/t.b + 1.0/t.c + 1.0/t.d)))::numeric, 2) as ror025,
           round((exp(ln((t.a::numeric * t.d) / (t.b * t.c))
                 + 1.96 * sqrt(1.0/t.a + 1.0/t.b + 1.0/t.c + 1.0/t.d)))::numeric, 2) as ror975,
           x.reason as excluded_reason
    from tbl t
    left join excluded_terms x on x.term = t.reaction_term
    where t.b > 0 and t.c > 0 and t.d > 0
      and ($4 or x.term is null)
    order by ror025 desc
    limit $5`,
    [drugId, roles, minCases, includeExcluded, limit]);
  return rows.map(r => ({ ...r, ror: +r.ror, ror025: +r.ror025, ror975: +r.ror975 }));
}

// how many terms the exclusion list removed from what would otherwise be
// the top of the ranking — reported alongside every diff, never hidden
export async function excludedCount({ drugId, minCases = 10, roles = ROLES }) {
  const { rows: [r] } = await pool.query(`
    with drug_ids as (select id from drugs where id = $1 or canonical_id = $1),
    exposed as (
      select distinct case_id from case_drugs
      where role_cod = any($2) and drug_id in (select id from drug_ids)
    )
    select count(*)::int as n
    from (select cr.reaction_term, count(*) as a
          from case_reactions cr join exposed e on e.case_id = cr.case_id
          group by cr.reaction_term having count(*) >= $3) t
    join excluded_terms x on x.term = t.reaction_term`,
    [drugId, roles, minCases]);
  return r.n;
}

// Parameterized aggregate for the pure-SQL questions: "serious hepatic
// events for statins in patients over 65". Every filter is optional and
// every value is a parameter; the model chooses arguments, never SQL.
//
//   drugId     one drug (salt forms included)      drugClass  every curated drug in a class
//   ageBracket '<18' | '18-44' | '45-64' | '65+' | 'unknown'
//   outcomes   subset of DE LT HO DS CA RI OT       termPattern  case-insensitive regex on the reaction term
export async function reportCounts({ drugId = null, drugClass = null, ageBracket = null, outcomes = null,
                                     termPattern = null, minCases = 3, limit = 50, roles = ROLES }) {
  const { rows } = await pool.query(`
    with target as (
      select d.id from drugs d
      left join drugs b on b.id = d.canonical_id
      where ($1::int  is null or d.id = $1 or d.canonical_id = $1)
        and ($2::text is null or d.drug_class = $2 or b.drug_class = $2)
    ),
    exposed as (
      select distinct cd.case_id from case_drugs cd
      join target t on t.id = cd.drug_id
      where cd.role_cod = any($3)
    ),
    filtered as (
      select e.case_id from exposed e join cases c on c.id = e.case_id
      where ($4::text is null or c.age_bracket = $4)
        and ($5::text[] is null or exists (select 1 from case_outcomes o where o.case_id = e.case_id and o.outc_cod = any($5)))
    ),
    terms as (
      select cr.reaction_term, count(*) as cases
      from case_reactions cr join filtered f on f.case_id = cr.case_id
      left join excluded_terms x on x.term = cr.reaction_term
      where x.term is null and ($6::text is null or cr.reaction_term ~* $6)
      group by cr.reaction_term having count(*) >= $7
    )
    select reaction_term, cases::int,
           (select count(*) from exposed)::int  as exposed_cases,
           (select count(*) from filtered)::int as filtered_cases
    from terms order by cases desc, reaction_term limit $8`,
    [drugId, drugClass, roles, ageBracket, outcomes, termPattern, minCases, limit]);
  return rows;
}
