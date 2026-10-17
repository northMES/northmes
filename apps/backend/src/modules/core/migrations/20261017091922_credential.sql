-- migration: expand
-- The credentials of principals that are not people (ADR 0073 section 5): in release 1 the
-- integration tokens a Company admin creates. Better Auth's api-key plugin holds the key, as a
-- SHA-256 hash in auth.apikey; this row holds what NorthMES knows of the token: its name, where it
-- is bound, its roles there, who created it, its expiry, its revocation and when it was last used.
-- A revoke deletes the key and keeps this row for the audit trail (ADR 0010), so rows are never
-- deleted.
create table core.credential (
  id uuid primary key default uuidv7(),
  -- The company's node: a credential belongs to its company (ADR 0008).
  scope_id uuid not null,
  version integer not null default 1,
  kind text not null constraint credential_kind_check check (kind in ('integration')),
  name text not null
    constraint credential_name_check check (name = btrim(name) and length(name) between 1 and 80),
  -- The company node or one plant node, where the token holds its roles (ADR 0073).
  binding_scope_id uuid not null,
  -- The roles of the company that the token holds at its binding, each once.
  role_ids uuid[] not null
    constraint credential_role_ids_check check (cardinality(role_ids) between 1 and 20),
  -- The id of the key in auth.apikey, which a revoke deletes; the id stays.
  key_id uuid not null constraint credential_key_id_key unique,
  created_by uuid not null references auth."user" (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth."user" (id) on delete restrict,
  last_used_at timestamptz,
  -- The foreign key on (scope_id, scope_id) finds only a company node, the one node whose id is
  -- its company_id; the binding is a node of the same company.
  constraint credential_company_fkey foreign key (scope_id, scope_id)
    references core.scope (id, company_id),
  constraint credential_binding_fkey foreign key (binding_scope_id, scope_id)
    references core.scope (id, company_id),
  constraint credential_expiry_check check (expires_at > created_at),
  constraint credential_revoked_check check ((revoked_at is null) = (revoked_by is null))
);
create index credential_scope_id_idx on core.credential (scope_id);

-- Every update bumps version, also one that plain SQL makes (ADR 0006), except the resolver's
-- write of last_used_at alone: a token in use would otherwise make every revoke of it stale.
create function core.credential_bump_version() returns trigger
  language plpgsql
as $$
begin
  if (to_jsonb(new) - 'last_used_at' - 'version') is distinct from
     (to_jsonb(old) - 'last_used_at' - 'version') then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;
create trigger bump_version before update on core.credential
  for each row execute function core.credential_bump_version();

alter table core.credential enable row level security;
create policy scope_select on core.credential for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.credential for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on core.credential for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.credential for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

-- No DELETE: a revoked credential stays for the audit trail.
grant select, insert, update on core.credential to nm_app;

-- The credential resolver reads a token's credential before it knows the request's scopes, as the
-- principal of a user is read through core.principal_grants. Both functions run as core's owner
-- role, which the policies do not bind (ADR 0008), with a pinned search_path, and answer a live
-- credential only: not revoked and not expired.

-- The live integration credential of an api-key, which the resolver calls once Better Auth has
-- verified the secret. It also writes last_used_at, at most once a minute per credential.
create function core.use_integration_credential(p_key_id uuid)
  returns table (id uuid, scope_id uuid, binding_scope_id uuid, name text, expires_at timestamptz)
  language sql volatile security definer
  set search_path = pg_catalog, pg_temp
as $$
  with live as (
    select c.id, c.scope_id, c.binding_scope_id, c.name, c.expires_at, c.last_used_at
      from core.credential c
     where c.key_id = p_key_id
       and c.kind = 'integration'
       and c.revoked_at is null
       and c.expires_at > now()
  ), touched as (
    update core.credential c
       set last_used_at = now()
      from live
     where c.id = live.id
       and (live.last_used_at is null or live.last_used_at <= now() - interval '1 minute')
  )
  select live.id, live.scope_id, live.binding_scope_id, live.name, live.expires_at from live
$$;

-- The grants of a live credential, in the shape of core.principal_grants: one row per scope node
-- of its company, with its parent, the plant's slug for a plant node, and at the binding node the
-- installed permissions of the credential's roles. No other node grants anything.
create function core.credential_grants(p_credential_id uuid)
  returns table (id uuid, parent_id uuid, slug text, permissions text[])
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
as $$
  select s.id, s.parent_id, pl.slug,
         case when s.id = c.binding_scope_id then
           coalesce(
             (select array_agg(distinct p.key order by p.key)
                from core.role r
                cross join lateral unnest(r.permissions) as held (key)
                join core.permission p on p.key = held.key and p.installed
               where r.id = any (c.role_ids) and r.company_id = c.scope_id),
             '{}'
           )
         else '{}' end as permissions
    from core.credential c
    join core.scope s on s.company_id = c.scope_id
    left join core.plant pl on pl.id = s.id
   where c.id = p_credential_id
     and c.revoked_at is null
     and c.expires_at > now()
$$;

revoke all on function core.use_integration_credential(uuid), core.credential_grants(uuid)
  from public;
grant execute on function core.use_integration_credential(uuid), core.credential_grants(uuid)
  to nm_app;
