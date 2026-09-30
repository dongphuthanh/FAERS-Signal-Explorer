-- Each label's own statement of its most common adverse reactions, verbatim,
-- and where in the label it came from ('highlights' or 'section 6'). Null when
-- the label states none in one sentence. Filled by src/label-common.mjs.
alter table labels add column common_ar text;
alter table labels add column common_ar_source text check (common_ar_source in ('highlights', 'section 6'));
