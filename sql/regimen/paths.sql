-- Layer 1 of regimen analysis: walk the interaction graph from every drug in
-- the regimen, keep the paths that end at another regimen drug, classify
-- each path by its step pattern against path_rules, then collapse to one
-- flag per (victim, mechanism) so three inhibitors of one enzyme are one
-- flag with three perpetrators, not three flags.
--
--   $1  int[]  base drug ids of the regimen (salt forms already folded)
--
-- Depth is capped at 3 and the path array is the visited set (cycle guard).
-- On a drug <-> mechanism graph every meaningful pattern is two hops; three
-- hops are kept, discounted, and shown only under "show all".
with recursive members as (
  select n.id as node, n.drug_id, n.name
  from graph_nodes n
  where n.kind = 'drug' and n.drug_id = any($1::int[])
),
walk as (
  select m.node as start, e.b as node,
         array[m.node, e.b]                as path,
         array[e.type || ':' || e.dir]     as steps,
         array[e.strength]                 as strengths,
         array[e.evidence]                 as evidence,
         array[e.source]                   as sources,
         e.severity                        as pair_severity,     -- only set on interacts_with edges
         1                                 as depth
  from members m
  join graph_adj e on e.a = m.node
  union all
  select w.start, e.b,
         w.path || e.b,
         w.steps || (e.type || ':' || e.dir),
         w.strengths || e.strength,
         w.evidence || e.evidence,
         w.sources || e.source,
         w.pair_severity,
         w.depth + 1
  from walk w
  join graph_adj e on e.a = w.node
  where w.depth < 3
    and not (e.b = any(w.path))              -- never revisit a node
    and e.type <> 'interacts_with'           -- documented pairs are one hop only
),
pair_paths as (
  select w.*
  from walk w
  where w.node in (select node from members)
    and w.node <> w.start
    and w.start < w.node                     -- each unordered pair once
),
classified as (
  -- who does what to whom. A pair is kept once (start < node by id), so the same
  -- interaction can arrive spelled from the perpetrator's side
  -- ({inhibits:out, substrate_of:in}) or from the victim's side
  -- ({substrate_of:out, inhibits:in}). Both are read; the roles come from the
  -- side the action is on, never from which end happened to have the lower id.
  select p.*,
         case when p.steps[2] like '%:in' and p.steps[1] like 'substrate_of:%' then p.node else p.start end as perpetrator,
         case when p.steps[2] like '%:in' and p.steps[1] like 'substrate_of:%' then p.start else p.node end as victim,
         p.path[2]                                                                                    as mechanism,
         case when p.steps[1] like 'substrate_of:%' then split_part(p.steps[2], ':', 1) else split_part(p.steps[1], ':', 1) end as perpetrator_type,
         case when p.steps[1] like 'substrate_of:%' then p.strengths[2] else p.strengths[1] end          as perpetrator_str,
         case when p.steps[1] like 'substrate_of:%' then p.strengths[1] else p.strengths[2] end          as victim_str
  from pair_paths p
  where p.depth = 2
    and (   (p.steps[1] in ('inhibits:out', 'induces:out') and p.steps[2] = 'substrate_of:in')     -- perpetrator's side
         or (p.steps[1] = 'substrate_of:out' and p.steps[2] in ('inhibits:in', 'induces:in'))      -- victim's side
         or (p.steps[1] = 'contributes_to:out' and p.steps[2] = 'contributes_to:in'))              -- shared effect
),
scored as (
  select c.*, r.severity, r.weight,
         case when 'theoretical' = any(c.evidence) then 0.7 when 'probable' = any(c.evidence) then 0.85 else 1.0 end as evidence_factor
  from classified c
  join path_rules r
    on r.perpetrator_type = c.perpetrator_type
   and r.perpetrator_str  = c.perpetrator_str
   and (r.victim_str = c.victim_str or r.victim_str = 'any')
  union all
  -- documented pairs (DrugBank, label boxed warnings): one hop, severity on the edge itself
  select p.*, p.start as perpetrator, p.node as victim, null::int as mechanism,
         'interacts_with' as perpetrator_type, null as perpetrator_str, null as victim_str,
         p.pair_severity as severity,
         case p.pair_severity when 'major' then 3 when 'moderate' then 2 else 1 end::real as weight,
         case when 'theoretical' = any(p.evidence) then 0.7 when 'probable' = any(p.evidence) then 0.85 else 1.0 end as evidence_factor
  from pair_paths p
  where p.depth = 1 and p.steps[1] like 'interacts_with:%'
)
-- one row per (victim, mechanism) for exposure changes; one row per effect
-- node for pharmacodynamic convergence, where there is no victim and every
-- member on the node is a participant
select case when s.perpetrator_type = 'contributes_to' then null else v.name end   as victim,
       coalesce(m.name, 'documented pair')                                         as mechanism,
       coalesce(m.kind, 'documented')                                              as mechanism_kind,
       s.perpetrator_type                                                          as action,
       array_agg(distinct pn.name)                                                 as participants,
       json_agg(distinct jsonb_build_object('drug', pn.name, 'strength', part.str)) as participant_detail,
       max(s.victim_str)                                                           as victim_strength,
       (array['minor','moderate','major'])[max(case s.severity when 'major' then 3 when 'moderate' then 2 else 1 end)] as severity,
       count(distinct part.id)::int                                                as compounding,
       round((max(s.weight) * (1 + 0.5 * (count(distinct part.id) - 1)) * min(s.evidence_factor))::numeric, 2) as score,
       array_agg(distinct s.sources[1])                                            as sources,
       array_agg(distinct s.path)                                                  as paths,
       (array_agg(e.description) filter (where e.description is not null))[1]      as description
from scored s
join graph_nodes v on v.id = s.victim
left join graph_nodes m on m.id = s.mechanism
cross join lateral unnest(
  case when s.perpetrator_type = 'contributes_to' then array[s.perpetrator, s.victim] else array[s.perpetrator] end,
  case when s.perpetrator_type = 'contributes_to' then array[s.perpetrator_str, s.victim_str] else array[s.perpetrator_str] end
) as part(id, str)
join graph_nodes pn on pn.id = part.id
left join graph_edges e on s.perpetrator_type = 'interacts_with' and e.type = 'interacts_with'
                       and ((e.src = s.start and e.dst = s.node) or (e.src = s.node and e.dst = s.start))
group by 1, 2, 3, 4
order by score desc, victim, mechanism;
