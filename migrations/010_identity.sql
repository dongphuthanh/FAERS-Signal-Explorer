-- Names from outside sources (FDA interaction tables, DrugBank, RxNorm) mapped
-- onto our drugs rows, with how each match was made and how sure it is. Rows
-- that match nothing are kept as 'unmatched' so the misses can be inspected
-- and the match rate reported. This is the Phase 2 table from CLAUDE.md.
create table drug_name_aliases (
  id            serial primary key,
  drug_id       int references drugs(id),          -- null when unmatched; a base ingredient otherwise
  source        text not null,                     -- 'seed:fda_cyp' | 'drugbank' | 'rxnorm' | 'manual'
  source_id     text,                              -- DrugBank ID, RxCUI, table row …
  raw_name      text not null,                     -- exactly as the source spelt it
  match_method  text not null check (match_method in ('exact', 'normalized', 'prefix', 'synonym', 'manual', 'unmatched')),
  confidence    real not null check (confidence between 0 and 1),
  unique (source, raw_name)
);
create index on drug_name_aliases (drug_id);
