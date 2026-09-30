-- Layer 3 of regimen analysis: for every pair of drugs in the regimen and
-- every reaction term, is the term reported for cases mentioning BOTH drugs
-- more often than the two drugs' separate reporting predicts?
--
-- The statistic is Ω (Norén et al., Statistics in Medicine 2008), the
-- WHO-UMC interaction screening measure: log2 of observed over expected with
-- the same +0.5 shrinkage as IC. Expected uses the conservative baseline
-- max(f10, f01, g11) — never lower than either drug alone — because false
-- flags are the failure mode this feature is fighting.
--
-- Cost: the "A alone" and "B alone" strata come from per-drug counts
-- precomputed in mention_counts / mention_term_counts (migration 014), so
-- the query only walks the cases a pair actually shares.
--
-- Duplicates: FAERS files one event many times (several manufacturers). The
-- shared-cases stratum counts distinct case profiles (demographics, event
-- date, reaction list — case_profiles, migration 015), not cases; raw counts
-- are returned alongside.
--
-- Population: only reports listing 30 drugs or fewer (in_pair_population,
-- 99.1% of cases). A report listing a hundred drugs co-lists every pair and
-- says nothing about any one of them. Every stratum below uses this population.
--
-- "Mentions" means any role (PS, SS, C, I): this is the one place in the
-- project where concomitant rows count. Ω corrects for each drug's own
-- reporting of the term, NOT for an indication the two drugs share; output
-- says "reported together more than expected", never "interact".
--
--   $1  int[]  base drug ids       $2  int  minimum de-duplicated shared cases with the term
--   $3, $4  int[]  optional parallel arrays of pair endpoints: only those pairs
--   $5  text  optional case-insensitive regex on the reaction term
with regimen(drug_id) as (select unnest($1::int[])),
rows_of as (                                            -- member -> all its rows (salt forms)
  select r.drug_id as member, d.id as row_id
  from regimen r join drugs d on d.id = r.drug_id or d.canonical_id = r.drug_id),
mention as (
  select distinct x.member, cd.case_id
  from case_drugs cd
  join rows_of x on x.row_id = cd.drug_id
  join case_profiles cp on cp.case_id = cd.case_id and cp.in_pair_population
  where cd.role_cod in ('PS', 'SS', 'C', 'I')),
pairs as (
  select a.drug_id as a, b.drug_id as b
  from regimen a join regimen b on a.drug_id < b.drug_id
  where $3::int[] is null
     or exists (select 1 from unnest($3::int[], $4::int[]) as w(x, y)
                where least(w.x, w.y) = a.drug_id and greatest(w.x, w.y) = b.drug_id)),
shared as (                                             -- the cases a pair has in common, with their duplicate-profile
  select p.a, p.b, ma.case_id, cp.profile
  from pairs p
  join mention ma on ma.member = p.a
  join mention mb on mb.member = p.b and mb.case_id = ma.case_id
  join case_profiles cp on cp.case_id = ma.case_id),
n as (
  select s.a, s.b, count(distinct s.profile) as n11, count(*) as n11_raw,
         ca.n_cases - count(*) as n10, cb.n_cases - count(*) as n01
  from shared s
  join mention_counts ca on ca.drug_id = s.a
  join mention_counts cb on cb.drug_id = s.b
  group by s.a, s.b, ca.n_cases, cb.n_cases),
total as materialized (select count(*) as big_n from case_profiles where in_pair_population),
counts as (                                             -- per term, among the shared cases
  select s.a, s.b, cr.reaction_term,
         count(distinct s.profile) as n11r, count(*) as n11r_raw
  from shared s join case_reactions cr on cr.case_id = s.case_id
  where $5::text is null or cr.reaction_term ~* $5
  group by 1, 2, 3
  having count(distinct s.profile) >= $2),
model as (
  select c.*, n.n11, n.n11_raw, n.n10, n.n01,
         coalesce(ta.n_cases, 0) - c.n11r_raw          as n10r,
         coalesce(tb.n_cases, 0) - c.n11r_raw          as n01r,
         t.big_n - n.n11_raw - n.n10 - n.n01           as n00,
         tt.n_cases - coalesce(ta.n_cases, 0) - coalesce(tb.n_cases, 0) + c.n11r_raw as n00r,
         tt.n_cases::numeric / t.big_n                  as base_rate
  from counts c
  join n using (a, b)
  join pair_term_cases tt using (reaction_term)
  left join mention_term_counts ta on ta.drug_id = c.a and ta.reaction_term = c.reaction_term
  left join mention_term_counts tb on tb.drug_id = c.b and tb.reaction_term = c.reaction_term
  cross join total t
  where n.n10 > 0 and n.n01 > 0),
expected as (
  select *,
         n10r::numeric / n10 as f10, n01r::numeric / n01 as f01,
         greatest(n10r::numeric / n10, n01r::numeric / n01,
                  1 - (1 - n10r::numeric / n10) * (1 - n01r::numeric / n01) / nullif(1 - n00r::numeric / nullif(n00, 0), 0)) as g11
  from model)
select da.prod_ai as drug_a, db.prod_ai as drug_b, e.reaction_term,
       e.n11::int as cases_with_both, e.n11r::int as observed, e.n11r_raw::int as observed_raw,
       round(e.n11 * e.g11, 1) as expected,
       round(e.f10, 4) as rate_a_alone, round(e.f01, 4) as rate_b_alone, round(e.n11r::numeric / e.n11, 4) as rate_both,
       round(e.base_rate, 5) as base_rate,
       round(log(2, (e.n11r + 0.5) / (e.n11 * e.g11 + 0.5))::numeric, 2) as omega,
       round((log(2, (e.n11r + 0.5) / (e.n11 * e.g11 + 0.5))
              - 3.3 * power(e.n11r + 0.5, -0.5) - 2 * power(e.n11r + 0.5, -1.5))::numeric, 2) as omega025
from expected e
join drugs da on da.id = e.a
join drugs db on db.id = e.b
left join excluded_terms x on x.term = e.reaction_term
where x.term is null and e.g11 > 0
order by omega025 desc, observed desc;
