-- migration: expand
-- Written by pnpm gen:migration. Add the table's own columns after version, and keep the four
-- policies, one per command, as they are (ADR 0008).
create table {{schema}}.{{table}} (
  id uuid primary key default uuidv7(),
  scope_id uuid not null,
  version integer not null default 1
);
create index {{table}}_scope_id_idx on {{schema}}.{{table}} (scope_id);

-- Every update bumps version, also one that plain SQL makes (ADR 0006).
create function {{schema}}.{{table}}_bump_version() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger bump_version before update on {{schema}}.{{table}}
  for each row execute function {{schema}}.{{table}}_bump_version();

alter table {{schema}}.{{table}} enable row level security;
create policy scope_select on {{schema}}.{{table}} for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on {{schema}}.{{table}} for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on {{schema}}.{{table}} for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on {{schema}}.{{table}} for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

grant select, insert, update, delete on {{schema}}.{{table}} to nm_app;
