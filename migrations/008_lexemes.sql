-- Precomputed for the diff: corpus document frequency per lexeme, and each
-- chunk's lexeme array with a GIN index so array overlap (&&) uses an index.
create materialized view lexeme_df as
  select word as lex, ndoc from ts_stat('select tsv from chunks');
create unique index on lexeme_df (lex);

-- from content, not tsv: a generated column cannot reference another one
alter table chunks add column lexemes text[]
  generated always as (tsvector_to_array(to_tsvector('english', content))) stored;
create index on chunks using gin (lexemes);
analyze chunks;