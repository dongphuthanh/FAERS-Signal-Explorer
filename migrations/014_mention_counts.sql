-- Per base ingredient, in ANY role (suspect or concomitant): how many cases
-- mention it, and how many mention it and report each term. Pair-independent,
-- so the pairwise Ω query only has to look at the cases a pair shares.
-- Refreshed by derive.
create materialized view mention_counts as
  select coalesce(d.canonical_id, d.id) as drug_id, count(distinct cd.case_id)::int as n_cases
  from case_drugs cd join drugs d on d.id = cd.drug_id
  where cd.role_cod in ('PS', 'SS', 'C', 'I')
  group by 1;
create unique index on mention_counts (drug_id);

create materialized view mention_term_counts as
  with m as (
    select distinct coalesce(d.canonical_id, d.id) as drug_id, cd.case_id
    from case_drugs cd join drugs d on d.id = cd.drug_id
    where cd.role_cod in ('PS', 'SS', 'C', 'I'))
  select m.drug_id, cr.reaction_term, count(*)::int as n_cases
  from m join case_reactions cr on cr.case_id = m.case_id
  group by 1, 2;
create unique index on mention_term_counts (drug_id, reaction_term);
