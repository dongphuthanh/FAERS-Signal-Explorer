-- Label layer: the prescribing information for the curated drug list.
-- One row in labels per SPL document fetched from DailyMed; one row in
-- label_documents per top-level section of it, text flattened, section
-- boundary preserved. Chunks and embeddings come in a later migration.

-- drugs gains three columns for the curated list. canonical_id groups salt
-- forms under their base ingredient (ROSUVASTATIN CALCIUM -> ROSUVASTATIN)
-- until phase 2 replaces that with RxNorm ingredient identity.
alter table drugs
    add column curated      boolean not null default false,
    add column drug_class   text,
    add column canonical_id int references drugs(id);

create index on drugs (canonical_id);

create table labels (
    id              serial primary key,
    drug_id         int not null references drugs(id),
    setid           text not null unique,       -- DailyMed SPL set id, stable across versions
    title           text not null,
    version         int,
    effective_date  date,
    source_path     text not null,              -- the XML on disk this was parsed from
    ingested_at     timestamptz not null default now()
);

create index on labels (drug_id);

create table label_documents (
    id          serial primary key,
    label_id    int not null references labels(id) on delete cascade,
    drug_id     int not null references drugs(id),
    position    int not null,                   -- document order within the label
    section     text not null,                  -- normalized key, e.g. 'adverse_reactions'
    loinc       text,                           -- the SPL section code it came from
    title       text,
    content     text not null
);

create index on label_documents (drug_id, section);
create index on label_documents (label_id, position);
