create function suspect_cases(p_drug_id int default null, p_drug_class text default null)
returns table (case_id bigint) language sql stable parallel safe as $$
    select distinct cd.case_id
    from case_drugs cd
    join drugs d on d.id = cd.drug_id
    left join drugs b on b.id = d.canonical_id
    where cd.role_cod in ('PS', 'SS')
        and (p_drug_id is null or d.id = p_drug_id or d.canonical_id = p_drug_id)
        and (p_drug_class is null or d.drug_class = p_drug_class or b.drug_class = p_drug_class)
$$;


    