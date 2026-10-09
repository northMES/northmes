-- migration: expand
-- Written by pnpm --filter @northmes/backend gen:auth-migration from Better Auth's options in
-- infrastructure/auth/auth-options.ts. Better Auth's tables live in the auth schema, which migrate
-- creates owned by nm_mod_core; Better Auth's own pool logs in as nm_auth (ADR 0010).
create table "auth"."user" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "username" text unique, "displayUsername" text, "role" text, "banned" boolean, "banReason" text, "banExpires" timestamptz);

create table "auth"."session" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" uuid not null references "auth"."user" ("id") on delete cascade, "activeOrganizationId" text, "impersonatedBy" text);

create table "auth"."account" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "accountId" text not null, "providerId" text not null, "userId" uuid not null references "auth"."user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "auth"."verification" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "auth"."organization" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "name" text not null, "slug" text not null unique, "logo" text, "createdAt" timestamptz not null, "metadata" text);

create table "auth"."member" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "organizationId" uuid not null references "auth"."organization" ("id") on delete cascade, "userId" uuid not null references "auth"."user" ("id") on delete cascade, "role" text not null, "createdAt" timestamptz not null);

create table "auth"."invitation" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "organizationId" uuid not null references "auth"."organization" ("id") on delete cascade, "email" text not null, "role" text, "status" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "inviterId" uuid not null references "auth"."user" ("id") on delete cascade);

create table "auth"."apikey" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "configId" text not null, "name" text, "start" text, "referenceId" text not null, "prefix" text, "key" text not null, "refillInterval" integer, "refillAmount" integer, "lastRefillAt" timestamptz, "enabled" boolean, "rateLimitEnabled" boolean, "rateLimitTimeWindow" integer, "rateLimitMax" integer, "requestCount" integer, "remaining" integer, "lastRequest" timestamptz, "expiresAt" timestamptz, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, "permissions" text, "metadata" text);

create table "auth"."jwks" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "publicKey" text not null, "privateKey" text not null, "createdAt" timestamptz not null, "expiresAt" timestamptz, "alg" text, "crv" text);

create table "auth"."rateLimit" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "session_userId_idx" on "auth"."session" ("userId");

create index "account_userId_idx" on "auth"."account" ("userId");

create index "verification_identifier_idx" on "auth"."verification" ("identifier");

create index "member_organizationId_idx" on "auth"."member" ("organizationId");

create index "member_userId_idx" on "auth"."member" ("userId");

create index "invitation_organizationId_idx" on "auth"."invitation" ("organizationId");

create index "invitation_email_idx" on "auth"."invitation" ("email");

create index "apikey_configId_idx" on "auth"."apikey" ("configId");

create index "apikey_referenceId_idx" on "auth"."apikey" ("referenceId");

create index "apikey_key_idx" on "auth"."apikey" ("key");

grant usage on schema auth to nm_auth;
grant select, insert, update, delete on all tables in schema auth to nm_auth;
