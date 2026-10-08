-- migration: expand
-- An article's code is unique at its scope and compares without case (ADR 0009). code_key is
-- stored, because Postgres 18 cannot index a virtual generated column. Until core.scope holds the
-- scope spans, a unique index on (scope_id, code_key) stands in for the exclusion constraint of
-- ADR 0009: it covers two articles at one plant, and articles exist only at plants so far.
alter table core.article
  add constraint article_code_check check (code = btrim(code) and length(code) between 1 and 32),
  add column code_key text generated always as (lower(code)) stored;

-- toDomainError maps a violation of an index whose name ends in _code_key to core.code_taken.
create unique index article_code_key on core.article (scope_id, code_key);

-- The default order of coreArticles, by code with id as the tie-breaker (ADR 0016).
create index article_scope_code_idx on core.article (scope_id, code, id);
