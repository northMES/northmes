-- migration: expand
-- Managing users, roles and role assignments (ADR 0010): the default roles of the modules, a
-- version on core.role, the rights core's commands write roles and assignments with, and the views
-- through which nm_app reads users.

-- Every change to a role bumps its version, which a change sends as expectedVersion (ADR 0012).
alter table core.role add column version integer not null default 1;

create function core.role_bump_version() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger bump_version before update on core.role
  for each row execute function core.role_bump_version();

-- A custom role's name is unique within its company, ignoring case. Default roles are left out, so
-- a module that adds a default role never clashes with a custom role that has its name; the
-- commands refuse a custom role with the name of any role of the company.
create unique index role_custom_name_key on core.role (company_id, lower(name))
  where origin = 'custom';

-- northmes migrate writes the default roles that the installed modules declare, as it writes
-- core.permission. A role no installed module declares any more stays with installed false, and the
-- companies keep their copies of it.
create table core.default_role (
  key text primary key check (key ~ '^[a-z][a-z0-9-]*$'),
  module_id text not null,
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  permissions text[] not null default '{}',
  installed boolean not null default true
);
comment on column core.default_role.key is
  'The role key, such as core-company-admin, that names a default role in every company. Not a secret.';

-- A new company gets a role of origin module for each installed default role. northmes migrate
-- gives the companies that exist the roles of a module installed later.
create function core.company_default_roles() returns trigger
  language plpgsql
as $$
begin
  insert into core.role (company_id, key, name, permissions, origin, module_id)
  select new.id, d.key, d.name, d.permissions, 'module', d.module_id
    from core.default_role d
   where d.installed
  on conflict (company_id, key) do nothing;
  return new;
end;
$$;
create trigger default_roles after insert on core.company
  for each row execute function core.company_default_roles();

-- core's commands write roles and assignments as nm_app, and each checks the principal's
-- permission at the company or at the scope it writes at. Every module and in-process plugin
-- shares nm_app (ADR 0008), so row-level security keeps a write outside the transaction's write
-- scopes out: a role at its company, an assignment at its scope. A company admin at a plant writes
-- the company and the plant, a plant admin the plant only. A transaction reads the roles of the
-- company in its read scopes only; the server reads a user's grants once per request, before it
-- knows the request's scopes, through core.principal_grants below. Assignments stay readable
-- without scopes: they name a user, a scope and a role, and no permission.
grant select on core.default_role to nm_app;
grant insert, update, delete on core.role to nm_app;
grant insert, delete on core.role_assignment to nm_app;

-- The default roles are the modules' catalog, like core.permission, the same for every company:
-- nm_app reads them all and writes none, since only northmes migrate writes them as core's owner.
alter table core.default_role enable row level security;
create policy catalog_select on core.default_role for select to nm_app using (true);

alter table core.role enable row level security;
create policy scope_select on core.role for select to nm_app
  using (company_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.role for insert to nm_app
  with check (company_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on core.role for update to nm_app
  using      (company_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (company_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.role for delete to nm_app
  using (company_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

-- nm_app has no UPDATE on assignments, so they need no update policy.
alter table core.role_assignment enable row level security;
create policy principal_select on core.role_assignment for select to nm_app using (true);
create policy scope_insert on core.role_assignment for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.role_assignment for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

-- nm_app reads users only through these views, which run with its own rights: the columns a list
-- of users shows and the organization memberships (ADR 0010). It has no right on auth.account,
-- auth.session or any other column of auth.user.
grant usage on schema auth to nm_app;
grant select (id, name, username, banned) on auth."user" to nm_app;
grant select ("organizationId", "userId") on auth.member to nm_app;

-- A user without a username, which only a user created outside NorthMES has, reads as ''.
create view core.user_directory with (security_invoker = true) as
  select id, name, coalesce(username, '') as username, coalesce(banned, false) as banned
    from auth."user";

-- The users of a company: the members of its Better Auth organization, which core's createUser
-- adds a user to, and every user who holds a role of the company.
create view core.company_user with (security_invoker = true) as
  select c.id as company_id, m."userId" as user_id
    from auth.member m
    join core.company c on c.organization_id = m."organizationId"
  union
  select company_id, user_id from core.role_assignment;

grant select on core.user_directory, core.company_user to nm_app;

-- What core reads across companies, before or outside the request's scopes, it reads through these
-- functions. Each runs as core's owner role, which the policies do not bind (ADR 0008), with a
-- pinned search_path, and answers only what its caller needs. They are on the definer allowlist.

-- The grants of a user (ADR 0010): one row per scope node of the companies where the user holds a
-- role, with its parent, the plant's slug for a plant node, and the installed permissions of the
-- roles assigned to the user at the node. PrincipalService resolves the principal from it.
create function core.principal_grants(p_user_id uuid)
  returns table (id uuid, parent_id uuid, slug text, permissions text[])
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
as $$
  with assigned as (
    select a.scope_id, r.permissions
      from core.role_assignment a
      join core.role r on r.id = a.role_id
     where a.user_id = p_user_id
  )
  select s.id, s.parent_id, pl.slug,
         coalesce(
           (select array_agg(distinct p.key order by p.key)
              from assigned x
              cross join lateral unnest(x.permissions) as held (key)
              join core.permission p on p.key = held.key and p.installed
             where x.scope_id = s.id),
           '{}'
         ) as permissions
    from core.scope s
    left join core.plant pl on pl.id = s.id
   where s.company_id in (
           select c.company_id from core.scope c join assigned x on x.scope_id = c.id
         )
$$;

-- The companies where the user holds core's Company admin role (core-company-admin, the
-- companyAdminRoleKey of core's permissions.ts) at the company node, in the order of their ids,
-- which the last-admin rule locks them in. A block holds in every company of the user, so the rule
-- checks companies outside the request's scopes.
create function core.company_admin_companies(p_user_id uuid)
  returns setof uuid
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
as $$
  select distinct r.company_id
    from core.role_assignment a
    join core.role r on r.id = a.role_id
   where a.user_id = p_user_id
     and r.origin = 'module' and r.key = 'core-company-admin'
     and a.scope_id = r.company_id
   order by r.company_id
$$;

-- The number of users other than p_user_id who are not blocked and hold Company admin at the
-- company node of the company.
create function core.other_active_company_admins(p_company_id uuid, p_user_id uuid)
  returns bigint
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
as $$
  select count(distinct a.user_id)
    from core.role_assignment a
    join core.role r on r.id = a.role_id
    join auth."user" u on u.id = a.user_id
   where r.company_id = p_company_id
     and r.origin = 'module' and r.key = 'core-company-admin'
     and a.scope_id = r.company_id
     and not coalesce(u.banned, false)
     and a.user_id <> p_user_id
$$;

revoke all on function core.principal_grants(uuid), core.company_admin_companies(uuid),
  core.other_active_company_admins(uuid, uuid) from public;
grant execute on function core.principal_grants(uuid), core.company_admin_companies(uuid),
  core.other_active_company_admins(uuid, uuid) to nm_app;
