---
status: "proposed"
date: 2026-10-06
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 08, 13, 19, 20, 22, 23, 32 and 33
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Module package shape and the defineModule manifest

## Context and problem statement

Krister Johansson decided that release 1 ships the internal `defineModule` contract plus two example plugins, a backend command validator and a frontend widget. The public npm SDK, the app repository and the upgrade tooling come after the pilot. Every module and plugin exposes its own Federation subgraph ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)), and every module with screens ships its own Module Federation remote ([ADR 0019](0019-web-shell-with-react-module-federation-remotes.md)).

The host must know each module's id, dependencies, permissions, commands, validators, consumed events, slots, contributions and menu data before it loads any Nest code or any browser code, because the catalog checks run at boot step 4 ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)). Plugins must type the command inputs they validate and the slot props they render without importing AGPL code ([ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)).

The `defineModule` contract itself is accepted. This ADR proposes the module id and its derived names, the three packages of a module folder, the split of the server part, the manifest fields and the two visibility tiers. It covers `modules/*`, `examples/*`, drop-in plugins and `@northmes/sdk`.

## Decision drivers

* The host reads every manifest before Nest starts, so a manifest must not import Nest or module code.
* The license gate picks its policy from each package's own `license` field, and plugins may import only MIT packages.
* `@nestjs/graphql` builds a subgraph from its `include` module plus everything that module imports, and Nest adds every global module to every module's imports. One module importing another module's resolver module leaks those resolvers into its own subgraph (internal research note 20).
* One module must not disagree with itself across GraphQL, SQL and Module Federation names.
* The example plugins must use the same contract as core modules, so CI exercises the plugin path.

## Considered options

* One `defineModule` for modules and plugins, three packages per module folder, a static manifest
* One package per module, with the web part loaded through the manifest (`web: () => import("./web")`)
* All module contracts in one shared contracts package, with a folder per module
* A separate `definePlugin` contract for plugins

## Decision outcome

Chosen option: "One `defineModule` for modules and plugins, three packages per module folder, a static manifest", because the host can check the whole catalog without loading code, plugins type their inputs from MIT packages, and the integration spike ran this shape end to end with two plugins built outside the workspace (internal research note 20).

### One id, derived names

Every module and plugin has one kebab-case id matching `[a-z][a-z0-9]*(-[a-z0-9]+)*`. The SDK function `moduleNames` derives every other name. The host refuses two modules whose derived names collide, and refuses the ids `web`, `station` and `auth`, which are the first-party and library path segments under `/api/v1` ([ADR 0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md)).

| Name | Example for `production-start` | Used for |
|---|---|---|
| id | `production-start` | manifest, config, URL segment `/$plant/production-start`, static path `/modules/production-start/<version>/`, REST path segment `/api/v<major>/production-start/` |
| gql | `productionStart` | subgraph name, root field prefix (`productionStartReportQuantity`), permission and command prefix |
| sql | `production_start` | Postgres schema, owner role `nm_mod_production_start`, event prefix (`production_start.report.created`) |
| remote | `productionStart` | Module Federation remote name, which allows no hyphens |

### Three packages per module folder

| Package | License | Contents |
|---|---|---|
| `@northmes/module-<id>` | AGPL-3.0-or-later | manifest, `server/`, `migrations/`, `schema.graphql`, `docs/`, `test/`; exports `./manifest` and `./api` |
| `@northmes/<id>-web` | AGPL-3.0-or-later | the Vite remote, built with `@northmes/web-build` |
| `@northmes/<id>-contracts` | MIT | Zod inputs of public and validatable commands, validator payload schemas, event payloads, the settings schema, error codes, master-data definitions, slot prop types, the module's link manifest (`defineModuleLinks`) |

```text
modules/<id>/
  package.json          @northmes/module-<id>
  northmes.module.ts    the manifest
  server/               <Id>Module; api/ holds <Id>ApiModule
  migrations/           <UTC yyyymmddHHMMss>_<slug>.sql, run as nm_mod_<sql>
  schema.graphql        subgraph SDL written by northmes schema print
  contracts/            @northmes/<id>-contracts
  web/                  @northmes/<id>-web
  docs/  test/
```

A module without screens has no `web/` package. Planning also holds its pure scheduling package, `@northmes/planning-domain` ([ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md)). Value types that every module shares sit below all modules in `@northmes/contracts` ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)). Platform code that is not a module (catalog loader, migration runner, gateway, command bus) lives in the host `apps/server` and has no manifest.

### Server split

* `<Id>ApiModule` holds the module's public service API: plain providers, no resolvers. Other in-repo modules import it through `@northmes/module-<id>/api`.
* `<Id>Module` holds resolvers, command handlers, jobs and event handlers. It imports its own API module and the API modules of the modules it depends on. It is the default export of the manifest's `server` entry.
* Global Nest modules never import module packages.
* The isolation boot check computes reachability the way Nest does (`BaseExplorerService.getModules` per subgraph root, resolver classes found by metadata). Boot fails when a resolver-bearing Nest module is reachable from two subgraph roots or through a global module, and the message prints both import paths.

### Two visibility tiers

Core modules, connectors and plugins all use `defineModule`. Core modules and connectors may also import other modules' AGPL API modules. Plugins import only MIT packages: `@northmes/sdk`, `@northmes/web-sdk`, `@northmes/ui`, `@northmes/web-build`, `@northmes/testing`, `@northmes/contracts` and the `@northmes/<id>-contracts` packages. Release 1 ships `defineModule` as an internal contract: its API Extractor tag is `@internal`, and what the example plugins use is `@beta`. The brief's separate `definePlugin` shape is dropped.

### Manifest fields

The manifest is a small ES module that imports only `defineModule` from the MIT SDK, so the host reads it without loading Nest. The `server` and `mcp` entries are lazy imports. The host finds migrations as `migrations/*.sql` next to the manifest; the manifest does not import them.

| Field | Content |
|---|---|
| `id` | the module id |
| `version` | imported from the package's `package.json` |
| `northmes` | the NorthMES version range the module accepts ([ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)) |
| `dependsOn` | ids of the modules it depends on |
| `permissions` | `<module>.<entity>` keys with their actions ([ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md)) |
| `roles` | default roles with their permissions |
| `settings` | the Zod settings definition from the contracts package |
| `events` | owned event types with versions |
| `consumes` | the events the module consumes, as `{ event, version }` per event; the sequencer enqueues a job per consumer from it ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md), [ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md)) |
| `commands` | owned commands, each with a `validatable` flag; a validatable command also declares the longest time limit it accepts from a validator |
| `validates` | the module's validators, as `{ id, command, payload }` per validator, where `payload` is the owner's payload version; boot step 4 checks each entry, and boot stops on an entry without a registered validator or a registered validator without an entry ([ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md)) |
| `personalData` | personal data declarations |
| tables | a lifecycle class per table (`record`, `working`, `operational`, `reference`) and the audit field declarations (skip, redact) ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)) |
| `web` | static data: `label`, `permission`, `order` (required); owned `slots` as a record of slot id to `{ kind }`; `contributes` as a list of `{ id, slot, label, order, permission }`, whose implementations the remote supplies under the same ids ([ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md)) |
| `subscriptions` | whether the module serves GraphQL subscriptions |
| `ai.features` | the AI features the module offers ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)) |
| `server`, `mcp` | lazy imports of the Nest module and the MCP tool definitions |

```ts
// modules/planning/northmes.module.ts (shape)
export default defineModule({
  id: "planning",
  version,
  northmes: ">=0.1.0-0 <0.2.0-0",
  dependsOn: ["core"],
  commands: { "planning.releaseProductionOrder": { validatable: true } },   // plus the longest validator time limit it accepts
  web: {
    label: "Planning", permission: "planning.productionOrder:read", order: 20,
    slots: { "planning/board/side/v1": { kind: "region" }, "planning/board/block-fields/v1": { kind: "field" } },
  },
  server: () => import("./server/planning.module.js"),
  mcp: () => import("./server/mcp/planning.tools.js"),
});
```

The `web` data is static because the remote is a separate build that the browser loads by URL, while the server needs the label, permission, order, slots and contributions before any browser code runs, so that the shell can name a contribution whose remote failed. The remote's `defineWebModule` repeats `id`, `version` and the range and supplies each contribution's implementation under its manifest id, and a build check compares them with the manifest. Because `order` is required, a module whose remote fails keeps its usual sidebar position, marked "(unavailable)".

### Consequences

* Good, because the host checks ids, dependencies, ranges, commands and slots before it loads any module code, and lists every problem in one message.
* Good, because a plugin imports a module's command and slot contracts from an MIT package and never touches AGPL code.
* Good, because the spike showed what a typical task touches: a new validator on a command already declared validatable is two hand-written files plus a test (internal research note 20).
* Bad, because every module has three `package.json` files, three license fields and up to three builds.
* Bad, because the static `web` data and the remote's `defineWebModule` repeat id, version and range, which needs the build check.
* Bad, because the server split doubles the Nest modules per module, and a wrong import surfaces only at boot.

### Confirmation

* `moduleNames` unit tests: `production-start` yields `productionStart`, `production_start`, `nm_mod_production_start` and remote `productionStart`; ids such as `Planning`, `-a`, `a-` and `a--b` are rejected.
* Catalog test: two modules whose derived names collide make boot exit 1 naming both ids; a validator for an undeclared command and a slot contribution outside the `dependsOn` closure each exit 1; the module ids `web`, `station` and `auth` are each refused as reserved, and the message names the id.
* Manifest load test: importing every in-repo manifest in a fresh process loads no `@nestjs/*` package.
* Isolation contract suite with five fixtures: a sub-module of another module, an untyped `@Resolver()`, a global host module, an API module importing its own resolver module, and a typed control. Each failing fixture makes boot exit 1 with the named import path; the control boots.
* Remote build check: a remote whose `defineWebModule` version differs from its manifest fails `pnpm plugin:build` and the in-repo remote build.
* Sidebar test: with one remote's files missing, the sidebar order equals a run with all remotes present, and the missing entry reads "(unavailable)".
* License and import checks: every workspace package has a `license` field; every `@northmes/<id>-contracts` package is MIT; the MIT-imports-no-AGPL check fails when an MIT package or an `examples/*` plugin imports an AGPL package.
* The API Extractor report of `@northmes/sdk` marks `defineModule` `@internal` and the members the examples use `@beta`.

## Pros and cons of the options

### One `defineModule`, three packages, static manifest

* Good, because core modules and plugins go through the same catalog checks, so the plugin path is tested by every boot.
* Good, because the contracts package can be MIT while the module and the remote stay AGPL.
* Bad, because a module folder carries three packages.

### One package per module with a lazy web import

* Good, because a module has one `package.json` and one license.
* Bad, because the server needs the web metadata before any browser code runs, and a remote is a separate build loaded by URL, so a lazy import of `./web` does not fit (internal research note 20).
* Bad, because the license gate cannot give the plugin-facing contracts a different license from the module.

### One shared contracts package with a folder per module

* Good, because there is one MIT package to publish and version.
* Bad, because a plugin that depends on planning would import every module's contracts, and the package would depend on all modules' definitions at once.

### A separate `definePlugin`

* Good, because the plugin surface could be smaller and documented on its own.
* Bad, because core modules would no longer exercise the plugin contract, and two contracts would need upkeep. The review of other plugin systems recommends one function with two visibility tiers instead (internal research note 08).

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) boot sequence, [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) migrations and owner roles, [0013](0013-audit-trail-written-in-the-command-transaction.md) lifecycle classes, [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) subgraphs, [0019](0019-web-shell-with-react-module-federation-remotes.md) remotes, [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) shared packages, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) plugins, [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) versions and ranges, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) license gate, [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md) scheduling package, [0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md) the link manifest in the contracts package, [0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md) extension points, slot kinds, `validates` and `consumes`.
* Plan: [03 modules and extensibility](../plan/03-modules-and-extensibility.md), [02 architecture](../plan/02-architecture.md).
* Revisit when the public SDK is published after the pilot (the `@internal` and `@beta` tags then move to `@public` for the stable parts), or when plugins need in-process access to core services beyond GraphQL references, validators, events and slots.
