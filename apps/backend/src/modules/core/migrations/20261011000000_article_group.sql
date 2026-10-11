-- migration: expand
-- An article group is a register of the company: every plant of the company reads it, and it is
-- changed at the company (maintainer, 2026-10-09). Each article picks one or none.
create table core.article_group (
  id uuid primary key default uuidv7(),
  -- The company's node, where every group of the company sits, as an article does (ADR 0073).
  scope_id uuid not null,
  company_id uuid not null,
  version integer not null default 1,
  code text not null
    constraint article_group_code_check check (code = btrim(code) and length(code) between 1 and 32),
  code_key text generated always as (lower(code)) stored,
  name text not null
    constraint article_group_name_check check (name = btrim(name) and length(name) between 1 and 200),
  -- The translations of the name (ADR 0053), which a register has from its first migration.
  translations jsonb not null default '[]'
    constraint article_group_translations_check check (jsonb_typeof(translations) = 'array'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_group_company_check check (scope_id = company_id),
  constraint article_group_scope_fkey foreign key (scope_id) references core.scope (id),
  -- An article points at a group of its own company through this key.
  constraint article_group_id_company_key unique (id, company_id)
);

-- A code is unique within the company and compares without case (ADR 0009). toDomainError maps a
-- violation of an index whose name ends in _code_key to core.code_taken.
create unique index article_group_code_key on core.article_group (company_id, code_key);
-- The default order of coreArticleGroups, by code with id as the tie-breaker (ADR 0016).
create index article_group_scope_code_idx on core.article_group (scope_id, code, id);

-- Every update bumps version and moves updated_at on, also one that plain SQL makes (ADR 0006).
create function core.article_group_touch() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch before update on core.article_group
  for each row execute function core.article_group_touch();

alter table core.article_group enable row level security;
create policy scope_select on core.article_group for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.article_group for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on core.article_group for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.article_group for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

grant select, insert, update, delete on core.article_group to nm_app;

-- An article's group, of the article's own company. A group is archived, never deleted, so the
-- reference stays.
alter table core.article
  add column article_group_id uuid,
  add constraint article_article_group_fkey foreign key (article_group_id, company_id)
    references core.article_group (id, company_id);
create index article_article_group_id_idx on core.article (article_group_id);
