---
status: "accepted"
date: 2026-10-05
decision-makers: "Krister Johansson"
consulted: "internal research notes 06, 20, 22, 24, 32, 33 and 34"
informed: "contributors and coding agents"
release: "1"
needs-confirmation: ""
---

# Shared building blocks: packages, the master-data kit, settings and generators

## Context and problem statement

Every NorthMES module needs the same pieces: a GraphQL subgraph, a web remote, commands with permission checks and an audit context, row-level security scopes, list and form screens, settings and tests on Postgres. Written once per module, these pieces drift apart. An earlier MES attempt by the same developer shows the pattern: a result-shaping file existed in eight byte-identical copies, a decorator that promised audit had 135 call sites and no code that read it, and the module generator copied a sibling module and was never rerun after its template grew. Krister Johansson decided that things repeated between modules become common packages, patterns and generators, with a master-data kit as the first named example.

This ADR covers the shared package map and its license boundary, the rule for when code becomes shared, the master-data kit, settings and configuration, the migration generator, the module, entity and command generators, and the recipe each extension point ships with. The module package shape is [ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md); the scheduling domain package is [ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md).

## Decision drivers

* Repeated code becomes shared packages, patterns and generators (Krister Johansson's decision).
* Plugins import only MIT packages, and no MIT package imports AGPL code ([ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md), [ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)).
* A cross-cutting rule copied into each module diverges, and the divergence becomes a security or compliance defect.
* Coding agents build one thin task at a time; a new code register must fit one task inside the plan budget of 15 files and 12 steps ([ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)).
* An abstraction built from one consumer takes that consumer's shape.
* Behaviour settings live in audited tables, not in environment variables ([ADR 0051](0051-regulated-readiness-no-regret-rules.md), rule 6).
* Generated output must match what the docs claim about it.

## Considered options

* Shared packages cut by runtime and license, three promotion thresholds, a master-data kit, settings as audited Zod definitions, and generators only with a golden test
* Each module writes its own wiring and screens, and shared code is extracted later when the copies hurt
* One shared common package plus a generator that stamps new modules by copying a template module

## Decision outcome

Chosen option: "Shared packages cut by runtime and license, three promotion thresholds, a master-data kit, settings as audited Zod definitions, and generators only with a golden test", because it removes copies at the seam where they appear, keeps the MIT boundary checkable per package, and lets a new register fit one task, while the kill rule and the golden test limit the cost of a wrong abstraction.

### Package map

| Package | License | Holds | Must not import |
|---|---|---|---|
| `@northmes/contracts` | MIT | value types (`code`, `quantity`, `money`, `externalRef`, `plantLocalDateTime`, `instant`, `localizedText`, `paletteColor` and `textColorFor`, `scopeLevel`), wire shapes, `defineCommandContract`, `defineMasterData`, `defineErrors`, `defineEvent`, `defineSettings`, the unit catalog ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md)), `resolveWallClock` and the millisecond window functions ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)) | Nest, React, Kysely, Apollo, other `@northmes/*` packages; Temporal is the global, never a polyfill import |
| `@northmes/<id>-contracts` | MIT | one module's command contracts, master-data definitions, event payloads, settings schema, error catalog, slot prop types, link helpers, generated lookup documents | server or web code of any module |
| `@northmes/sdk` | MIT | `defineModule`, command declarations, Kysely helpers, the GraphQL kit, jobs, MCP tool definitions, AI port types, health checks, settings and the master-data server factory, on subpaths `/commands`, `/data`, `/graphql`, `/jobs`, `/mcp`, `/ai`, `/health`, `/settings`, `/master-data` | React, AGPL paths; `pg-boss` and AI SDK types stay out of its public API |
| `@northmes/web-sdk` | MIT, shared singleton | web module contract, shell provider, Apollo client factory, `screenRoute`, `useConnection`, `useListState`, `useCommandForm`, permission hooks, slots, `announce()`, `formatPlantTime` | Nest, AGPL paths |
| `@northmes/ui` | MIT, shared singleton | primitives on one locked base, tokens, patterns (`DataTable`, `EntityListPage`, `EntityDetailPage`, `HistoryTab`, `EntityForm`, `SettingsForm`, `ConfirmDialog`, `QuantityInput`, `Lookup`), the form engine `useZodForm` | Apollo, TanStack Router, `graphql`, `@northmes/web-sdk` |
| `@northmes/web-build` | MIT | `defineRemoteConfig`, the shared singleton list, build guards, `sources.gen.css` | run-time code |
| `@northmes/testing` | MIT | Testcontainers harness, app factory, `given` factories, principals, `gqlClient`, contract suites (autoplan, ERP connector, master-data kit, command pipeline), AI mock, accessibility helpers, catalog lint | production code paths |
| generator package | MIT | module, entity and command templates | module code |

Dependencies point down from `@northmes/contracts`. The SDK declares and the AGPL host runs: the command bus, the audit writer, the gateway, the job runner, the MCP tool runner and the AI module are host code behind SDK interfaces. Each shared package has an `AGENTS.md` section that states what it owns, what it refuses, its test floor and its API report. Shared web packages export every name explicitly and add no federation share keys; the kits live inside the existing `@northmes/web-sdk` and `@northmes/ui` singletons.

### When something becomes shared

| Kind | Threshold | Examples |
|---|---|---|
| Cross-cutting rule | From the first use, shipped with its runtime and a fail-closed check in the same task | command pipeline, scoped transactions, DomainError and database error mapping, field guards, provenance, archive semantics, accessibility in primitives and shell services, plant time display |
| Mechanical glue | Zero copies in modules; a factory or the host owns it | subgraph wiring, remote config, test setup, MCP result shaping, readiness checks, job registration |
| Composite with a judgement | Third use, or second when both users ship in release 1; the second copy carries `// shared-candidate: #<issue>` | `DataTable`, `EntityForm` |
| Domain logic | Never shared by import between modules | planning rules stay in planning; other modules call planning's API module |

No decorator, manifest key or flag ships without the code that reads it. A change to a shared package is its own task and pull request, ordered before and run apart from the module tasks that use it. A module task that finds a missing shared piece writes a local copy with a `shared-candidate` comment and an issue, or stops at the question gate.

### Master-data kit

A register is an entity with a code, a name, a few scalar or reference fields, no child collections and no state beyond archive. Release 1 registers in core: equipment groups, tools, warehouses, customers and equipment. Articles, routings, operation equipment and calendars are not registers; they use the lower-level pieces directly.

One `defineMasterData` definition in the owner's contracts package yields the migration scaffold, the repository, the commands (create, update, archive, restore, move to company, upsert by external reference), the GraphQL type with its list and reference resolver, the list, detail and form screens, a picker (`MasterDataLookup`) that any dependent module can render, the permissions and the audit declarations. Register lists follow [ADR 0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md) through the list kit. API shapes come from the definition, never from the table, so a column added for internal use reaches neither GraphQL nor events. Migrations stay inline-SQL scaffolds that the module owns after generation.

The kit is built with equipment groups and tools first, because they differ in fields and allowed scope levels. Each register uses one escape level: 0 changes options in the definition, 1 adds own fields, commands or tabs, 2 replaces one screen or command, 3 leaves the kit. Escape levels are counted; if three of the first five registers need level 2 or 3, the kit is reworked before more registers use it. The kit assumes that codes compare case-insensitively and that an archived row keeps its code; both wait for the product owner ([ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md)).

### Settings and configuration

Settings are Zod definitions (`defineSettings`) in module contracts packages, stored in audited tables at company and plant scope and rendered by `SettingsForm`. Adding a module setting is one field in that schema. A settings field without a label and a description is refused at boot. Environment variables hold only infrastructure settings and secrets; behaviour-affecting configuration never lives there. Switches that look like infrastructure but change behaviour, such as enabling `/mcp` or a connector's shadow or live write-back mode, are audited settings commands. Statement triggers on the settings, role, role assignment, retention and installed-module tables bump `core.config_revision`, which every command row records ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)). A settings cascade below company and plant (user level) is a cut candidate.

### Generators and recipes

`pnpm gen:migration <module> <slug>` exists from the walking skeleton. It writes `migrations/<UTC yyyymmddHHMMss>_<slug>.sql` with a schema-qualified table, a uuidv7 id, `scope_id`, `version`, row-level security with the split policies of [ADR 0008](0008-row-level-security-with-transaction-local-scopes.md) (no `FOR ALL`, no `FORCE`), grants to `nm_app` and the audit trigger. A plugin foreign key that fails with SQLSTATE 42501 on `REFERENCES` gets the message "core does not allow references to core.customer; store the id without a foreign key or ask core to declare it".

The minimal module generator, the entity generator and the command generator ship in release 1 only together with a golden test. Templates call shared factories and never copy a module. Scaffolds (written once, then owned by the module) and regenerated files (`*.gen.*`, written by `pnpm gen`, never edited) never mix. The plugin generator, `create-northmes-plugin` and the screen generator wait until after the pilot.

The task that builds an extension point (validator, slot widget, screen, contributed field, migration) also writes its recipe, as a skill or in the module's docs: a table of hand-written and generated files, the exact pnpm commands, and each boot or composition error with its meaning.

If velocity is low, these go first, in this order, before any feature cut ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)): `objectFromZod` (register types then written by hand with the GraphQL kit), the module generator, the command generator, the settings cascade below company and plant.

### Consequences

* Good, because a new register takes an estimated four hand-edited files and one test file instead of about 19 to 21 (derived from the module layout, not measured), so it fits one task.
* Good, because a fix in a shared rule reaches every module in one commit and one CI run through `workspace:*` dependencies and lockstep versions ([ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)).
* Good, because plugins get a license-clean surface with committed API reports.
* Good, because every setting gets its form, history and audit without module code.
* Bad, because shared tasks must land before the module tasks that use them, which serializes some work.
* Bad, because a defect in a shared piece reaches every module; contract suites and the two example plugins booted in CI as canaries limit the damage.
* Bad, because GraphQL derived at run time hides schema changes; the committed subgraph SDL and its drift check keep them visible in review ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)).
* Bad, because the kit and the generators are work before the first register ships; the cut order above says what goes first.

### Confirmation

* Biome `noRestrictedImports` overrides: module web code (`modules/*/web/**` and plugin remotes) imports no `@base-ui/*`, `radix-ui`, `@radix-ui/*`, `react-hook-form`, `@hookform/*`, `@tanstack/react-table`, `@tanstack/react-virtual` or `sonner`; module server code imports no `pg`, `pg-boss`, `ai`, `@ai-sdk/*`, `@modelcontextprotocol/*`, `@graphql-hive/*` or `@apollo/subgraph`, and imports `kysely` only under `server/infrastructure/**`.
* A raw-SQL pattern script fails on `set_config(`, `pg_advisory`, `archived_at is null`, `version = version + 1` and `audit.` in module server code outside migrations, unless an allowlist entry gives a reason.
* The boot check exits when a module Mutation field maps to no registered command handler ([ADR 0012](0012-commands-as-the-single-write-path.md)).
* The license check fails when an MIT package imports `@northmes/module-*`, a `modules/` path or an `apps/` path. API Extractor reports for the MIT packages are committed, and an unreviewed change fails CI.
* Biome `noReExportAll` is an error in `@northmes/web-sdk` and `@northmes/ui`; a unit test asserts that the shell's share keys equal the shared list.
* A styling pattern check fails on status palette utilities, raw color classes and the panel class recipe in module web sources.
* The catalog lint in `@northmes/testing` requires `version`, `archived_at`, `scope_span`, the code exclusion constraint and the provenance columns on every register table.
* `pnpm gen` compares each `defineMasterData` definition with the module's generated `DB` type, and `pnpm gen && git diff --exit-code` fails on stale generated files.
* The master-data kit contract suite runs once per register.
* `gen-migration.test.ts`: a table generated from the template passes the row-level security and audit catalog lints with no edits; two files with the same timestamp prefix in one module fail the catalog; a fixture plugin with a foreign key to an ungranted core table fails with the message above.
* The generator golden test generates a module and a register into a temporary workspace and runs typecheck, migrations, the kit contract suite and the remote build. Every property the docs claim about generated output is an assertion in it.
* A copy detector over `modules/*` fails on a third copy unless the code is promoted or allowlisted with a reason (the tool is not chosen yet).
* The release checklist runs a usage report of `@northmes/ui`, `@northmes/web-sdk` and `@northmes/sdk` exports with fewer than two consumers.
* Settings tests: a field without label and description fails boot; changing a setting raises the next command row's `config_revision` by 1; enabling `/mcp` writes one audited command row.

## Pros and cons of the options

### Shared packages cut by runtime and license, with thresholds, a kit and tested generators

* Good, because each package's license and runtime are fixed, so import rules can check the boundary.
* Good, because cross-cutting rules ship together with their enforcement.
* Neutral, because the second copy of a composite stays in a module until a third use appears.
* Bad, because the kit, the settings form and the generators are work before the first module feature.

### Each module writes its own wiring and screens

* Good, because the first module ships without waiting for shared packages.
* Bad, because copies diverge: in the earlier attempt the database error mapping existed in five services and was missing in the two with the most unique constraints, so key races surfaced as internal server errors.
* Bad, because a register takes three or four tasks with coordination between them.

### One common package plus a generator that copies a template module

* Good, because there is one place to look.
* Bad, because a package whose change rate follows screen and entity work grows into a god package; the earlier attempt's contracts package reached 12 888 lines.
* Bad, because every later fix to the template becomes one edit per stamped module, and the generator stops matching its docs.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md), [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md), [0008](0008-row-level-security-with-transaction-local-scopes.md), [0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md), [0012](0012-commands-as-the-single-write-path.md), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md), [0017](0017-zod-contracts-as-the-single-source-for-inputs.md), [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), [0051](0051-regulated-readiness-no-regret-rules.md), [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md).
* Plan: [03-modules-and-extensibility.md](../plan/03-modules-and-extensibility.md#shared-packages-and-the-license-boundary) (packages, recipes, generators), [04-data-and-platform.md](../plan/04-data-and-platform.md#settings-and-configuration) (settings and the migration template), [14-roadmap.md](../plan/14-roadmap.md) (cut order).
* Open: which module owns scrap reasons (core or production-start); whether plugins may define registers in release 1 or the kit stays `@internal` until the public SDK.
* Revisit when three of the first five registers need escape level 2 or 3, when the public SDK is published after the pilot (plugin generator, `@public` tags), and when a second timeline or a chart used by two modules appears.
* Background: internal research note 33.
