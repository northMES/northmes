---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 02, 13, 18, 20, 32, 34
informed: NorthMES contributors
release: "1"
needs-confirmation: ""
---

# GraphQL Federation inside one process with an embedded Hive Gateway

## Context and problem statement

NorthMES serves its web app through one GraphQL endpoint, `/graphql`. Core, planning, production-start, the Pyramid connector and the two example plugins contribute types and fields, and later modules and customer plugins must add more without changes to core. Krister Johansson decided that every module and plugin exposes its own GraphQL Federation subgraph, written NestJS code-first, and that Hive Gateway composes the supergraph the web reads. Krister Johansson kept this shape against internal research note 02, which recommended one modular schema without Federation.

The pilot runs every module in one Node process (role `all`) on one Linux host, and one developer builds it with coding agents. This ADR decides how subgraphs, composition, the gateway, its limits and the committed schema snapshot work in that setting. It covers `@northmes/sdk/graphql`, the core gateway module in `apps/server`, `northmes schema print` and the files under `schema/`.

## Decision drivers

* The decided shape: one subgraph per module and plugin, a supergraph composed by Hive Gateway, NestJS code-first.
* A plugin adds fields to core entities by name, without importing AGPL core classes, so it can depend on the MIT SDK only.
* Module authors write types and resolvers, never `GraphQLModule` or Federation configuration.
* The pilot has one host and role `all`: no extra container, no loopback hop, no internal endpoints to hide from browsers.
* No Elastic-2.0 code in an AGPL product: `@apollo/gateway` is Elastic-2.0, and `@graphql-yoga/nestjs-federation` depends on it.
* Composition errors and silent merges (a duplicate enum, a drifted shared input) fail at boot or in CI with the subgraph names, never at a plant.
* Web codegen and plugin checks read a committed schema that depends only on what is in the repository.

## Considered options

* One code-first modular schema without Federation (internal research note 02).
* Federation with one HTTP subgraph endpoint per module and a separate gateway container.
* Federation with subgraphs built in process by a schema-only driver and the Hive Gateway runtime embedded in the same Nest process.

## Decision outcome

Chosen option: "Federation with subgraphs built in process and an embedded Hive Gateway runtime", because it implements the decided shape at a cost a spike measured as small, and it needs neither a second container nor subgraph routes on the public port.

Subgraphs:

* The host turns each enabled module or plugin with a `server` entry into a subgraph by calling `defineSubgraph({ name, module, subscriptions })`. The subgraph name is the module's GraphQL name (module id `production-start` gives `productionStart`), so the root-field prefix has one source.
* `InProcessSubgraphDriver` in `@northmes/sdk/graphql` (MIT) builds the schema with Nest's `GraphQLFederationFactory`, registers `{ name, schema, sdl, url: "inproc://<name>" }` and starts no server. It needs neither `@nestjs/apollo` nor `@apollo/server`.
* Authors declare types through `graphqlKit(() => <Id>Module)` and reference other modules' entities with `entityRef("Article")`. The kit applies `registerIn`, `@key`, the `includeModules` workaround and the orphaned entity stubs.
* Every subgraph sets `fieldResolverEnhancers: ["guards", "interceptors", "filters"]`, so guards also run on fields reached through `_entities`.

Gateway:

* `GatewayModule` creates the runtime with `createGatewayRuntime` from `@graphql-hive/gateway-runtime` in `onApplicationBootstrap`, after every subgraph schema exists, and mounts it as Nest middleware on `/graphql`; the middleware answers 503 until the runtime exists. Boot awaits `runtime.getSchema()`, so supergraph errors surface at boot and an early subscription finds a schema.
* graphql-ws runs on one `ws` server with `noServer: true`, reached from the HTTP server's `upgrade` listener. SSE is served on the same endpoint for `Accept: text/event-stream`.
* A hybrid transport executes `inproc://` subgraphs with `createDefaultExecutor` from `@graphql-mesh/transport-common`. It keeps one subgraph context per client request and subgraph, so DataLoader caches survive several `_entities` calls. The HTTP branch stays in the code for a module that later leaves the process; HTTP subgraph mode is not shipped in release 1.
* A gateway plugin resolves the principal once per client request and passes it to every subgraph call as an object, with no header and no second session lookup.
* There is no `apps/gateway`. `@apollo/gateway` and `@graphql-yoga/nestjs-federation` are never installed.

Composition at boot: the gateway composes the supergraph from the enabled subgraphs with `@theguild/federation-composition`, then applies the NorthMES rules. Any error exits the process with code 1 and a `SupergraphCompositionError` that lists each error on its own line.

| Rule id | Fails when |
|---|---|
| `NORTHMES_ROOT_FIELD_PREFIX` | a Query, Mutation or Subscription root field does not start with the subgraph's GraphQL name followed by an upper-case letter (`planningReleaseProductionOrder` passes); namespace objects are not used |
| `NORTHMES_TYPE_OWNERSHIP` | a non-entity type or enum appears in more than one subgraph and is not an SDK shared type |
| `NORTHMES_CONTRIBUTED_FIELD_NULLABLE` | a field one module adds to another module's entity is non-null |
| `NORTHMES_SDK_TYPE_DRIFT` | a shared type prints differently in two subgraphs |

The shared-type allowlist holds `PageInfo`, the time scalars, the list operator inputs and enums, and the unit enums with their measured filters; a new shared type enters only through `@northmes/sdk`. The drift rule exists because composition merges input types, and enums used in inputs, by intersection without an error. The supergraph hash appears in the boot log, on `/health/ready`, on the System health page and in the `x-northmes-build` header.

The SDK pins the federation link to v2.9, because `@nestjs/graphql` 14 links v2.14 by default and the composition library accepts v2.0 to v2.9. `@nestjs/graphql`, `@apollo/subgraph`, `@theguild/federation-composition`, `@graphql-hive/gateway-runtime`, `@graphql-mesh/transport-common` and `graphql` 16 are pinned exactly in the pnpm catalog and upgraded together in one pull request.

Limits and guards:

* `maskedErrors` is on, and the SDK exception filter masks unknown errors inside each subgraph as "Unexpected error." with a correlation id.
* Depth 12 and 2 000 tokens per document come from graphql-armor plugins added to the runtime's `plugins`, because they are not runtime options.
* Hive `demandControl` runs with `@listSize` on every connection field and a `maxCost` that starts at 20 000 and is then set from measured persisted documents.
* Field suggestions are blocked, and introspection is refused for unauthenticated requests.
* One global permission guard reads `@RequirePermission`; `@Public()` is the only opt-out. At boot a walk over resolver classes exits with code 1 and names `Type.field` when a field carries neither.
* A persisted-documents manifest is generated now and enforced later.

Schema snapshot and checks:

* `northmes schema print` builds the subgraphs of a fixed list of in-repo modules. It never reads `northmes.config.json`, completes with `DATABASE_URL` unset and constructs no database pool, so a developer's local plugin cannot leak into committed files.
* Committed files: `schema/api.graphql` (the client-facing SDL, without `join__` types or `@inaccessible` fields), `schema/supergraph.graphql`, each `modules/<id>/schema.graphql` and one closure schema per web package.
* The example plugins stay out of the snapshot; `pnpm plugin:check <id>` composes a plugin's SDL against it.
* `pnpm gen` runs in a fixed order: schema, closure schemas, typed documents, CSS sources, database types (only when the migrations hash changed), reference docs. `pnpm gen --check` writes to a temporary directory and diffs. Output is deterministic (`lexicographicSortSchema`, sorted keys). Generated paths are marked `linguist-generated`, and the rule for a merge conflict in a generated file is "run `pnpm gen`".
* GraphQL Inspector diffs `schema/api.graphql` against the base branch. In 0.x it reports and its entity-field diff goes into the release notes; from 1.0 it is a gate.
* CI composes the pull request's subgraphs with a corpus: the in-repo examples, the SDL in `test/plugin-corpus` and the built package of any plugin the pilot runs. There is no blanket freeze of `@key` entity fields and no release-candidate contract channel.

### Consequences

* Good, because a plugin adds a field to core's `Article` through `entityRef` and `@external` by name. The contract is the type name, the key and the exact type of each external field, and composition checks all three.
* Good, because composition errors name the subgraphs and stop the boot or the pull request; the spike's deliberately broken plugin produced three named errors.
* Good, because the measured cost is small. On one Apple M4 machine (pilot-scale figures, not a capacity plan) the embedded gateway added about 0.07 ms per request over a plain Apollo server, each extra in-process subgraph call cost 0.1 to 0.2 ms against about 0.5 ms over loopback HTTP, and boot of the whole process with three subgraphs took 101 to 121 ms.
* Good, because boot composition cannot drift from the code in the image; composing 24 subgraphs with 575 types took 62.1 ms.
* Good, because SSE on the same endpoint gives a site that blocks WebSockets a fallback with no extra code.
* Bad, because the pinned versions carry five traps the SDK must absorb: `registerIn` ignored on the federation path (worked around with the internal `includeModules` key), the v2.14 default link, dropped entity stubs, `@ResolveReference` arguments without `@Parent()`, and an async subscription context under guards. `graphql` also loads twice under Vitest unless the root config aliases it.
* Bad, because the Hive packages release often (internal research note 18 counted 58 stable `gateway-runtime` releases in 2026), so every upgrade is a deliberate pull request with the contract tests.
* Bad, because a feature that touches another module's entity needs an `entityRef` stub and a nullable field, which one schema would not need.
* Bad, because one event loop serves the gateway and the resolvers. The pilot host's headroom is measured in the first month, and the `api` role scales by replicas.

### Confirmation

* `gateway/composition.test.ts`: each NorthMES rule fails with its rule id; the broken example plugin yields the expected errors; the drift rule names both subgraphs.
* `gateway/boot.int.test.ts`: a composition error exits with code 1; the supergraph hash appears in the boot log and on `/health/ready`; a subscription sent before the first HTTP request works; two subgraphs boot without "multiple types named" (this guards the `includeModules` workaround).
* `gateway/guards.int.test.ts`: a resolver field without permission or `@Public` makes boot exit 1 and name `Type.field`; a contributed field returns `FORBIDDEN` while its parent object returns; anonymous `{ __schema { types { name } } }` returns `UNAUTHENTICATED`; a 13-level query returns a depth error; a document over `maxCost` is refused.
* `gateway/principal.int.test.ts`: one session lookup serves a request that touches three subgraphs.
* `schema/print.int.test.ts`: print with `DATABASE_URL` unset constructs zero pools, finishes under 5 s and equals the committed files; adding a plugin to `northmes.config.json` leaves the snapshot unchanged.
* `test/meta/gen.test.ts`: `pnpm gen` twice leaves an empty diff; adding a field to a planning resolver makes `pnpm gen --check` exit 1 and name `schema/api.graphql`. `pnpm check` runs `pnpm gen --check`.
* Plugin corpus CI job: a fixture with a breaking planning change fails when composed with a corpus SDL.
* A CI check fails unless `node_modules/.pnpm` holds exactly one `@nestjs+graphql@` directory. The license gate of [ADR 0040][adr-0040] refuses `@apollo/gateway` and `@graphql-yoga/nestjs-federation`.

## Pros and cons of the options

### One code-first modular schema without Federation

* Good, because there is one schema file, no gateway, no entity stubs and no composition step.
* Good, because subscriptions are plain async iterators and tests need no gateway.
* Bad, because it contradicts the decided shape.
* Bad, because a plugin field on a core type needs a reference to the AGPL core class, or a by-name type registry in the SDK whose feasibility with code-first `@ResolveField` was not verified.
* Bad, because a module that later leaves the process needs a Federation migration at that point.

### Federation with HTTP subgraphs and a separate gateway container

* Good, because the gateway's CPU is separate and scales apart from the resolvers, which matters only past pilot load.
* Bad, because every subgraph call crosses loopback HTTP; in the spike, cross-subgraph throughput was half that of in-process execution.
* Bad, because subgraph routes share the public port and must be hidden from browsers, and the principal travels in a signed header that each subgraph verifies.
* Bad, because a plain `Error` thrown in a resolver leaked its message through the gateway in HTTP mode, even with `NODE_ENV=production`.
* Bad, because it adds a second image or role, a second health check and a start order.

### Federation in process with an embedded Hive Gateway runtime

* Good, because it meets the decided shape with no extra container and no loopback hop.
* Good, because the hybrid transport keeps the HTTP path open for a later split.
* Neutral, because the SDK and gateway hold about 500 lines of code plus tests; internal research note 18 estimated 6 to 9 developer days with agents.
* Bad, because it depends on version-specific workarounds and exact pins.

## More information

* Related ADRs: [0002][adr-0002] (process roles), [0003][adr-0003] (module manifest), [0011][adr-0011] (same-origin rules), [0012][adr-0012] (mutations are commands), [0016][adr-0016] (list conventions), [0017][adr-0017] (Zod inputs), [0018][adr-0018] (subscriptions), [0022][adr-0022] (SDK packages), [0037][adr-0037] (plugins), [0038][adr-0038] (versions and API reports), [0043][adr-0043] (health), [0058][adr-0058] (`pnpm gen` and `pnpm check`).
* Plan: [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md) holds the type rules, the SDK traps table and the full test list; [02-architecture.md](../plan/02-architecture.md) the boot order; [13-delivery-and-github.md](../plan/13-delivery-and-github.md) the CI jobs.
* The design was tested on 2026-10-04 with `@nestjs/graphql` 14.0.3, `@apollo/subgraph` 2.15.1, `@graphql-hive/gateway-runtime` 2.12.1, `@graphql-mesh/transport-common` 1.1.0, `@theguild/federation-composition` 0.27.0 and `graphql` 16.14.2.
* Hive Gateway documentation: https://the-guild.dev/graphql/hive/docs/gateway/subscriptions and https://the-guild.dev/graphql/hive/docs/gateway/other-features/security.
* Revisit when a module needs its own deployable (move it to the HTTP transport and sign the principal), when `@theguild/federation-composition` accepts links above v2.9, when `@nestjs/graphql` passes `include` to the federation factory so the `includeModules` workaround can go, when the pilot host shows event-loop contention between gateway and resolvers, and at 1.0, when GraphQL Inspector becomes a gate.

[adr-0002]: 0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0016]: 0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0040]: 0040-dependency-license-policy-ci-gate-and-sbom.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0058]: 0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
