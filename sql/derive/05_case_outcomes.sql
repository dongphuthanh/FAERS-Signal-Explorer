insert into case_outcomes (case_id, outc_cod)
select distinct c.id, o.outc_cod
from raw_outc o
join cases c on c.primaryid = o.primaryid::bigint;