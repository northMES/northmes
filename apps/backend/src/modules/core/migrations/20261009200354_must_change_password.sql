-- migration: expand
-- A password that an admin sets is temporary (ADR 0051 rule 13): Better Auth's additional field
-- mustChangePassword in auth-options.ts marks its user until they set a new password. The
-- principal reads the mark through core.user_directory and refuses every request of a marked user
-- with core.password_change_required. No GraphQL type exposes it.
alter table auth."user" add column "mustChangePassword" boolean not null default false;

grant select ("mustChangePassword") on auth."user" to nm_app;

create or replace view core.user_directory with (security_invoker = true) as
  select id, name, coalesce(username, '') as username, coalesce(banned, false) as banned,
         "mustChangePassword" as must_change_password
    from auth."user";
