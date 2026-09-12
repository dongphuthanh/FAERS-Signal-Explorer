
create table raw_demo (
    primaryid       text not null,
    caseid          text not null,
    caseversion     text,
    i_f_code        text,
    event_dt        text,
    mfr_dt          text,
    init_fda_dt     text,
    fda_dt          text,
    rept_cod        text,
    auth_num        text,
    mfr_num         text,
    mfr_sndr        text,
    lit_ref         text,
    age             text,
    age_cod         text,
    age_grp         text,
    sex             text,
    e_sub           text,
    wt              text,
    wt_cod          text,
    rept_dt         text,
    to_mfr          text,
    occp_cod        text,
    reporter_country text,
    occr_country    text,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_demo (primaryid);
create index on raw_demo (caseid);

create table raw_drug (
    primaryid       text not null,
    caseid          text not null,
    drug_seq        text,
    role_cod        text,
    drugname        text,
    prod_ai         text,
    val_vbm         text,
    route           text,
    dose_vbm        text,
    cum_dose_chr    text,
    cum_dose_unit   text,
    dechal          text,
    rechal          text,
    lot_num         text,
    exp_dt          text,
    nda_num         text,
    dose_amt        text,
    dose_unit       text,
    dose_form       text,
    dose_freq       text,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_drug (primaryid);

create table raw_indi (
    primaryid       text not null,
    caseid          text not null,
    indi_drug_seq   text,
    indi_pt         text,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_indi (primaryid);

create table raw_outc (
    primaryid       text not null,
    caseid          text not null,
    outc_cod        text,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_outc (primaryid);

create table raw_reac (
    primaryid       text not null,
    caseid          text not null,
    pt              text,
    drug_rec_act    text,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_reac (primaryid);


create table raw_rpsr (
    primaryid       text not null,
    caseid          text not null,
    rpsr_cod        text,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_rpsr (primaryid);


create table raw_ther (
    primaryid       text not null,
    caseid          text not null,
    dsg_drug_seq    text,
    start_dt        text,
    end_dt          text,
    dur             text,
    dur_cod         text,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_ther (primaryid);


create table raw_deleted (
    caseid          text not null,
    source_quarter  text not null default current_setting('faers.quarter'),
    loaded_at       timestamptz not null default now()
);

create index on raw_deleted (caseid);
