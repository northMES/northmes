-- migration: expand
-- The failed sign-ins in a row per email, which the sign-in-lockout plugin in
-- infrastructure/auth/sign-in-lockout.ts counts to lock an account (#476). Better Auth's own pool
-- reads and writes it as nm_auth; nm_app gets nothing (ADR 0010).
create table "auth"."signInFailure" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "key" text not null unique, "count" integer not null, "lastFailure" bigint not null);

grant select, insert, update, delete on auth."signInFailure" to nm_auth;
