-- migration: expand
-- Row-level security on the scope tree and the companies (ADR 0008, security audit 2026-10-11
-- finding B9). Since 20261014193000_company_admin_cli.sql nm_app may insert into both tables, and
-- every in-process plugin writes as nm_app (ADR 0037), so the database keeps a new company or a new
-- node to the companies among the transaction's write scopes: northmes company create writes with
-- the new company as its only write scope, and a plugin acting at one company cannot add a node to
-- another company's tree or a company of its own.
--
-- Reads stay open: the server reads both tables once per request to resolve the principal and
-- check its plant, before it knows the request's scopes (20261009091022_plant.sql), as the
-- principal_select policy of core.role_assignment does. Scoping those reads is the rest of #483.
-- nm_app has no UPDATE or DELETE on either table, so they need no policies for those commands.
alter table core.scope enable row level security;
create policy principal_select on core.scope for select to nm_app using (true);
create policy scope_insert on core.scope for insert to nm_app
  with check (company_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

alter table core.company enable row level security;
create policy principal_select on core.company for select to nm_app using (true);
create policy scope_insert on core.company for insert to nm_app
  with check (id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
