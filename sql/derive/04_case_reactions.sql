insert into case_reactions (case_id, reaction_term)
select distinct c.id, r.pt
from raw_reac r
join cases c on c.primaryid = r.primaryid::bigint
where r.pt is not null;