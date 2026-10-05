---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 18, 22, 24 and 32
informed: product owner, module and plugin authors
release: "1"
needs-confirmation: "product owner (who edits and assigns roles); maintainer (operator placeholder email)"
---

# Identity with Better Auth, roles and permissions in core tables

## Context and problem statement

Krister Johansson decided that Better Auth handles identity and sessions, that roles apply per plant, that company admins create custom roles from module permissions, that operators sign in by personal login or by badge at a station, and that MCP agents act as the user. Better Auth's organization plugin models a company well, but it has no scope below the organization: a role cannot be held at one plant. Its dynamic access control also rejects a role payload whose resource keys were not in the boot-time statement, so a role that keeps the permissions of an uninstalled plugin could no longer be edited.

This ADR decides what Better Auth stores and what NorthMES core tables store, how `can()` evaluates a permission at a scope, how the plant of a request is validated, how fast a revoked role takes effect, and how operators exist as users. It covers the core auth module, `core.role`, `core.role_assignment`, `core.permission`, `core.credential`, `core.badge_assignment`, `core.retired_username`, the gateway's principal plugin and the command pipeline's permission step. Surfaces, credential types and same-origin rules are in [ADR 0011](0011-principals-credentials-and-same-origin-rules.md); the station design is in [ADR 0033](0033-online-operator-station-in-the-production-start-module.md).

## Decision drivers

* Roles held at a plant or at the company, checked by one function for every kind of principal.
* Module manifests own their permissions and default roles; installing or removing a plugin must not break role editing.
* Better Auth ships breaking changes in minor releases, and its advisory list showed 32 advisories between 2025-10-04 and 2026-10-04 (3 critical). The plugin set must stay small and upgrades deliberate.
* A removed role or a banned user takes effect on the next request, not after a long cache lifetime.
* Regulated readiness rules: operators are full users, a username is never reassigned, badge assignments are dated, and a password an administrator sets is temporary ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)).
* Permission is checked at the scope of the row a command changes, not only at the request's plant.

## Considered options

* Better Auth for identity, sessions, organization membership and key secrets; roles, assignments, the permission catalog and credential bindings in NorthMES core tables
* Better Auth's organization plugin with dynamic access control for role definitions, plus a NorthMES plant membership table for assignments
* Better Auth teams as plants

## Decision outcome

Chosen option: "Better Auth for identity, sessions, organization membership and key secrets; roles, assignments, the permission catalog and credential bindings in NorthMES core tables", because Better Auth cannot scope a role below the organization, so NorthMES would write the evaluation, the cache and the grant rules for plant roles in any case.

Better Auth configuration:

* `better-auth` 1.7.x, pinned exactly. An upgrade reads the release notes, generates the schema migration and passes the drift test.
* Better Auth keeps users, accounts, sessions, organization membership (`member.role` is only `owner` or `member`) and API key secrets.
* Plugins: username (email or username plus password), organization, admin (used only through server-side `auth.api` calls from NorthMES commands; its HTTP paths are disabled, [ADR 0011](0011-principals-credentials-and-same-origin-rules.md)) and api-key (station keys and MCP personal access tokens). Dynamic access control and teams are off. Any other plugin is reviewed against its advisory history before it is enabled.
* The built-in Kysely adapter with its own pool as the login role `nm_auth`, `schemaName: "auth"` and uuid ids. Better Auth's SQL is generated into core migrations, and `northmes migrate` applies it.
* A thin core auth module (`toNodeHandler` on `/api/auth/*` and one `PrincipalGuard`) replaces the community NestJS package.
* Database sessions with a cookie cache whose `maxAge` is at most 60 seconds, rate-limit storage in the database, sign-up disabled, `immutableUsername: true`, session cookie `SameSite=Strict`.
* Boot refuses to start when `BETTER_AUTH_TELEMETRY` is set, and the `testUtils` entry point is not in the production image.
* `nm_app` reads names only through the `security_invoker` view `core.user_directory(id, name, username, banned)` and has no access to `auth.account` or `auth.session`.
* Single sign-on through Microsoft Entra ID waits for a customer that asks.

Roles and permissions:

* Core tables: `core.permission` (catalog from installed manifests: key, module id, installed flag), `core.role` (organization, key, name, permissions, origin `module` or `custom`, module id), `core.role_assignment` `(user, scope node, role)` and `core.credential` (credential bindings that audit rows reference, because Better Auth deletes expired keys).
* Permission ids follow `<module>.<entity>:<action>`, for example `planning.productionOrder:release`.
* `can(principal, permission, scopeId)` walks from the scope to the root and checks the principal's assignments on the way. A company role is an assignment at the root node and applies to every plant.
* Modules ship default roles in their manifests; company admins create custom roles from module permissions. Editing roles needs `core.role:manage` at company scope. Assigning a role at scope S needs the assignment permission plus every permission of that role at S. The product owner confirms who may edit and assign roles at which scope.
* The permission catalog and default-role sync run inside `northmes migrate`, not at every boot.
* The principal is resolved once per request in one indexed query.
* The gateway's principal plugin validates `x-northmes-plant` against `core.role_assignment` with the ancestor walk. An unknown or unauthorized plant fails with `FORBIDDEN`, `errorCode` `core.plant_forbidden` and one `permission.denied` security event. No request falls back to a default plant.
* The command pipeline loads the target and calls `can(principal, permission, target.scope_id)`, or uses the requested scope for creates ([ADR 0012](0012-commands-as-the-single-write-path.md)). The field guard on GraphQL types stays a coarse gate.
* `/api/web/modules` returns 401 without a session and 403 for an unauthorized plant. `/modules/**` stays public with immutable caching, because the remotes hold no data. `viewerCanUpdate` on entities waits until a screen needs it.

Permission cache, with one replica in the pilot: invalidated locally when a role transaction commits, with a 30-second TTL as backstop, or no cache at all. A role-assignment change invalidates all of that user's scopes; a `core.role` change invalidates every user of the organization. Subscriptions re-check `can()` per event through the same cache, and sockets close when the session is revoked. There is no authorization epoch table.

Users and operators:

* Every operator is a NorthMES user with a username from the first migration, even when release 1 signs operators in by badge only. Badge and PIN are sign-in methods on that user.
* Better Auth needs a unique email on every user. Operators without one get a placeholder address. The working proposal is an address under the reserved `.invalid` domain; the maintainer confirms the scheme before the first migration.
* A password an administrator sets is temporary and must be changed at the next sign-in.
* Badges are dated records, `core.badge_assignment(user_id, badge_hmac, valid_from, valid_to)`. `badge_hmac` is declared redact for the audit trail, is computed with the `badge-v1` purpose key ([ADR 0047](0047-secrets-and-the-installation-key.md)) and stores its key version.
* A username is never reassigned. `core.retired_username` keeps an HMAC of each retired username, and user creation checks it.
* Foreign keys from core to `auth.user` are `ON DELETE RESTRICT`. The person id is `auth.user.id` everywhere, `acting_for` included.

### Consequences

* Good, because one `can()` serves sessions, station keys, personal access tokens and later OAuth tokens.
* Good, because removing a plugin marks its permissions not installed without breaking roles that hold them.
* Good, because Better Auth's surface is four plugins, and its tables sit in their own schema behind their own login role.
* Bad, because NorthMES owns the role editor, the assignment rules and the cache, which Better Auth would otherwise partly provide.
* Bad, because every Better Auth minor upgrade is a planned migration with a drift test, and on-prem customers need a fast patch path for its advisories.
* Bad, because the permission cache invalidates only in process; a second replica needs a shared invalidation before it runs.
* Neutral, because operators without email carry a placeholder address that no mail can reach.

### Confirmation

* Permission matrix `can.int.test.ts`: a company planner with only a root assignment reads orders at plant A and plant B; a plant B planner updating a company article gets `FORBIDDEN` with `errorCode` `core.forbidden`, never "Unexpected error."; the company planner succeeds and `audit.command.roles` lists the role held at the company.
* Plant header test: a viewer at A with `x-northmes-plant` B gets `FORBIDDEN` `core.plant_forbidden`, data null and one security event with `detail.plant` B.
* Revocation tests: after a planner's role is removed, the next move is `FORBIDDEN` without waiting for the TTL; after a ban, the next request with the cached cookie is `UNAUTHENTICATED` within 60 seconds; an open board subscription receives nothing within 2 seconds after `planning.productionOrder:read` is removed.
* Role administration: a plant A admin calling `coreUpdateRole` on a company role gets `FORBIDDEN`; adding a permission the actor lacks at plant B, where the role is assigned, gets `FORBIDDEN`.
* Users: creating a user with a retired username fails; deleting `auth.user` directly fails with a foreign key violation; no `audit.change` diff contains a badge HMAC; after an admin password reset, sign-in requires a new password before any other request succeeds.
* As `nm_app`, `select` from `auth.account` fails and `select` from `core.user_directory` works.
* Better Auth drift test: apply all migrations to a fresh Testcontainers database, run Better Auth's migration check with the production options and assert that nothing is left to create.
* Boot test: boot exits when `BETTER_AUTH_TELEMETRY` is set; a build check asserts that the production bundle contains no `testUtils` symbol.
* `GET /api/web/modules` without a cookie returns 401, and with plant B for a viewer at A returns 403.

## Pros and cons of the options

### Core tables for roles, Better Auth for identity

* Good, because roles can be held at any scope node and evaluated with one ancestor walk.
* Good, because the permission catalog follows installed manifests without Better Auth's resource validation.
* Bad, because NorthMES writes and tests its own role and assignment commands.

### Dynamic access control plus a plant membership table

* Good, because Better Auth provides role create, update and list endpoints.
* Bad, because plant assignments still need a NorthMES table, evaluation and cache, so Better Auth would hold role definitions only as a JSON column.
* Bad, because a role payload with resource keys not in the boot-time statement is rejected, so editing a role that holds an uninstalled plugin's permissions either fails or drops them.
* Bad, because with dynamic access control on, every check loads all role rows of the organization.

### Teams as plants

* Good, because teams are part of the organization plugin.
* Bad, because a team membership has no role, so a role per plant cannot be expressed.

## More information

* Related ADRs: [0007](0007-tenancy-company-plants-and-the-scope-tree.md) (scope tree), [0008](0008-row-level-security-with-transaction-local-scopes.md) (write scopes from roles), [0011](0011-principals-credentials-and-same-origin-rules.md) (principals, credentials, user management commands, first admin), [0012](0012-commands-as-the-single-write-path.md), [0013](0013-audit-trail-written-in-the-command-transaction.md) (security events, roles on command rows), [0033](0033-online-operator-station-in-the-production-start-module.md) (station sign-in), [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md) (MCP tokens act as the user), [0047](0047-secrets-and-the-installation-key.md), [0051](0051-regulated-readiness-no-regret-rules.md).
* Plan: [04 data and platform, identity, roles and permissions](../plan/04-data-and-platform.md#identity-roles-and-permissions), [05 GraphQL and APIs](../plan/05-graphql-and-apis.md), [09 operator station](../plan/09-operator-station.md).
* Better Auth: https://www.better-auth.com/docs/plugins/organization, https://www.better-auth.com/docs/plugins/api-key/advanced, https://www.better-auth.com/docs/adapters/postgresql, https://github.com/better-auth/better-auth/security/advisories.
* Revisit when a customer asks for single sign-on, when a second replica runs, and when company mode lets one request span several plants.
