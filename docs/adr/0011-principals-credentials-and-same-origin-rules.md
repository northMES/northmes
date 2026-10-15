---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 01, 04, 15, 18, 19, 23 and 32
informed: pilot IT, module and plugin authors
release: "1"
needs-confirmation: ""
---

# Principals, credentials and same-origin rules

## Context and problem statement

NorthMES accepts several credentials (the web's session, the station key cookie, MCP personal access tokens, later OAuth tokens) on several surfaces (`/graphql` over HTTP, graphql-ws and SSE, `/api/v1/web`, `/api/v1/ai/chat`, `/api/v1/station`, the Pyramid upload at `/api/v1/pyramid-connector/import-file`, `/mcp` and Better Auth's `/api/auth`). A review of the design found these gaps:

* Yoga, under the gateway runtime, with `cors` undefined reflects any `Origin` with credentials and executes form-encoded mutations (reproduced with graphql-yoga 5.24.1). `SameSite=Lax` blocks only cross-site requests, and other applications on the customer's intranet domain count as same-site. A WebSocket upgrade has no CORS at all.
* Better Auth's admin plugin serves `/admin/impersonate-user`, `/admin/set-user-password`, `/admin/set-role`, `/admin/ban-user`, `/admin/remove-user` and more to any user with a Better Auth admin role. These write only the `auth` schema, so no command row records them; `set-user-password` skips the rule that an admin-set password is temporary; and actions during impersonation are recorded as the impersonated user.
* An agent that can read its MCP token could call the commit mutation on `/graphql` as the user.
* Sign-up is disabled, and nothing creates the first admin or recovers access when every admin is locked out and no SMTP server exists.
* Rate limits need a store that matches the one-replica pilot.

This ADR decides the principal types, which credential each surface accepts, how user management runs, how the first admin is created, the same-origin rules for HTTP and WebSocket, and rate limiting. Identity, roles and `can()` are in [ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md).

## Decision drivers

* One principal per request, resolved by one function on every surface.
* A credential works only on the surfaces it was issued for.
* MCP agents act as the user but never commit a change as the user ([ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)).
* Every change to users and roles is a command with an audit row ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).
* No page on another intranet host can read or write as the signed-in user, over HTTP or WebSocket.
* Nobody on the plant network can become company admin before IT finishes setup.
* The pilot runs one replica on one host, often without SMTP.

## Considered options

* Explicit NorthMES rules: same-origin checks on HTTP and on the WebSocket upgrade, a credential-by-surface table, user management as NorthMES commands with Better Auth's admin HTTP paths disabled, and the first admin created by CLI
* Library defaults: `SameSite=Lax` cookies, Yoga's default CSRF prevention, Better Auth's admin endpoints for user management, any valid credential on any endpoint, and a web setup route for the first admin
* Explicit same-origin rules, but Better Auth's admin endpoints kept for company admins

## Decision outcome

Chosen option: "Explicit NorthMES rules", because each library default above left a reproduced or documented gap, and the third option still lets user changes bypass the command pipeline and the audit trail.

Principals. One SDK function, `PrincipalResolver(request, plant)`, serves the gateway, REST controllers (exports included), the SSE chat route and `/mcp`. Every route either uses it or carries `@Public`.

| Principal type | Who | Credential | Surface | `acting_for` |
|---|---|---|---|---|
| `user` | A signed-in person | A five-minute JWT as a bearer token, minted from the bearer session token ([ADR 0070](0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md)) | `web` | none |
| `user` | A person through an MCP client | Personal access token, prefix `nms_mcp_` | `mcp` | none |
| `agent` | The in-app assistant, one fixed system principal per feature ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)) | The user's session credential | `assistant` | the user |
| `station` | A registered operator station ([ADR 0033](0033-online-operator-station-in-the-production-start-module.md)) | Station key in the `__Host-nm_station` cookie | `station` | the signed-in operator |
| `system` | A connector run or a registered system job | none | `connector` or `job` | none |
| `user` | The person who started a job, such as autoplan from the board | the requester's credential id, carried in the job data | `job` | none |
| `user` | A named support user fixing data by hand, with a reason | not specified yet | `sql` | none |

Route families. Every REST route lives under `/api/v<major>/` and belongs to one route family, which `ApiController({ module, family })` records on the controller ([ADR 0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md)). Public and first-party routes share the version segment, and a module-owned first-party route such as `/api/v1/ai/chat` has the same path shape as a public route, so the guard and the same-origin middleware read the family from that metadata, never from a path prefix. The family decides the credentials:

* First-party routes (`/api/v1/web/*`, `/api/v1/station`, `/api/v1/ai/chat` and `/api/v1/pyramid-connector/import-file`) accept the credentials the table below names and pass the origin rule. Only the shell, the remotes and the stations of the same image call them.
* The library family is Better Auth's handler at `/api/auth/*` (`basePath` `/api/auth`, outside the versioned routes, as built under ADR 0070), guarded by `trustedOrigins` and `disabledPaths`.
* Public routes, `/api/v<major>/<module-id>/...`, arrive with the first outside system or Data collection's ingestion endpoint; release 1 has none. They accept a bearer integration token bound to a scope node and ignore cookies. Commands they run record surface `api`. The token design (`configId`, prefix, expiry, issuing UI and rotation) is decided with the first public route.
* Root routes (`/health`, `/health/live`, `/health/ready`, `/graphql`, `/mcp`, `/modules/<id>/<version>/*`, `/assets/*` and the SPA paths) are probes, protocols and static mounts. They stay at the root, outside the route families.

Credentials by surface. One table drives `PrincipalGuard` and the gateway plugin:

| Surface | Accepts | Rejects |
|---|---|---|
| `/graphql` (HTTP, graphql-ws, SSE), `/api/v1/web/*` | the web's JWT, station cookie | personal access tokens of api-key `configId` `mcp`, any token whose `aud` is `/mcp`, and integration tokens (later) |
| `/mcp` | bearer JWT whose `aud` is `NORTHMES_PUBLIC_ORIGIN + '/mcp'`, or a personal access token of `configId` `mcp` | cookies, which it ignores, and integration tokens (later) |
| `/api/v1/station` | station cookie | |
| `/api/v1/ai/chat`, `/api/v1/pyramid-connector/import-file` | the web's JWT | |
| Public routes (later) | bearer integration token bound to a scope node | cookies, which they ignore, and personal access tokens of `configId` `mcp` |
| `GET /api/v1/openapi.json` (later) | the web's JWT or integration token | anonymous requests and personal access tokens of `configId` `mcp` |

* Boot asserts that Better Auth's `enableSessionForAPIKeys` is false and that `disabledPaths` contains every `/admin/*` path and the api-key client endpoints. `/token` stays open, because the web mints its JWTs there (ADR 0070).
* Personal access tokens expire within 90 days. Each call's rights are the token's scopes intersected with a live `can()`.
* When dynamic client registration arrives with OAuth login for MCP, it accepts only `http://localhost` and `http://127.0.0.1` redirect URIs.

User management. No user gets a Better Auth admin role. Creating users, banning, resetting passwords and assigning roles are NorthMES commands that check `can()` at the target user's assignment scopes, write command rows and call `auth.api` on the server. The guard refuses sessions with `impersonatedBy` set. If impersonation is ever enabled, the impersonator is the principal and the impersonated user is `acting_for`.

First admin and recovery. No web setup route exists. `northmes admin create` and `northmes admin reset-password` run with `docker compose run --rm` in the one-off migrate container. Each opens an audit context with surface `cli`, writes a security event and prints a temporary password once. Operators come from a seed script or a later CSV import.

Same-origin rules, as built. [ADR 0070](0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md) moved the web from a session cookie to a bearer session, because the web and the API may be on different sites, where browsers block a third-party cookie. That replaced the cookie and CSRF-header rules this ADR first proposed (`SameSite=Strict`, `x-northmes-csrf` and Yoga's `csrfPrevention`); the rules below are the ones the code follows, with the later parts marked:

* The web keeps Better Auth's session token in the tab's `sessionStorage` and uses it only to mint five-minute JWTs; every API request carries the JWT in `Authorization` and sends no cookies. A request from another site therefore carries no ambient credential, which is what the CSRF header was for.
* One origin rule runs before every route and before `/graphql` (`apps/backend/src/http/web-origins.module.ts`). A request without `Origin`, or from `NORTHMES_PUBLIC_ORIGIN`, passes. A request from one of the `webOrigins` in `northmes.config.json` passes with CORS headers that never allow credentials, and its preflight is answered there. Any other origin gets 403 before a route or GraphQL sees it.
* Better Auth's `trustedOrigins` is `NORTHMES_PUBLIC_ORIGIN` and the `webOrigins`.
* The WebSocket upgrade does not run the origin rule yet, and the socket's principal comes from the handshake headers at subscribe time, never from `connectionParams`. [#480](https://github.com/northMES/northmes/issues/480) adds the origin rule, a smaller payload limit and a principal re-read per operation before the first Subscription field. With that field, graphql-ws `onConnect` closes with 4401 without a session and 4403 on lost plant membership, and the client treats both as fatal: the shell routes to sign-in on 4401 and shows an access message on 4403.
* The station cookie, when the operator station arrives, is `__Host-nm_station` with `SameSite=Strict` and `Path=/`, and the station route checks `Origin` as above.
* `/mcp` and public routes (later) accept bearer credentials only and ignore cookies.

The trade-off: any script running in the page can read the session token from `sessionStorage`, where an `HttpOnly` cookie would have hidden it. The shell's strict content security policy (no `unsafe-inline` or `unsafe-eval`, no third-party scripts) and the absence of HTML injection sinks keep foreign scripts out of the page, and the token ends with the tab. A plugin's screens run in the page with full trust and can read it ([ADR 0075](0075-plugin-installs-from-signed-archives-into-a-plugin-volume-with-plugin-screens-loaded-at-run-time.md), `SECURITY.md`).

Rate limiting. Better Auth's limiter, with database storage, guards the sign-in endpoints. The station key configuration turns that limiter off and uses a per-station limit instead (5 unknown badges within 60 seconds lock badge sign-in on that station for 5 minutes and write a security event, [ADR 0033](0033-online-operator-station-in-the-production-start-module.md)). `@nestjs/throttler` keeps counters in memory while one replica runs; a Postgres `ThrottlerStorage` is written before a second replica exists. Public routes (later) are limited per integration token, with counters in the Postgres `ThrottlerStorage` from the first public route, because in-memory counters do not limit an outside client across replicas. Only Caddy is a trusted proxy.

### Consequences

* Good, because a page on another intranet host can neither read nor write as the signed-in user over HTTP: it holds no credential the browser would send, and the origin rule refuses it. The WebSocket gets the same rule with [#480](https://github.com/northMES/northmes/issues/480).
* Good, because an agent holding an MCP token cannot call any `/graphql` mutation, so commits stay with the person in the NorthMES UI.
* Good, because every user change and every admin recovery leaves a command row or a security event.
* Bad, because the session token in `sessionStorage` is readable by any script in the page, so the strict CSP and the absence of HTML sinks carry that risk, and a plugin's screens can read it.
* Bad, because `NORTHMES_PUBLIC_ORIGIN` and the `webOrigins` must match the host names users type exactly ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)).
* Bad, because recovery needs shell access to the host, which pilot IT holds.
* Bad, because in-memory throttler counters reset on restart and do not span replicas.
* Neutral, because OAuth login for MCP and dynamic client registration come later ([ADR 0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md)).
* Neutral, because integration tokens, the public routes' credential rows and per-token rate limits arrive with the first public route ([ADR 0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md)).

### Confirmation

* The origin rule against the built app, in `apps/backend/test/modules/core/sign-in.int.test.ts` ("E05-S05 a request from an origin that webOrigins does not list is refused with 403" and "E05-S05 the web origin signs in across origins: its preflight passes, it may read the token and retry headers, and it may send no cookies"): a request from a foreign origin returns 403; a request from a web origin gets `Access-Control-Allow-Origin` with that origin and no `Access-Control-Allow-Credentials`; a request without an `Origin` header, as every other integration test sends, passes. When the Pyramid upload lands, its route test adds: a multipart POST to it from a foreign origin returns 403 and enqueues nothing.
* WebSocket tests in `apps/backend/test/graphql/websocket.int.test.ts` (new with #480): a graphql-ws client with a foreign `Origin` gets 403 on upgrade; a socket opened without a credential that sends one in `connectionParams` is closed with 4401; an e2e test revokes the session, restarts the server and asserts that the client stops retrying and the sign-in page appears.
* `credentials-by-surface.int.test.ts`: `POST /api/auth/admin/impersonate-user`, `/admin/set-user-password` and `/admin/remove-user` return 404; a session row with `impersonatedBy` is rejected; a personal access token on `POST /graphql` returns 401; the commit mutation with an MCP token returns 401 or 403 and writes a security event; a cookie on `POST /mcp` without a bearer returns 401 with `WWW-Authenticate` `resource_metadata`.
* When the first public route lands, `credentials-by-surface.int.test.ts` adds: an integration token on `POST /graphql` returns 401; a session cookie on a public route is ignored and returns 401; an integration token on `/mcp` returns 401. `openapi-json.int.test.ts`: an anonymous `GET /api/v1/openapi.json` returns 401, and so does one with an MCP personal access token.
* Boot tests: boot exits 1 when `enableSessionForAPIKeys` is true or when `disabledPaths` misses an `/admin/*` path.
* Route inventory test, `apps/server/test/rest/routes.int.test.ts`: lists every HTTP route and fails on one that neither uses `PrincipalResolver` nor carries `@Public`, or that is neither in a route family nor on the root allowlist.
* CLI tests: a fresh database serves no setup route; `northmes admin create` followed by sign-in works and the command row has surface `cli`; `northmes admin reset-password` with every admin locked out restores access.
* When dynamic client registration lands: a registration with `redirect_uri` `https://attacker.example.test/cb` returns 400.

## Pros and cons of the options

### Explicit NorthMES rules

* Good, because each rule has a test that fails without it.
* Good, because one credential table and one resolver keep surfaces from drifting apart.
* Bad, because NorthMES owns the middleware, the upgrade check and the user management commands.

### Library defaults

* Good, because nothing extra is written.
* Bad, because Yoga reflects any origin with credentials and runs form-encoded mutations, `SameSite=Lax` lets same-site intranet pages through, and the WebSocket upgrade has no origin check.
* Bad, because Better Auth's admin endpoints change users with no command row and record impersonated actions under the wrong person.
* Bad, because a web setup route lets whoever reaches the host first become admin.

### Same-origin rules, Better Auth admin endpoints kept

* Good, because user management screens could call ready-made endpoints.
* Bad, because those endpoints still write only the `auth` schema, skip the temporary-password rule and bypass `can()` at the target user's scopes.

## More information

* Related ADRs: [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md), [0012](0012-commands-as-the-single-write-path.md), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md) (graphql-ws client rules), [0033](0033-online-operator-station-in-the-production-start-module.md), [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md), [0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md) (log redaction of credentials), [0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md) (route families, the public API).
* Plan: [05 GraphQL and APIs, same-origin rules](../plan/05-graphql-and-apis.md#same-origin-rules-csrf-and-credentials), [04 data and platform, principals and credentials](../plan/04-data-and-platform.md#principals-and-credentials), [12 operations and security](../plan/12-operations-and-security.md).
* Better Auth rate limits: https://www.better-auth.com/docs/concepts/rate-limit. MCP authorization: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization.
* Revisit when a second replica runs (throttler storage), when OAuth login for MCP arrives, when the first public route arrives (integration tokens), and if support work ever needs impersonation.
