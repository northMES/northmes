-- migration: expand
-- A tab of the dashboard (ADR 0078, design shell-454). A shared tab has no owner and sits at the
-- company or at a plant; a user's own tab has an owner and sits at the owner's company, so it
-- shows at every plant of the company. The layout is one array of widgets, which core's service
-- validates as it reads and writes it.
create table core.dashboard_tab (
  id uuid primary key default uuidv7(),
  scope_id uuid not null,
  company_id uuid not null,
  version integer not null default 1,
  owner_id uuid references auth."user" (id) on delete restrict,
  name text not null
    constraint dashboard_tab_name_check check (name = btrim(name) and length(name) between 1 and 80),
  -- The tab's place among the tabs of its kind: the company's, the plant's or the owner's.
  position integer not null,
  widgets jsonb not null default '[]'
    constraint dashboard_tab_widgets_check check (jsonb_typeof(widgets) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_tab_scope_fkey foreign key (scope_id, company_id)
    references core.scope (id, company_id),
  constraint dashboard_tab_owner_check check (owner_id is null or scope_id = company_id)
);
create index dashboard_tab_scope_id_idx on core.dashboard_tab (scope_id, position, id);
create index dashboard_tab_owner_id_idx on core.dashboard_tab (owner_id);

-- Every update bumps version and moves updated_at on, also one that plain SQL makes (ADR 0006).
create function core.dashboard_tab_touch() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch before update on core.dashboard_tab
  for each row execute function core.dashboard_tab_touch();

-- The scope policies of ADR 0008, with northmes.user_id for own tabs (ADR 0078): a transaction
-- reads the shared tabs of its read scopes and its own user's tabs, and writes a shared tab in its
-- write scopes or an own tab of its user in its read scopes, so a viewer keeps tabs of their own.
-- Without a user, nullif turns the setting into null, which equals no owner.
alter table core.dashboard_tab enable row level security;
create policy scope_select on core.dashboard_tab for select to nm_app
  using (
    scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[])
    and (owner_id is null
      or owner_id = (select nullif(current_setting('northmes.user_id', true), ''))::uuid)
  );
create policy scope_insert on core.dashboard_tab for insert to nm_app
  with check (
    (owner_id is null
      and scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
    or (owner_id = (select nullif(current_setting('northmes.user_id', true), ''))::uuid
      and scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]))
  );
create policy scope_update on core.dashboard_tab for update to nm_app
  using (
    (owner_id is null
      and scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
    or (owner_id = (select nullif(current_setting('northmes.user_id', true), ''))::uuid
      and scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]))
  )
  with check (
    (owner_id is null
      and scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
    or (owner_id = (select nullif(current_setting('northmes.user_id', true), ''))::uuid
      and scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]))
  );
create policy scope_delete on core.dashboard_tab for delete to nm_app
  using (
    (owner_id is null
      and scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
    or (owner_id = (select nullif(current_setting('northmes.user_id', true), ''))::uuid
      and scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]))
  );

grant select, insert, update, delete on core.dashboard_tab to nm_app;
