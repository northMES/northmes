-- migration: expand
-- Written by pnpm gen:migration --register. A register row sits at its company's node or at a
-- plant's (ADR 0007), and its code is unique per scope (ADR 0009). Add the register's own columns
-- after translations, and keep the code rule, the four policies, one per command (ADR 0008), and
-- the grants as they are.
create table production_start.tool (
  id uuid primary key default uuidv7(),
  company_id uuid not null,
  -- The row's scope node and that node's span, which the foreign key below keeps in step.
  scope_id uuid not null,
  scope_span int8range not null,
  version integer not null default 1,
  code text not null
    constraint tool_code_check check (code = btrim(code) and length(code) between 1 and 32),
  -- Codes compare without case. Stored, because Postgres cannot index a virtual column.
  code_key text generated always as (lower(code)) stored,
  name text not null
    constraint tool_name_check check (name = btrim(name) and length(name) between 1 and 200),
  -- The translations of the name (ADR 0053).
  translations jsonb not null default '[]'
    constraint tool_translations_check check (jsonb_typeof(translations) = 'array'),
  -- A row is archived, never deleted, and keeps its code.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tool_scope_fkey foreign key (scope_id, company_id, scope_span)
    references core.scope (id, company_id, span) on update cascade,
  -- Two rows of the company clash when their codes match and their spans overlap: two rows at one
  -- scope, or a plant row and a company row; two plants never clash. toDomainError maps a
  -- violation of a constraint whose name ends in _code_excl to core.code_taken.
  constraint tool_code_excl
    exclude using gist (company_id with =, code_key with =, scope_span with &&)
);
-- The default order of a register's list, by code with id as the tie-breaker (ADR 0016).
create index tool_scope_code_idx on production_start.tool (scope_id, code, id);
-- A lookup by code, which stays index-backed under row-level security (ADR 0009).
create index tool_scope_code_key_idx on production_start.tool (scope_id, code_key);

-- Every update bumps version and moves updated_at on, also one that plain SQL makes (ADR 0006).
create function production_start.tool_touch() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch before update on production_start.tool
  for each row execute function production_start.tool_touch();

alter table production_start.tool enable row level security;
create policy scope_select on production_start.tool for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on production_start.tool for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on production_start.tool for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on production_start.tool for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

grant select, insert, update, delete on production_start.tool to nm_app;
