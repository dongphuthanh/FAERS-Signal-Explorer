-- Reaction terms that are not clinical adverse events and should not appear
-- in a signal ranking: medication errors, device faults, product-use issues.
-- Every exclusion carries a reason. Applied as a filter and always reported
-- as a count, so a suppressed term is visible, not gone.
--
-- Deliberately narrow. Efficacy complaints ("Drug ineffective", "Weight loss
-- poor") and expected lab changes are NOT here: whether they belong in a
-- safety output is a clinical judgment, not an engineering one.

create table excluded_terms (
    term        text primary key,       -- the MedDRA PT exactly as FAERS spells it
    category    text not null,          -- 'administrative' | 'device' | 'non_event'
    reason      text not null,
    added_by    text not null default 'seed',
    added_at    timestamptz not null default now()
);
