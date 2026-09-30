-- Two fixes to the population the pairwise Ω statistic runs on, found when
-- clarithromycin + cephalexin produced 29 "co-reported" terms that were in
-- fact two Canadian patients, each report listing ~100 drugs, filed dozens of
-- times by different manufacturers.
--
-- 1. The duplicate fingerprint no longer includes the drug list. Copies of one
--    event filed by different manufacturers spell a long drug list
--    differently, so no two matched (95 copies -> 90 "distinct" profiles).
--    Demographics, event date and the coded reaction list do match.
-- 2. Reports listing more than 30 drugs (0.9% of cases) are left out of the
--    pair statistic entirely. When everything is co-listed with everything,
--    co-listing says nothing about any one pair. case_profiles.in_pair_population
--    marks the cases that count, and every Ω input below uses only those.
--
-- Measured on three pairs (shared cases -> distinct profiles in population):
--   clarithromycin + cephalexin   187 -> 18      (the cluster, removed)
--   warfarin + fluconazole         48 -> 31
--   metformin + atorvastatin     7763 -> 6053    (a sex+age+country+date key
--                                                  would give 5479: over-merging)
drop materialized view if exists mention_term_counts;
drop materialized view if exists mention_counts;
drop materialized view if exists case_profiles;

create materialized view case_profiles as
  with nd as (select case_id, count(*) as n_drugs from case_drugs group by case_id),
       rx as (select case_id, string_agg(reaction_term, '|' order by reaction_term) as reactions
              from case_reactions group by case_id)
  select c.id as case_id,
         md5(concat_ws('|', c.sex, c.age_years, c.country, c.event_date, rx.reactions)) as profile,
         coalesce(nd.n_drugs, 0)::int as n_drugs,
         coalesce(nd.n_drugs, 0) <= 30 as in_pair_population
  from cases c
  left join nd on nd.case_id = c.id
  left join rx on rx.case_id = c.id;
create unique index on case_profiles (case_id);
create index on case_profiles (profile);

-- per base ingredient, any role, pair population only
create materialized view mention_counts as
  select coalesce(d.canonical_id, d.id) as drug_id, count(distinct cd.case_id)::int as n_cases
  from case_drugs cd
  join drugs d on d.id = cd.drug_id
  join case_profiles cp on cp.case_id = cd.case_id and cp.in_pair_population
  where cd.role_cod in ('PS', 'SS', 'C', 'I')
  group by 1;
create unique index on mention_counts (drug_id);

create materialized view mention_term_counts as
  with m as (
    select distinct coalesce(d.canonical_id, d.id) as drug_id, cd.case_id
    from case_drugs cd
    join drugs d on d.id = cd.drug_id
    join case_profiles cp on cp.case_id = cd.case_id and cp.in_pair_population
    where cd.role_cod in ('PS', 'SS', 'C', 'I'))
  select m.drug_id, cr.reaction_term, count(*)::int as n_cases
  from m join case_reactions cr on cr.case_id = m.case_id
  group by 1, 2;
create unique index on mention_term_counts (drug_id, reaction_term);

-- term totals over the pair population, for the "neither drug" stratum
create materialized view pair_term_cases as
  select cr.reaction_term, count(*)::int as n_cases
  from case_reactions cr
  join case_profiles cp on cp.case_id = cr.case_id and cp.in_pair_population
  group by 1;
create unique index on pair_term_cases (reaction_term);
