# Threat model

This is NorthMES's threat model for release 1 and the pilot: what an attacker would want, where trust changes, the threats at each boundary and the controls that meet them. It follows the zones and conduits of IEC 62443-3-2 and a STRIDE pass per conduit (spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege). [ADR 0076](../adr/0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) rule 4 keeps it current: a new surface, trust boundary or integration adds its row here in the same pull request.

A control's status uses the words of the [controls index](README.md#controls-index): **built**, **decided**, **gap** or **accepted**. A threat that stays after its controls is a residual risk; the accepted ones, with an owner and a review date, are in the [risk register](risks.md). The broader project risks are in [plan 17](../plan/17-risks.md).

Checked against `main` at fe15e3d on 2026-10-15.

## The system in one picture

One installation serves one customer ([ADR 0072](../adr/0072-one-installation-per-customer-and-hosting-partners-run-many-with-a-customer-folder-northmes-apply-and-the-health-endpoints.md)). It runs on one host with Docker Compose ([ADR 0044](../adr/0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)): Caddy terminates TLS, one NorthMES server process serves the API and the static web app, and Postgres holds every record. Plugins run inside that process and in the page.

```text
 Plant network (users' browsers, operator stations, the ERP host)
        │ HTTPS 443                                     ▲ ERP export files / API (later)
 ───────┼──────────────────── Zone boundary: the host ──┼──────────────────────────────
        ▼                                               │
   ┌─────────┐   HTTP on the Compose network   ┌────────┴─────────────────────────┐
   │  Caddy  │ ──────────────────────────────▶ │ app: NorthMES server             │
   └─────────┘                                 │  web shell, /graphql, /api/*,    │
                                               │  graphql-ws, CLI, plugins        │
   Host operator ── docker compose run ──────▶ │  (all in one process)            │
                                               └────────┬─────────────────────────┘
                                                        │ SQL as nm_app / nm_auth
                                               ┌────────▼─────────┐
                                               │ Postgres (db)    │  or the customer's own
                                               └──────────────────┘  Postgres (#567)

 Supply chain: GitHub (source, CI, releases) → ghcr.io image → the host; npm → plugin volume
```

## Assets

| Asset | Why it matters | Where it lives |
|---|---|---|
| Production records: orders, articles, plans, reported quantities | The customer's production; wrong data stops or misguides the plant | Postgres, per company and plant under row-level security |
| Personal data: users' names, emails, sign-in history | GDPR | Postgres `auth` schema |
| Credentials: password hashes, sessions, JWT signing keys | Whoever holds them acts as a user | Postgres `auth` schema; the session token in the tab's `sessionStorage` |
| Installation secrets: database role passwords, the auth secret, later the installation key | Whoever holds them reads or forges everything | `secrets/` on the host, mounted as Compose secrets (ADR 0047, ADR 0060) |
| Permissions and role assignments | Decide who may do what | Postgres `core` tables |
| The audit trail and security events (decided, [#443](https://github.com/northMES/northmes/issues/443)) | Show who changed what, for the customer and an auditor | Postgres `audit` schema |
| The code that runs: the image, the plugins, the web bundle | A changed artifact runs with full rights | ghcr.io, the host, the plugin volume |
| Availability of the plant's planning | Planners and operators wait when it is down | The whole stack |

## Zones and conduits

| Zone | What is in it | Trust |
|---|---|---|
| Z1 Plant network | Users' browsers, operator stations, the ERP host, other intranet apps | Untrusted: any device on the network can send requests |
| Z2 Host | Caddy, the NorthMES server with its plugins, the host operator's shell, `secrets/` | Trusted; the host operator is pilot IT |
| Z3 Database | Postgres, its volume and backups | Trusted; reached only from Z2 with role passwords |
| Z4 Build and supply chain | GitHub, CI runners, ghcr.io, the npm registry, Argos | Trusted for what it signs and pins; a third party for the rest |

| Conduit | From, to | Protocol |
|---|---|---|
| C1 | Browser (Z1) to Caddy and the server (Z2) | HTTPS; HTTP and WebSocket behind Caddy |
| C2 | Server (Z2) to Postgres (Z3) | Postgres wire protocol on the Compose network, or to the customer's own server |
| C3 | Host operator to the server and database (Z2, Z3) | `docker compose run`, the CLI |
| C4 | Plugins into the server and the page (Z4 to Z2 and Z1) | npm into the plugin volume; ES modules in the page |
| C5 | ERP and other systems (Z1) to the server (Z2) | Files or an API (later) |
| C6 | Source to the running image (Z4 to Z2) | GitHub Actions, ghcr.io, `docker compose pull` |
| C7 | CI to third-party services (Z4) | Argos upload, Scorecard |

## Surfaces

Each entry point, the conduit it sits on and the credential it accepts. A surface marked later is decided but not built; its threats are listed now so its pull request starts from them.

| Surface | Status | Conduit | Credential |
|---|---|---|---|
| Web app: the shell and its static files | built | C1 | none to load; a strict CSP |
| GraphQL over HTTP, `/graphql` | built | C1 | a five-minute EdDSA JWT as a bearer token (ADR 0070) |
| REST: Better Auth at `/api/auth/*`, `/api/account/password`, later `/api/v1/*` | built (auth and password), later (`/api/v1`) | C1 | the session token (bearer) for auth, the JWT for the rest; integration tokens later (ADR 0064) |
| WebSocket: graphql-ws on `/graphql` | built, latent (no Subscription field yet) | C1 | the JWT, checked at subscribe time |
| MCP, `/mcp` | later (ADR 0034, ADR 0073) | C1 | bearer JWT or personal access token |
| CLI: `northmes admin`, `db bootstrap`, `migrate` | built | C3 | shell access to the host and the role passwords in `secrets/` |
| Plugins: server part and screens | built (server part from config), decided (npm into the plugin volume, ADR 0075) | C4 | none: full trust |
| ERP connector: the Pyramid file import and later write-back | later (ADR 0031, ADR 0032) | C5 | a session for the upload; a system principal for the run |
| Operator station | later (ADR 0033) | C1 | a station key and the operator's badge |
| Database | built | C2, C3 | role passwords: `nm_app`, `nm_auth` at run time, `nm_owner` for migrations only |
| Release and image | built | C6 | GitHub's release workflow; image digests in the release notes |
| Argos visual snapshots | decided (ADR 0077) | C7 | `ARGOS_TOKEN`, a repository secret |

## Threats and controls

Each table lists the threats that matter at that conduit, not every STRIDE letter. "Status" is the status of the weakest control in the row.

### C1: browser to server (web app, GraphQL, REST, WebSocket)

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| Password guessing or credential stuffing against sign-in | S | Better Auth's limiter; a GraphQL rate limit per principal or address; throttling that does not depend on `NODE_ENV`, a trusted proxy and a lockout per account | gap [#476](https://github.com/northMES/northmes/issues/476) |
| A stolen session token or JWT is replayed | S | JWTs live 5 minutes with issuer and audience pinned; the principal and the ban are re-read on every request; the session token stays in the tab's `sessionStorage`; an absolute session lifetime and JWTs ended with their session | gap [#479](https://github.com/northMES/northmes/issues/479) |
| A script in the page reads the session token from `sessionStorage` | I, S | A strict CSP with no `unsafe-inline` or `unsafe-eval`, no third-party scripts and no HTML injection sinks; the trade-off is recorded in ADR 0011 | built |
| Another intranet site calls the API as the signed-in user (CSRF, CORS) | S, T | Requests carry a bearer header and no cookies, so a browser sends no ambient credential; the origin rule answers CORS only for `webOrigins`, never with credentials, and refuses other origins with 403 | built |
| A WebSocket upgrade from a foreign origin, or a principal kept after it changes | S, E | The origin rule on the upgrade, a smaller payload limit and the principal re-read per operation | gap [#480](https://github.com/northMES/northmes/issues/480) (latent until a Subscription field exists) |
| A user reads or changes rows of another company, plant or user | I, E | Row-level security with scopes set per transaction from bound values; `nm_app` cannot bypass it; the command bus checks the permission at the row's scope; a permission check on every read | gap [#474](https://github.com/northMES/northmes/issues/474), [#483](https://github.com/northMES/northmes/issues/483) |
| A user grants themselves more rights, or blocks a stronger user | E | No one grants a permission they lack; the last Company admin is protected; block limited to users who hold no more than the actor | gap [#478](https://github.com/northMES/northmes/issues/478) |
| Better Auth's own routes expose colleagues' data or admin actions | I, E | `disabledPaths` for the admin and other plugin routes; only the routes the web uses stay open | gap [#475](https://github.com/northMES/northmes/issues/475) |
| Injection through GraphQL or REST input | T | Zod contracts on every input; Kysely with bound values; `sql.raw` on literals only | built |
| Large or deep queries exhaust the server | D | Size, depth and cost limits on GraphQL; a rate limit per principal or address | built |
| Errors leak internals | I | Masked errors with a code and a correlation id; static file errors hide paths | built |
| Clickjacking, sniffing and other header gaps | T, I | Security headers on every response, `form-action` in the CSP | gap [#480](https://github.com/northMES/northmes/issues/480) |
| A user denies having made a change | R | The audit trail and security events in the command transaction | decided [#443](https://github.com/northMES/northmes/issues/443) |
| Traffic is read or changed on the plant network | I, T | HTTPS through Caddy; the public origin must be HTTPS in production | built (origin check), decided (ADR 0044 hardening) |

### C2: server to database

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A compromised server process uses more database rights than it needs | E | `nm_app` and `nm_auth` own nothing and have no SUPERUSER, CREATEDB, REPLICATION or BYPASSRLS; `nm_owner` only for migrations | built |
| SQL built from user input | T, I | Kysely with bound values; scopes set with `set_config(..., true)` from bound values | built |
| Database credentials leak through logs or errors | I | Passwords never logged; pool errors without credentials; `DATABASE_URL` may not carry credentials; structured logs with redaction | built, decided [#147](https://github.com/northMES/northmes/issues/147) |
| A weak auth secret lets an attacker forge sessions | S | Secret files only, dev secrets refused in production; a minimum strength and key rotation | gap [#484](https://github.com/northMES/northmes/issues/484) |
| Traffic to the customer's own Postgres is read on the network | I | TLS settings on the pool for an external database | gap: checked again with the external database guide (#567) |
| Data is lost to a disk failure or a bad upgrade | D | Backups and a tested restore | accepted A-04 in the [risk register](risks.md) |

### C3: host operator

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| Someone on the plant network becomes admin before IT finishes setup | E | No web setup route: companies and their first admins only from the CLI on the host | built |
| A secret leaks from the host | I | Secret files readable only by their owner, refused otherwise; Compose secrets per service | built |
| A container is used to reach the host | E | Non-root user; read-only filesystem, no capabilities, `no-new-privileges` and a memory limit | decided (ADR 0044) |
| An admin recovery leaves no trace | R | The CLI writes as `nm_app` and `nm_auth`; the command row and security event wait on the audit trail | decided [#443](https://github.com/northMES/northmes/issues/443) |

### C4: plugins

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A malicious or vulnerable plugin reads every company's data within the request's scopes, sessions, configuration and secrets, or changes records | I, T, E | Full trust by design (ADR 0037, ADR 0068); install only from trusted publishers; the admin reviews the plugin inventory; `npm install --ignore-scripts` | accepted A-03 in the [risk register](risks.md) |
| A plugin's screen reads the session token or acts as the user in the browser | I, S | Full trust; the CSP keeps third-party origins out but not a plugin served by NorthMES | accepted A-03 |
| A changed package on the registry replaces a plugin | T | Pinned versions in the plugin volume's lockfile; signed archives later (ADR 0075) | accepted A-03 |

### C5: ERP connector and other systems (later)

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A forged or malformed ERP file changes orders | T | The upload needs a signed-in user with the permission; the file passes a Zod contract; imported rows are records, not code | decided (ADR 0031, ADR 0032) |
| A connector run acts with more rights than it needs | E | A `system` principal per connector, with its own permissions and audit rows | decided (ADR 0011, ADR 0013) |
| A public route accepts the wrong credential | S | Integration tokens bound to one scope node, cookies ignored, limits per token | decided (ADR 0064), with the first public route |
| A machine protocol (OPC UA, MQTT) is spoofed | S, T | Security mode, credentials and access lists in each integration's ADR before code | decided (ADR 0076 rule 4) |

### Operator station (later, on C1)

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A device on the plant network poses as a station | S | A station key registered by an admin, in a `__Host-` cookie, accepted only on the station route | decided (ADR 0033) |
| Badge numbers are guessed at a station | S | 5 unknown badges within 60 seconds lock badge sign-in on that station for 5 minutes and write a security event | decided (ADR 0033) |
| An operator's action is recorded as someone else's | R | The station is the principal and the signed-in operator is `acting_for` | decided (ADR 0011) |

### C6 and C7: supply chain, CI and third parties

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A compromised dependency reaches the image | T, E | Exact catalog versions, a 14-day release age, install scripts denied, a frozen lockfile; dependency audit, license gate and CodeQL as required checks | built, gap [#197](https://github.com/northMES/northmes/issues/197) |
| A known vulnerable dependency stays | E | Automated updates; a dependency audit in CI; accepted ones recorded | gap [#482](https://github.com/northMES/northmes/issues/482); accepted A-05 in the [risk register](risks.md) |
| A pull request from a fork steals a CI secret or writes to the repository | E, I | Read-only tokens, actions pinned by SHA, no `pull_request_target`, inputs through `env` | built |
| A changed image is installed | T | Image digests in the release notes; signed and attested images, an SBOM and a Trivy scan | built (digests), decided [#157](https://github.com/northMES/northmes/issues/157) |
| A leaked `ARGOS_TOKEN` uploads builds or changes the baseline a pull request is compared with | S, T | Argos's project token grants nothing in GitHub; only the `e2e` test step reads it; a visual change counts only after a person approves it in Argos (ADR 0077) | decided |
| Screenshots sent to Argos disclose data | I | Screenshots show only the fictional seed and the records a spec creates (ADR 0077) | decided |
| Nobody can tell who approved a visual change | R | Argos records who approved each change | decided |
| An Argos outage blocks merges | D | The Argos check is not required at first (ADR 0077) | decided |

## Residual risks

What stays after the controls above is in the [risk register](risks.md): each accepted risk with its reason, owner, review date and the ADR or issue that carries it. The gaps above are tracked by their issues under [#473](https://github.com/northMES/northmes/issues/473), and the internal audit before each release checks this page against the code (ADR 0076).
