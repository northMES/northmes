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
-- organizations and core.plant arrive with the plant switcher. A node's parent is in the node's
-- company, and only a company node has its own id as company_id.
create table core.scope (
  id uuid primary key default uuidv7(),
  company_id uuid not null,
  parent_id uuid,
  kind text not null check (kind in ('company', 'plant')),
  span int8range not null,
  unique (id, company_id),
  unique (id, company_id, span),
  foreign key (parent_id, company_id) references core.scope (id, company_id),
  constraint scope_root_check check ((kind = 'company') = (parent_id is null)),
  constraint scope_company_check check ((kind = 'company') = (id = company_id))
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
-- module; a company admin's role has origin custom. The foreign key on (company_id, company_id)
-- finds only a company node, the one node whose id is its company_id.
create table core.role (
  id uuid primary key default uuidv7(),
  company_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9-]*$'),
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  permissions text[] not null default '{}',
  origin text not null check (origin in ('module', 'custom')),
  module_id text,
  unique (company_id, key),
  unique (id, company_id),
  foreign key (company_id, company_id) references core.scope (id, company_id),
  constraint role_module_check check ((origin = 'module') = (module_id is not null))
);

-- A user holds a role at a scope node, and with it every permission of the role at that node and
-- below. A user is never deleted while an assignment names them (ADR 0010). The role and the scope
-- node are of the assignment's company, so a role of one company grants nothing at another.
create table core.role_assignment (
  id uuid primary key default uuidv7(),
  user_id uuid not null references auth."user" (id) on delete restrict,
  company_id uuid not null,
  scope_id uuid not null,
  role_id uuid not null,
  unique (user_id, scope_id, role_id),
  foreign key (scope_id, company_id) references core.scope (id, company_id) on delete restrict,
  foreign key (role_id, company_id) references core.role (id, company_id) on delete restrict
);
create index role_assignment_scope_id_idx on core.role_assignment (scope_id);
create index role_assignment_role_id_idx on core.role_assignment (role_id);

grant select on core.scope, core.permission, core.role, core.role_assignment to nm_app;
