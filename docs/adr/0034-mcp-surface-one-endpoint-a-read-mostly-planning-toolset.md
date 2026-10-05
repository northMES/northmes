---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 04, 22, 23 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (off by default per installation; personal access tokens before OAuth)"
---

# MCP surface: one endpoint, a read-mostly planning toolset

## Context and problem statement

The Model Context Protocol (MCP) lets an agent client that a planner already uses, such as Claude Code on a PC in the plant network, read NorthMES data and act through tools. Krister Johansson kept an MCP read-mostly planning toolset in release 1 and decided that MCP agents act as the user.

The stress test of the design (internal research note 32) proposed keeping `/mcp` off for the pilot: the endpoint costs 8 to 13 days, and the in-app assistant runs the same tool definitions in process without it. Krister Johansson's decision keeps the endpoint in scope, so this ADR ships it and switches it off by default on every installation. The MCP specification's current revision, 2026-07-28, removed sessions and the `initialize` handshake, while hosted clients still speak the 2025-era protocol (internal research note 04).

This ADR covers the `/mcp` controller in the core host, `defineTool` in `@northmes/sdk/mcp`, the shared tool runner, the planning tool handlers and MCP sign-in. The in-app assistant's adapter and model calls are in [ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md), proposals in [ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md).

## Decision drivers

* Krister Johansson's decisions: a read-mostly planning toolset, with agents acting as the user.
* One developer: no extra deployable, no wrapper library that must track a fast-moving specification.
* Both protocol eras must work from one endpoint.
* Roles are per plant, but `tools/list` has no plant parameter.
* Agent writes are proposals that a person commits; tool reads are not audited.
* The pilot runs on a plant LAN: OAuth login there needs HTTPS trust, an outbound fetch for client metadata and loopback redirect matching, and any one of these can block sign-in.
* Few, task-shaped tools with input schemas that every model provider accepts.
* An installation that does not use MCP should not expose it.

## Considered options

* One `/mcp` endpoint inside the Nest app on the official MCP SDK v2, eight planning tools, personal access tokens, off by default
* The same endpoint built on `@rekog/mcp-nest`
* A separate MCP host (`apps/mcp`) with OAuth 2.1 login through Better Auth's MCP plugin in release 1
* No MCP endpoint in release 1; the tool definitions serve only the in-app assistant

## Decision outcome

Chosen option: "One `/mcp` endpoint inside the Nest app on the official MCP SDK v2, eight planning tools, personal access tokens, off by default", because it delivers the decided toolset with the smallest surface: one controller in the existing process, tools defined once and shared with the in-app assistant, and a sign-in path that works on a plant LAN today. The tool list, the token-first sign-in and the default-off setting come from internal research note 04 and the stress test; Krister confirms the default-off setting and personal access tokens before OAuth.

### Endpoint

* `POST /mcp` runs inside the Nest app in the `api` role ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)). It is built on `@modelcontextprotocol/server` v2 directly in a Nest controller with `createMcpHandler(factory, { legacy: "stateless" })`, so clients of the 2026-07-28 revision and 2025-era clients work from one endpoint without a session store or sticky sessions.
* The controller validates `Origin` and `Host` itself, because the SDK handler checks neither.
* The endpoint is disabled per installation by default and enabled through an audited settings command, never an environment variable ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)). While it is off, `POST /mcp` returns 404.

### Tool definitions and the shared runner

* Each tool is a `defineTool` value in `@northmes/sdk/mcp` (MIT), plain data independent of the MCP SDK: name, toolset, Zod input and output schemas, permission, annotations (`readOnlyHint` and `destructiveHint` on every tool), effect (`read` or `proposal`) and handler. Modules expose their tools through the manifest's lazy `mcp` entry ([ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md)).
* One shared runner parses the input, checks the permission at the named plant, runs the handler in a transaction with the row-level security scope ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)), read tools in `SET TRANSACTION READ ONLY`, validates the output and returns `structuredContent` plus the same JSON as text. It maps errors before any adapter sees them: a known domain error becomes `{ code, safeMessage, retryable }`, anything else `{ code: "internal", correlationId }`.
* Two thin adapters sit on the runner: `toMcpTool` for `/mcp` and `toAgentTool` for the in-app assistant. The assistant never calls `/mcp` over HTTP, so a fix in the runner reaches both.

### The release 1 toolset

| Tool | Effect | Returns or does |
|---|---|---|
| `core_list_plants` | read | the plants the user can reach; a default only for a user with one plant |
| `planning_find_orders` | read | production orders by number, article, customer, status or due window; the `late` filter returns the late-order facts of [ADR 0030](0030-a-planning-board-built-in-house.md) |
| `planning_get_order` | read | one production order with operations, job orders, demand and material warnings |
| `planning_machine_schedule` | read | job orders on equipment for a plant and production day, with optional local from and to resolved on the server |
| `planning_capacity_load` | read | load against available time per equipment and day or shift |
| `planning_material_warnings` | read | job orders with a material shortfall |
| `planning_estimate_duration` | read | the duration of a quantity on equipment, from the scheduling domain as a pure function |
| `planning_propose_changes` | proposal | writes a proposal of moves that a planner reviews and saves ([ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)) |

The cap is eight tools; the late-order search is a filter on `planning_find_orders`, not a ninth tool.

### Tool rules

* Every plant-scoped tool takes an explicit `plant` argument, required unless the user reaches exactly one plant. There is no hidden active-plant state.
* `tools/list` is filtered by the union of the user's plant permissions and returns `cacheScope: "private"`, a short `ttlMs` and `listChanged: false`. Every call re-checks the permission at the plant it names.
* Agent-visible input schemas stay in a portable subset: objects, enums, arrays of primitives or of flat objects of primitives, and optional fields. No unions, records or recursion, because some providers reject them.
* Read tools take a `view` argument, `committed` or `draft`; MCP defaults to the committed plan ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)).
* Tool outputs give local time with offset plus the plant's zone id. Wall-clock inputs resolve on the server with `resolveWallClock` ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* ERP free text in results (CustomData, notes, customer names) is wrapped as `{ untrusted: true, text }`, capped at 500 characters per value and 50 values per call, and appears only in named data fields, never in tool descriptions or server instructions. The manifest-driven personal-field redactor runs on every tool output inside the runner.
* Proposing never takes or breaks a soft lock, and read tools return `heldByOther` as true or false, never the holder's identity.

### Sign-in, principal and audit

* Release 1 signs MCP clients in with a personal access token: a Better Auth api-key with `configId` `mcp`, prefix `nms_mcp_` and an expiry of at most 90 days. The token acts as the user with the user's roles; each call's rights are the token's scopes intersected with a live `can()` ([ADR 0011](0011-principals-credentials-and-same-origin-rules.md)).
* `/mcp` accepts only that token or a bearer JWT whose `aud` is the public origin plus `/mcp`, and ignores cookies. A request without a bearer gets 401 with a `WWW-Authenticate` header that carries `resource_metadata`. The GraphQL guard rejects MCP tokens, so an agent that can read its token cannot call the commit mutation as the user.
* OAuth 2.1 login through Better Auth's MCP plugin, with client ID metadata documents and a dynamic client registration fallback, comes later, after a spike on a plant LAN. When registration arrives it accepts only `http://localhost` and `http://127.0.0.1` redirect URIs.
* Calls run as the user with the token as credential and surface `mcp` ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)). Read calls write no command row and go to the structured log with their correlation id. `planning_propose_changes` opens an audit context and writes exactly one command. A denied call writes one `permission.denied` security event with surface `mcp`.
* The user docs say plainly that MCP clients run their own models under the user's own account: tool results become context at the client's model provider, outside the provider the customer configured for in-app features.

### What waits

MCP Apps views, WebMCP, an autoplan tool, admin and import tools, per-organization toolset toggles and `listChanged` notifications. `structuredContent` is shaped so a view can be added later without changing tools. If velocity forces cuts, the `/mcp` endpoint is item 3 of the cut order in [ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md); the SDK tool definitions and the shared runner stay, because the in-app assistant uses them.

### Consequences

* Good, because one process serves MCP with no session store, and any `api` replica can answer any request.
* Good, because tools are defined once, so the assistant and MCP clients get the same permissions, redaction and error mapping.
* Good, because a personal access token works on a plant LAN with no public URL and no outbound call.
* Good, because an installation that never enables MCP exposes nothing on `/mcp`.
* Bad, because users create and rotate tokens by hand until OAuth arrives.
* Bad, because NorthMES owns the `Origin` and `Host` checks and the bearer handling that a wrapper library would partly provide.
* Bad, because plan data leaves the plant through the MCP client's own model provider, which NorthMES does not control.

### Confirmation

* `mcp.disabled.int.test.ts`: `POST /mcp` returns 404 while the setting is off, and enabling it writes one audited settings command.
* `tool-bridge.int.test.ts`: the agent's tool list equals the SDK planning toolset filtered by `can()` for the user at the named plant.
* MCP integration tests with `@modelcontextprotocol/client` against the app on Testcontainers Postgres: a user without the propose permission gets no `planning_propose_changes` in `tools/list`; every tool declares both annotations and an `outputSchema`, and its `structuredContent` validates against it; a plant A user never gets plant B rows; calls work in both protocol eras.
* A CI check fails when the planning toolset holds more than eight tools.
* The tool schema lint fails on `z.union` in a tool input; the propose input passes it.
* Surface tests: a personal access token on `POST /graphql` returns 401; the commit mutation with an MCP token returns 401 or 403 and writes a security event; a session cookie on `POST /mcp` without a bearer returns 401 with `resource_metadata`; a request with a foreign `Origin` is rejected (proposed test name `mcp-origin.int.test.ts`).
* An MCP `planning_find_orders` call with the `late` filter writes no command row; a mocked `planning_propose_changes` writes exactly one.
* Each release gets one manual smoke test with Claude Code against `/mcp`.

## Pros and cons of the options

### One endpoint in the Nest app on the official SDK v2, tokens first, off by default

* Good, because the official SDK serves both protocol eras from one handler, and the definitions do not import it, so a future SDK major stays inside core.
* Good, because the toolset is small and task-shaped.
* Bad, because the endpoint costs 8 to 13 days of release 1 work.

### The same endpoint on `@rekog/mcp-nest`

* Good, because it serves both protocol eras on SDK v2 and runs Nest guards per tool, and the earlier attempt used it.
* Bad, because one maintainer carries almost all of its commits while tracking a specification whose 2026-07-28 revision broke compatibility.
* Bad, because it adds a microservice strategy layer, and NorthMES needs its own per-plant permission model anyway.

### A separate MCP host with OAuth in release 1

* Good, because OAuth login is what hosted clients expect.
* Bad, because it adds a deployable for one developer, and LAN OAuth needs HTTPS trust, the client metadata fetch and loopback redirects, each of which can block the pilot.

### No MCP endpoint in release 1

* Good, because it saves 8 to 13 days and removes an exposed surface.
* Bad, because it contradicts the decision to keep the toolset in release 1, and planners' own agents cannot read the plan.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md) manifest `mcp` entry, [0008](0008-row-level-security-with-transaction-local-scopes.md) row-level security, [0011](0011-principals-credentials-and-same-origin-rules.md) credentials bound to surfaces, [0013](0013-audit-trail-written-in-the-command-transaction.md) audit, [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) settings, [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) the draft view, [0030](0030-a-planning-board-built-in-house.md) late-order facts, [0035](0035-ai-provider-port-with-customer-configured-providers.md) the assistant, [0036](0036-agent-proposals-as-planning-records-a-person-commits.md) proposals, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) cut order, [0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md) MIT SDK packages.
* Plan: [10-ai-and-agents.md](../plan/10-ai-and-agents.md), sections "MCP endpoint and toolset" and "On-prem reachability"; [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md), section "The MCP endpoint"; [16-open-questions.md](../plan/16-open-questions.md).
* MCP specification, revision 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28
* Revisit after the LAN spike for OAuth sign-in, when a client the customer uses can render MCP Apps views and reach the server, and when a ninth tool is proposed.
