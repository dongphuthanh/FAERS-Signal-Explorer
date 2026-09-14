insert into drugs (prod_ai, is_combination)
select distinct prod_ai, position(chr(92) in prod_ai) > 0
from raw_drug
where prod_ai is not null
on conflict (prod_ai) do nothing;
