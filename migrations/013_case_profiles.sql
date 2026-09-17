-- A fingerprint of each case: demographics, event date, the full reaction
-- list and the full drug list. FAERS carries the same event many times when
-- several manufacturers file it, and those copies share all of these.
-- Pairwise statistics count distinct profiles in the numerator so a 30-copy
-- cluster counts once. Refreshed by derive.
create materialized view case_profiles as
  select c.id as case_id,
         md5(coalesce(c.age_years::text, '') || '|' || coalesce(c.sex, '') || '|' || coalesce(c.country, '') || '|' || coalesce(c.event_date::text, '') || '|' ||
             (select string_agg(reaction_term, '|' order by reaction_term) from case_reactions r where r.case_id = c.id) || '|' ||
             (select string_agg(drug_id::text, '|' order by drug_id) from (select distinct drug_id from case_drugs d where d.case_id = c.id) x)) as profile
  from cases c;
create unique index on case_profiles (case_id);
create index on case_profiles (profile);
