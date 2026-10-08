-- migration: expand
-- Written by pnpm gen:migration. Add the table's own columns after version, and keep the four
-- policies, one per command, as they are (ADR 0008).
create table planning.production_order (
  id uuid primary key default uuidv7(),
  scope_id uuid not null,
  version integer not null default 1,
  number text not null,
  -- core grants nm_ext references (id) on core.article.
  article_id uuid not null references core.article (id),
  quantity numeric(18, 6) not null,
  status text not null default 'planned' check (status in ('planned', 'released'))
);
create index production_order_scope_id_idx on planning.production_order (scope_id);

-- Every update bumps version, also one that plain SQL makes (ADR 0006).
create function planning.production_order_bump_version() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger bump_version before update on planning.production_order
  for each row execute function planning.production_order_bump_version();

alter table planning.production_order enable row level security;
create policy scope_select on planning.production_order for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on planning.production_order for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on planning.production_order for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on planning.production_order for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

grant select, insert, update, delete on planning.production_order to nm_app;
