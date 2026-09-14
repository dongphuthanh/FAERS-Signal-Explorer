with latest as (
    select *, row_number() over (partition by caseid order by caseversion::int desc) as rn
    from raw_demo
),
kept as (
    select *
    from latest l
    where rn = 1
     and not exists (select 1 from raw_deleted x where x.caseid = l.caseid)
),
typed as (
  select *,
    case age_cod
      when 'YR'  then age::numeric
      when 'DEC' then age::numeric * 10
      when 'MON' then age::numeric / 12
      when 'WK'  then age::numeric / 52
      when 'DY'  then age::numeric / 365
      when 'HR'  then age::numeric / 8760
    end as age_years
  from kept
)
insert into cases (id, version, primaryid, age_years, age_bracket,
                   sex, country, reported_at, event_date, source_quarter)
select
  caseid::bigint,
  caseversion::int,
  primaryid::bigint,
  round(age_years, 2),
  case
    when age_years is null then 'unknown'
    when age_years < 18   then '<18'
    when age_years < 45   then '18-44'
    when age_years < 65   then '45-64'
    else '65+'
  end,
  sex,
  occr_country,
  to_date(fda_dt, 'YYYYMMDD'),
  case when event_dt ~ '^\d{8}$' then to_date(event_dt, 'YYYYMMDD') end,
  source_quarter
from typed;
