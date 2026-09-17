-- The interaction graph. Drugs and mechanisms (enzymes, transporters,
-- receptors, pharmacodynamic effects) share one node table so a single
-- recursive query can walk drug -> mechanism -> drug. Edges are directed as
-- the source states them (drug inhibits enzyme; drug is a substrate of
-- enzyme); graph_adj presents both directions for traversal.
create table graph_nodes (
  id       serial primary key,
  kind     text not null check (kind in ('drug', 'enzyme', 'transporter', 'receptor', 'effect')),
  name     text not null,                       -- 'CYP3A4', 'P-gp', 'QT prolongation', or the drug's prod_ai
  drug_id  int references drugs(id),            -- set when kind = 'drug'; the base ingredient
  unique (kind, name)
);
create index on graph_nodes (drug_id);

create table graph_edges (
  id          bigserial primary key,
  src         int not null references graph_nodes(id),
  dst         int not null references graph_nodes(id),
  type        text not null check (type in ('substrate_of', 'inhibits', 'induces', 'contributes_to', 'interacts_with')),
  strength    text check (strength in ('strong', 'moderate', 'weak', 'sensitive', 'moderate_sensitive', 'narrow_ti')),
  severity    text check (severity in ('major', 'moderate', 'minor')),     -- only on interacts_with
  evidence    text not null check (evidence in ('established', 'probable', 'theoretical')),
  source      text not null,
  source_ref  text,
  description text,                             -- source prose, quoted by the model, never paraphrased
  unique (src, dst, type, source)
);
create index on graph_edges (src);
create index on graph_edges (dst);

-- both directions, so the walk can go drug -> enzyme -> drug; dir records
-- which way the stored edge points ('out' = as stored, 'in' = reversed)
create view graph_adj as
  select src as a, dst as b, type, strength, severity, evidence, source, id as edge_id, 'out' as dir from graph_edges
  union all
  select dst as a, src as b, type, strength, severity, evidence, source, id as edge_id, 'in'  as dir from graph_edges;

-- what a perpetrator -> mechanism <- victim pattern means. Data, not code:
-- the reviewers can change a row and the ranking follows.
create table path_rules (
  perpetrator_type  text not null,     -- inhibits | induces | contributes_to
  perpetrator_str   text not null,     -- strong | moderate | weak | any
  victim_str        text not null,     -- sensitive | moderate_sensitive | narrow_ti | any
  severity          text not null check (severity in ('major', 'moderate', 'minor')),
  weight            real not null,
  primary key (perpetrator_type, perpetrator_str, victim_str)
);

insert into path_rules values
  -- inhibition: victim exposure rises. FDA grades: strong >= 5x AUC of a sensitive substrate, moderate 2-5x, weak 1.25-2x
  ('inhibits', 'strong',   'sensitive',          'major',    3),
  ('inhibits', 'strong',   'narrow_ti',          'major',    3),
  ('inhibits', 'strong',   'moderate_sensitive', 'moderate', 2),
  ('inhibits', 'moderate', 'sensitive',          'moderate', 2),
  ('inhibits', 'moderate', 'narrow_ti',          'major',    3),
  ('inhibits', 'moderate', 'moderate_sensitive', 'minor',    1),
  ('inhibits', 'weak',     'sensitive',          'minor',    1),
  ('inhibits', 'weak',     'narrow_ti',          'moderate', 2),
  ('inhibits', 'weak',     'moderate_sensitive', 'minor',    1),
  -- induction: victim exposure falls (loss of effect is a safety event too)
  ('induces',  'strong',   'sensitive',          'major',    3),
  ('induces',  'strong',   'narrow_ti',          'major',    3),
  ('induces',  'strong',   'moderate_sensitive', 'moderate', 2),
  ('induces',  'moderate', 'sensitive',          'moderate', 2),
  ('induces',  'moderate', 'narrow_ti',          'moderate', 2),
  ('induces',  'moderate', 'moderate_sensitive', 'minor',    1),
  ('induces',  'weak',     'any',                'minor',    1),
  -- pharmacodynamic convergence on one effect node: symmetric, graded by the weaker contributor
  ('contributes_to', 'strong',   'any', 'moderate', 2),
  ('contributes_to', 'moderate', 'any', 'minor',    1),
  ('contributes_to', 'weak',     'any', 'minor',    1);
