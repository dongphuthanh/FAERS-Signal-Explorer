-- How many cases report each reaction term, over every case in the loaded
-- quarters. The "neither drug" stratum of the pairwise Ω query needs this
-- per term, and computing it inside the query would scan case_reactions per
-- regimen. Refreshed by derive.mjs after each load.
create materialized view term_cases as
  select reaction_term, count(*)::int as n_cases
  from case_reactions
  group by reaction_term;
create unique index on term_cases (reaction_term);
