-- migration: expand
-- One row per article event the plugin logged. The plugin's consumers write it in the
-- transaction the host opens at the event's scope, so a row sits at the article's edit scope.
create table example_article_log.entry (
  event_id uuid primary key,
  event text not null,
  article_id uuid not null,
  article_version bigint not null,
  scope_id uuid not null,
  code text not null,
  name text not null,
  logged_at timestamptz not null default now()
);

-- nm_app reads and writes entries only at its scopes (ADR 0008).
alter table example_article_log.entry enable row level security;
create policy scope_select on example_article_log.entry for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on example_article_log.entry for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
grant select, insert on example_article_log.entry to nm_app;
