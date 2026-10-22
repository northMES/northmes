# Threat model

This is NorthMES's threat model for release 1 and the pilot: what an attacker would want, where trust changes, the threats at each boundary and the controls that meet them. It follows the zones and conduits of IEC 62443-3-2 and a STRIDE pass per conduit (spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege). [ADR 0076](../adr/0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) rule 4 keeps it current: a new surface, trust boundary or integration adds its row here in the same pull request.

A control's status uses the words of the [controls index](README.md#controls-index): **built**, **decided**, **gap** or **accepted**. A threat that stays after its controls is a residual risk; the accepted ones, with an owner and a review date, are in the [risk register](risks.md). The broader project risks are in [plan 17](../plan/17-risks.md).

Checked against `main` at fe15e3d on 2026-10-15. The rows for agent sessions and code owner review were checked against `main` at 17df3ff8 and the live `main` ruleset on 2026-10-20.

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
| The maintainer's credentials on the development workstation: GitHub tokens, SSH keys, registry tokens | Whoever holds them pushes, publishes or acts as the maintainer in this and other organizations | `~/.ssh`, `~/.config/gh`, `~/.npmrc` and the macOS keychain on the maintainer's machine |
| Availability of the plant's planning | Planners and operators wait when it is down | The whole stack |

## Zones and conduits

| Zone | What is in it | Trust |
|---|---|---|
| Z1 Plant network | Users' browsers, operator stations, the ERP host, other intranet apps | Untrusted: any device on the network can send requests |
| Z2 Host | Caddy, the NorthMES server with its plugins, the host operator's shell, `secrets/` | Trusted; the host operator is pilot IT |
| Z3 Database | Postgres, its volume and backups | Trusted; reached only from Z2 with role passwords |
| Z4 Build and supply chain | GitHub, CI runners, ghcr.io, the npm registry, Argos | Trusted for what it signs and pins; a third party for the rest |
| Z5 Development workstation | The maintainer's machine, where Claude Code sessions and workflows build NorthMES, often unattended | Partly trusted: sessions act on untrusted input (public issues, pull request comments, web pages, packages), so they run inside the Claude Code sandbox (ADR 0084) |

| Conduit | From, to | Protocol |
|---|---|---|
| C1 | Browser (Z1) to Caddy and the server (Z2) | HTTPS; HTTP and WebSocket behind Caddy |
| C2 | Server (Z2) to Postgres (Z3) | Postgres wire protocol on the Compose network, or to the customer's own server |
| C3 | Host operator to the server and database (Z2, Z3) | `docker compose run`, the CLI |
| C4 | Plugins into the server and the page (Z4 to Z2 and Z1) | npm into the plugin volume; ES modules in the page |
| C5 | ERP and other systems (Z1) to the server (Z2) | Files or an API (later) |
| C6 | Source to the running image (Z4 to Z2) | GitHub Actions, ghcr.io, `docker compose pull` |
| C7 | CI to third-party services (Z4) | Argos upload, Scorecard |
| C8 | Agent sessions (Z5) to the repository and GitHub (Z4) | git over HTTPS and the GitHub API with the agent machine user's token; Docker on the workstation for Testcontainers |

## Surfaces

Each entry point, the conduit it sits on and the credential it accepts. A surface marked later is decided but not built; its threats are listed now so its pull request starts from them.

| Surface | Status | Conduit | Credential |
|---|---|---|---|
| Web app: the shell and its static files | built | C1 | none to load; a strict CSP |
| GraphQL over HTTP, `/graphql` | built | C1 | a five-minute EdDSA JWT as a bearer token (ADR 0070) |
| REST: Better Auth at `/api/auth/*` and `/api/account/password` | built | C1 | the session token (bearer) for auth, the JWT for the rest, and a NorthMES web origin on every POST to auth and password; integration tokens only on the public routes of the next row (ADR 0073) |
| Public REST, `/api/v1/<module>/...`: core's article routes, built from the operation declarations by `toRestRoutes` | built | C1, C5 | an integration token (`nms_int_`) in `Authorization: Bearer`; OAuth access tokens later (ADR 0073); the web's JWT is refused and cookies are never read |
| The installation's OpenAPI document, `GET /api/v1/openapi.json` | built | C1, C5 | the web's JWT or an integration token in `Authorization: Bearer`; an anonymous request gets 401 (ADR 0073) |
| WebSocket: graphql-ws on `/graphql` | built, latent (no Subscription field yet) | C1 | the JWT, checked at subscribe time |
| MCP, `/mcp` | later (ADR 0034, ADR 0073) | C1 | bearer JWT or personal access token |
| CLI: `northmes admin`, `db bootstrap`, `migrate`, and `openapi print`, which reads no database and no secret | built | C3 | shell access to the host and the role passwords in `secrets/` |
| Plugins: server part and screens | built (both from config; screens at `/api/v1/web/plugins/<id>/<version>/`, shared modules at `/shared/`), decided (npm into the plugin volume, ADR 0075) | C4 | none: full trust |
| ERP connector: the Pyramid file import and later write-back | later (ADR 0031, ADR 0032) | C5 | a session for the upload; a system principal for the run |
| Operator station | later (ADR 0033) | C1 | a station key and the operator's badge |
| Database | built | C2, C3 | role passwords: `nm_app`, `nm_auth` at run time, `nm_owner` for migrations only |
| Release and image | built | C6 | GitHub's release workflow; image digests in the release notes |
| Argos visual snapshots | decided (ADR 0077) | C7 | `ARGOS_TOKEN`, a repository secret |
| Agent sessions acting on the repository: Claude Code sessions and workflows that push branches, open pull requests and comment | built (sandbox, read block and a reviewed `env` block in `.claude/settings.json`; bypass mode inside the sandbox for unattended sessions and the install hook, ADR 0087; `.github/CODEOWNERS`; auto mode in user settings, machine user, code owner review in the ruleset and Docker file sharing, set up on 2026-10-20 under [#737](https://github.com/northMES/northmes/issues/737); ADR 0084) | C8 | the `northmes-agent` machine user's fine-grained token for `northMES/northmes` |
| Replay eval trials: headless sessions that deliver old issues from merged pull requests, and the grading that runs their code | decided (ADR 0085) | C8 | none: no GitHub token; the eval API key reaches Claude Code through `apiKeyHelper` |

## Threats and controls

Each table lists the threats that matter at that conduit, not every STRIDE letter. "Status" is the status of the weakest control in the row.

### C1: browser to server (web app, GraphQL, REST, WebSocket)

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| Password guessing or credential stuffing against sign-in | S | Better Auth's limiter; a GraphQL rate limit per principal or address; throttling that does not depend on `NODE_ENV`, a trusted proxy and a lockout per account | gap [#476](https://github.com/northMES/northmes/issues/476) |
| A script or outside system signs in with a person's email and password, outside the browser that the throttle, the lockout and the web's sign-in screen assume | S | Password sign-in requires the web app's origin: every POST to `/api/auth/*` and `/api/account/password` needs `NORTHMES_PUBLIC_ORIGIN` or a web origin as its `Origin`, refused with 403 `core.origin_required` without one and `core.origin_forbidden` with another, before Better Auth reads the body; `/api/auth/token` refuses a cross-site GET and needs a session token from such a sign-in. A client that forges an allowed `Origin` still passes, and its attempts meet the throttle and the lockout. Integrations use integration tokens on the public REST API, and OAuth client credentials come later (ADR 0073) | built |
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
| A plugin's screen swaps the React, router or Apollo that the shell and other plugins share | T, E | The shared modules sit on a frozen, non-writable property that the shell defines before any plugin loads; `/shared/` serves only files from the web build | built |
| A changed package on the registry replaces a plugin | T | Pinned versions in the plugin volume's lockfile; signed archives later (ADR 0075) | accepted A-03 |

### C5: ERP connector and other systems (later)

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A forged or malformed ERP file changes orders | T | The upload needs a signed-in user with the permission; the file passes a Zod contract; imported rows are records, not code | decided (ADR 0031, ADR 0032) |
| A connector run acts with more rights than it needs | E | A `system` principal per connector, with its own permissions and audit rows | decided (ADR 0011, ADR 0013) |
| A public route accepts the wrong credential, or none | S, E | Every route that `toRestRoutes` builds hands its call to `PublicApiRunner`, which resolves the principal only through `PublicApiCredentials`, the public family's credential guard, and never through the web's `PrincipalResolver`; `PrincipalGuard` passes only handlers that carry `PublicApiOperation` in a public `ApiController` that `toRestRoutes` built, so a hand-written public controller still needs the web's JWT (`apps/backend/test/rest/principal-guard.test.ts`). The server's guard, `BearerPublicApiCredentials`, reads only `Authorization: Bearer` and verifies only an `nms_int_` token, through core's `IntegrationCredentialService`; the web's JWT, any other bearer, another scheme, a cookie and no header answer 401 `core.unauthenticated`, a revoked or expired token too, and a token bound to one plant gets 403 `core.plant_forbidden` at another. `/graphql` refuses an integration token, because the web's resolver accepts only its own JWT (`apps/backend/test/rest/credential-guard.int.test.ts`) | built |
| An integration token's secret leaks from the database, a log or a list | I | Better Auth's api-key plugin stores only its SHA-256 hash and no leading characters; the create answer shows it once; the record holds it as a `Secret` that serializes as `[redacted]`; `coreIntegrationTokens` has no secret field (ADR 0073) | built |
| An integration token acts with more rights than its creator, or after revoke or expiry | E, S | `core.integration:manage` at the company; the grant rule for each role at the binding; the resolver needs Better Auth's verify and a live `core.credential` row, whose expiry and revocation it checks again; revoke deletes the key at once (ADR 0073); the public routes call the resolver on every request (`credential-guard.int.test.ts`) | built |
| A token floods the public API, or one integration starves the others | D | Rate limits per credential, not per address: `NORTHMES_API_RATE_LIMIT_READS` GET and `NORTHMES_API_RATE_LIMIT_WRITES` POST requests a minute, 600 and 60 by default, counted in Postgres (`core.rate_limit`, reached by `nm_app` only through two definer functions), so every backend process shares one count; a refusal is 429 `core.request.rate_limited` with `Retry-After` (ADR 0073 section 6; `apps/backend/test/rest/rate-limit.int.test.ts`). The limits are off unless the installation sets `NORTHMES_API_RATE_LIMIT=on`, and a request without a live token is refused with 401 before it is counted, so the public routes have no limit per client address | built (off by default) |
| The OpenAPI document shows someone on the plant network which public routes, modules and plugins the installation serves and which permission each needs | I | `OpenApiController` answers only the web's JWT, through core's `PrincipalResolver`, or a credential that `PublicApiCredentials` resolves; an anonymous request, an unknown bearer and a credential that fails to resolve get 401 `core.unauthenticated` as a problem. The route only reads: it builds the document once from the public controllers, holds no row data and writes nothing (ADR 0073; `apps/backend/test/rest/openapi-json.int.test.ts`) | built |
| A change to a contract breaks the public API without notice, so an ERP integration fails after an upgrade | T, D | `schema/openapi-v1.json` is generated from the contracts and `pnpm gen --check` fails when it is stale; `CI / openapi diff`, which `CI / gate` needs, runs `oasdiff breaking` against the base branch and fails on an ERR-level change unless NorthMES is 0.x and the title marks the break with `!`, so the release notes name it; from 1.0 every break fails (ADR 0064; `scripts/ci/openapi-diff.test.ts`, `apps/backend/test/openapi/print.test.ts`) | built |
| A machine protocol (OPC UA, MQTT) is spoofed | S, T | Security mode, credentials and access lists in each integration's ADR before code | decided (ADR 0076 rule 4) |

### Operator station (later, on C1)

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A device on the plant network poses as a station | S | A station key registered by an admin, in a `__Host-` cookie, accepted only on the station route | decided (ADR 0033) |
| Badge numbers are guessed at a station | S | 5 unknown badges within 60 seconds lock badge sign-in on that station for 5 minutes and write a security event | decided (ADR 0033) |
| An operator's action is recorded as someone else's | R | The station is the principal and the signed-in operator is `acting_for` | decided (ADR 0011) |

### C8: agent sessions on the repository

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| An instruction injected through an issue, a comment, a web page or a package makes a session read the maintainer's credentials or private files and send them out | I, S | Bypass mode is disabled and sessions run in auto mode; the file tools and sandboxed commands read nothing outside the working directories except the toolchain folders the maintainer opens, and the credential paths are denied by name as well; the maintainer's GitHub credentials leave the macOS keychain, which the sandbox does not cover; sandboxed commands reach only the npm registry, GitHub and the Playwright downloads, and the allowlist is locked in user settings so a command cannot open a host of its own (ADR 0084; `test/meta/agent-sandbox.test.ts`) | built (settings), decided (auto mode, the locked allowlist, keychain) |
| A session pushes a workflow that reads a repository secret, adds a key to an account, or changes repository settings | E, I | Sessions hold only the machine user's token: one repository, Contents, Pull requests and Issues, no Workflows, Actions, Administration or Secrets permission, 90 days (ADR 0084; [project credentials](project-credentials.md)) | decided |
| A session's pull request changes what `pnpm e2e` runs, so the `e2e` job hands it `ARGOS_TOKEN` | I | The token reaches only the Argos project and grants nothing in GitHub; a visual change counts only after a person approves it in Argos (ADR 0077) | accepted A-07 |
| A session creates a `v*` tag or a release whose notes point an installation at another image | T, S | Contents write allows both; the tag ruleset allows creation for release-please (ADR 0050) | gap [#738](https://github.com/northMES/northmes/issues/738) |
| A session's change reaches `main` without a person reviewing it, through its own approval, CodeRabbit's or a merge it starts | T, E | `.github/CODEOWNERS` names only the maintainer, for the patterns of `.github/risk-paths`, and `main` requires code owner review and `risk gate` from the GitHub Actions app, so a change to a risk path or a high pull request needs his approval and green checks whoever starts the merge; the gate reads its rules from the default branch; no bypass actors; `Bash(gh pr merge*)` is a deny rule, which `gh api` gets past. A low pull request merges without a person reading it (accepted risk A-08; ADR 0084, ADR 0086) | built (CODEOWNERS and the ruleset, 2026-10-20; risk paths only, ADR 0086) |
| A session changes the workstation outside its worktree (shell start-up files, launch agents, git hooks, binaries the maintainer runs, other repositories) so that code runs later with the maintainer's rights | E | Sandboxed commands write only to the worktree and temp, and Claude Code keeps the shared `.git`'s hooks and config read-only for them; no command runs unsandboxed; deny rules keep the file tools off the shell start-up files, `~/.gitconfig`, `~/.ssh` and `~/Library/LaunchAgents`; the auto mode classifier reviews the other edits of the file tools in auto mode, and in bypass mode only the deny rules hold (accepted risk A-09, ADR 0087); the install hook runs pnpm outside the sandbox only when every install input equals `main`, with scripts and the pnpmfile off | built |
| A session loosens its own boundary by editing a Claude Code settings file | T, E | Claude Code keeps the settings files out of sandboxed commands' reach, and deny rules keep the file tools off every `.claude/settings.json` and `.claude/settings.local.json` and the user settings; a change to the project settings reaches `main` only through a pull request that the maintainer approves, and `test/meta/agent-sandbox.test.ts` fails one that widens the sandbox | built |
| A session drives Docker to mount a host folder or to reach a host outside the network allowlist | E, I | Docker Desktop shares no folder that holds credentials or a NorthMES checkout; a container still has the Docker VM's rights and its own network egress | accepted A-07 in the [risk register](risks.md) |
| A session sends data out through an allowed host (a repository or package of its own on GitHub or npm, or a host behind an allowed name, because the proxy does not inspect TLS), through the TLS trust service that gh needs, or calls a service on a localhost port | I, E | What a session can read is the worktree, which holds the public source, and the machine user's narrow token; local services hold their own credentials | accepted A-07 |
| The code-reviewer agent sends repository content or private notes to Context7, which it reaches outside the sandbox, or acts on an instruction injected through the diff | I, E | MCP servers run outside the Bash sandbox, so `mcp.context7.com` is reached outside the network allowlist. The agent asks Context7 about a library's behaviour only, never with code, data or secrets from the diff; it starts without CLAUDE.md files in context (`omitClaudeMd`), so the maintainer's private notes are not loaded; it has no file-edit tools, and a PreToolUse hook (`scripts/agents/review-bash-guard.mjs`) refuses every Bash command that is not a single git read or gh view, every test run (which would execute code from the branch under review), and refuses when it cannot judge a command; and it treats instructions in the diff as data (`.claude/agents/code-reviewer.md`, ADR 0065) | built (the Bash guard, with tests), decided (the query rule, an instruction no code checks) |
| A session's Blast radius section declares a low tier for a risky change, by mistake or on an instruction injected through an issue, a comment or the diff | T, E | The declared tier cannot lower the floor: `Risk / risk gate` makes a pull request high when it touches the review machinery in `.github/risk-paths`, or from the Validation impact, a breaking title or an author other than `northmes-agent`, whatever the section says; a Validation impact other than none or UI only, or one the gate cannot read, is high; the blast-radius agent has no file-edit tools, runs Bash through the read-only guard and treats instructions in the diff as data (`scripts/ci/risk-gate.test.ts`, ADR 0086). Outside the review machinery, docs, dependencies, migrations and access code included, the tier is the agent's judgment, so a wrong low tier there merges unread: accepted as A-08, bounded by CI and a revert | partly built (accepted risk A-08) |
| A pull request changes the risk gate or `.github/risk-paths` so that the gate judges it low | T, E | The job downloads the check and the path list from the default branch and runs them without a checkout, so a pull request cannot change the script or the paths that judge it (`test/meta/workflows.test.ts`) | built |
| Anyone who can review a pull request triggers `Risk refresh`, which holds `actions: write`, to re-run Risk runs or cancel a run in progress | D | It runs from the default branch, so a pull request cannot change it; it acts only after a passing run that a review started, re-runs only failed or cancelled pull request runs of Risk at that commit, one at a time and only while the commit is the pull request's head; it reads no files, and a re-run can only re-check the reviews (`test/meta/workflows.test.ts`, ADR 0086) | built |
| A pull request rewrites `.github/workflows/risk.yml`, or adds a workflow with a job named `risk gate`, which GitHub runs from the pull request's own copy, so the check reports low | T, E | `.github/` is a risk path, and code owner review on it is the control that holds: such a pull request needs the maintainer's approval (`scripts/ci/risk-gate.test.ts`). The machine user's token has no Workflows permission, so an agent pull request cannot change a workflow at all (ADR 0084). After the switch, the `main` ruleset requires `risk gate` from the GitHub Actions app only (ADR 0086 rule 5) | built (CODEOWNERS on the risk paths, ADR 0086) |
| An agent's change is recorded as the maintainer's | R | Pushes, pull requests and comments are made with the machine user's token, so GitHub records them as its own; commit author fields come from the session's environment and prove nothing while commits are unsigned (ADR 0050) | decided |
| A replayed issue carries an injected instruction, or a trial's code runs with the maintainer's rights when it is graded | E, I | Trials and their grading run inside the ADR 0084 sandbox with reviewed trial user settings that allow no GitHub host and deny web fetch and search; no GitHub token and no settings.local.json reach a trial; nothing a trial wrote is installed, because a trial that changes the lockfile or `pnpm-workspace.yaml` fails; results go to the maintainer's private repository, never this one (ADR 0085) | decided |

### C6 and C7: supply chain, CI and third parties

| Threat | STRIDE | Controls | Status |
|---|---|---|---|
| A compromised dependency reaches the image | T, E | Exact catalog versions, a 14-day release age, install scripts denied, a frozen lockfile; dependency audit, license gate and CodeQL as required checks | built, gap [#197](https://github.com/northMES/northmes/issues/197) |
| A known vulnerable dependency stays | E | Automated updates; a dependency audit in CI; accepted ones recorded | gap [#482](https://github.com/northMES/northmes/issues/482); accepted A-05 in the [risk register](risks.md) |
| A pull request from a fork steals a CI secret or writes to the repository | E, I | Read-only tokens, actions pinned by SHA, no `pull_request_target`, inputs through `env` | built |
| The oasdiff image of `CI / openapi diff` is swapped, or sends the documents elsewhere | T, I | The image is pinned by digest in `OASDIFF_IMAGE` and Renovate updates its tag and digest together; it runs with `--network none` and the workspace mounted read-only, in a job that holds only `contents: read` and no secret; the official action is not used, because it uploads the documents for a review page and sends telemetry by default (`test/meta/workflows.test.ts`, `test/meta/renovate.test.ts`) | built |
| A contribution arrives without a license grant, or a pull request signs the CLA for its own author or edits the check that judges it | T, R | `CI / cla` reads `signed.json` and runs its script from the default branch, never from the pull request, with no checkout and a read-only token; a commit without a GitHub account fails; signatures are recorded by the maintainer in a separate pull request; the exempt accounts (the maintainer, Renovate, github-actions on the release pull request, and the `northmes-agent` machine user of ADR 0084 on pull requests it or the maintainer opened) are listed by user id in the script on the default branch. GitHub links a commit to the account whose email the commit names, so anyone can author a commit that GitHub lists as an exempt account; the pull request's own author is always checked | built (not yet in `CI / gate`, ADR 0039) |
| A changed image is installed | T | Image digests in the release notes; signed and attested images, an SBOM and a Trivy scan | built (digests, image attestations, image SBOM), decided [#157](https://github.com/northMES/northmes/issues/157) |
| A leaked `ARGOS_TOKEN` uploads builds or changes the baseline a pull request is compared with | S, T | Argos's project token grants nothing in GitHub; only the `e2e` test step reads it; a visual change counts only after a person approves it in Argos (ADR 0077) | decided |
| Screenshots sent to Argos disclose data | I | Screenshots show only the fictional seed and the records a spec creates (ADR 0077) | decided |
| Nobody can tell who approved a visual change | R | Argos records who approved each change | decided |
| An Argos outage blocks merges | D | The Argos check is not required at first (ADR 0077) | decided |

## Residual risks

What stays after the controls above is in the [risk register](risks.md): each accepted risk with its reason, owner, review date and the ADR or issue that carries it. The gaps above are tracked by their issues under [#473](https://github.com/northMES/northmes/issues/473), and the internal audit before each release checks this page against the code (ADR 0076).
