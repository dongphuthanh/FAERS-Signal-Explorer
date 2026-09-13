-- Core layer: typed, deduplicated, one row per thing. Rebuilt in full by
-- scripts/derive.mjs from raw_* on every run. Mirrors FAERS's own structure:
-- a case, with drugs, reactions and outcomes hanging off it.

create table drugs (
    id              serial primary key,
    prod_ai         text not null unique,       -- FDA's active-ingredient string
    is_combination  boolean not null,           -- backslash-separated, multi-ingredient
    rxcui           text                        -- phase 2
);

create table cases (
    id              bigint primary key,         -- FAERS caseid
    version         int not null,
    primaryid       bigint not null unique,     -- trace back to raw_*
    age_years       numeric(6,2),
    age_bracket     text not null,              -- '<18' | '18-44' | '45-64' | '65+' | 'unknown'
    sex             text,
    country         text,
    reported_at     date not null,              -- fda_dt of this version
    event_date      date,
    source_quarter  text not null
);

create table case_drugs (
    case_id     bigint not null references cases(id) on delete cascade,
    drug_seq    int not null,
    drug_id     int references drugs(id),       -- null when FAERS gave no ingredient
    role_cod    text not null,
    drugname    text,
    primary key (case_id, drug_seq)
);

create table case_reactions (
    case_id         bigint not null references cases(id) on delete cascade,
    reaction_term   text not null,
    primary key (case_id, reaction_term)
);

create table case_outcomes (
    case_id     bigint not null references cases(id) on delete cascade,
    outc_cod    text not null,
    primary key (case_id, outc_cod)
);

create index on case_drugs (drug_id, role_cod);
create index on case_reactions (reaction_term);
create index on cases (age_bracket);
create index on cases (reported_at);
