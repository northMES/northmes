-- migration: expand
-- The scope tree (ADR 0007), the permission catalog, roles and role assignments (ADR 0010).
--
-- These tables carry no row-level security policies. The server reads them once per request to
-- resolve the principal, before it knows the request's scopes, and they hold authorization facts,
-- not plant data. nm_app reads them; roles and assignments change through core's commands later.
-- Their entries on the policy allowlist arrive with the catalog lint (E05-S04).

-- A company is the root of its tree and plants are its children; areas and lines may join below
-- plants later. A company's span is unbounded, and plant number k gets [k << 32, (k + 1) << 32),
-- which code uniqueness and cross-scope references use (ADR 0009). Companies as Better Auth
-- organizations and core.plant arrive with the plant switcher.
create table core.scope (
  id uuid primary key default uuidv7(),
  company_id uuid not null,
  parent_id uuid references core.scope (id),
  kind text not null check (kind in ('company', 'plant')),
  span int8range not null,
  unique (id, company_id, span),
  constraint scope_root_check check ((kind = 'company') = (parent_id is null)),
  constraint scope_company_check check (kind <> 'company' or id = company_id)
);
create index scope_company_id_idx on core.scope (company_id);
create index scope_parent_id_idx on core.scope (parent_id);

-- northmes migrate writes the catalog from the permissions the installed modules declare. A key no
-- installed module declares stays with installed false, so a role that holds it keeps it.
create table core.permission (
  key text primary key
    check (key ~ '^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+:[a-z][A-Za-z0-9]*$'),
  module_id text not null,
  installed boolean not null default true
);

-- A role belongs to a company and holds permission keys. A module's default role has origin
-- module; a company admin's role has origin custom.
create table core.role (
  id uuid primary key default uuidv7(),
  company_id uuid not null references core.scope (id),
  key text not null check (key ~ '^[a-z][a-z0-9-]*$'),
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  permissions text[] not null default '{}',
  origin text not null check (origin in ('module', 'custom')),
  module_id text,
  unique (company_id, key),
  constraint role_module_check check ((origin = 'module') = (module_id is not null))
);

-- A user holds a role at a scope node, and with it every permission of the role at that node and
-- below. A user is never deleted while an assignment names them (ADR 0010).
create table core.role_assignment (
  id uuid primary key default uuidv7(),
  user_id uuid not null references auth."user" (id) on delete restrict,
  scope_id uuid not null references core.scope (id) on delete restrict,
  role_id uuid not null references core.role (id) on delete restrict,
  unique (user_id, scope_id, role_id)
);
create index role_assignment_scope_id_idx on core.role_assignment (scope_id);
create index role_assignment_role_id_idx on core.role_assignment (role_id);

grant select on core.scope, core.permission, core.role, core.role_assignment to nm_app;
