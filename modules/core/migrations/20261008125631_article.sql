-- migration: expand
-- Written by pnpm gen:migration. Add the table's own columns after version, and keep the four
-- policies, one per command, as they are (ADR 0008).
create table core.article (
  id uuid primary key default uuidv7(),
  scope_id uuid not null,
  version integer not null default 1,
  code text not null,
  name text not null
);
create index article_scope_id_idx on core.article (scope_id);

-- Every update bumps version, also one that plain SQL makes (ADR 0006).
create function core.article_bump_version() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger bump_version before update on core.article
  for each row execute function core.article_bump_version();

alter table core.article enable row level security;
create policy scope_select on core.article for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.article for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on core.article for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.article for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

grant select, insert, update, delete on core.article to nm_app;

-- Other modules may point at an article by foreign key. Granting REFERENCES is core's decision, and
-- nm_ext holds every module and plugin owner role (ADR 0006).
grant references (id) on core.article to nm_ext;
