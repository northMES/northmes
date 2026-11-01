-- migration: expand
-- Equipment, the machines of a plant: a register at plant scope only (ADR 0007), whose code is
-- unique within the plant and the company (ADR 0009). Written by pnpm gen:migration --register,
-- with the machine's group, flags and own color added.
create table core.equipment (
  id uuid primary key default uuidv7(),
  company_id uuid not null,
  -- The row's scope node and that node's span, which the foreign key below keeps in step.
  scope_id uuid not null,
  scope_span int8range not null,
  version integer not null default 1,
  code text not null
    constraint equipment_code_check check (code = btrim(code) and length(code) between 1 and 32),
  -- Codes compare without case. Stored, because Postgres cannot index a virtual column.
  code_key text generated always as (lower(code)) stored,
  name text not null
    constraint equipment_name_check check (name = btrim(name) and length(name) between 1 and 200),
  -- The translations of the name (ADR 0053).
  translations jsonb not null default '[]'
    constraint equipment_translations_check check (jsonb_typeof(translations) = 'array'),
  -- The machine's equipment group, of its plant or of the company: the service refuses another
  -- plant's group with core.crossScopeReference (ADR 0009). Archiving the group keeps it.
  equipment_group_id uuid not null
    constraint equipment_equipment_group_fkey references core.equipment_group (id),
  -- Planners plan job orders on a plannable machine; an OEE machine is measured. Either puts the
  -- machine on the planning board.
  is_plannable boolean not null default true,
  is_oee boolean not null default false,
  -- The machine's own palette color for its stripe, or null for the group's.
  color text
    constraint equipment_color_check check (color ~ '^palette-([1-9]|1[0-9]|20)$'),
  -- A row is archived, never deleted, and keeps its code.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A machine sits at a plant, never at the company's node.
  constraint equipment_plant_check check (scope_id <> company_id),
  constraint equipment_scope_fkey foreign key (scope_id, company_id, scope_span)
    references core.scope (id, company_id, span) on update cascade,
  -- Two rows of the company clash when their codes match and their spans overlap: two rows at one
  -- scope, or a plant row and a company row; two plants never clash. toDomainError maps a
  -- violation of a constraint whose name ends in _code_excl to core.code_taken.
  constraint equipment_code_excl
    exclude using gist (company_id with =, code_key with =, scope_span with &&)
);
-- The default order of a register's list, by code with id as the tie-breaker (ADR 0016).
create index equipment_scope_code_idx on core.equipment (scope_id, code, id);
-- A lookup by code, which stays index-backed under row-level security (ADR 0009).
create index equipment_scope_code_key_idx on core.equipment (scope_id, code_key);
-- The machines of a group, for the list's group filter and the foreign key.
create index equipment_equipment_group_idx on core.equipment (equipment_group_id);

-- Every update bumps version and moves updated_at on, also one that plain SQL makes (ADR 0006).
create function core.equipment_touch() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch before update on core.equipment
  for each row execute function core.equipment_touch();

alter table core.equipment enable row level security;
create policy scope_select on core.equipment for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.equipment for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on core.equipment for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.equipment for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

grant select, insert, update, delete on core.equipment to nm_app;
