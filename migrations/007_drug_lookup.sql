-- Lets "Ozempic" resolve to SEMAGLUTIDE by looking at what reporters called
-- the drug. case_drugs.drugname is the product name as typed in FAERS;
-- upper() so the lookup is case-insensitive and still uses the index.
create index on case_drugs (upper(drugname));
