-- drugs is deliberately not truncated: labels reference it, and its ids
-- should stay stable across rebuilds. 01_drugs.sql upserts instead.
truncate case_outcomes, case_reactions, case_drugs, cases;
