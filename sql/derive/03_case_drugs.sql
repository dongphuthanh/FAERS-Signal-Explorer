insert into case_drugs (case_id, drug_seq, drug_id, role_cod, drugname)
select distinct
  c.id, g.drug_seq::int, d.id, g.role_cod, g.drugname
from raw_drug g
join cases c on c.primaryid = g.primaryid::bigint
left join drugs d on d.prod_ai = g.prod_ai;