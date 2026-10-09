-- migration: expand
-- Companies and plants (ADR 0007, ADR 0066). A company is a Better Auth organization, which
-- core.company links to the company's node in core.scope; a plant is core.plant at a plant node,
-- with the slug that names it in the web's URLs and in x-northmes-plant.
--
-- Like core.scope, these tables carry no row-level security policies: the server reads them once
-- per request to resolve the principal and check its plant, before it knows the request's scopes.
-- Their entries on the policy allowlist arrive with the catalog lint (E05-S04).

-- The kind of a node joins the key a company or a plant points at, so a company row names a
-- company node and a plant row a plant node.
alter table core.scope add constraint scope_id_company_id_kind_key unique (id, company_id, kind);

-- The name is what NorthMES shows: nm_app reads nothing in the auth schema, so the organization's
-- name is not readable to the server's queries.
create table core.company (
  id uuid primary key,
  organization_id uuid not null unique references auth.organization (id) on delete restrict,
  name text not null check (name = btrim(name) and length(name) between 1 and 120),
  kind text not null default 'company' check (kind = 'company'),
  foreign key (id, id, kind) references core.scope (id, company_id, kind) on delete restrict
);

-- A plant's id is its node's id. Its slug is unique per installation (ADR 0066) and follows
-- plantSlug in core's contracts: lower-case words joined by single hyphens, at most 40
-- characters, none of the first path segments the server and the web reserve.
create table core.plant (
  id uuid primary key,
  company_id uuid not null references core.company (id) on delete restrict,
  slug text not null unique
    check (
      slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and length(slug) <= 40
      and slug not in (
        'api', 'graphql', 'mcp', 'health', 'modules', 'assets', 'station', 'settings', 'admin',
        'sign-in'
      )
    ),
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  kind text not null default 'plant' check (kind = 'plant'),
  foreign key (id, company_id, kind) references core.scope (id, company_id, kind)
    on delete restrict
);
create index plant_company_id_idx on core.plant (company_id);

grant select on core.company, core.plant to nm_app;
