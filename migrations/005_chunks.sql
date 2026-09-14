-- Retrieval layer. One row per chunk of a clinical label section, carrying
-- both search representations: a 384-dim vector from all-MiniLM-L6-v2 and a
-- generated tsvector for keyword match. Chunks never cross a section
-- boundary; drug_id and section are copied down so scoped search needs no
-- join. Rebuilt by scripts/embed-labels.mjs; a re-ingest of labels cascades
-- here, so embed always follows ingest.

create table chunks (
    id          bigserial primary key,
    document_id int not null references label_documents(id) on delete cascade,
    drug_id     int not null references drugs(id),
    section     text not null,
    position    int not null,                   -- order within the document
    content     text not null,
    embedding   vector(384) not null,
    tsv         tsvector generated always as (to_tsvector('english', content)) stored
);

create index on chunks using hnsw (embedding vector_cosine_ops);
create index on chunks using gin (tsv);
create index on chunks (drug_id, section);
create index on chunks (document_id, position);
