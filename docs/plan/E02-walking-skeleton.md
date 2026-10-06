# E02 platform: Boot a walking skeleton end to end

This file holds the tasks of epic E02 (northMES/northmes#18), shaped as thin vertical slices by the rules in [13-delivery-and-github.md](13-delivery-and-github.md#shaping-the-plan-into-issues). The epic, its stories, their criteria and their named tests are in [14-roadmap.md](14-roadmap.md#e02-platform-boot-a-walking-skeleton-end-to-end); each story section below links its roadmap section and adds only what the tasks need. A "Covers" line names the story criteria a task delivers, numbered by their order in the roadmap. Once an issue exists for a task, its number goes on the task's Issue line, the issue becomes the source of truth for scope, and this file is not edited again. Every task carries `human` and runs in an interactive session or as a run on `northmes-guided` (Krister Johansson's choice of 2026-10-06), because ADRs [0003](../adr/0003-module-package-shape-and-the-definemodule-manifest.md), [0004](../adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md), [0006](../adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md), [0008](../adr/0008-row-level-security-with-transaction-local-scopes.md), [0012](../adr/0012-commands-as-the-single-write-path.md), [0014](../adr/0014-outbox-event-log-and-pg-boss-jobs.md), [0020](../adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md) and [0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) are proposed and ADRs [0005](../adr/0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0019](../adr/0019-web-shell-with-react-module-federation-remotes.md), [0037](../adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) and [0038](../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) have open needs-confirmation.

E02-S01-T01 is the foundation session pull request: it lands every root configuration change the skeleton needs, including the `package.json` of every E02 workspace package, so later E02 tasks and the E03 runs change no root configuration and no lockfile. Every other task comes after it, and it comes after E00-S05-T03 (#202), so the `docs/sources/` paths the tasks port from exist. The earliest point where the shell shows information from module subgraphs and saves information through a command is E02-S05-T08: after it, the planning board stub lists production orders with their article names from the planning and core subgraphs, and its Release button runs `planningReleaseProductionOrder`. Before that, E02-S04-T03 is the first task that serves module data from Postgres through the gateway, and E02-S04-T06 the first that saves through a command. A hand test in the browser needs the stack script and `pnpm dev` (E02-S08-T01 and E02-S08-T05), which the story order puts after E02-S07.

Until E05, every task follows these tracer rules. There is no sign-in; a tracer principal holds every permission (E05-S05, E05-S06). A request names its plant by the plant's scope id in `x-northmes-plant`, and one transaction step sets `northmes.read_scopes` and `northmes.write_scopes` to that one id (E05-S03, E05-S04). `given.company()` and `given.plant()` return fresh scope ids without rows, and `db.command` opens a scoped transaction without an audit context (E05-S02). Every package version is 0.0.0 until the first release-please release (E01-S03-T02). Recipes go to `docs/recipes/<name>.md`, because [ADR 0063](../adr/0063-agent-skills-from-library-authors-pinned-in-the-repository.md) keeps `.claude/skills` to the vendored skills. Test names start with the story id ([ADR 0041](../adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).

#### E02-S01 platform: Load manifests and stop boot on catalog errors

Issue: northMES/northmes#19. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s01-platform-load-manifests-and-stop-boot-on-catalog-errors). Blocked by: E00-S07-T01 (#206), E01-S05-T02 (#214).

Notes: criteria 2, 4 and 6 are split over two tasks each. Criterion 2 of E02-S08 (the dev secret refusal) lands in E02-S01-T06, because `secrets.test.ts` is the only test of the dev marker ([ADR 0060](../adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md)).

##### E02-S01-T00 docs: Record the E02 plan and ADRs

Labels: `task`, `human`, `area: docs` (the epic's plan docs task, worked in a session). Blocked by: none.

Covers: no story criterion; the epic's shaping file.

```markdown
Plan: E02-S01-T00

## Goal
A person works this task in a session. The docs pull request that adds docs/plan/E02-walking-skeleton.md closes this issue with Closes #N, which ci / linked issue requires. The file holds every E02 task with its labels, its blockers and the story lines it covers, plus the tracer rules E02 follows until E05. When the session finds that E02 needs a new ADR, it adds the ADR as proposed from docs/adr/template.md with its row in docs/adr/README.md and raises the next free number by one.

## Where in the code
docs/plan/E02-walking-skeleton.md (new): the E02 tasks, their order and the tracer rules
docs/adr/README.md (exists; changes only when a new ADR is added)

## Tests first
- Session check: every checkbox and every named test of stories #19 to #26 maps to one task in the file
- Session check: every task body is under 3 500 characters and has 3 to 8 checkboxes
- Session check: no body names a private research path, a customer or a value from product owner files

## Design
none

## ADRs
docs/adr/0001-record-architecture-decisions-in-madr.md
docs/adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md

## Out of scope
Creating the task issues (the planning session after the merge), user guides and ADR status changes (E02-S08-T06).

## Changelog
docs(plan): record the E02 plan and ADRs

## Acceptance criteria
- [ ] docs/plan/E02-walking-skeleton.md is on main and its pull request closes this issue
- [ ] Every story checkbox and named test of #19 to #26 sits in exactly one task, or the pull request description lists it as an open question
- [ ] Every task names its labels, its blockers by plan id and the story lines it covers
- [ ] No body names a private research path, a customer or a product owner value
```

##### E02-S01-T01 repo: Land the root configuration the walking skeleton needs

Labels: `task`, `human`, `area: ci` (session pull request). Blocked by: E00-S07-T01 (#206), E01-S05-T02 (#214), E00-S01-T02 (#4), E00-S02-T02 (#194), #186.

Covers: criterion 7; criterion 8; test `source-exports.test.ts`.

```markdown
Plan: E02-S01-T01

## Goal
A person lands, in one session pull request, every root configuration change the skeleton needs, so no later E02 task or E03 run changes a root config or the lockfile. It creates every E02 workspace package.json with its dependencies, pins each new dependency in the catalog at a version older than Renovate's minimumReleaseAge window, and adds the root scripts later tasks fill.

## Where in the code
package.json (exists): version 0.0.0; scripts northmes, gen:migration, plugin:build, dev and e2e, whose targets their tasks add
pnpm-workspace.yaml (exists; catalog), pnpm-lock.yaml (regenerated)
vitest.config.ts (exists): alias graphql to one copy
turbo.json (exists): build outputs of apps/*, modules/planning/web, examples/plugin-validator
biome.json (exists): style/noProcessEnv error outside packages/sdk/src/config, tests, scripts, tool configs
tsconfig.base.json (exists): experimentalDecorators, emitDecoratorMetadata, useDefineForClassFields false
.gitattributes (new; snapshots linguist-generated), .gitignore (exists; .northmes/, plugins/)
package.json (new, 11) of packages/sdk, contracts, web-sdk, web-build; apps/server (also ./testing), apps/web; modules/core, planning, planning/contracts, planning/web; examples/plugin-validator (host packages as peers); packages/testing (exists). Version 0.0.0, "@northmes/source" before "default"; MIT for packages/* and planning/contracts, else AGPL-3.0-or-later.
test/meta/source-exports.test.ts (new), test/meta/tooling.test.ts (exists)
New: @nestjs/common, core, platform-express, graphql, config, terminus, testing; @apollo/subgraph, graphql, @theguild/federation-composition, @graphql-hive/gateway-runtime, @graphql-mesh/transport-common, graphql-ws, ws, graphql-subscriptions, reflect-metadata, rxjs, zod, kysely, pg, semver, rolldown, ms, react, react-dom, @tanstack/react-router, @apollo/client, vite, @module-federation/vite and runtime, @testing-library/react, @playwright/test, and @types packages.
Seam: files read with node:fs; Biome runs on in-memory files.

## Tests first
- source-exports.test.ts: "E02-S01 every workspace package lists @northmes/source before default"
- source-exports.test.ts: "E02-S01 no root or package script passes the @northmes/source condition"
- tooling.test.ts: "E02-S01 style/noProcessEnv fails in module server code and passes in packages/sdk/src/config"
- tooling.test.ts: "E02-S01 pnpm-lock.yaml holds one @nestjs/core and one @nestjs/graphql resolution"

## Design
none

## ADRs
docs/adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md

## Out of scope
Source code and package scripts (each package's first task), playwright.config.ts (E02-S08-T02), northmes.config.json (E02-S04-T07), Tailwind (E04).

## Changelog
build(repo): add the skeleton's root configuration and dependencies

## Acceptance criteria
- [ ] pnpm install --frozen-lockfile and pnpm check pass
- [ ] The pull request lists each new dependency's version and release date, all older than the minimumReleaseAge window
- [ ] Every E02 workspace package exists with its license, its dependencies and "@northmes/source" before "default"
- [ ] Biome reports style/noProcessEnv in module server code only
- [ ] The lockfile holds one @nestjs/core and one @nestjs/graphql resolution
```

##### E02-S01-T02 platform: Define module manifests and derive module names in the SDK

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S01-T01.

Covers: criterion 1; criterion 2 (the derived names); test `module-names.test.ts`.

```markdown
Plan: E02-S01-T02

## Goal
@northmes/sdk exports defineModule (tagged @internal), moduleNames and HOST_PROVIDED from its root. moduleNames(id) checks the id against [a-z][a-z0-9]*(-[a-z0-9]+)* and derives the GraphQL name, the SQL name, the owner role nm_mod_<sql name> and the remote name. HOST_PROVIDED lists @nestjs/*, @nestjs/graphql, @apollo/subgraph, graphql, reflect-metadata, rxjs, zod, @northmes/sdk and temporal-polyfill, and isHostProvided(specifier) matches them. The core and planning manifests import only defineModule and their version from their package.json; planning depends on core and declares planning.releaseProductionOrder validatable and a web block with label and order. Server entries arrive with each module's first server code.

## Where in the code
packages/sdk/src/manifest.ts, module-names.ts, host-provided.ts, index.ts (new)
packages/sdk/tsconfig.json, packages/sdk/LICENSE (new, MIT); packages/sdk/package.json (exists; build and typecheck scripts)
modules/core/northmes.module.ts, modules/planning/northmes.module.ts (new)
packages/sdk/test/module-names.test.ts, packages/sdk/test/host-provided.test.ts (new)
test/meta/manifest-load.test.ts (new)
Port from docs/sources/spike-integration/packages/sdk/src/ (manifest.ts, host-provided.ts) and docs/sources/spike-integration/modules/core/northmes.module.ts and modules/planning/northmes.module.ts there.
Every new file in packages/sdk starts with // SPDX-License-Identifier: MIT.
Seam: pure functions moduleNames(id) and isHostProvided(specifier); the load test imports every in-repo manifest in a child process and lists the packages it loaded.

## Tests first
- module-names.test.ts: "E02-S01 production-start derives productionStart and production_start"
- module-names.test.ts: "E02-S01 ids Planning, -a, a- and a--b are rejected"
- host-provided.test.ts: "E02-S01 isHostProvided matches @nestjs/core and graphql and not ms"
- manifest-load.test.ts: "E02-S01 importing every in-repo manifest in a fresh process loads no @nestjs package"
- manifest-load.test.ts: "E02-S01 every in-repo manifest version equals the root package.json version"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md

## Out of scope
Catalog checks (E02-S01-T04, E02-S01-T05), server entries (E02-S04-T02, E02-S04-T03), the API Extractor report (E18).

## Changelog
none, internal

## Acceptance criteria
- [ ] defineModule, moduleNames and HOST_PROVIDED import from @northmes/sdk, and defineModule is tagged @internal
- [ ] moduleNames("production-start") gives productionStart, production_start, nm_mod_production_start and remote productionStart
- [ ] Ids Planning, -a, a- and a--b are rejected naming the id
- [ ] The core and planning manifests load in a fresh process without any @nestjs package
- [ ] Each manifest's version equals the root version, and packages/sdk carries its MIT LICENSE
```

##### E02-S01-T03 repo: Fail the check when an MIT package imports AGPL code

Labels: `task`, `human`, `area: ci` (first task of a new pattern). Blocked by: E02-S01-T02.

Covers: no story criterion; the import rule of ADRs 0003 and 0056, needed before the MIT packages grow.

```markdown
Plan: E02-S01-T03

## Goal
A meta test keeps the MIT packages free of AGPL code. It reads every workspace package's license and fails when an MIT package (packages/*, modules/*/contracts) or an examples/* plugin imports an AGPL package, naming the importing file and the imported package. It also fails when a modules/*/contracts package is not MIT. AGENTS.md already states the rule; this makes it a check in pnpm check.

## Where in the code
scripts/lint/mit-imports.mjs (new)
test/meta/mit-imports.test.ts (new)
Seam: scan(packages, files) takes package manifests and in-memory source files and returns findings; the test passes fixtures, and a second case runs it over git ls-files.

## Tests first
- mit-imports.test.ts: "E02-S01 an MIT package that imports an AGPL package fails naming the file and the package"
- mit-imports.test.ts: "E02-S01 an examples plugin that imports an AGPL package fails"
- mit-imports.test.ts: "E02-S01 a contracts package that is not MIT fails"
- mit-imports.test.ts: "E02-S01 the repository passes"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md

## Out of scope
The license gate for third-party dependencies (E00-S04-T02), the plugin-outside CI job (E21).

## Changelog
none, internal

## Acceptance criteria
- [ ] A fixture MIT file importing @northmes/module-core fails naming the file and the package
- [ ] A fixture examples plugin importing an AGPL package fails
- [ ] A contracts package without "license": "MIT" fails
- [ ] pnpm check runs the test and it passes on main
```

##### E02-S01-T04 platform: Order the module catalog and stop on missing dependencies

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S01-T02.

Covers: criterion 4 (missing dependency, cycle, core module depending on a plugin, several problems listed together); criterion 5; tests "a missing dependency exits 1 naming both modules" and "three problems are listed as 3 problems".

```markdown
Plan: E02-S01-T04

## Goal
apps/server checks the module catalog at boot step 4 and returns the modules in topological order: core first, in-repo modules before plugins, then by id. It refuses a missing dependency (naming both modules), a cycle (naming every module in it) and a core module that depends on a plugin. It collects every problem and throws one BootError that lists them as "refused to start (N problems)"; boot maps a BootError to exit code 1 (ADR 0002).

## Where in the code
apps/server/src/catalog/check-catalog.ts, apps/server/src/boot/boot-error.ts (new)
apps/server/tsconfig.json (new); apps/server/package.json (exists; build and typecheck scripts)
apps/server/test/catalog.test.ts (new)
apps/server/test/fixtures/catalog.ts (new): in-memory manifests built with defineModule
Port from docs/sources/spike-integration/apps/server/src/catalog.ts and the matching cases of docs/sources/spike-integration/apps/server/test/catalog.test.mjs.
Seam: checkCatalog(entries, { imageVersion }) returns the ordered catalog or throws BootError with problems and exitCode 1; an entry is { manifest, kind } with kind module or plugin.

## Tests first
- catalog.test.ts: "E02-S01 a missing dependency exits 1 naming both modules"
- catalog.test.ts: "E02-S01 a cycle is refused naming every module in it"
- catalog.test.ts: "E02-S01 a core module that depends on a plugin is refused"
- catalog.test.ts: "E02-S01 three problems are listed as 3 problems"
- catalog.test.ts: "E02-S01 modules come back core first, in dependency order, plugins last"

## Design
none

## ADRs
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md

## Out of scope
Reserved ids, name collisions, ranges, key prefixes and slots (E02-S01-T05), validator checks (E02-S04-T05), wiring into boot (E02-S01-T07).

## Changelog
none, internal

## Acceptance criteria
- [ ] A missing dependency gives exit code 1 and a message naming both modules
- [ ] A cycle and a core module that depends on a plugin each give a named problem
- [ ] Three problems in one catalog appear in one message as "3 problems"
- [ ] The ordered catalog starts with core and puts plugins after the in-repo modules
```

##### E02-S01-T05 platform: Refuse reserved ids, name clashes, ranges, prefixes and slots

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S01-T04.

Covers: criterion 2 (colliding derived names); criterion 3; criterion 4 (bad range, wrong key prefix, slot contribution outside the dependency closure); tests "image 0.4.0-rc.1 satisfies range >=0.3.0 <0.5.0" and "module ids web, station and auth are each refused as reserved".

```markdown
Plan: E02-S01-T05

## Goal
checkCatalog adds five refusals to the same BootError: the reserved ids web, station and auth, which are the first-party and library segments under /api/v1 (ADR 0064); two modules whose derived names collide, naming both ids; a northmes range the image version does not satisfy, checked with semver.satisfies and includePrerelease and naming both versions; a permission or command key without its module's GraphQL prefix, or an event key without its SQL prefix (ADR 0003); and a slot contribution to a module outside the contributor's dependsOn closure.

## Where in the code
apps/server/src/catalog/check-catalog.ts (exists), apps/server/src/catalog/rules.ts (new)
apps/server/test/catalog.test.ts (exists), apps/server/test/fixtures/catalog.ts (exists)
Port the range, prefix and slot checks from docs/sources/spike-integration/apps/server/src/catalog.ts, with two changes: includePrerelease, and one prefix per key kind.
Seam: checkCatalog(entries, { imageVersion }), as in E02-S01-T04.

## Tests first
- catalog.test.ts: "E02-S01 module ids web, station and auth are each refused as reserved, and the message names the id"
- catalog.test.ts: "E02-S01 two modules whose derived names collide are refused naming both ids"
- catalog.test.ts: "E02-S01 image 0.4.0-rc.1 satisfies range >=0.3.0 <0.5.0, and image 0.5.0 is refused naming both versions"
- catalog.test.ts: "E02-S01 a command key without its GraphQL prefix and an event key without its SQL prefix are refused"
- catalog.test.ts: "E02-S01 a slot contribution outside the dependsOn closure is refused"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md

## Out of scope
The version field of northmes.config.json (E02-S04-T07), validator checks (E02-S04-T05).

## Changelog
none, internal

## Acceptance criteria
- [ ] A module or plugin with id web, station or auth stops boot with a message naming the id
- [ ] Two modules with colliding derived names stop boot naming both ids
- [ ] Image 0.4.0-rc.1 passes range >=0.3.0 <0.5.0, and a range that excludes the image names both versions
- [ ] A wrong key prefix and a slot contribution outside the dependsOn closure each add a named problem to the one BootError
```

##### E02-S01-T06 platform: Parse the environment and secret files in the SDK config

Labels: `task`, `human`, `area: sdk` (touches secrets handling). Blocked by: E02-S01-T02.

Covers: criterion 6 (loadEnv, serverEnvSchema and the secrets namespace); E02-S08 criterion 2; tests `server-env.test.ts` and `secrets.test.ts`.

```markdown
Plan: E02-S01-T06

## Goal
@northmes/sdk/config exports serverEnvSchema (Zod), loadEnv(schema), which runs safeParse and throws one ConfigError that lists every failing key with its rule and never its value, and secretsConfig, the secrets namespace that readSecrets fills from the *_FILE keys. readSecrets refuses a missing file, an empty file or a file whose mode grants read to others (mode & 0o004); group read passes; one trailing newline is trimmed; a value with the dev marker fails with CONFIG_DEV_SECRET_IN_PRODUCTION when NODE_ENV is production. Secret values never enter process.env. PORT is required with no default, NODE_ENV defaults to production and NORTHMES_ROLE to all.

## Where in the code
packages/sdk/src/config/server-env.ts, load-env.ts, secrets.ts, index.ts (new)
packages/sdk/test/config/server-env.test.ts, packages/sdk/test/config/secrets.test.ts (new)
Seam: loadEnv(schema)(record) is pure; readSecrets(keys, { nodeEnv }) reads files the test writes into a temporary directory.

## Tests first
- server-env.test.ts: "E02-S01 a missing public origin, PORT 70000 and role web are listed together without their values"
- server-env.test.ts: "E02-S01 NODE_ENV defaults to production and NORTHMES_ROLE to all"
- secrets.test.ts: "E02-S01 a missing, empty or world-readable secret file fails naming its key"
- secrets.test.ts: "E02-S01 one trailing newline is trimmed"
- secrets.test.ts: "E02-S01 a dev-marked secret fails with NODE_ENV production"

## Design
none

## ADRs
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md

## Out of scope
Wiring into apps/server (E02-S01-T07), configForTest (E02-S02-T05), writing dev secrets (E02-S08-T01), BETTER_AUTH_TELEMETRY (E05-S05).

## Changelog
none, internal

## Acceptance criteria
- [ ] Three bad keys give one ConfigError naming all three and containing none of their values
- [ ] NODE_ENV defaults to production, NORTHMES_ROLE to all, and PORT has no default
- [ ] A missing, empty or other-readable secret file fails naming its key, and a 0440 file passes
- [ ] A dev-marked secret with NODE_ENV production fails with CONFIG_DEV_SECRET_IN_PRODUCTION
- [ ] No secret value reaches process.env
```

##### E02-S01-T07 platform: Load configuration before any manifest when the server boots

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S01-T05, E02-S01-T06.

Covers: criterion 6 (ConfigModule before every module, exit 1 before any manifest import); test `config.int.test.ts`.

```markdown
Plan: E02-S01-T07

## Goal
apps/server boots in the order of ADR 0002. AppModule imports ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, cache: true, validate: loadEnv(serverEnvSchema), load: [secretsConfig] }) before every module, and the environment is checked before any manifest import. Boot then imports the in-repo manifests (core, planning), runs checkCatalog, creates AppModule.forRoot(catalog) and listens on 127.0.0.1:PORT, logging the modules in catalog order. A ConfigError or BootError prints its message and exits 1. Subcommands go through one dispatcher, so later tasks add northmes db bootstrap, migrate and schema print there.

## Where in the code
apps/server/src/main.ts (new): entry, hands argv to cli.ts
apps/server/src/cli.ts (new): serve only
apps/server/src/boot/boot.ts (new): config, manifests, catalog, Nest create, listen
apps/server/src/app.module.ts (new): AppModule.forRoot(catalog), ConfigModule first
apps/server/src/modules.ts (new): the in-repo manifest list
apps/server/test/boot/config.int.test.ts (new)
Port from docs/sources/spike-integration/apps/server/src/main.ts and app.module.ts there.
Seam: boot({ env, importManifest, exit, log }) in boot.ts; the test passes an environment record, a spy importManifest and a fake exit, so no build runs.

## Tests first
- config.int.test.ts: "E02-S01 an invalid environment exits 1 before any manifest import and lists every bad key"
- config.int.test.ts: "E02-S01 a valid environment boots core then planning and logs them in that order"
- config.int.test.ts: "E02-S01 a catalog BootError exits 1 with its message"

## Design
none

## ADRs
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md

## Out of scope
northmes.config.json and plugins (E02-S04-T07), the migration check (E02-S02-T03), the gateway (E02-S03-T03), the resolve hook (E02-S04-T08), shutdown (E02-S07-T02).

## Changelog
none, internal

## Acceptance criteria
- [ ] With an invalid environment the process exits 1, the manifest import spy is never called, and stderr lists every bad key without its value
- [ ] ConfigModule.forRoot is AppModule's first import, with ignoreEnvFile, cache, validate loadEnv(serverEnvSchema) and load [secretsConfig]
- [ ] A valid environment boots and logs core before planning
- [ ] A catalog problem exits 1 with the BootError message
```

#### E02-S02 platform: Migrate each module as its own owner role

Issue: northMES/northmes#20. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s02-platform-migrate-each-module-as-its-own-owner-role). Blocked by: E02-S01.

Notes: tasks that touch row-level security policies carry `human` anyway. The migrate tests run on fixture modules, so the story does not wait for the tracer tables of E02-S04. Until composition exists, `northmes migrate` runs boot steps 1 to 4 only; [ADR 0006](../adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) asks for steps 1 to 10, which E02-S03 completes. The `db-test` recipe comes with E02-S02-T05.

##### E02-S02-T01 platform: Bootstrap the database roles with UTC and DML rights only

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0006). Blocked by: E02-S01-T07.

Covers: criterion 3; test `no-truncate.test.ts`.

```markdown
Plan: E02-S02-T01

## Goal
pnpm northmes db bootstrap, run as the container superuser, creates nm_owner (login, CREATEROLE, CREATE on the database), nm_app (login, no BYPASSRLS), nm_auth (login) and nm_ext (NOLOGIN group) with passwords from the *_FILE secret keys, and runs ALTER ROLE ... SET timezone = 'UTC' for each. A second run changes nothing. The test template gets the same roles, and useTestDatabase() hands out nm_app and nm_owner connection strings, never the superuser's. A lint fails on any TRUNCATE grant in a migration file.

## Where in the code
apps/server/src/db/bootstrap.ts (new), apps/server/src/cli.ts (exists; db bootstrap)
apps/server/test/db/bootstrap.int.test.ts (new)
packages/testing/src/database.ts (exists): per-role connection strings; the caller supplies the template preparer, so the MIT package imports no AGPL code
packages/testing/test/harness.int.test.ts (exists)
test/meta/no-truncate.test.ts (new)
Port the role setup from docs/sources/spike-integration/apps/server/test/migrate.test.mjs.
Seam: bootstrapRoles(superuserUrl, passwords) is idempotent; no-truncate exports scan(files) over in-memory files.

## Tests first
- bootstrap.int.test.ts: "E02-S02 bootstrap creates nm_owner, nm_app, nm_auth and nm_ext, each with timezone UTC"
- bootstrap.int.test.ts: "E02-S02 nm_app has no SUPERUSER, CREATEROLE or BYPASSRLS"
- bootstrap.int.test.ts: "E02-S02 a second bootstrap changes nothing"
- harness.int.test.ts: "E02-S02 useTestDatabase hands out nm_app and nm_owner connections and never the superuser"
- no-truncate.test.ts: "E02-S02 no migration grants TRUNCATE to nm_app"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md
docs/adr/0008-row-level-security-with-transaction-local-scopes.md
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md

## Out of scope
Role-level timeouts for nm_app (values not decided), the Compose init script (E17-S02), applying migrations (E02-S02-T02).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm northmes db bootstrap creates the four roles, each with timezone UTC, and a second run changes nothing
- [ ] nm_app has no SUPERUSER, CREATEROLE or BYPASSRLS
- [ ] Integration tests connect as nm_app or nm_owner, never as the superuser
- [ ] A fixture migration that grants TRUNCATE to nm_app fails the lint naming the file
```

##### E02-S02-T02 platform: Apply each module's migrations as its own owner role

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0006). Blocked by: E02-S02-T01.

Covers: criterion 1; criterion 2; tests "two concurrent runs apply each file once" and "checksum drift stops the run naming the file".

```markdown
Plan: E02-S02-T02

## Goal
pnpm northmes migrate takes pg_advisory_lock on a dedicated direct connection with a lock_timeout. Per catalog module it creates the NOLOGIN owner role nm_mod_<sql name> (member of nm_ext; nm_owner grants itself SET TRUE, INHERIT FALSE) and its schema, then applies migrations/<UTC yyyymmddHHMMss>_<slug>.sql in lexical order, each file in its own transaction with SET LOCAL ROLE nm_mod_<sql name>. Applied files are tracked in northmes_meta.migration(module, name, sha256, applied_at). A second run is a no-op; a changed applied file stops the run naming it; two files with one timestamp prefix in a module, or a file without its expand or contract marker, are refused.

## Where in the code
apps/server/src/migrate/runner.ts, apps/server/src/migrate/files.ts (new)
apps/server/src/cli.ts (exists; migrate)
apps/server/test/migrate.int.test.ts (new)
apps/server/test/fixtures/migrations/ (new): fixture modules core and planning with two files each, and a module with a duplicate prefix
Port from docs/sources/spike-integration/apps/server/src/migrate.ts and docs/sources/spike-integration/apps/server/test/migrate.test.mjs, with timestamp names instead of 0001_.
Seam: migrate({ ownerUrl, catalog }) against a database from useTestDatabase(), connected as nm_owner.

## Tests first
- migrate.int.test.ts: "E02-S02 core then planning apply in catalog order, each as its owner role, and a second run is a no-op"
- migrate.int.test.ts: "E02-S02 two concurrent runs apply each file once"
- migrate.int.test.ts: "E02-S02 checksum drift stops the run naming the file"
- migrate.int.test.ts: "E02-S02 two files with the same timestamp prefix in one module are refused"
- migrate.int.test.ts: "E02-S02 a file without an expand or contract marker is refused"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
The inbound foreign key guard, repeatable files, pg-boss queues, the permission sync and audit partitions (ADR 0006 steps 6 and 8 to 11, E05), migrate --check (E18-S03).

## Changelog
none, internal

## Acceptance criteria
- [ ] Files apply in catalog order, one transaction each, under SET LOCAL ROLE nm_mod_<sql name>, and each schema is owned by its module role
- [ ] A second run applies nothing, and two concurrent runs apply each file once
- [ ] An edited applied file stops the run with exit 1 naming the file
- [ ] Two files with one timestamp prefix in a module, or a file without its marker, are refused
```

##### E02-S02-T03 platform: Confine plugin migrations and stop boot while one is pending

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0006). Blocked by: E02-S02-T02.

Covers: criterion 4; criterion 5; test "a plugin ALTER on core.article is refused".

```markdown
Plan: E02-S02-T03

## Goal
A plugin's migration runs as its own owner role, so Postgres refuses an ALTER TABLE on core.article ("must be owner of table article"), a CREATE TABLE in the core schema ("permission denied for schema core") and a CREATE TABLE AS SELECT from planning.production_order. The runner rolls the file back, records nothing and exits 1 naming the plugin and the file. Boot step 5 compares, as nm_app, the applied files with the files of every catalog module and refuses to start while any is pending, naming the module and the file.

## Where in the code
apps/server/src/migrate/runner.ts (exists): name the plugin and file on refusal
apps/server/src/migrate/pending.ts (new), apps/server/src/boot/boot.ts (exists; step 5)
apps/server/test/migrate.int.test.ts (exists), apps/server/test/boot/pending.int.test.ts (new)
apps/server/test/fixtures/migrations/ (exists): plugin fixtures alter-core, core-schema and reads-planning
Port the fixtures sneaky-schema and reads-other from docs/sources/spike-integration/apps/server/test/fixtures/.
Seam: migrate({ ownerUrl, catalog }) and checkPending(appUrl, catalog).

## Tests first
- migrate.int.test.ts: "E02-S02 a plugin ALTER on core.article is refused"
- migrate.int.test.ts: "E02-S02 a plugin CREATE TABLE in the core schema is refused and changes nothing"
- migrate.int.test.ts: "E02-S02 a plugin CREATE TABLE AS SELECT from planning.production_order is refused"
- pending.int.test.ts: "E02-S02 boot refuses to start while a migration is pending, naming the module and the file"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
The guard against dropping a plugin's foreign key (not in an E02 story), the schema compatibility number (E18-S03).

## Changelog
none, internal

## Acceptance criteria
- [ ] A plugin's ALTER TABLE core.article fails with "must be owner of table article", and the database is unchanged
- [ ] A plugin's CREATE TABLE in the core schema and its CREATE TABLE AS SELECT from planning are refused, and northmes_meta.migration has no row for them
- [ ] Boot exits 1 while a migration is pending and names its module and file
```

##### E02-S02-T04 platform: Generate a migration file from the table template

Labels: `task`, `human`, `area: sdk` (touches row-level security policies). Blocked by: E02-S02-T02.

Covers: criterion 6; test `gen-migration.test.ts`.

```markdown
Plan: E02-S02-T04

## Goal
pnpm gen:migration <module> <slug> writes modules/<module>/migrations/<UTC yyyymmddHHMMss>_<slug>.sql from the table template: the expand marker; a schema-qualified table with id uuid primary key default uuidv7(), scope_id uuid not null with an index that leads with it, and version integer not null default 1 with its BEFORE UPDATE trigger; enable row level security with the four split policies on northmes.read_scopes and northmes.write_scopes, never FOR ALL and no FORCE; and grants of SELECT, INSERT, UPDATE and DELETE to nm_app. Everything is inline SQL; the template never calls a shared SQL helper.

## Where in the code
scripts/gen-migration.mjs (new), scripts/templates/table.sql (new)
scripts/gen-migration.test.ts (new)
apps/server/test/migrate/template.int.test.ts (new)
Seam: render({ module, slug, now }) returns { path, sql }; the CLI writes the file; the integration test applies a rendered file with migrate() and queries as nm_app.

## Tests first
- gen-migration.test.ts: "E02-S02 the generated file has FOR SELECT, FOR INSERT, FOR UPDATE and FOR DELETE policies and no FOR ALL"
- gen-migration.test.ts: "E02-S02 the file is named with the UTC timestamp and the slug in the module's migrations folder"
- template.int.test.ts: "E02-S02 a generated table returns no rows to nm_app without scopes and its scope's rows with them"
- template.int.test.ts: "E02-S02 an update by nm_app bumps version through the inline trigger"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0008-row-level-security-with-transaction-local-scopes.md
docs/adr/0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md

## Out of scope
The audit trigger (E05-S02), register columns (E06-S04), the catalog lint (E05-S04), the migration lint for cascade and drop table (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm gen:migration <module> <slug> writes migrations/<UTC timestamp>_<slug>.sql in that module's folder
- [ ] The file holds a schema-qualified table with a uuidv7 id, scope_id, version, the four split policies and the nm_app grants, and no FOR ALL
- [ ] Applied by migrate, the table shows nm_app no rows without scopes and its scope's rows with them
- [ ] An update bumps version
```

##### E02-S02-T05 testing: Give integration tests a migrated template and the app factory

Labels: `task`, `human`, `area: ci` (first task of a new pattern). Blocked by: E02-S02-T03, E02-S02-T04.

Covers: the story's note on the `db-test` recipe; the app factory and `given` factories that E00-S02-T01 hands to E02.

```markdown
Plan: E02-S02-T05

## Goal
The integration template is bootstrapped and migrated from the in-repo modules once per run and named after a hash of their migration files. @northmes/testing adds configForTest(overrides), which validates an explicit record with loadEnv and never touches process.env; createTestApp({ modules }), which builds the host app in the test process with in-repo modules only, through the host factory that apps/server exports at ./testing and the caller passes in, so the MIT package imports no AGPL code; given.company() and given.plant(), which return fresh scope ids without rows; and db.command({ principal, scopes, reason }, fn), a transaction as nm_app with both scope sets set and no audit context yet. The db-test recipe records the files, commands and errors.

## Where in the code
packages/testing/src/config-for-test.ts, create-test-app.ts, given.ts, db-command.ts (new)
packages/testing/src/database.ts (exists): migrated template keyed on the hash
apps/server/src/testing.ts (new): template preparer and host factory
packages/testing/test/config-for-test.test.ts, packages/testing/test/db-command.int.test.ts (new)
docs/recipes/db-test.md (new)
Seam: the exported helpers of @northmes/testing.

## Tests first
- config-for-test.test.ts: "E02-S02 building two apps with configForTest leaves process.env unchanged"
- db-command.int.test.ts: "E02-S02 a row written through db.command at plant A is visible to plant A and not to plant B"
- db-command.int.test.ts: "E02-S02 the template name changes with the migration files and an unchanged run reuses it"
- db-command.int.test.ts: "E02-S02 createTestApp boots the in-repo modules in the test process"

## Design
none

## ADRs
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md

## Out of scope
The audit context and the raw-insert guard (E05-S02), company and plant rows (E05-S03), gqlClient (E02-S03-T03).

## Changelog
none, internal

## Acceptance criteria
- [ ] Two apps built with configForTest leave process.env unchanged
- [ ] A row written with db.command at one given.plant() is invisible to another
- [ ] A changed migration file changes the template name, and an unchanged run reuses the template
- [ ] createTestApp boots core and planning in the test process
- [ ] docs/recipes/db-test.md lists the files, the pnpm commands and each migrate and row-level security error with its meaning
```

#### E02-S03 platform: Compose module subgraphs behind one embedded gateway

Issue: northMES/northmes#21. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s03-platform-compose-module-subgraphs-behind-one-embedded-gateway). Blocked by: E02-S01.

Notes: tasks E02-S03-T01 to E02-S03-T06 test with fixture modules. E02-S03-T07 prints the snapshots of the in-repo modules, so it waits for their first fields (E02-S04-T03), and the story closes after that task; E02-S04 and E02-S05 start after E02-S03-T06. Criterion 1 is split over E02-S03-T02 and E02-S03-T03. The `graphql-subgraph` recipe and the first `pnpm gen` stage come with E02-S03-T07.

##### E02-S03-T01 platform: Declare REST controllers with ApiController and apiPath

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S01-T07.

Covers: criterion 4; criterion 5; tests `api-controller.test.ts` and `api-path.test.ts`.

```markdown
Plan: E02-S03-T01

## Goal
@northmes/contracts exports API_MAJOR (1) and apiPath(...segments), which returns /api/v<API_MAJOR>/<segments>. @northmes/sdk/rest exports ApiController({ module, family }), a class decorator that applies Nest's Controller with the path api/v<API_MAJOR>/<module>/ and records the module and the family (first-party, library or public) as metadata for the boot route check. The server never calls app.setGlobalPrefix or app.enableVersioning, and a meta test keeps it so.

## Where in the code
packages/contracts/src/api-path.ts, packages/contracts/src/index.ts (new)
packages/contracts/tsconfig.json, packages/contracts/LICENSE (new, MIT); packages/contracts/package.json (exists; scripts)
packages/sdk/src/rest/api-controller.ts, packages/sdk/src/rest/index.ts (new)
packages/contracts/test/api-path.test.ts, packages/sdk/test/rest/api-controller.test.ts (new)
test/meta/no-global-prefix.test.ts (new)
Every new file in the two packages starts with // SPDX-License-Identifier: MIT.
Seam: apiPath is a pure function; ApiController is read back through Reflect metadata on a decorated class.

## Tests first
- api-path.test.ts: "E02-S03 API_MAJOR is 1 and apiPath for web/modules returns /api/v1/web/modules"
- api-controller.test.ts: "E02-S03 ApiController({ module: "web", family: "first-party" }) registers api/v1/web and records family first-party and module web"
- no-global-prefix.test.ts: "E02-S03 no file under apps calls app.setGlobalPrefix or app.enableVersioning"

## Design
none

## ADRs
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md

## Out of scope
The boot route check (E02-S03-T06), the module list controller (E02-S05-T05), public routes and OpenAPI (the public API epic).

## Changelog
none, internal

## Acceptance criteria
- [ ] API_MAJOR is 1 and apiPath("web", "modules") returns /api/v1/web/modules
- [ ] A class decorated with ApiController({ module: "web", family: "first-party" }) has the path api/v1/web and metadata module web and family first-party
- [ ] ApiController takes the major from API_MAJOR
- [ ] A fixture call to app.setGlobalPrefix under apps fails no-global-prefix.test.ts
```

##### E02-S03-T02 platform: Build one subgraph per module with the in-process driver

Labels: `task`, `human`, `area: sdk` (new shared package code). Blocked by: E02-S01-T07.

Covers: criterion 1 (defineSubgraph with the in-process driver).

```markdown
Plan: E02-S03-T02

## Goal
@northmes/sdk/graphql exports InProcessSubgraphDriver, which needs neither @nestjs/apollo nor @apollo/server; defineSubgraph(Module), which calls GraphQLModule.forRoot with the driver, include [Module], the federation link pinned to v2.9, a lexicographically sorted schema and fieldResolverEnhancers guards, interceptors and filters; graphqlKit(() => Module), which applies includeModules and the orphaned entity stubs that @nestjs/graphql 14 needs under federation; entityRef("Article"), a key-only stub of an entity another module owns; loaderFor, a per-request batch loader; and SubgraphRegistry, which collects { name, sdl, schema } per module.

## Where in the code
packages/sdk/src/graphql/driver.ts, define-subgraph.ts, entity-ref.ts, loader.ts, registry.ts, index.ts (new)
packages/sdk/test/graphql/define-subgraph.test.ts (new)
packages/sdk/test/fixtures/graphql/ (new): one module that owns Article and one that references it
Port from docs/sources/spike-integration/packages/sdk/src/ (subgraph.ts, types.ts, context.ts, loader.ts).
Seam: defineSubgraph inside a Nest TestingModule; SubgraphRegistry exposes each subgraph's SDL and schema.

## Tests first
- define-subgraph.test.ts: "E02-S03 defineSubgraph builds a subgraph SDL with the v2.9 federation link and only its module's root fields"
- define-subgraph.test.ts: "E02-S03 two subgraphs build in one process without multiple types named"
- define-subgraph.test.ts: "E02-S03 entityRef(Article) adds a key-only Article stub to the referencing subgraph"
- define-subgraph.test.ts: "E02-S03 loaderFor batches three loads in one request into one call"

## Design
none

## ADRs
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md

## Out of scope
Composition and the gateway (E02-S03-T03), connections and paging (E06-S02), Zod input types (E02-S04-T04).

## Changelog
none, internal

## Acceptance criteria
- [ ] Each fixture module's SDL links federation v2.9 and holds only its own root fields
- [ ] Two subgraphs build in one Nest app without a "multiple types named" error
- [ ] entityRef("Article") yields a key-only stub, and the owning subgraph resolves the reference
- [ ] loaderFor makes one batched call for three keys in one request
```

##### E02-S03-T03 platform: Serve the module subgraphs at /graphql through the gateway

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S03-T02.

Covers: criterion 1 (the gateway over HTTP, graphql-ws and SSE); criterion 8.

```markdown
Plan: E02-S03-T03

## Goal
GatewayModule composes the registered subgraphs with composeServices in onApplicationBootstrap, hashes the supergraph and creates the Hive gateway runtime with createGatewayRuntime: an in-process transport with one subgraph context per client request and subgraph, maskedErrors on, no landing page and no GraphiQL. It is mounted as middleware on /graphql and answers 503 until boot has awaited runtime.getSchema(). graphql-ws runs on one ws server with noServer: true on the upgrade of /graphql, and SSE is served on /graphql. The boot log shows supergraph=<12 hex>. @northmes/testing adds gqlClient for HTTP, graphql-ws and SSE.

## Where in the code
apps/server/src/gateway/gateway.module.ts, compose.ts, transport.ts (new)
apps/server/src/app.module.ts (exists): SubgraphRegistry, one defineSubgraph per module, GatewayModule
packages/testing/src/gql-client.ts (new)
apps/server/test/gateway/serve.int.test.ts (new)
apps/server/test/fixtures/subgraphs/ (new): fixture modules alpha (owns Thing) and beta (references it, has a subscription)
Port from docs/sources/spike-integration/apps/server/src/gateway/ (compose.ts, gateway.module.ts) and the hybrid transport in docs/sources/spike-federation/src/gateway/gateway.module.ts, without HTTP subgraph mode.
Seam: boot() with the fixture catalog on PORT 0; gqlClient(url) sends the operations.

## Tests first
- serve.int.test.ts: "E02-S03 a query across two fixture subgraphs resolves the entity reference over HTTP"
- serve.int.test.ts: "E02-S03 a subscription delivers one event over graphql-ws and over SSE"
- serve.int.test.ts: "E02-S03 a subscription sent before the first HTTP request works"
- serve.int.test.ts: "E02-S03 the boot log shows supergraph= and a 12 hex hash"

## Design
none

## ADRs
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
The NorthMES composition rules (E02-S03-T04), the plant and the tracer principal (E02-S04-T01), the hash on /health/ready (E02-S07-T01), depth and cost limits (E05).

## Changelog
none, internal

## Acceptance criteria
- [ ] /graphql answers a query that spans two fixture subgraphs over HTTP
- [ ] A fixture subscription delivers over graphql-ws and over SSE on /graphql
- [ ] A subscription sent before any HTTP request works
- [ ] The boot log carries supergraph= followed by 12 hex characters
```

##### E02-S03-T04 platform: Stop boot when composition breaks a NorthMES rule

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S03-T03.

Covers: criterion 2; tests `composition.test.ts` and `boot.int.test.ts`.

```markdown
Plan: E02-S03-T04

## Goal
Before composeServices, the gateway runs NORTHMES_ROOT_FIELD_PREFIX (every root field starts with its module's GraphQL name), NORTHMES_TYPE_OWNERSHIP (a type has one owning module; shared types come from an allowlist that starts with PageInfo) and NORTHMES_CONTRIBUTED_FIELD_NULLABLE (a field one module adds to another module's entity is nullable). Rule and composition errors throw one SupergraphCompositionError with a "[code] message" line per error that names the field and both subgraphs, and boot exits 1.

## Where in the code
apps/server/src/gateway/rules.ts (new), apps/server/src/gateway/compose.ts (exists)
apps/server/test/gateway/composition.test.ts, apps/server/test/gateway/boot.int.test.ts (new)
apps/server/test/fixtures/subgraphs/ (exists): unprefixed, two-owners and non-null-contribution fixtures
Port from docs/sources/spike-federation/test/composition.test.mjs and docs/sources/spike-federation/examples/plugin-broken/broken.module.ts.
Seam: checkRules(subgraphs) and compose(subgraphs) over SDL strings; boot.int.test.ts boots a fixture catalog.

## Tests first
- composition.test.ts: "E02-S03 a root field without a module prefix fails with its rule id"
- composition.test.ts: "E02-S03 a type owned by two modules fails with NORTHMES_TYPE_OWNERSHIP naming both subgraphs"
- composition.test.ts: "E02-S03 a non-nullable contributed field fails with NORTHMES_CONTRIBUTED_FIELD_NULLABLE naming the field"
- boot.int.test.ts: "E02-S03 a composition error exits with code 1"

## Design
none

## ADRs
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
NORTHMES_SDK_TYPE_DRIFT (not in an E02 story), the plugin corpus job (E21-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] An unprefixed root field fails with NORTHMES_ROOT_FIELD_PREFIX and names the field
- [ ] A type owned by two modules fails naming both subgraphs
- [ ] A non-nullable contributed field fails naming the field and both subgraphs
- [ ] Boot with any of them exits 1 with one message that lists every error
```

##### E02-S03-T05 platform: Fail boot when two subgraph roots reach one resolver module

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S03-T04, E02-S02-T03.

Covers: criterion 3.

```markdown
Plan: E02-S03-T05

## Goal
After Nest create (boot step 8), the isolation check computes, the way Nest's explorer does, which resolver-bearing modules each subgraph root reaches through its imports. Boot fails when one is reachable from two roots or through a global module, and the message prints both import paths. The same walk assigns each REST controller to the module root that reaches it, or to the host, for the route check (E02-S03-T06).

## Where in the code
apps/server/src/isolation.ts (new), apps/server/src/boot/boot.ts (exists; step 8)
apps/server/test/isolation.int.test.ts (new)
apps/server/test/fixtures/isolation/ (new): a sub-module of another module, an untyped Resolver(), a global host module, an API module importing its own resolver module, a typed control
Port from docs/sources/spike-integration/apps/server/src/isolation.ts; the walk follows Nest's reachability instead of the spike's per-root import walk.
Seam: checkIsolation(app, roots) returns { controllerOwners } or throws BootError.

## Tests first
- isolation.int.test.ts: "E02-S03 a resolver module imported by two module roots makes boot exit 1 printing both import paths"
- isolation.int.test.ts: "E02-S03 each failing isolation fixture exits 1 with its import path, and the typed control boots"
- isolation.int.test.ts: "E02-S03 a controller is assigned to the module root that reaches it, or to the host"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md

## Out of scope
The route check itself (E02-S03-T06), import lints between modules (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] A resolver module reachable from two subgraph roots stops boot, and the message prints both import paths
- [ ] Each of the four failing fixtures stops boot naming its import path, and the typed control boots
- [ ] Every controller is assigned to exactly one module root or to the host
```

##### E02-S03-T06 platform: Refuse REST controllers outside the route families at boot

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S03-T05, E02-S03-T01.

Covers: criterion 6; tests `routes.int.test.ts`.

```markdown
Plan: E02-S03-T06

## Goal
At boot step 10 the route check reads the ApiController metadata and the controller owners from the isolation walk, and exits 1 naming the controller class when: a controller path does not start with api/v<API_MAJOR>/ and is not on the root allowlist (/health, /health/live, /health/ready, /graphql, /mcp, /modules/<id>/<version>/*, /assets/* and the SPA paths); a controller off the root allowlist was not declared through ApiController; two controllers register one method and path (naming both); a public controller's module segment differs from its owner's id (naming both ids). Release 1 has no public route, so the last rule runs only against fixtures.

## Where in the code
apps/server/src/routes/route-check.ts, apps/server/src/routes/root-allowlist.ts (new)
apps/server/src/boot/boot.ts (exists; step 10)
apps/server/test/boot/routes.int.test.ts (new)
apps/server/test/fixtures/routes/ (new): one controller per case and a health controller at /health
Seam: checkRoutes(controllers, owners) over Nest's router metadata; the test boots a fixture catalog per case.

## Tests first
- routes.int.test.ts: "E02-S03 a controller at api/web/modules makes boot exit 1 naming the class"
- routes.int.test.ts: "E02-S03 a controller declared with plain @Controller off the root allowlist makes boot exit 1 naming the class"
- routes.int.test.ts: "E02-S03 two controllers on POST /api/v1/web/client-errors make boot exit 1 naming both classes"
- routes.int.test.ts: "E02-S03 a public controller with module segment scheduling inside the planning module makes boot exit 1 naming both ids"
- routes.int.test.ts: "E02-S03 the health controller at /health passes as a root route"

## Design
none

## ADRs
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
The plugin rule (E02-S04-T08), the route inventory test (E05-S07), the real health controller (E02-S07-T01).

## Changelog
none, internal

## Acceptance criteria
- [ ] A controller at api/web/modules and a plain @Controller off the root allowlist each stop boot naming the class
- [ ] Two controllers on POST /api/v1/web/client-errors stop boot naming both classes
- [ ] A public controller with module segment scheduling inside the planning module stops boot naming both ids
- [ ] A health controller at /health passes as a root route
```

##### E02-S03-T07 platform: Print the schema snapshots without a database

Labels: `task`, `human`, `area: sdk` (first generated snapshot). Blocked by: E02-S03-T06, E02-S04-T03.

Covers: criterion 7; test `print.int.test.ts`; the story's notes on the first `pnpm gen` stage and the `graphql-subgraph` recipe.

```markdown
Plan: E02-S03-T07

## Goal
pnpm northmes schema print builds the subgraphs of the in-repo modules only, never reading northmes.config.json or loading a plugin, with DATABASE_URL unset and no pool created. It composes them and writes schema/api.graphql, schema/supergraph.graphql and modules/<id>/schema.graphql, sorted with lexicographicSortSchema. scripts/gen.mjs gets its first stage, schema, so pnpm gen --check fails when a snapshot is stale. The graphql-subgraph recipe records the files a module writes, the commands and each composition error with its meaning.

## Where in the code
apps/server/src/schema/print.ts (new), apps/server/src/cli.ts (exists; schema print)
scripts/gen.mjs (exists; the schema stage)
schema/api.graphql, schema/supergraph.graphql, modules/core/schema.graphql, modules/planning/schema.graphql (new, generated)
apps/server/test/schema/print.int.test.ts (new), test/meta/gen.test.ts (new)
docs/recipes/graphql-subgraph.md (new)
Port from docs/sources/spike-federation/export-supergraph.mjs; the spike's full boot with the config file is not ported.
Seam: printSchema({ modules, outDir }) with the pool factory spied; gen.test.ts runs scripts/gen.mjs --check in a child process on a temporary copy.

## Tests first
- print.int.test.ts: "E02-S03 print with DATABASE_URL unset constructs zero pools and equals the committed files"
- gen.test.ts: "E02-S03 pnpm gen twice leaves an empty diff"
- gen.test.ts: "E02-S03 a changed resolver makes pnpm gen --check exit 1 naming schema/api.graphql"

## Design
none

## ADRs
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md

## Out of scope
The links.snapshot.json stage (not in an E02 story), the OpenAPI snapshot (the public API epic).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm northmes schema print with DATABASE_URL unset writes the four files and constructs no pool
- [ ] The committed snapshots equal a fresh print
- [ ] pnpm gen --check exits 1 naming schema/api.graphql when a resolver changes without a new snapshot
- [ ] docs/recipes/graphql-subgraph.md names the files, the commands and each NorthMES rule id with its meaning
```

#### E02-S04 platform: Run a validatable command vetoed by a drop-in plugin

Issue: northMES/northmes#22. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s04-platform-run-a-validatable-command-vetoed-by-a-drop-in-plugin). Blocked by: E02-S02, E02-S03.

Notes: criterion 1 is split over E02-S04-T02, T03, T04 and T06, and criterion 2 over E02-S04-T07 and T09. E02-S04-T01 carries the tracer data path that criterion 1 needs. Tests that load a built plugin boot the built server in a child process, because `createTestApp` takes in-repo modules only. The `vertical-slice` recipe comes with E02-S04-T06. The example validator keeps no table of its own in E02, because whether it should is an open product owner question.

##### E02-S04-T01 platform: Run module queries in a transaction scoped to the plant

Labels: `task`, `human`, `area: sdk` (touches row-level security scopes). Blocked by: E02-S02-T05, E02-S03-T06.

Covers: no criterion alone; the scoped data path of criterion 1.

```markdown
Plan: E02-S04-T01

## Goal
@northmes/sdk exports the DATABASE token and the ScopedDatabase interface: transaction(fn) runs fn in a Kysely transaction whose first statement sets northmes.read_scopes and northmes.write_scopes with set_config(..., true). apps/server provides it from one pg pool that connects as nm_app. Until E05-S03 and E05-S04, a tracer principal plugin in the gateway takes the request's plant scope id from x-northmes-plant (connectionParams.plantId on graphql-ws), grants every permission, and both scope sets hold that one id. A request without a plant reads nothing.

## Where in the code
packages/sdk/src/db.ts (new), packages/sdk/src/index.ts (exists)
apps/server/src/db/pool.ts, apps/server/src/db/scoped-database.ts (new)
apps/server/src/gateway/tracer-principal.ts (new), apps/server/src/gateway/gateway.module.ts (exists)
apps/server/src/app.module.ts (exists; DatabaseModule)
apps/server/test/db/scoped-database.int.test.ts (new): a fixture table rendered from the migration template
Port the principal plugin from docs/sources/spike-integration/apps/server/src/gateway/sessions.ts, without cookies.
Seam: ScopedDatabase.transaction(fn) resolved from createTestApp with a principal context per plant.

## Tests first
- scoped-database.int.test.ts: "E02-S04 a request for plant A reads plant A's rows and none of plant B's"
- scoped-database.int.test.ts: "E02-S04 a request without a plant reads zero rows"
- scoped-database.int.test.ts: "E02-S04 the pool connects as nm_app and sets scopes only inside the transaction"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0008-row-level-security-with-transaction-local-scopes.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
The transaction helper with write sets from roles (E05-S04), sign-in and permissions (E05-S05, E05-S06), plant slugs and the plant header check (E05-S03).

## Changelog
none, internal

## Acceptance criteria
- [ ] Inside transaction(), a query for plant A returns only plant A rows
- [ ] Without x-northmes-plant the same query returns zero rows
- [ ] current_user in the pool is nm_app, and the scope settings are transaction-local
```

##### E02-S04-T02 core: Serve articles from Postgres through the core subgraph

Labels: `task`, `human`, `area: core` (first module table; builds on proposed ADR 0006). Blocked by: E02-S04-T01.

Covers: criterion 1 (Article at tracer depth).

```markdown
Plan: E02-S04-T02

## Goal
core.article (code, name) comes from a migration made with pnpm gen:migration, which also grants references (id) to nm_ext so planning can point at it. CoreApiModule (providers only, under server/api) holds ArticleService, which reads through ScopedDatabase. CoreModule holds the code-first Article entity keyed on id, the root field coreArticle(id) and the reference resolver, which batches with loaderFor. The core manifest gains its lazy server entry. Kysely table types for core are written by hand.

## Where in the code
modules/core/migrations/<timestamp>_article.sql (new, generated)
modules/core/server/api/article.service.ts, modules/core/server/api/core-api.module.ts (new)
modules/core/server/article.resolver.ts, core.module.ts, db.ts, index.ts (new)
modules/core/northmes.module.ts (exists; server entry), modules/core/package.json (exists; scripts), modules/core/tsconfig.json (new)
modules/core/test/article.int.test.ts (new)
Port from docs/sources/spike-integration/modules/core/ (server/api.ts, server/core.module.ts, migrations/0001_article.sql), with Postgres instead of in-memory rows.
Seam: createTestApp with core; fixtures through db.command at given.plant(); queries through gqlClient.

## Tests first
- article.int.test.ts: "E02-S04 coreArticle returns an article written at the request's plant and null for another plant's"
- article.int.test.ts: "E02-S04 three Article references resolve with one SQL query"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md

## Out of scope
Article master data with routings and units (E06-S06), core contracts and screens (E06), generated Kysely types (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] The core.article migration applies as nm_mod_core and nm_app reads it only inside a plant scope
- [ ] coreArticle(id) returns code and name at the request's plant, and null for another plant's article
- [ ] Resolving three Article references runs one SQL query
```

##### E02-S04-T03 planning: List production orders with their article names

Labels: `task`, `human`, `area: planning` (first planning table; builds on proposed ADR 0006). Blocked by: E02-S04-T02.

Covers: criterion 1 (ProductionOrder at tracer depth).

```markdown
Plan: E02-S04-T03

## Goal
planning.production_order (number, article_id with a foreign key to core.article, quantity numeric(18,6), status text with a check of planned or released, version) comes from the migration template. PlanningModule holds the ProductionOrder entity, the root field planningProductionOrders, which lists the request plant's orders, and the article field, which resolves through entityRef("Article") from the core subgraph. This is the first query that shows module data from Postgres through two subgraphs.

## Where in the code
modules/planning/migrations/<timestamp>_production_order.sql (new, generated)
modules/planning/server/api/production-order.service.ts, modules/planning/server/api/planning-api.module.ts (new)
modules/planning/server/production-order.resolver.ts, planning.module.ts, db.ts, index.ts (new)
modules/planning/northmes.module.ts (exists; server entry), modules/planning/package.json (exists; scripts), modules/planning/tsconfig.json (new)
modules/planning/test/production-orders.int.test.ts (new)
Port from docs/sources/spike-integration/modules/planning/ (server/planning.module.ts, migrations/0001_production_order.sql).
Seam: createTestApp with core and planning; db.command fixtures; gqlClient.

## Tests first
- production-orders.int.test.ts: "E02-S04 planningProductionOrders lists the plant's orders with their article names"
- production-orders.int.test.ts: "E02-S04 an order at another plant is not listed"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md

## Out of scope
Connections with paging (E06-S02), operations and job orders (E07-S01), the release command (E02-S04-T06), the schema snapshots (E02-S03-T07).

## Changelog
none, internal

## Acceptance criteria
- [ ] planningProductionOrders returns number, quantity, status and article code and name for the request's plant
- [ ] Orders at another plant are not listed
- [ ] quantity is numeric(18,6), and status is text with a check, not a Postgres enum
```

##### E02-S04-T04 platform: Generate a command's mutation field from its contract

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0012). Blocked by: E02-S04-T01.

Covers: criterion 1 (a mutation that maps to a registered handler).

```markdown
Plan: E02-S04-T04

## Goal
@northmes/contracts exports defineCommandContract({ name, input, validatable, payload }), with Zod schemas for input and payload. @northmes/sdk exports defineCommand(contract, handler) for AGPL module server code, the COMMAND_BUS token and the CommandBus interface. The SDK generates the prefixed Mutation field from the contract (planning.releaseProductionOrder gives planningReleaseProductionOrder) with an input type built from the Zod input, parses the input with the contract and sends it to the command bus, so a module writes no resolver for it. Input conversion covers the field kinds the skeleton uses (ID, string, number).

## Where in the code
packages/contracts/src/define-command-contract.ts (new), packages/contracts/src/index.ts (exists)
packages/sdk/src/commands/define-command.ts, mutation-field.ts, index.ts (new)
packages/contracts/test/define-command-contract.test.ts, packages/sdk/test/commands/mutation-field.test.ts (new)
Port from docs/sources/spike-integration/packages/sdk/src/commands.ts.
Seam: defineCommand inside a Nest TestingModule with a fake COMMAND_BUS; the test reads the printed SDL and calls the field.

## Tests first
- mutation-field.test.ts: "E02-S04 defineCommand for planning.releaseProductionOrder adds Mutation.planningReleaseProductionOrder with the contract's input"
- mutation-field.test.ts: "E02-S04 the generated field sends the parsed input to the command bus"
- mutation-field.test.ts: "E02-S04 an input that fails the contract never reaches the bus"

## Design
none

## ADRs
docs/adr/0012-commands-as-the-single-write-path.md
docs/adr/0017-zod-contracts-as-the-single-source-for-inputs.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md

## Out of scope
The shared reason input, expectedVersion, fieldErrors and the boot check for a mutation without a handler (E05-S01), the full Zod to GraphQL input converter (E05-S01).

## Changelog
none, internal

## Acceptance criteria
- [ ] A contract plus defineCommand yields Mutation.planningReleaseProductionOrder with a prefixed input type
- [ ] The field calls the bus with the parsed input and returns the handler's result
- [ ] An invalid input returns a validation error, and the fake bus is not called
```

##### E02-S04-T05 platform: Run validators on validatable commands and fail closed

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0012). Blocked by: E02-S04-T04.

Covers: criteria 3, 4 and 5; test `command-bus.test.ts`.

```markdown
Plan: E02-S04-T05

## Goal
CommandBusImpl in apps/server discovers validators (the SDK's CommandValidator) at boot and refuses, with a BootError, a validator on a command not declared validatable or from a module whose dependsOn lacks the owner. At run time it parses the payload with the owner's MIT contract schema first and rejects a mismatch with core.validator_contract_mismatch, then runs validators in catalog order and then by name, each on a frozen payload with its time limit. A veto throws CommandRejected (core.command_rejected, details.rejectedBy); a timeout rejects; a throw is masked as "Unexpected error."; the handler never runs after any of them. The SDK exception filter, registered once as APP_FILTER, writes code, errorCode and details of a DomainError into the GraphQL error.

## Where in the code
packages/sdk/src/commands/validator.ts, packages/sdk/src/errors/domain-error.ts, packages/sdk/src/errors/exception-filter.ts (new)
apps/server/src/commands/command-bus.ts, apps/server/src/commands/commands.module.ts (new)
apps/server/src/app.module.ts (exists; CommandsModule, APP_FILTER)
apps/server/test/command-bus.test.ts, apps/server/test/errors/filter.int.test.ts (new)
apps/server/test/fixtures/commands/ (new): a validatable fixture command and slow, throwing and vetoing validators
Port from docs/sources/spike-integration/apps/server/src/commands.ts; DomainError and the filter replace the spike's GraphQLError subclass.
Seam: CommandBusImpl.run(command, input, context) with a handler spy; the filter test sends a fixture mutation through gqlClient.

## Tests first
- command-bus.test.ts: "E02-S04 a payload with quantity as an object is rejected with core.validator_contract_mismatch and the handler spy is not called"
- command-bus.test.ts: "E02-S04 a validator slower than its limit rejects the command and the handler does not run"
- command-bus.test.ts: "E02-S04 a throwing validator returns Unexpected error. and the handler does not run"
- command-bus.test.ts: "E02-S04 a validator on a command that is not validatable, or without dependsOn on the owner, stops boot"
- filter.int.test.ts: "E02-S04 a veto reaches the client with code, errorCode core.command_rejected and details.rejectedBy"

## Design
none

## ADRs
docs/adr/0012-commands-as-the-single-write-path.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md

## Out of scope
The permission check, audit context, expectedVersion, correlation id and defineErrors (E05-S01).

## Changelog
none, internal

## Acceptance criteria
- [ ] A payload that fails the owner's schema is rejected with core.validator_contract_mismatch, and the handler does not run
- [ ] A slow and a throwing validator each reject the command without running the handler, and the throw reaches the client as "Unexpected error."
- [ ] A misplaced validator stops boot with a named message
- [ ] The filter is registered once as APP_FILTER, and a veto's GraphQL error carries code, errorCode and details.rejectedBy
```

##### E02-S04-T06 planning: Release a production order through the command bus

Labels: `task`, `human`, `area: planning` (first command of a new pattern). Blocked by: E02-S04-T05, E02-S03-T07.

Covers: criterion 1 (planningReleaseProductionOrder maps to a registered, validatable handler); the story's note on the `vertical-slice` recipe.

```markdown
Plan: E02-S04-T06

## Goal
@northmes/planning-contracts declares releaseProductionOrder with defineCommandContract: input { id }, validatable, and a validator payload schema with productionOrderId, plantId, articleId and quantity. The planning module registers the handler with defineCommand: inside ScopedDatabase.transaction it builds the payload, sets the status to released and bumps version, and refuses an order that is not planned with a DomainError. planningReleaseProductionOrder is generated from the contract. This is the first save through a command. The vertical-slice recipe records the files from migration to command to field, the commands and the errors.

## Where in the code
modules/planning/contracts/src/release-production-order.ts, modules/planning/contracts/src/index.ts (new)
modules/planning/contracts/tsconfig.json, modules/planning/contracts/LICENSE (new, MIT); modules/planning/contracts/package.json (exists; scripts)
modules/planning/server/commands/release-production-order.ts (new), modules/planning/server/planning.module.ts (exists)
modules/planning/test/release.int.test.ts, modules/planning/contracts/test/payload.test.ts, packages/contracts/test/pure-imports.test.ts (new)
schema/api.graphql, schema/supergraph.graphql, modules/planning/schema.graphql (regenerated with pnpm gen)
docs/recipes/vertical-slice.md (new)
Seam: createTestApp with core and planning; gqlClient sends the mutation; fixtures through db.command.

## Tests first
- release.int.test.ts: "E02-S04 planningReleaseProductionOrder sets the order to released and bumps its version"
- release.int.test.ts: "E02-S04 releasing an order that is not planned returns a DomainError and changes nothing"
- payload.test.ts: "E02-S04 the payload planning builds for an order parses with its MIT schema"
- pure-imports.test.ts: "E02-S04 importing every contracts package in a fresh process loads no @nestjs or react module"

## Design
none

## ADRs
docs/adr/0012-commands-as-the-single-write-path.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md

## Out of scope
The event in core.event (E02-S06-T01), the Release button (E02-S05-T08), audit rows (E05-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] planningReleaseProductionOrder(input: { id }) releases a planned order and returns it with its new version
- [ ] Releasing an order twice fails with a DomainError and leaves the row unchanged
- [ ] The payload for an order parses with the schema in @northmes/planning-contracts, and no contracts package loads Nest or React
- [ ] The schema snapshots are regenerated, and docs/recipes/vertical-slice.md lists the files, commands and errors of the slice
```

##### E02-S04-T07 platform: Build plugins with plugin:build and load them from plugins/

Labels: `task`, `human`, `area: sdk` (ADR 0037 has open needs-confirmation). Blocked by: E02-S04-T05.

Covers: criterion 2 (the build with Rolldown and the load from `plugins/`).

```markdown
Plan: E02-S04-T07

## Goal
pnpm plugin:build <id> builds the example plugin with Rolldown into dist/manifest.js and dist/server.js, keeps every HOST_PROVIDED specifier external, bundles the rest (the example bundles ms) and copies the package with its migrations to plugins/<id>/. northmes.config.json at the repository root holds the NorthMES version and the plugins to load. Boot step 1 reads it; a version that differs from the image stops boot naming both; a listed plugin whose dist/server.js throws on import stops boot naming the plugin. Plugins join the catalog after the in-repo modules. A test helper builds the server and the plugins once per run and boots the built server in a child process.

## Where in the code
scripts/plugin-build.mjs (new), scripts/plugin-build.test.ts (new)
examples/plugin-validator/src/manifest.ts, src/server.ts (new): example-validator depends on planning; no validator yet
examples/plugin-validator/tsconfig.json (new), package.json (exists; scripts)
northmes.config.json (new)
apps/server/src/boot/config-file.ts (new), apps/server/src/boot/boot.ts (exists)
apps/server/test/support/built-server.ts (new), apps/server/test/plugins/load.int.test.ts (new)
Port from docs/sources/spike-integration/examples/plugin-validator/ (build.mjs, src/manifest.ts) and docs/sources/spike-integration/apps/server/test/helpers.mjs.
Seam: buildPlugin(dir, outDir) returns the output files; bootBuilt({ env, config }) returns the exit code and output.

## Tests first
- plugin-build.test.ts: "E02-S04 plugin:build keeps every HOST_PROVIDED import external and bundles ms"
- load.int.test.ts: "E02-S04 a plugin listed in northmes.config.json loads from plugins/ after the in-repo modules"
- load.int.test.ts: "E02-S04 config version 0.3.0 with image 0.4.0 stops boot naming both"
- load.int.test.ts: "E02-S04 a listed plugin whose dist/server.js throws on import stops boot naming the plugin id"

## Design
none

## ADRs
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
The resolve hook (E02-S04-T08), the validator (E02-S04-T09), the block reason field and plugin:check (E21).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm plugin:build example-validator writes dist/manifest.js and dist/server.js with no HOST_PROVIDED code inside
- [ ] With example-validator in northmes.config.json, the boot log lists it after core and planning
- [ ] A config version that differs from the image, and a plugin whose server part throws on import, each stop boot with a named message
```

##### E02-S04-T08 platform: Map host packages for plugins and refuse plugin controllers

Labels: `task`, `human`, `area: sdk` (ADR 0037 has open needs-confirmation). Blocked by: E02-S04-T07.

Covers: criteria 6 and 7; tests `resolve-hook.int.test.ts` and `plugin-controller.int.test.ts`.

```markdown
Plan: E02-S04-T08

## Goal
Boot step 2 installs one module.registerHooks resolve hook: when the importing file lies under a plugin root and the specifier is host-provided, it resolves as if the host had imported it; every other import passes through. A plugin outside the host tree and a plugin with its own node_modules copy of Nest then boot against the host's packages, and a plugin that bundles host packages fails boot as designed. The route check also exits 1 when a plugin root reaches a REST controller, naming the plugin id; plugins add no REST controller until the public API epic.

## Where in the code
apps/server/src/plugins/resolve-hook.ts (new), apps/server/src/boot/boot.ts (exists; step 2)
apps/server/src/routes/route-check.ts (exists; plugin rule)
apps/server/test/plugins/resolve-hook.int.test.ts, apps/server/test/boot/plugin-controller.int.test.ts (new)
apps/server/test/fixtures/plugins/ (new): own-nest, bundled and controller fixtures
Port from docs/sources/spike-integration/apps/server/src/plugin-resolution.ts and the config.bundled.json and config.ownmods.json cases in docs/sources/spike-integration/apps/server/.
Seam: bootBuilt({ env, config }) from E02-S04-T07; the outside case copies the built example into a temporary directory outside the repository.

## Tests first
- resolve-hook.int.test.ts: "E02-S04 a plugin outside the host tree boots with the hook"
- resolve-hook.int.test.ts: "E02-S04 a plugin with its own node_modules copy of Nest boots with the hook"
- resolve-hook.int.test.ts: "E02-S04 a plugin bundling @nestjs/graphql fails boot"
- plugin-controller.int.test.ts: "E02-S04 a fixture plugin whose Nest module reaches a controller makes boot exit 1 naming the plugin id"

## Design
none

## ADRs
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
docs/adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md

## Out of scope
Requiring the resolve-hook test in ci / gate (from M1), the plugin-outside CI job (E21).

## Changelog
none, internal

## Acceptance criteria
- [ ] A plugin outside the repository and a plugin with its own Nest copy both boot and get the host's @nestjs/core
- [ ] A plugin that bundles @nestjs/graphql fails boot with a message naming the plugin
- [ ] A plugin whose Nest module reaches a controller stops boot naming the plugin id
```

##### E02-S04-T09 platform: Veto a release with the example validator plugin

Labels: `task`, `human`, `area: sdk` (ADR 0037 has open needs-confirmation). Blocked by: E02-S04-T08, E02-S04-T06.

Covers: criterion 2 (the veto with `core.command_rejected` naming `rejectedBy`); test `validator.int.test.ts`.

```markdown
Plan: E02-S04-T09

## Goal
examples/plugin-validator registers ReleaseLimitValidator with CommandValidator for planning.releaseProductionOrder. It rejects a release whose quantity is above an example limit, with a 2 s time limit written with ms. Built with pnpm plugin:build and loaded from plugins/, it makes planningReleaseProductionOrder fail with core.command_rejected and details.rejectedBy example-validator, and the order stays planned. The validator takes the payload schema from the plugin's bundled copy of @northmes/planning-contracts.

## Where in the code
examples/plugin-validator/src/release-limit.validator.ts (new), examples/plugin-validator/src/server.ts (exists)
examples/plugin-validator/test/validator.int.test.ts (new)
Port from docs/sources/spike-integration/examples/plugin-validator/src/server.ts.
Seam: bootBuilt with the plugin listed and a database from useTestDatabase(); gqlClient sends the release.

## Tests first
- validator.int.test.ts: "E02-S04 a release over the example limit is rejected"
- validator.int.test.ts: "E02-S04 a release under the limit passes and the order is released"

## Design
none

## ADRs
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0012-commands-as-the-single-write-path.md

## Out of scope
The nullable exampleValidatorBlockReason field and offline composition (E21), a table of the plugin's own (not decided).

## Changelog
none, internal

## Acceptance criteria
- [ ] A release above the example limit fails with core.command_rejected and details.rejectedBy example-validator, and the order stays planned
- [ ] A release under the limit succeeds with the plugin loaded
- [ ] The plugin takes host packages as peerDependencies, and its source imports only MIT packages
```

#### E02-S05 web: Load the planning remote in the runtime shell

Issue: northMES/northmes#23. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s05-web-load-the-planning-remote-in-the-runtime-shell). Blocked by: E02-S03.

Notes: every task runs in a session, because `handoff-demo` arrives with E02-S08. Design: none (tracer screen). In E02 a disabled module is a module the catalog did not load, because release 1 knows only installed modules. The menu is a plain list in module order; E04-S02 builds the sidebar. The spec `e2e/shell-degraded.spec.ts` runs in E02-S08-T02, because the Playwright harness arrives in E02-S08; the placeholder itself is tested in E02-S05-T06. E02-S05-T08 adds the Release button, which no S05 criterion names; E02-S06 criterion 3 and the skeleton spec need it, and it makes the shell save through a command as early as possible. Criteria 2, 3 and 8 are split over two tasks each. The `web-remote` recipe comes with E02-S05-T07.

##### E02-S05-T01 contracts: Declare module links with defineModuleLinks

Labels: `task`, `human`, `area: sdk` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S03-T06.

Covers: criterion 8 (defineModuleLinks); tests `define-module-links.test.ts` and `define-module-links.test-d.ts`.

```markdown
Plan: E02-S05-T01

## Goal
@northmes/contracts exports defineModuleLinks(moduleId, entries), which imports no router. Each entry's builder takes typed params and search and returns { to, params, search, href }. Values are encoded with encodeURIComponent, and an empty value throws naming the param. Paths start with the plant segment and the module id.

## Where in the code
packages/contracts/src/define-module-links.ts (new), packages/contracts/src/index.ts (exists)
packages/contracts/test/define-module-links.test.ts, packages/contracts/test/define-module-links.test-d.ts (new)
Seam: pure functions; the types project runs the .test-d.ts file.

## Tests first
- define-module-links.test.ts: "E02-S05 order({ plant: plant-a, orderId: a/b }).href is /plant-a/planning/orders/a%2Fb"
- define-module-links.test.ts: "E02-S05 an empty orderId throws"
- define-module-links.test-d.ts: "E02-S05 a missing orderId, an extra argument and an unknown entry fail typecheck"

## Design
none

## ADRs
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md

## Out of scope
planningLinks (E02-S05-T07), typed search keys and enums (E04), station section builders (E11).

## Changelog
none, internal

## Acceptance criteria
- [ ] A builder returns to, params, search and href, with every value encoded
- [ ] An empty param value throws naming the param
- [ ] A missing param, an extra argument and an unknown entry are type errors in the types project
- [ ] packages/contracts imports no router package
```

##### E02-S05-T02 repo: Fail the check on app paths written as string literals

Labels: `task`, `human`, `area: ci` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S05-T01.

Covers: criterion 9; test `path-literals.test.ts`.

```markdown
Plan: E02-S05-T02

## Goal
A meta test scans modules/*/web, examples/*/web, apps/web and e2e for an app path written as a string literal in to=, href=, navigate({ to }), redirect({ to }) or page.goto(), and fails unless an allowlist entry gives a reason. Paths come from link builders and apiPath.

## Where in the code
scripts/lint/path-literals.mjs (new), scripts/lint/path-literals.allow.json (new)
test/meta/path-literals.test.ts (new)
Seam: scan(files, allowlist) over in-memory { path, text } files returns findings; a second case runs it over git ls-files.

## Tests first
- path-literals.test.ts: "E02-S05 a fixture <Link to="/x"> in a module web file fails, and a builder call passes"
- path-literals.test.ts: "E02-S05 navigate({ to: "/x" }) and page.goto("/x") fail, and an allowlisted literal with a reason passes"
- path-literals.test.ts: "E02-S05 an allowlist entry without a reason fails"

## Design
none

## ADRs
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md

## Out of scope
The link snapshot check (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] A literal path in to=, href=, navigate, redirect or page.goto in a scanned folder fails naming the file and line
- [ ] A builder call passes
- [ ] An allowlist entry without a reason fails, and pnpm check runs the test
```

##### E02-S05-T03 web: Keep shared singletons out of remote bundles

Labels: `task`, `human`, `area: web` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S03-T06.

Covers: criterion 4; tests `guards.test.ts`.

```markdown
Plan: E02-S05-T03

## Goal
@northmes/web-build holds shared.mjs, the one singleton list for the shell and every remote (react, react-dom, @tanstack/react-router, @apollo/client, graphql, graphql-ws, @northmes/web-sdk, @northmes/ui), and remote.mjs, whose defineRemoteConfig({ id, version }) sets the base /modules/<id>/<version>/, exposes ./module with a manifest and dts: false, and declares each singleton { singleton: true, import: false, requiredVersion: false }. The northmes:no-bundled-singletons plugin fails the build naming the package when singleton code lands in a remote chunk; zod, @northmes/contracts and @northmes/<id>-contracts are bundled per remote on purpose. A remote under modules/*/web that emits CSS fails.

## Where in the code
packages/web-build/shared.mjs, remote.mjs, guards.mjs (new), packages/web-build/LICENSE (new, MIT), packages/web-build/package.json (exists; scripts)
packages/web-build/test/guards.test.ts (new)
packages/web-build/test/fixtures/ (new): remote-apollo, remote-zod-contracts and remote-css
Port from docs/sources/spike-integration/packages/web-build/ (shared.mjs, remote.mjs).
Seam: the tests build each fixture remote with Vite through defineRemoteConfig and read the result.

## Tests first
- guards.test.ts: "E02-S05 a remote bundling @apollo/client fails naming the package"
- guards.test.ts: "E02-S05 a fixture remote that bundles zod and @northmes/planning-contracts passes"
- guards.test.ts: "E02-S05 a remote under modules/*/web that emits CSS fails"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md

## Out of scope
Plugin remotes with prefixed stylesheets and remotes built outside the workspace (E21), the Rsbuild path (only if the skeleton is red on 2026-11-27).

## Changelog
none, internal

## Acceptance criteria
- [ ] A fixture remote that bundles @apollo/client fails its build naming the package
- [ ] A fixture remote that bundles zod and @northmes/planning-contracts builds
- [ ] A remote under modules/*/web that emits CSS fails its build
- [ ] shared.mjs is the only singleton list, and defineRemoteConfig gives every singleton import false
```

##### E02-S05-T04 web: Define web modules and the shell client in @northmes/web-sdk

Labels: `task`, `human`, `area: web` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S03-T06.

Covers: criterion 3 (defineWebModule).

```markdown
Plan: E02-S05-T04

## Goal
@northmes/web-sdk exports defineWebModule({ id, version, routes }), where routes(plantRoute) returns the module's TanStack Router route tree, without nav (ADR 0062); validateWebModule, which names each problem (missing id, a version that differs from the server's entry, a route path that is not the module id); createShellRoutes, which builds the root route and the $plant route; createNorthmesClient, one Apollo Client 4 whose HTTP link sends x-northmes-plant and whose graphql-ws link sends plantId in connectionParams; and ShellProvider with useShell, which throws when the shell and a module hold two copies.

## Where in the code
packages/web-sdk/src/web-module.ts, routes.ts, apollo.ts, shell-context.tsx, index.ts (new)
packages/web-sdk/tsconfig.json, packages/web-sdk/LICENSE (new, MIT); packages/web-sdk/package.json (exists; scripts)
packages/web-sdk/test/web-module.test.ts, apollo.test.ts, shell-context.test.tsx (new)
Port from docs/sources/spike-integration/packages/web-sdk/src/ (contract.ts, routes.ts, apollo.ts, shell-context.tsx), without slots.
Seam: validateWebModule is pure; createNorthmesClient takes a fake fetch and a mock WebSocket.

## Tests first
- web-module.test.ts: "E02-S05 validateWebModule names a missing id, a version that differs from the server entry and a route path that is not the module id"
- apollo.test.ts: "E02-S05 createNorthmesClient sends the plant in x-northmes-plant over HTTP and in connectionParams over graphql-ws"
- shell-context.test.tsx: "E02-S05 useShell throws when a module holds a second copy of the shell context"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md

## Out of scope
Slots (E21-S01), reconnect options (E04-S05), one client per plant (E04-S04).

## Changelog
none, internal

## Acceptance criteria
- [ ] validateWebModule returns one named problem per case
- [ ] The client sends the plant header over HTTP and plantId in connectionParams over graphql-ws
- [ ] useShell throws on a second context copy
- [ ] Every file in packages/web-sdk carries the MIT SPDX line, and the package has its LICENSE
```

##### E02-S05-T05 platform: Serve the web module list and the remotes under a strict CSP

Labels: `task`, `human`, `area: sdk` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S05-T04, E02-S02-T05.

Covers: criterion 2 (the controller); criterion 5; criterion 7; test `web-modules.int.test.ts`.

```markdown
Plan: E02-S05-T05

## Goal
The module list controller is declared with ApiController({ module: "web", family: "first-party" }) and answers GET /api/v1/web/modules with no-store: per catalog module with a web block, its id, remote name, label, order, version, manifest URL and the SHA-384 hash of its mf-manifest.json (null when files are missing), plus the NorthMES version and the supergraph hash. Nest serves each remote at /modules/<id>/<version>/ with immutable caching for hashed files and no-cache for mf-manifest.json and the entry, and the shell at the SPA paths. Every SPA response sends a Content-Security-Policy of 'self'. A module the catalog did not load gets no entry and no mount.

## Where in the code
apps/server/src/web/web-modules.controller.ts, static-mounts.ts, web.module.ts (new)
apps/server/src/app.module.ts (exists; WebModule)
apps/server/test/rest/web-modules.int.test.ts (new)
apps/server/test/fixtures/web/ (new): built remote and shell files
Port from docs/sources/spike-integration/apps/server/src/web.ts and docs/sources/spike-mf/apps/server/src/web-modules.ts.
Seam: createTestApp with fixture files; requests with fetch.

## Tests first
- web-modules.int.test.ts: "E02-S05 a disabled module is not listed"
- web-modules.int.test.ts: "E02-S05 the module list answers at apiPath(web, modules) from a controller declared with ApiController"
- web-modules.int.test.ts: "E02-S05 hashed remote files are immutable and mf-manifest.json is no-cache"
- web-modules.int.test.ts: "E02-S05 an SPA path answers with the strict self Content-Security-Policy"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md

## Out of scope
401 without a session and 403 for a plant (E05), the plant filter (E05-S06), hash checks in the shell (E04-S02), client errors (E04-S06).

## Changelog
none, internal

## Acceptance criteria
- [ ] GET /api/v1/web/modules lists planning with its manifest URL and hash, and a module the catalog did not load appears in no response
- [ ] The controller's path comes from ApiController, not from a string
- [ ] Hashed files under /modules/planning/<version>/ are immutable, and mf-manifest.json is no-cache
- [ ] Every SPA response carries the strict 'self' policy; e2e/skeleton.spec.ts checks for zero violations (E02-S08-T03)
```

##### E02-S05-T06 web: Load remotes in the shell from the module list

Labels: `task`, `human`, `area: web` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S05-T03, E02-S05-T05.

Covers: criterion 1; criterion 2 (the shell builds the URL with `apiPath`); criterion 6.

```markdown
Plan: E02-S05-T06

## Goal
apps/web is a Vite SPA and a pure @module-federation/runtime host with no federation build plugin. It calls registerShared with its own module instances for every name in shared.mjs, fetches the module list from apiPath("web", "modules"), registers each listed remote, loads ./module, checks it with validateWebModule and builds the route tree from createShellRoutes plus each remote's routes(plantRoute). A remote that fails to load gets a placeholder route and an "(unavailable)" menu entry in its usual position. The E02 menu is a plain list of modules in order.

## Where in the code
apps/web/index.html, apps/web/vite.config.ts (new)
apps/web/src/main.tsx, federation.ts, menu.tsx (new)
apps/web/tsconfig.json (new), apps/web/package.json (exists; scripts)
apps/web/test/federation.test.tsx, apps/web/test/shared.test.ts (new)
Port from docs/sources/spike-integration/apps/shell/ (src/federation.ts, src/main.tsx, vite.config.ts, index.html), renamed to apps/web.
Seam: loadModules(list, runtime) with a fake federation runtime; Testing Library in the web project.

## Tests first
- federation.test.tsx: "E02-S05 the shell registers each listed remote and mounts its routes under $plant"
- federation.test.tsx: "E02-S05 a remote that fails to load gets a placeholder route and an (unavailable) entry in its usual position"
- federation.test.tsx: "E02-S05 the shell requests the module list from apiPath(web, modules)"
- shared.test.ts: "E02-S05 the registerShared keys equal the list in shared.mjs"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md

## Out of scope
Timeouts and retries, the sidebar from routes and the degraded e2e spec's hash case (E04-S02), styles and tokens (E04-S01).

## Changelog
none, internal

## Acceptance criteria
- [ ] The shell fetches /api/v1/web/modules through apiPath, registers each remote and mounts its routes under /$plant
- [ ] A remote that fails to load shows a placeholder route and "(unavailable)" in its menu position
- [ ] registerShared covers exactly the names in shared.mjs
- [ ] pnpm build builds apps/web with no federation build plugin
```

##### E02-S05-T07 planning: Show production orders with article names on the board stub

Labels: `task`, `human`, `area: planning` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S05-T06, E02-S05-T02, E02-S04-T06.

Covers: criterion 3 (the remote and its board stub); criterion 8 (planningLinks); test `routes.links.test.tsx`; the story's note on the `web-remote` recipe.

```markdown
Plan: E02-S05-T07

## Goal
modules/planning/web is a remote built through defineRemoteConfig that exposes ./module = defineWebModule(...). Its routes take their paths from planningLinks in @northmes/planning-contracts, declared with defineModuleLinks. The board stub at planningLinks.board runs planningProductionOrders and lists each order's number, quantity, status and article name, with data-testid hooks for the e2e specs. The remote imports no stylesheet. The web-remote recipe records the files, the commands and each load error with its meaning.

## Where in the code
modules/planning/contracts/src/links.ts (new), modules/planning/contracts/src/index.ts (exists)
modules/planning/web/vite.config.ts (new)
modules/planning/web/src/module.tsx, routes.tsx, board-screen.tsx, board.graphql.ts (new)
modules/planning/web/tsconfig.json (new), modules/planning/web/package.json (exists; scripts)
modules/planning/web/test/routes.links.test.tsx, modules/planning/web/test/board-screen.test.tsx (new)
docs/recipes/web-remote.md (new)
Port from docs/sources/spike-integration/modules/planning/web/ and docs/sources/spike-mf/modules/planning/web/src/module.test.tsx.
Seam: the remote's module tested as a plain React package with MockedProvider; routes compared with planningLinks.

## Tests first
- routes.links.test.tsx: "E02-S05 every planningLinks entry matches a route fullPath"
- board-screen.test.tsx: "E02-S05 the board stub lists production orders with their article names"
- board-screen.test.tsx: "E02-S05 the remote's defineWebModule version equals the planning manifest version"
- Session check: on a migrated database with orders written through db.command, the built all process shows them on the board in Chromium

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md

## Out of scope
The Release button (E02-S05-T08), live updates (E02-S06-T03), the real board (E08), links.snapshot.json (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] The planning remote builds through defineRemoteConfig and exposes ./module
- [ ] Every planning route path comes from planningLinks, and every planningLinks entry matches a route
- [ ] The board stub lists number, quantity, status and article name for each order of the plant
- [ ] docs/recipes/web-remote.md lists the files, the commands and each load error with its meaning
```

##### E02-S05-T08 planning: Release a production order from the board stub

Labels: `task`, `human`, `area: planning` (runs in a session: handoff-demo arrives with E02-S08). Blocked by: E02-S05-T07.

Covers: no S05 criterion; the release in the browser that E02-S06 criterion 3 and the skeleton spec need. After this task the shell shows module data and saves it through a command.

```markdown
Plan: E02-S05-T08

## Goal
Each planned order on the board stub has a Release button that sends planningReleaseProductionOrder with the order's id. On success the row shows released and its new version without a reload; on failure the row shows the error's message and errorCode (for a veto, core.command_rejected with the validator's message), and the row stays planned.

## Where in the code
modules/planning/web/src/board-screen.tsx (exists), modules/planning/web/src/release.graphql.ts (new)
modules/planning/web/test/board-screen.test.tsx (exists)
Seam: the board screen with MockedProvider.

## Tests first
- board-screen.test.tsx: "E02-S05 the Release button sends planningReleaseProductionOrder and the row shows released"
- board-screen.test.tsx: "E02-S05 a rejected release shows the message and errorCode in the row"
- Session check: on the built all process, a release changes the row in Chromium

## Design
none

## ADRs
docs/adr/0012-commands-as-the-single-write-path.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md

## Out of scope
Live updates in other browsers (E02-S06-T03), forms with fieldErrors (E05-S01), the real board actions (E08).

## Changelog
none, internal

## Acceptance criteria
- [ ] A planned order's Release button sends planningReleaseProductionOrder with its id
- [ ] A released row shows its status and new version without a reload
- [ ] A rejected release shows the message and the errorCode, and the row stays planned
```

#### E02-S06 platform: Push a release to the board over a subscription

Issue: northMES/northmes#24. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s06-platform-push-a-release-to-the-board-over-a-subscription). Blocked by: E02-S04, E02-S05.

Notes: the release publishes `planning.production_order.released`, which is not in the release 1 event list of [04-data-and-platform.md](04-data-and-platform.md#release-1-events). `core.event`, `core.event_sequencer` and `core.inbox` carry no policies, by the working default of [ADR 0014](../adr/0014-outbox-event-log-and-pg-boss-jobs.md); their allowlist entries arrive with the catalog lint (E05-S04). pg-boss jobs wait for E05-S09.

##### E02-S06-T01 platform: Sequence command events in commit order

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0014). Blocked by: E02-S04-T09, E02-S05-T08.

Covers: criterion 1; test `sequencer.int.test.ts`.

```markdown
Plan: E02-S06-T01

## Goal
core.event and core.event_sequencer come from a core migration with the DDL of ADR 0014; position stays null until published. A handler publishes events through the SDK in its own transaction, after the row update that returned the new version; the release handler publishes planning.production_order.released with ids only. In roles worker and all, one sequencer per batch of up to 500 rows takes pg_try_advisory_xact_lock, assigns positions to rows with position null in seq order and sends one NOTIFY carrying only the last position, all in one transaction. Role api starts no sequencer.

## Where in the code
modules/core/migrations/<timestamp>_event.sql (new)
packages/sdk/src/commands/publish.ts (new), packages/sdk/src/commands/index.ts (exists)
apps/server/src/events/sequencer.ts, apps/server/src/events/events.module.ts (new), apps/server/src/app.module.ts (exists)
modules/planning/server/commands/release-production-order.ts (exists; publishes the event)
apps/server/test/events/sequencer.int.test.ts (new)
No spike source: the spike publishes from the handler without a transaction.
Seam: publish(tx, event) and runSequencerBatch(pool) against a database from useTestDatabase().

## Tests first
- sequencer.int.test.ts: "E02-S06 events committed out of order get positions in commit order"
- sequencer.int.test.ts: "E02-S06 a publish inside a rolled-back transaction leaves no event"
- sequencer.int.test.ts: "E02-S06 one batch sends one NOTIFY whose payload is only its last position"
- sequencer.int.test.ts: "E02-S06 two sequencers running at once give unique, increasing positions"
- sequencer.int.test.ts: "E02-S06 role api starts no sequencer"

## Design
none

## ADRs
docs/adr/0014-outbox-event-log-and-pg-boss-jobs.md
docs/adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
pg-boss jobs and the inbox (E05-S09), causation ids from audit (E05-S02), retention (not decided).

## Changelog
none, internal

## Acceptance criteria
- [ ] A release writes one planning.production_order.released row to core.event in the command's transaction
- [ ] Transactions committed out of insertion order get positions in commit order, and two sequencers never give one position twice
- [ ] A rolled-back command leaves no event
- [ ] Each batch sends one NOTIFY that carries only a position, and role api runs no sequencer
```

##### E02-S06-T02 platform: Tail core.event and feed planningBoardChanged

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0014). Blocked by: E02-S06-T01.

Covers: criterion 2; test `board-changed.int.test.ts`.

```markdown
Plan: E02-S06-T02

## Goal
In roles api and all, the event tail holds one direct LISTEN connection outside the pool, starts at the current maximum position, treats a notification as a wake-up, reads core.event where position is greater than the last seen and hands each event to an in-process PubSub; no third-party Postgres pub/sub library is used. Planning's subscription planningBoardChanged(plantId: ID!) yields the ids of production orders changed in that plant's scope. The schema snapshots are regenerated.

## Where in the code
apps/server/src/events/event-tail.ts (new), apps/server/src/events/events.module.ts (exists)
packages/sdk/src/events.ts (new): the EVENTS token and its interface
modules/planning/server/board-changed.resolver.ts (new), modules/planning/server/planning.module.ts (exists)
modules/planning/test/board-changed.int.test.ts, apps/server/test/events/event-tail.int.test.ts (new)
schema/api.graphql, schema/supergraph.graphql, modules/planning/schema.graphql (regenerated)
Port the subscription from docs/sources/spike-integration/modules/planning/server/planning.module.ts and subscriptionWithFilter from the driver in docs/sources/spike-integration/packages/sdk/src/subgraph.ts.
Seam: createTestApp with core and planning; gqlClient subscribes over graphql-ws; the release goes through the mutation.

## Tests first
- board-changed.int.test.ts: "E02-S06 a release emits one planningBoardChanged message with the order id"
- board-changed.int.test.ts: "E02-S06 a subscriber for another plant receives nothing"
- event-tail.int.test.ts: "E02-S06 the tail starts at the current maximum position and skips older events"

## Design
none

## ADRs
docs/adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
docs/adr/0014-outbox-event-log-and-pg-boss-jobs.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md

## Out of scope
The polling fallback and authorization per subscription and per event (E05-S10), reconnects (E04-S05).

## Changelog
none, internal

## Acceptance criteria
- [ ] The tail uses one direct LISTEN connection and no pool connection while idle
- [ ] A release emits exactly one planningBoardChanged message that carries the order id and no other order fields
- [ ] A subscriber for another plant receives nothing
- [ ] A process started after an event does not replay it
```

##### E02-S06-T03 planning: Update the board stub live when an order is released

Labels: `task`, `human`, `area: planning` (builds on proposed ADR 0020). Blocked by: E02-S06-T02.

Covers: criteria 3 and 4.

```markdown
Plan: E02-S06-T03

## Goal
The board stub subscribes to planningBoardChanged for its plant over graphql-ws and, on each message, refetches its visible range of orders, so a release made in one browser shows on the board in another without a reload. Messages carry ids only; the rows come from the refetch.

## Where in the code
modules/planning/web/src/board-screen.tsx, modules/planning/web/src/board.graphql.ts (exist)
modules/planning/web/test/board-screen.test.tsx (exists)
Seam: the board screen with MockedProvider and a mocked subscription result.

## Tests first
- board-screen.test.tsx: "E02-S06 the board subscribes to planningBoardChanged with its plant id"
- board-screen.test.tsx: "E02-S06 a planningBoardChanged message makes the board refetch its orders and show the new status"
- Session check: a release in one Chromium window appears on the board in a second window

## Design
none

## ADRs
docs/adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md

## Out of scope
Pausing live updates (E08-S11), the reconnect banner (E04-S05), the end-to-end test (E02-S08-T03).

## Changelog
none, internal

## Acceptance criteria
- [ ] The board subscribes to planningBoardChanged with its plant id
- [ ] A message triggers one refetch of the board's orders, and the row shows the new status
- [ ] A release in one browser appears on the board in another without a reload
```

#### E02-S07 platform: Shut down cleanly and report the supergraph hash

Issue: northMES/northmes#25. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s07-platform-shut-down-cleanly-and-report-the-supergraph-hash). Blocked by: E02-S06.

Notes: pg-boss `stop()` (E05-S09), the schema compatibility number (E18-S03) and the audit row of the 1.5 s mutation (E05-S02) are not part of E02.

##### E02-S07-T01 platform: Report liveness and readiness with the supergraph hash

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S06-T03.

Covers: criterion 4.

```markdown
Plan: E02-S07-T01

## Goal
/health/live answers 200 while the process runs. /health/ready returns JSON with status, the NorthMES version and the supergraph hash through custom @nestjs/terminus indicators for the pool and the gateway, and answers 503 until the gateway is ready. Both are root routes on the route check's allowlist.

## Where in the code
apps/server/src/health/health.controller.ts, health.module.ts, indicators.ts (new)
apps/server/src/app.module.ts (exists)
apps/server/test/health.int.test.ts (new)
Port from the health/ready route in docs/sources/spike-integration/apps/server/src/web.ts.
Seam: createTestApp; fetch on /health/live and /health/ready.

## Tests first
- health.int.test.ts: "E02-S07 /health/live answers 200"
- health.int.test.ts: "E02-S07 /health/ready returns status, version and the supergraph hash from the boot log"

## Design
none

## ADRs
docs/adr/0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md

## Out of scope
Degraded states, the watchdog and System health (E16).

## Changelog
none, internal

## Acceptance criteria
- [ ] GET /health/live returns 200
- [ ] GET /health/ready returns status, version and supergraph, and the hash equals the boot log's
- [ ] Both routes pass the boot route check as root routes
```

##### E02-S07-T02 platform: Shut down cleanly on SIGTERM and finish in-flight requests

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S07-T01.

Covers: criteria 1, 2 and 3; tests `shutdown.int.test.ts`.

```markdown
Plan: E02-S07-T02

## Goal
Boot calls app.enableShutdownHooks(["SIGTERM", "SIGINT"]), because the embedded gateway's own signal listeners would otherwise stop Node's default exit. On SIGTERM: readiness returns 503; graphql-ws is disposed in beforeApplicationShutdown, so subscribers get close code 1001; Nest closes HTTP with forceCloseConnections off and return503OnClosing on; the gateway runtime is disposed in onApplicationShutdown; the event tail's LISTEN connection and the pools close last.

## Where in the code
apps/server/src/boot/boot.ts, apps/server/src/gateway/gateway.module.ts (exist)
apps/server/src/events/event-tail.ts, apps/server/src/db/pool.ts, apps/server/src/health/indicators.ts (exist)
apps/server/test/shutdown.int.test.ts (new)
apps/server/test/fixtures/slow-command/ (new): a fixture module with a 1.5 s command
Port from the shutdown hooks in docs/sources/spike-integration/apps/server/src/gateway/gateway.module.ts and docs/sources/spike-integration/apps/server/ws-close.mjs.
Seam: boot() of a fixture catalog in the test process for the mutation and readiness cases; bootBuilt for the exit case.

## Tests first
- shutdown.int.test.ts: "E02-S07 a 1.5 s mutation with app.close() after 300 ms returns 200"
- shutdown.int.test.ts: "E02-S07 readiness returns 503 during shutdown"
- shutdown.int.test.ts: "E02-S07 a subscriber gets 1001 and the process exits"

## Design
none

## ADRs
docs/adr/0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
pg-boss stop (E05-S09), assistant streams (E14), the audit row of the slow mutation (E05-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] A 1.5 s mutation running when app.close() starts after 300 ms returns 200
- [ ] /health/ready returns 503 once shutdown starts
- [ ] A graphql-ws subscriber gets close code 1001, and the process exits on its own after SIGTERM
- [ ] The pools close after HTTP and the gateway
```

#### E02-S08 platform: Start the stack with one script and gate on the skeleton spec

Issue: northMES/northmes#26. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s08-platform-start-the-stack-with-one-script-and-gate-on-the-skeleton-spec). Blocked by: E02-S07.

Notes: criterion 2 lands in E02-S01-T06. The seed writes fictional articles and orders at one company and plant scope id; the planner and operator need Better Auth (E05-S05) and core's tables (E05-S03). `playwright.config.ts` does not exist on main; E02-S08-T02 creates it, or extends it when E01-S04-T01 has created it. From M1, `e2e/skeleton.spec.ts` and the resolve-hook test become required in `ci / gate`, which is a ruleset change outside these tasks. E02-S08-T06 is the epic's end docs task.

##### E02-S08-T01 platform: Start Postgres, migrate and seed with one stack script

Labels: `task`, `human`, `area: sdk` (touches secrets handling). Blocked by: E02-S07-T02.

Covers: criteria 1 and 3; test `scripts/stack/config.test.ts`.

```markdown
Plan: E02-S08-T01

## Goal
scripts/stack/stack.mjs runs the shared steps of ADR 0058: write .northmes/dev.env (NODE_ENV=development, *_FILE keys) and random dev secret files under .northmes/secrets/ with mode 0600 and the dev marker when missing; start Postgres through Testcontainers from infra/pg-image.json (withReuse only on a laptop behind an opt-in variable, never in CI); run northmes db bootstrap as the container superuser, then northmes migrate; run an idempotent seed of fictional articles and production orders at one fixed company and plant scope; and take ports by binding 127.0.0.1:0. The server has no default port, and EADDRINUSE names PORT.

## Where in the code
scripts/stack/stack.mjs, config.mjs, ports.mjs, seed.mjs (new)
scripts/stack/config.test.ts, scripts/stack/ports.test.ts, scripts/stack/dev-up.int.test.ts (new)
apps/server/src/boot/boot.ts (exists; EADDRINUSE names PORT), apps/server/test/boot/port.int.test.ts (new)
Port from docs/sources/spike-mf/dev.mjs, docs/sources/tcspike/spike.mjs and the role setup in docs/sources/spike-integration/apps/server/test/migrate.test.mjs.
Seam: writeDevConfig(dir) and freePort() over a temporary directory and sockets; dev-up.int.test.ts runs the bootstrap twice against one container.

## Tests first
- config.test.ts: "E02-S08 the dev secret files are written with mode 0600 and the dev marker"
- ports.test.ts: "E02-S08 two stack instances get disjoint ports"
- dev-up.int.test.ts: "E02-S08 a second run applies no migration and adds no seed rows"
- port.int.test.ts: "E02-S08 a port in use stops boot with a message naming PORT"

## Design
none

## ADRs
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
docs/adr/0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md

## Out of scope
pnpm dev and handoff-demo (E02-S08-T05), sign-in of a seeded planner (E05-S05), the Compose stack (E17-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] A first run writes .northmes/dev.env and the secret files with mode 0600 and the dev marker, and a second run keeps them
- [ ] The stack starts Postgres from infra/pg-image.json, bootstraps the roles, migrates and seeds, and a second run adds nothing
- [ ] Two stack instances started together get disjoint ports and no EADDRINUSE
- [ ] The server has no default port, and a port in use stops boot naming PORT
```

##### E02-S08-T02 platform: Run Playwright specs on the built all process

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S08-T01.

Covers: E02-S05 test `e2e/shell-degraded.spec.ts`; the Playwright harness criterion 5 runs on.

```markdown
Plan: E02-S08-T02

## Goal
playwright.config.ts gets the e2e project: Chromium, no webServer. Its globalSetup runs the stack script into a template database; a worker fixture clones e2e_<parallelIndex> and spawns the built server with NORTHMES_ROLE=all and PORT=0. pnpm e2e builds once and runs the project. The first spec proves the shell's degraded path: with the planning remote's files missing, the shell shows the placeholder route and the "(unavailable)" menu entry.

## Where in the code
playwright.config.ts (new, or extended when E01-S04-T01 has created it)
e2e/global-setup.ts, e2e/fixtures.ts (new)
e2e/shell-degraded.spec.ts, e2e/harness.spec.ts (new)
Seam: the worker fixture's server URL; specs build paths with planningLinks and apiPath.

## Tests first
- shell-degraded.spec.ts: "E02-S05 a missing remote shows the placeholder and the menu entry"
- harness.spec.ts: "E02-S08 two workers get their own database and server"

## Design
none

## ADRs
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
docs/adr/0019-web-shell-with-react-module-federation-remotes.md

## Out of scope
Better Auth storage states (E05-S05), the stack2 fixture (E05-S10), the accessibility project (E20), the wrong-hash case (E04-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm e2e builds once and runs the e2e project on Chromium with one database and one built server per worker
- [ ] The config has no webServer entry, and no spec writes an app path as a literal
- [ ] With the planning remote's files removed, the shell shows the placeholder route and "(unavailable)" in the menu
```

##### E02-S08-T03 platform: Gate on the skeleton spec in ci / e2e

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S08-T02.

Covers: criterion 5; tests `e2e/skeleton.spec.ts`.

```markdown
Plan: E02-S08-T03

## Goal
e2e/skeleton.spec.ts runs on the built all process with core, planning and example-validator loaded from plugins/. The board lists the seeded orders with article names under the strict CSP with zero securitypolicyviolation events; a release over the example limit shows the validator's message; a release in a second browser context appears on the board. ci.yml gets the ci / e2e job, which builds and runs pnpm e2e on every pull request.

## Where in the code
e2e/skeleton.spec.ts (new)
.github/workflows/ci.yml (exists; ci / e2e job)
test/meta/workflows.test.ts (exists)
Seam: the e2e fixtures from E02-S08-T02; workflows.test.ts parses ci.yml.

## Tests first
- skeleton.spec.ts: "E02-S08 the board lists orders with article names"
- skeleton.spec.ts: "E02-S08 a vetoed release shows the validator message"
- skeleton.spec.ts: "E02-S08 a release in a second context appears on the board"
- workflows.test.ts: "E02-S08 ci / e2e builds and runs pnpm e2e"

## Design
none

## ADRs
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md

## Out of scope
Making the spec required in ci / gate at M1 (a ruleset change), the Chromium project with Temporal deleted (later).

## Changelog
ci(repo): run the walking skeleton spec in ci / e2e

## Acceptance criteria
- [ ] skeleton.spec.ts passes on the built all process with example-validator loaded
- [ ] The board test records zero securitypolicyviolation events
- [ ] A vetoed release shows the validator's message, and a release in one context appears in the other
- [ ] ci / e2e runs the spec on every pull request
```

##### E02-S08-T04 repo: Run integration tests in a fresh worktree in CI

Labels: `task`, `human`, `area: ci` (changes CI workflows). Blocked by: E02-S08-T03.

Covers: criterion 6.

```markdown
Plan: E02-S08-T04

## Goal
The fresh-worktree job in ci.yml runs git worktree add, pnpm install --frozen-lockfile and pnpm test:int with no build step, and passes, so a fresh worktree runs every integration test after one install. Tests that boot the built server build it through their own helper (E02-S04-T07).

## Where in the code
.github/workflows/ci.yml (exists; fresh-worktree job)
test/meta/workflows.test.ts (exists)
Seam: workflows.test.ts parses ci.yml.

## Tests first
- workflows.test.ts: "E02-S08 the fresh-worktree job runs git worktree add, pnpm install --frozen-lockfile and pnpm test:int and no build"
- Session check: the job passes on the pull request

## Design
none

## ADRs
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
docs/adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md

## Out of scope
Making the job a required check (a ruleset change).

## Changelog
ci(repo): run the integration tests in a fresh worktree

## Acceptance criteria
- [ ] ci.yml has a fresh-worktree job with exactly these three steps and no build step
- [ ] The job passes on the pull request
- [ ] workflows.test.ts fails when a build step is added to the job
```

##### E02-S08-T05 platform: Run the app with pnpm dev and the handoff-demo launch entry

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S08-T01.

Covers: criterion 4. After this task a person can try the app by hand.

```markdown
Plan: E02-S08-T05

## Goal
pnpm dev runs the stack script, then tsc -b --watch over the backend projects with a server restart after each completed build, the shell's Vite dev server and one Vite dev server per remote, with ports from the stack; a changed migration file runs northmes migrate again. .claude/launch.json gets handoff-demo, which runs the production build of role all through the stack script on $PORT with the fictional seed, so a demo has one origin and one port.

## Where in the code
scripts/stack/dev.mjs, scripts/stack/demo.mjs (new)
.claude/launch.json (new)
scripts/stack/dev.test.ts, test/meta/launch.test.ts (new)
Seam: devPlan(ports) returns the processes to start; launch.test.ts reads .claude/launch.json.

## Tests first
- dev.test.ts: "E02-S08 pnpm dev starts tsc -b --watch, the shell dev server and one dev server per remote on the stack's ports"
- launch.test.ts: "E02-S08 handoff-demo runs the built all process through the stack script on PORT"
- Session check: through handoff-demo the board lists the seeded orders and a release changes a row

## Design
none

## ADRs
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
docs/adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md

## Out of scope
Fast Refresh for every remote (E04-S08).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm dev starts Postgres, migrates, seeds and serves the server, the shell and the planning remote with rebuilds on change
- [ ] .claude/launch.json has handoff-demo, which runs the built all process through the stack script on $PORT
- [ ] Through handoff-demo the board lists the seeded orders and a release changes a row
```

##### E02-S08-T06 docs: Update the guides and ADR statuses after the walking skeleton

Labels: `task`, `human`, `area: docs` (the epic's end docs task, run alone). Blocked by: E02-S08-T03, E02-S08-T04, E02-S08-T05.

Covers: the epic's definition of done (shared docs, ADR statuses, issue numbers in this file).

```markdown
Plan: E02-S08-T06

## Goal
A person works this task in a session, alone, after every other E02 task. It updates the shared docs the skeleton changed: README.md's quick start with pnpm dev, AGENTS.md where a command changed, the plan documents where E02 settled an open item, and the status and needs-confirmation fields of every ADR that E02 confirmed. It checks that docs/plan/E02-walking-skeleton.md holds every task's issue number.

## Where in the code
README.md, AGENTS.md (exist)
docs/adr/*.md and docs/adr/README.md (exist; status and needs-confirmation)
docs/plan/README.md (exists; the ADR checklist)
docs/plan/E02-walking-skeleton.md (exists; issue numbers only)

## Tests first
- Session check: test/meta/doc-links.test.ts and the ADR index test pass
- Session check: every E02 task issue is closed and its number is in docs/plan/E02-walking-skeleton.md

## Design
none

## ADRs
docs/adr/0001-record-architecture-decisions-in-madr.md
docs/adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md

## Out of scope
The docs site (E19), module how-to pages beyond the recipes (E19-S05).

## Changelog
docs(repo): document how to run the walking skeleton

## Acceptance criteria
- [ ] README.md tells a newcomer how to start the app with pnpm dev
- [ ] Every ADR that E02 confirmed has current status and needs-confirmation fields, and the ADR index matches
- [ ] docs/plan/E02-walking-skeleton.md holds every task's issue number
```

#### Project order

The order for `set_order`, which keeps every blocker ahead of its task and reaches the stop point at E02-S05-T08 as early as the stories allow:

1. E02-S01-T00, E02-S01-T01, E02-S01-T02, E02-S01-T03, E02-S01-T04, E02-S01-T05, E02-S01-T06, E02-S01-T07
2. E02-S02-T01, E02-S03-T01, E02-S03-T02, E02-S02-T02, E02-S03-T03, E02-S02-T03, E02-S02-T04, E02-S03-T04, E02-S02-T05, E02-S03-T05, E02-S03-T06
3. E02-S04-T01, E02-S05-T01, E02-S05-T02, E02-S05-T03, E02-S05-T04, E02-S04-T02, E02-S04-T03, E02-S03-T07, E02-S04-T04, E02-S04-T05, E02-S04-T06, E02-S05-T05, E02-S05-T06, E02-S05-T07, E02-S05-T08
4. E02-S04-T07, E02-S04-T08, E02-S04-T09
5. E02-S06-T01, E02-S06-T02, E02-S06-T03, E02-S07-T01, E02-S07-T02
6. E02-S08-T01, E02-S08-T05, E02-S08-T02, E02-S08-T03, E02-S08-T04, E02-S08-T06
