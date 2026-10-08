# E02 platform: Boot a walking skeleton end to end

This file holds the tasks of epic E02 (northMES/northmes#18), shaped as thin vertical slices by the rules in [13-delivery-and-github.md](13-delivery-and-github.md#shaping-the-plan-into-issues). The epic, its stories, their criteria and their named tests are in [14-roadmap.md](14-roadmap.md#e02-platform-boot-a-walking-skeleton-end-to-end); each story section below links its roadmap section and adds only what the tasks need. A "Covers" line names the story criteria a task delivers, numbered by their order in the roadmap. After the issues exist, each task heading gets its issue number next to its identifier (`E02-S03-T01, #42`), the issue becomes the source of truth for scope, and this file is not edited again. Every task carries `human` and runs in an interactive session or as a run on `northmes-guided` (Krister Johansson's choice of 2026-10-06), because ADRs [0003](../adr/0003-module-package-shape-and-the-definemodule-manifest.md), [0004](../adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md), [0006](../adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md), [0008](../adr/0008-row-level-security-with-transaction-local-scopes.md), [0012](../adr/0012-commands-as-the-single-write-path.md), [0014](../adr/0014-outbox-event-log-and-pg-boss-jobs.md), [0017](../adr/0017-zod-contracts-as-the-single-source-for-inputs.md), [0020](../adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md), [0056](../adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md) and [0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) are proposed and ADRs [0005](../adr/0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0019](../adr/0019-web-shell-with-react-module-federation-remotes.md), [0037](../adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0038](../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) and [0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) have open needs-confirmation.

E02-S01-T01 is the foundation session pull request: it lands every root configuration change the skeleton needs, including the `package.json` of every E02 workspace package, the root scripts and the root devDependencies that `scripts/`, `e2e/` and `playwright.config.ts` import, so later E02 tasks and the E03 runs change no lockfile. After it, a root file changes only in the task that owns it: `scripts/gen.mjs` (E02-S03-T09), `northmes.config.json` (E02-S04-T09), `playwright.config.ts` (E02-S08-T02, which extends the file E01-S04-T01 creates), `.github/workflows/ci.yml` (E02-S08-T03 and E02-S08-T04) and `.claude/launch.json` (E02-S08-T05). Every other task comes after E02-S01-T01, and E02-S01-T01 comes after E00-S05-T03 (#202), so the `docs/sources/` paths the tasks port from exist. E02-S01-T01 also lands before E01-S04-T01, which rebases its `package.json` and lockfile change on it.

The shell first shows module data from two subgraphs after E02-S05-T08 (the board stub lists production orders with their article names) and first saves through a command after E02-S05-T09 (its Release button runs `planningReleaseProductionOrder`). The stack script (E02-S08-T01) needs only E02-S04-T03, and `pnpm dev` (E02-S08-T05) follows E02-S05-T09, so after E02-S08-T05 a person can start the app with `pnpm dev`, open the board URL it prints, see the seeded orders and release one. That is the stop point for a hand test and a review of the setup; the [project order](#project-order) reaches it as its 32nd task. Earlier, E02-S04-T02 is the first task that serves module data from Postgres through the gateway, E02-S04-T03 the first that joins two subgraphs, and E02-S04-T07 the first that saves through a command. The roadmap's story order puts E02-S08 after E02-S07; this file starts E02-S08-T01 and E02-S08-T05 early and keeps the rest of E02-S08 last.

Until E05, every task follows these tracer rules. There is no sign-in; a tracer principal holds every permission (E05-S05, E05-S06). An HTTP request names its plant by the plant's scope id in `x-northmes-plant`, and the SPA's `$plant` segment carries that id until plant slugs arrive (E05-S03). A subscription takes its plant from its `plantId` argument, and nothing goes in `connectionParams` ([ADR 0018](../adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md)). One transaction step sets `northmes.read_scopes` and `northmes.write_scopes` to that one id (E05-S03, E05-S04). `given.company()` and `given.plant()` return fresh scope ids without rows, and `db.command` opens a scoped transaction without an audit context (E05-S02). The seed writes fictional articles and production orders at one company and plant scope id, with no planner and no operator; the E05-S05 task "Seed a planner and an operator with dev-only credentials" adds them. Every package version is 0.0.0 until the first release-please release (E01-S03-T02). Test names start with the story id ([ADR 0041](../adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).

The root of `@northmes/sdk` exports only what a manifest may load (`defineModule`, `moduleNames`, `HOST_PROVIDED` and types), because a manifest loads without Nest ([ADR 0003](../adr/0003-module-package-shape-and-the-definemodule-manifest.md)). Nest code goes to the subpaths `/config`, `/graphql`, `/rest`, `/data`, `/commands` and `/errors` ([03-modules-and-extensibility.md](03-modules-and-extensibility.md#shared-packages-and-the-license-boundary)), which E02-S01-T01 declares.

Each recipe is a project skill at `.claude/skills/<name>/SKILL.md`. [ADR 0022](../adr/0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) allows a recipe as a skill, and the accepted ADRs [0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) and [0063](../adr/0063-agent-skills-from-library-authors-pinned-in-the-repository.md) call these five recipes project skills, so a `docs/recipes` folder would need the text of both ADRs changed. A project skill is NorthMES's own file: it gets no `skills-lock.json` entry and no section in `.claude/skills/THIRD_PARTY_LICENSE.md`, because ADR 0063 pins and licenses the third-party skills only. E02-S02-T07, which writes the first one, makes the skills check in `test/meta/agent-files.test.ts` (E00-S03-T01) accept the five project skills that [13-delivery-and-github.md](13-delivery-and-github.md#agent-skills-in-the-repository) names. Each project skill joins handoff's `northmes` library group when it lands. The `dst-test` skill comes with E03-S01.

The operating session settled the open points of the shaping review on 2026-10-06, under Krister Johansson's delegation of that day: the recipes are project skills, as above; criterion 1 of E02-S08 in the roadmap names the tracer seed, and an E05-S05 task adds the planner and the operator; `@northmes/ui` stays out of `shared.mjs` until E04-S01; E02-S08-T01 and E02-S08-T05 run before E02-S07; the eight tasks with a `feat` changelog line keep it; E02-S01-T01 stays one session pull request; E02-S01-T01 lands before E01-S04-T01; and the names `buildPayload` and the contract's `payload` schema stand.

#### E02-S01 platform: Load manifests and stop boot on catalog errors

Issue: northMES/northmes#19. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s01-platform-load-manifests-and-stop-boot-on-catalog-errors). Blocked by: E00-S07-T01 (#206), E01-S05-T02 (#214).

Notes: criterion 2 is split over E02-S01-T02 and E02-S01-T05, criterion 4 over E02-S01-T04, T05 and T06, and criterion 6 over E02-S01-T07, T08 and T09. Criterion 2 of E02-S08 (the dev secret refusal) lands in E02-S01-T08, because [ADR 0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) tests the refusal itself in `@northmes/sdk/config`. The story test "image 0.4.0-rc.1 satisfies range >=0.3.0 <0.5.0" keeps its name, and E02-S01-T05 adds the refusal of a range that excludes the image as a second test.

##### E02-S01-T00, #219 docs: Record the E02 plan and ADRs

Labels: `task`, `human`, `area: docs` (the epic's plan docs task, worked in a session). Blocked by: none.

Covers: no story criterion; the epic's shaping file.

```markdown
Plan: E02-S01-T00

## Goal
A person works this task in a session. Its issue is created before the docs pull request, which adds docs/plan/E02-walking-skeleton.md and closes the issue with Closes #N, as ci / linked issue requires. The file holds every E02 task with its labels, its blockers and the story lines it covers, plus the tracer rules E02 follows until E05. The pull request also settles where the E02 recipes live (docs/recipes or .claude/skills) and aligns the roadmap, plan 13 and ADR 0063 with that choice. When the session finds that E02 needs a new ADR, it adds the ADR as proposed from docs/adr/template.md with its row in docs/adr/README.md and raises the next free number by one.

## Where in the code
docs/plan/E02-walking-skeleton.md (new): the E02 tasks, their order and the tracer rules
docs/plan/14-roadmap.md, docs/plan/13-delivery-and-github.md (exist; the recipe location)
docs/adr/README.md (exists; changes only when a new ADR is added)
Seam: none, docs only.

## Tests first
none, docs only

## Design
none

## ADRs
docs/adr/0001-record-architecture-decisions-in-madr.md
docs/adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md
docs/adr/0063-agent-skills-from-library-authors-pinned-in-the-repository.md

## Out of scope
Creating the other E02 task issues (the planning session after the merge), user guides and ADR status changes (E02-S08-T06).

## Changelog
docs(plan): record the E02 plan and ADRs

## Acceptance criteria
- [ ] docs/plan/E02-walking-skeleton.md is on main and its pull request closes this issue
- [ ] Every story checkbox and named test of #19 to #26 sits in at least one task and every split names its parts, or the pull request description lists it as an open question
- [ ] Every task names its labels, its blockers by plan id and the story lines it covers
- [ ] Every task body is under 3 500 characters and has 3 to 8 checkboxes
- [ ] No body names a private research path, a customer or a product owner value
```

##### E02-S01-T01, #227 repo: Land the root configuration the walking skeleton needs

Labels: `task`, `human`, `area: ci` (session pull request). Blocked by: E00-S07-T01 (#206), E01-S05-T02 (#214), E00-S01-T02 (#4, with its part #215), E00-S02-T02 (#194), E00-S05-T03 (#202).

Covers: criterion 7; criterion 8; test `source-exports.test.ts`.

```markdown
Plan: E02-S01-T01

## Goal
One session pull request, although it touches about 22 configuration and package files, lands every root configuration change the skeleton needs, so no later E02 task or E03 run changes the lockfile: every E02 workspace package.json with the dependencies the ADRs name, pinned in the catalog older than Renovate's minimumReleaseAge window, and the root scripts, whose targets later tasks add.

## Where in the code
package.json (exists): version 0.0.0; scripts northmes (builds apps/server, runs dist/main.js), gen:migration, plugin:build, dev, demo, e2e, and e2e in check:full; devDependencies of scripts/ and e2e/: @testcontainers/postgresql, pg, rolldown, @playwright/test, workspace @northmes/contracts, @northmes/planning-contracts, @northmes/testing
pnpm-workspace.yaml (exists): catalog, overrides pointing the web singletons at it; pnpm-lock.yaml (regenerated)
vitest.config.ts (exists): one graphql copy; integration globalSetup adds apps/server/test/global-setup.ts (new, empty)
turbo.json (exists): build outputs of apps/*, modules/planning/web, examples/plugin-validator
biome.json (exists): style/noProcessEnv as an error, with the exceptions below
tsconfig.base.json (exists): experimentalDecorators, emitDecoratorMetadata, useDefineForClassFields false
.gitattributes (new; snapshots linguist-generated), .gitignore (exists; .northmes/, plugins/)
package.json (new, 11) of packages/sdk (exports ., ./config, ./graphql, ./rest, ./data, ./commands, ./errors), contracts, web-sdk, web-build; apps/server (also ./testing), apps/web; modules/core, planning, planning/contracts, planning/web; examples/plugin-validator (host packages as peers); packages/testing (exists). Version 0.0.0, "@northmes/source" before "default"; MIT for packages/* and planning/contracts, else AGPL-3.0-or-later.
test/meta/source-exports.test.ts (new), test/meta/tooling.test.ts (exists)
Seam: files read with node:fs; Biome runs on in-memory files.

## Tests first
- source-exports.test.ts: "E02-S01 every workspace package lists @northmes/source before default"
- source-exports.test.ts: "E02-S01 no root or package script passes the @northmes/source condition"
- tooling.test.ts: "E02-S01 style/noProcessEnv fails in apps/server/src and packages/contracts/src and passes in packages/sdk/src/config, tests, scripts and vitest.config.ts"
- tooling.test.ts: "E02-S01 pnpm-lock.yaml holds one @nestjs/core and one @nestjs/graphql resolution"

## Design
none

## ADRs
docs/adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md

## Out of scope
Source code and package scripts (each package's first task), playwright.config.ts (E02-S08-T02), northmes.config.json (E02-S04-T09), @northmes/ui (E04-S01).

## Changelog
build(repo): add the skeleton's root configuration and dependencies

## Acceptance criteria
- [ ] pnpm install --frozen-lockfile and pnpm check pass
- [ ] The pull request lists each new dependency's version and release date, all outside the minimumReleaseAge window
- [ ] Every E02 workspace package exists with its license, its dependencies and "@northmes/source" before "default"
- [ ] Biome reports style/noProcessEnv outside packages/sdk/src/config, tests, scripts and tool configs
- [ ] The lockfile holds one @nestjs/core and one @nestjs/graphql resolution
```

##### E02-S01-T02, #228 platform: Define module manifests and derive module names in the SDK

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S01-T01 (#227).

Covers: criterion 1; criterion 2 (the derived names); test `module-names.test.ts`.

```markdown
Plan: E02-S01-T02

## Goal
The root of @northmes/sdk exports defineModule (tagged @internal), moduleNames and HOST_PROVIDED and loads no Nest code. moduleNames(id) checks the id against [a-z][a-z0-9]*(-[a-z0-9]+)* and derives the GraphQL name, the SQL name, the owner role nm_mod_<sql name> and the remote name. HOST_PROVIDED lists @nestjs/*, @nestjs/graphql, @apollo/subgraph, graphql, reflect-metadata, rxjs, zod, @northmes/sdk and temporal-polyfill, and isHostProvided(specifier) matches them. The core and planning manifests import only defineModule and their version from their package.json, and their northmes range >=0.0.0-0 <0.1.0-0 accepts image 0.0.0. Planning depends on core and declares planning.releaseProductionOrder validatable and a web block with label and order. Server entries arrive with each module's first server code.

## Where in the code
packages/sdk/src/manifest.ts, module-names.ts, host-provided.ts, index.ts (new)
packages/sdk/tsconfig.json, packages/sdk/LICENSE (new, MIT); packages/sdk/package.json (exists; build and typecheck scripts)
modules/core/northmes.module.ts, modules/planning/northmes.module.ts (new)
packages/sdk/test/module-names.test.ts, packages/sdk/test/host-provided.test.ts (new)
test/meta/manifest-load.test.ts (new)
Port from docs/sources/spike-integration/packages/sdk/src/ (manifest.ts, host-provided.ts) and modules/core/northmes.module.ts and modules/planning/northmes.module.ts there. The spike's index.ts re-exports Nest code; the root index here does not.
Every new file in packages/sdk starts with // SPDX-License-Identifier: MIT.
Seam: pure functions moduleNames(id) and isHostProvided(specifier); the load test imports every in-repo manifest in a child process and lists the packages it loaded, and reads each manifest's import lines.

## Tests first
- module-names.test.ts: "E02-S01 production-start derives productionStart and production_start"
- module-names.test.ts: "E02-S01 ids Planning, -a, a- and a--b are rejected"
- host-provided.test.ts: "E02-S01 isHostProvided matches @nestjs/core and graphql and not ms"
- manifest-load.test.ts: "E02-S01 importing every in-repo manifest in a fresh process loads no @nestjs package"
- manifest-load.test.ts: "E02-S01 every northmes.module.ts imports only defineModule and its own package.json"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md

## Out of scope
Catalog checks (E02-S01-T04 to E02-S01-T06), server entries (E02-S04-T02, E02-S04-T03), the API Extractor report (E21-S04).

## Changelog
none, internal

## Acceptance criteria
- [ ] defineModule, moduleNames and HOST_PROVIDED import from the root of @northmes/sdk, which loads no Nest code, and defineModule is tagged @internal
- [ ] moduleNames("production-start") gives productionStart, production_start, nm_mod_production_start and remote productionStart
- [ ] Ids Planning, -a, a- and a--b are rejected naming the id
- [ ] The core and planning manifests import only defineModule and their package.json, and load in a fresh process without any @nestjs package
- [ ] Each manifest's northmes range accepts version 0.0.0, and packages/sdk carries its MIT LICENSE
```

##### E02-S01-T03, #258 repo: Fail the check when an MIT package imports AGPL code

Labels: `task`, `human`, `area: ci` (first task of a new pattern). Blocked by: E02-S01-T02 (#228).

Covers: no story criterion; the import rule of ADRs 0003 and 0056, needed before the MIT packages grow.

```markdown
Plan: E02-S01-T03

## Goal
A meta test keeps the MIT packages free of AGPL code. It reads every workspace package's license and fails when a source or test file of an MIT package (packages/*, modules/*/contracts) or of an examples/* plugin imports an AGPL package, naming the importing file and the imported package. Test files are scanned too, so an MIT package's tests reach AGPL code only through a helper that spawns it by path. It also fails when a modules/*/contracts package is not MIT. AGENTS.md already states the rule; this makes it a check in pnpm check.

## Where in the code
scripts/lint/mit-imports.mjs (new)
test/meta/mit-imports.test.ts (new)
Seam: scan(packages, files) takes package manifests and in-memory source files and returns findings; the test passes fixtures, and a second case runs it over git ls-files.

## Tests first
- mit-imports.test.ts: "E02-S01 an MIT package that imports an AGPL package fails naming the file and the package"
- mit-imports.test.ts: "E02-S01 a test file of an MIT package that imports an AGPL package fails"
- mit-imports.test.ts: "E02-S01 an examples plugin that imports an AGPL package fails"
- mit-imports.test.ts: "E02-S01 a contracts package that is not MIT fails"
- mit-imports.test.ts: "E02-S01 the repository passes"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md

## Out of scope
The license gate for third-party dependencies (E00-S04-T02), the plugin-outside CI job (E21-S03).

## Changelog
none, internal

## Acceptance criteria
- [ ] A fixture MIT file importing @northmes/module-core fails naming the file and the package
- [ ] A fixture test file in an MIT package that imports an AGPL package fails
- [ ] A fixture examples plugin importing an AGPL package fails
- [ ] A contracts package without "license": "MIT" fails
- [ ] pnpm check runs the test and it passes on main
```

##### E02-S01-T04, #229 platform: Order the module catalog and stop on missing dependencies

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S01-T02 (#228).

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
Reserved ids, name collisions and ranges (E02-S01-T05), key prefixes and slots (E02-S01-T06), validator checks (E02-S04-T06), wiring into boot (E02-S01-T09).

## Changelog
none, internal

## Acceptance criteria
- [ ] A missing dependency gives exit code 1 and a message naming both modules
- [ ] A cycle and a core module that depends on a plugin each give a named problem
- [ ] Three problems in one catalog appear in one message as "3 problems"
- [ ] The ordered catalog starts with core and puts plugins after the in-repo modules
```

##### E02-S01-T05, #259 platform: Refuse reserved ids, name clashes and unmet version ranges

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S01-T04 (#229).

Covers: criterion 2 (colliding derived names); criterion 3; criterion 4 (bad range); tests "image 0.4.0-rc.1 satisfies range >=0.3.0 <0.5.0" and "module ids web, station and auth are each refused as reserved, and the message names the id".

```markdown
Plan: E02-S01-T05

## Goal
checkCatalog adds three refusals to the same BootError: the reserved ids web, station and auth, which are the first-party and library segments under /api/v1 (ADR 0064); two modules whose derived names collide, naming both ids; and a northmes range the image version does not satisfy, checked with semver.satisfies and includePrerelease and naming both versions.

## Where in the code
apps/server/src/catalog/check-catalog.ts (exists), apps/server/src/catalog/rules.ts (new)
apps/server/test/catalog.test.ts (exists), apps/server/test/fixtures/catalog.ts (exists)
Port the range check from docs/sources/spike-integration/apps/server/src/catalog.ts, adding includePrerelease.
Seam: checkCatalog(entries, { imageVersion }), as in E02-S01-T04.

## Tests first
- catalog.test.ts: "E02-S01 module ids web, station and auth are each refused as reserved, and the message names the id"
- catalog.test.ts: "E02-S01 two modules whose derived names collide are refused naming both ids"
- catalog.test.ts: "E02-S01 image 0.4.0-rc.1 satisfies range >=0.3.0 <0.5.0"
- catalog.test.ts: "E02-S01 image 0.5.0 outside range >=0.3.0 <0.5.0 is refused naming both versions"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md

## Out of scope
Key prefixes and slots (E02-S01-T06), the version field of northmes.config.json (E02-S04-T09), validator checks (E02-S04-T06).

## Changelog
none, internal

## Acceptance criteria
- [ ] A module or plugin with id web, station or auth stops boot with a message naming the id
- [ ] Two modules with colliding derived names stop boot naming both ids
- [ ] Image 0.4.0-rc.1 passes range >=0.3.0 <0.5.0
- [ ] A range that excludes the image adds a problem naming both versions to the one BootError
```

##### E02-S01-T06, #260 platform: Refuse bad key prefixes and contributions to unrelated slots

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S01-T05 (#259).

Covers: criterion 4 (wrong key prefix, contribution to a slot of a module the contributor does not depend on).

```markdown
Plan: E02-S01-T06

## Goal
checkCatalog adds two refusals to the same BootError: a permission or command key without its module's GraphQL prefix, or an event key without its module's SQL prefix (ADR 0003), naming the key; and a slot contribution to a module outside the contributor's dependsOn closure, naming the contributor and the slot.

## Where in the code
apps/server/src/catalog/rules.ts (exists)
apps/server/test/catalog.test.ts (exists), apps/server/test/fixtures/catalog.ts (exists)
Port the prefix and slot checks from docs/sources/spike-integration/apps/server/src/catalog.ts, with one prefix rule per key kind.
Seam: checkCatalog(entries, { imageVersion }), as in E02-S01-T04.

## Tests first
- catalog.test.ts: "E02-S01 a command key without its module's GraphQL prefix is refused naming the key"
- catalog.test.ts: "E02-S01 an event key without its module's SQL prefix is refused naming the key"
- catalog.test.ts: "E02-S01 a slot contribution outside the dependsOn closure is refused naming the contributor and the slot"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md

## Out of scope
Slot rendering (E21-S01), the incompatible status of a web-only plugin (E21-S04), validator checks (E02-S04-T06).

## Changelog
none, internal

## Acceptance criteria
- [ ] A command or permission key without its module's GraphQL prefix adds a problem naming the key
- [ ] An event key without its module's SQL prefix adds a problem naming the key
- [ ] A slot contribution outside the dependsOn closure adds a problem naming the contributor and the slot
```

##### E02-S01-T07, #230 platform: Parse the environment with Zod schemas in the SDK config

Labels: `task`, `human`, `area: sdk` (touches configuration). Blocked by: E02-S01-T02 (#228).

Covers: criterion 6 (loadEnv and serverEnvSchema); test `server-env.test.ts`.

```markdown
Plan: E02-S01-T07

## Goal
@northmes/sdk/config exports serverEnvSchema, migrateEnvSchema and bootstrapEnvSchema (Zod, with their inferred types) and loadEnv(schema), which runs safeParse and throws one ConfigError that lists every failing key with its rule and never its value. PORT is required with no default, NODE_ENV defaults to production and NORTHMES_ROLE to all. migrateEnvSchema holds the keys northmes migrate reads (DATABASE_URL and the owner password file), and bootstrapEnvSchema those of northmes db bootstrap (DATABASE_URL, POSTGRES_PASSWORD_FILE and each login role's password file).

## Where in the code
packages/sdk/src/config/server-env.ts, entry-schemas.ts, load-env.ts, config-error.ts, index.ts (new)
packages/sdk/test/config/server-env.test.ts (new)
Seam: loadEnv(schema)(record) is pure.

## Tests first
- server-env.test.ts: "E02-S01 a missing public origin, PORT 70000 and role web are listed together without their values"
- server-env.test.ts: "E02-S01 NODE_ENV defaults to production and NORTHMES_ROLE to all"
- server-env.test.ts: "E02-S01 a record without PORT fails naming PORT"
- server-env.test.ts: "E02-S01 migrateEnvSchema and bootstrapEnvSchema accept their entry point's keys without PORT"

## Design
none

## ADRs
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md

## Out of scope
Secret files (E02-S01-T08), wiring into apps/server (E02-S01-T09), configForTest (E02-S02-T07), BETTER_AUTH_TELEMETRY (E05-S05).

## Changelog
none, internal

## Acceptance criteria
- [ ] Three bad keys give one ConfigError naming all three and containing none of their values
- [ ] NODE_ENV defaults to production, NORTHMES_ROLE to all, and PORT has no default
- [ ] migrateEnvSchema and bootstrapEnvSchema import from @northmes/sdk/config and need no PORT
```

##### E02-S01-T08, #231 platform: Read secret files into the config secrets namespace

Labels: `task`, `human`, `area: sdk` (touches secrets handling). Blocked by: E02-S01-T07 (#230).

Covers: criterion 6 (the secrets namespace); E02-S08 criterion 2; test `secrets.test.ts`.

```markdown
Plan: E02-S01-T08

## Goal
@northmes/sdk/config exports readSecrets(keys, { nodeEnv }) and secretsConfig, the secrets namespace that readSecrets fills from the *_FILE keys. readSecrets refuses a missing file, an empty file or a file whose mode grants read to others (mode & 0o004) with a ConfigError naming the key; group read passes; one trailing newline is trimmed; a value with the dev marker fails with CONFIG_DEV_SECRET_IN_PRODUCTION when NODE_ENV is production. Secret values never enter process.env.

## Where in the code
packages/sdk/src/config/secrets.ts (new), packages/sdk/src/config/index.ts (exists)
packages/sdk/test/config/secrets.test.ts (new)
Seam: readSecrets(keys, { nodeEnv }) reads files the test writes into a temporary directory.

## Tests first
- secrets.test.ts: "E02-S01 a missing, empty or world-readable secret file fails naming its key"
- secrets.test.ts: "E02-S01 one trailing newline is trimmed"
- secrets.test.ts: "E02-S01 a dev-marked secret fails with NODE_ENV production"
- secrets.test.ts: "E02-S01 a 0440 secret file passes and its value stays out of process.env"

## Design
none

## ADRs
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md

## Out of scope
Wiring into apps/server (E02-S01-T09), writing dev secrets (E02-S08-T01).

## Changelog
none, internal

## Acceptance criteria
- [ ] A missing, empty or other-readable secret file fails naming its key, and a 0440 file passes
- [ ] One trailing newline is trimmed from a secret value
- [ ] A dev-marked secret with NODE_ENV production fails with CONFIG_DEV_SECRET_IN_PRODUCTION
- [ ] No secret value reaches process.env
```

##### E02-S01-T09, #232 platform: Load configuration before any manifest when the server boots

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S01-T04 (#229), E02-S01-T08 (#231).

Covers: criterion 6 (ConfigModule before every module, exit 1 before any manifest import); test `config.int.test.ts`.

```markdown
Plan: E02-S01-T09

## Goal
apps/server boots in the order of ADR 0002. main.ts awaits ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, cache: true, validate: loadEnv(serverEnvSchema), load: [secretsConfig] }) before it imports any manifest, and AppModule imports that module first. Boot then imports the in-repo manifests (core, planning), runs checkCatalog, creates AppModule.forRoot(catalog) and listens on 127.0.0.1:PORT, logging the modules in catalog order. A ConfigError or BootError prints its message and exits 1. Subcommands go through one dispatcher, so later tasks add northmes db bootstrap, migrate and schema print there. @northmes/testing gets bootBuilt, which builds apps/server once per test run with pnpm --filter and spawns its dist/main.js by path, so the MIT package imports no AGPL code.

## Where in the code
apps/server/src/main.ts (new): entry, hands argv to cli.ts
apps/server/src/cli.ts (new): serve only
apps/server/src/boot/boot.ts (new): config, manifests, catalog, Nest create, listen
apps/server/src/app.module.ts (new): AppModule.forRoot(catalog), ConfigModule first
apps/server/src/modules.ts (new): the in-repo manifest list
packages/testing/src/boot-built.ts (new)
apps/server/test/boot/boot.test.ts, apps/server/test/boot/config.int.test.ts (new)
Port from docs/sources/spike-integration/apps/server/src/main.ts and app.module.ts there.
Seam: boot({ env, importManifest, exit, log }) in boot.ts for the boot order; config.int.test.ts runs the built server through bootBuilt, because only the built main.js shows whether a manifest loads before the environment check.

## Tests first
- config.int.test.ts: "E02-S01 an invalid environment exits 1 before any manifest import and lists every bad key"
- boot.test.ts: "E02-S01 AppModule's first import is the ConfigModule built from loadEnv(serverEnvSchema) and secretsConfig"
- boot.test.ts: "E02-S01 a valid environment boots core then planning and logs them in that order"
- boot.test.ts: "E02-S01 a catalog BootError exits 1 with its message"

## Design
none

## ADRs
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md

## Out of scope
northmes.config.json, plugins and the resolve hook (E02-S04-T09), the migration check (E02-S02-T04), the gateway (E02-S03-T03), shutdown (E02-S07-T02).

## Changelog
none, internal

## Acceptance criteria
- [ ] The built server with an invalid environment exits 1, imports no manifest and prints every bad key without its value
- [ ] ConfigModule.forRoot is AppModule's first import, with ignoreEnvFile, cache, validate loadEnv(serverEnvSchema) and load [secretsConfig]
- [ ] A valid environment boots and logs core before planning
- [ ] A catalog problem exits 1 with the BootError message
- [ ] bootBuilt is exported from @northmes/testing and imports nothing from apps/server
```

#### E02-S02 platform: Migrate each module as its own owner role

Issue: northMES/northmes#20. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s02-platform-migrate-each-module-as-its-own-owner-role). Blocked by: E02-S01 (#19).

Notes: tasks that touch row-level security policies carry `human` anyway. The migrate tests run on fixture modules, so the story does not wait for the tracer tables of E02-S04. `northmes migrate` runs the boot sequence without listening before its first file ([ADR 0006](../adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) step 1, [ADR 0060](../adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md)), so each boot step a later task adds also runs before migrate applies anything; E02-S03-T05 adds the test for composition. Criterion 2 is split over E02-S02-T02 and E02-S02-T03, and criterion 3 over E02-S02-T01 and E02-S02-T05. The integration template is prepared in `apps/server/test/global-setup.ts`, which E02-S01-T01 wires into `vitest.config.ts`, so `@northmes/testing` imports no AGPL code. The `db-test` recipe comes with E02-S02-T07, and E02-S02-T03 and E02-S02-T04 add their errors to it.

##### E02-S02-T01, #233 platform: Bootstrap the database roles with UTC and DML rights only

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0006). Blocked by: E02-S01-T09 (#232).

Covers: criterion 3 (the four roles, no TRUNCATE, timezone UTC); test `no-truncate.test.ts`.

```markdown
Plan: E02-S02-T01

## Goal
pnpm northmes db bootstrap, run as the container superuser, parses bootstrapEnvSchema and creates nm_owner (login, CREATEROLE, CREATE on the database), nm_app (login, no BYPASSRLS), nm_auth (login) and nm_ext (NOLOGIN group) with passwords from the *_FILE secret keys, and runs ALTER ROLE ... SET timezone = 'UTC' for each. A second run changes nothing. The integration global setup bootstraps the same roles into the test template, and useTestDatabase() hands out nm_app and nm_owner connection strings, never the superuser's. A lint fails on any TRUNCATE grant in a migration file.

## Where in the code
apps/server/src/db/bootstrap.ts (new), apps/server/src/cli.ts (exists; db bootstrap)
apps/server/test/global-setup.ts (exists): bootstraps the roles into the template
apps/server/test/db/bootstrap.int.test.ts (new)
packages/testing/src/database.ts (exists): per-role connection strings
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

##### E02-S02-T02, #234 platform: Apply each module's migrations as its own owner role

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0006). Blocked by: E02-S02-T01 (#233).

Covers: criterion 1; criterion 2 (a second run is a no-op); test "two concurrent runs apply each file once".

```markdown
Plan: E02-S02-T02

## Goal
pnpm northmes migrate parses migrateEnvSchema, runs the boot sequence without listening, then takes pg_advisory_lock on a dedicated direct connection with a lock_timeout. Per catalog module it creates the NOLOGIN owner role nm_mod_<sql name> (member of nm_ext; nm_owner grants itself SET TRUE, INHERIT FALSE) and its schema, then applies migrations/<UTC yyyymmddHHMMss>_<slug>.sql in lexical order, each file in its own transaction with SET LOCAL ROLE nm_mod_<sql name>. Applied files are tracked in northmes_meta.migration(module, name, sha256, applied_at), and a second run is a no-op.

## Where in the code
apps/server/src/migrate/runner.ts, apps/server/src/migrate/files.ts (new)
apps/server/src/cli.ts (exists; migrate), apps/server/src/boot/boot.ts (exists; a mode that does not listen)
apps/server/test/migrate.int.test.ts (new)
apps/server/test/fixtures/migrations/ (new): fixture modules core and planning with two files each
Port from docs/sources/spike-integration/apps/server/src/migrate.ts and docs/sources/spike-integration/apps/server/test/migrate.test.mjs, with timestamp names instead of 0001_.
Seam: migrate({ ownerUrl, catalog }) against a database from useTestDatabase(), connected as nm_owner.

## Tests first
- migrate.int.test.ts: "E02-S02 core then planning apply in catalog order, each file under SET LOCAL ROLE of its module's owner role"
- migrate.int.test.ts: "E02-S02 each module schema is owned by its module role"
- migrate.int.test.ts: "E02-S02 a second run is a no-op"
- migrate.int.test.ts: "E02-S02 two concurrent runs apply each file once"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md

## Out of scope
Checksum, duplicate prefix and marker refusals (E02-S02-T03); the inbound foreign key guard, repeatable files, pg-boss queues, the permission sync and audit partitions (ADR 0006 steps 6 and 8 to 11, E05); migrate --check (E18-S03).

## Changelog
none, internal

## Acceptance criteria
- [ ] Files apply in catalog order, one transaction each, under SET LOCAL ROLE nm_mod_<sql name>
- [ ] Each schema is owned by its module role, and northmes_meta.migration records each applied file with its sha256
- [ ] A second run applies nothing, and two concurrent runs apply each file once
```

##### E02-S02-T03, #261 platform: Refuse changed, duplicate and unmarked migration files

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0006). Blocked by: E02-S02-T07 (#237).

Covers: criterion 2 (the checksum error and the duplicate timestamp prefix); test "checksum drift stops the run naming the file".

```markdown
Plan: E02-S02-T03

## Goal
northmes migrate checks every module's files before it applies any. An applied file whose sha256 changed stops the run with exit 1 naming the file; two files with one timestamp prefix in a module are refused naming both; a file without its expand or contract marker is refused naming it (ADR 0006). The db-test recipe gains these three errors with their meaning.

## Where in the code
apps/server/src/migrate/files.ts, apps/server/src/migrate/runner.ts (exist)
apps/server/test/migrate.int.test.ts (exists)
apps/server/test/fixtures/migrations/ (exists): a module with a duplicate prefix and one with an unmarked file
.claude/skills/db-test/SKILL.md (exists)
Seam: migrate({ ownerUrl, catalog }), as in E02-S02-T02.

## Tests first
- migrate.int.test.ts: "E02-S02 checksum drift stops the run naming the file"
- migrate.int.test.ts: "E02-S02 two files with the same timestamp prefix in one module are refused"
- migrate.int.test.ts: "E02-S02 a file without an expand or contract marker is refused"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md

## Out of scope
migrate --check (E18-S03), the migration lint for cascade and drop table (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] An edited applied file stops the run with exit 1 naming the file
- [ ] Two files with one timestamp prefix in a module are refused naming both
- [ ] A file without its expand or contract marker is refused naming it
- [ ] .claude/skills/db-test/SKILL.md lists the three errors with their meaning
```

##### E02-S02-T04, #262 platform: Confine plugin migrations and stop boot while one is pending

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0006). Blocked by: E02-S02-T03 (#261).

Covers: criterion 4; criterion 5; test "a plugin ALTER on core.article is refused".

```markdown
Plan: E02-S02-T04

## Goal
A plugin's migration runs as its own owner role, so Postgres refuses an ALTER TABLE on core.article ("must be owner of table article"), a CREATE TABLE in the core schema ("permission denied for schema core") and a CREATE TABLE AS SELECT from planning.production_order. The runner rolls the file back, records nothing and exits 1 naming the plugin and the file. Boot step 5 compares, as nm_app, the applied files with the files of every catalog module and refuses to start while any is pending, naming the module and the file; in migrate mode the same step lists the pending files instead of failing (ADR 0006). The db-test recipe gains these errors.

## Where in the code
apps/server/src/migrate/runner.ts (exists): name the plugin and file on refusal
apps/server/src/migrate/pending.ts (new), apps/server/src/boot/boot.ts (exists; step 5)
apps/server/test/migrate.int.test.ts (exists), apps/server/test/boot/pending.int.test.ts (new)
apps/server/test/fixtures/migrations/ (exists): plugin fixtures alter-core, core-schema and reads-planning
.claude/skills/db-test/SKILL.md (exists)
Port the fixtures sneaky-schema and reads-other from docs/sources/spike-integration/apps/server/test/fixtures/.
Seam: migrate({ ownerUrl, catalog }) and checkPending(appUrl, catalog, { mode }).

## Tests first
- migrate.int.test.ts: "E02-S02 a plugin ALTER on core.article is refused"
- migrate.int.test.ts: "E02-S02 a plugin CREATE TABLE in the core schema is refused and changes nothing"
- migrate.int.test.ts: "E02-S02 a plugin CREATE TABLE AS SELECT from planning.production_order is refused"
- pending.int.test.ts: "E02-S02 boot refuses to start while a migration is pending, naming the module and the file"
- pending.int.test.ts: "E02-S02 migrate lists the pending files and applies them"

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
- [ ] northmes migrate runs with pending files and applies them
```

##### E02-S02-T05, #235 platform: Generate a migration file from the table template

Labels: `task`, `human`, `area: sdk` (touches row-level security policies). Blocked by: E02-S02-T02 (#234).

Covers: criterion 3 (nm_app holds SELECT, INSERT, UPDATE and DELETE only); criterion 6; test `gen-migration.test.ts`.

```markdown
Plan: E02-S02-T05

## Goal
pnpm gen:migration <module> <slug> writes modules/<module>/migrations/<UTC yyyymmddHHMMss>_<slug>.sql from the table template: the expand marker; a schema-qualified table with id uuid primary key default uuidv7(), scope_id uuid not null with an index that leads with it, and version integer not null default 1 with its BEFORE UPDATE trigger; enable row level security with the four split policies on northmes.read_scopes and northmes.write_scopes, never FOR ALL and no FORCE; and grants of SELECT, INSERT, UPDATE and DELETE to nm_app and nothing more. Everything is inline SQL; the template never calls a shared SQL helper.

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
- template.int.test.ts: "E02-S02 nm_app holds SELECT, INSERT, UPDATE and DELETE on a generated table and no other privilege"

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
- [ ] information_schema.role_table_grants shows nm_app with SELECT, INSERT, UPDATE and DELETE only
```

##### E02-S02-T06, #236 testing: Migrate the test template and write fixtures with db.command

Labels: `task`, `human`, `area: ci` (first task of a new pattern). Blocked by: E02-S02-T05 (#235).

Covers: no story criterion alone; the migrated template, `given` factories and `db.command` that E00-S02-T01 hands to E02.

```markdown
Plan: E02-S02-T06

## Goal
The integration global setup migrates the in-repo modules into the template once per run, after it bootstraps the roles, and names the template after a hash of their migration files; an unchanged run reuses it. @northmes/testing adds given.company() and given.plant(), which return fresh scope ids without rows, and db.command({ principal, scopes, reason }, fn), a transaction as nm_app with both scope sets set and no audit context yet.

## Where in the code
apps/server/test/global-setup.ts (exists): migrate into the hashed template
packages/testing/src/given.ts, packages/testing/src/db-command.ts (new)
packages/testing/src/database.ts (exists): clone from the template the setup names
packages/testing/test/db-command.int.test.ts, apps/server/test/testing/template-hash.int.test.ts (new)
Seam: the exported helpers of @northmes/testing; db-command.int.test.ts renders a fixture table with the migration template into its own database.

## Tests first
- db-command.int.test.ts: "E02-S02 a row written through db.command at plant A is visible to plant A and not to plant B"
- db-command.int.test.ts: "E02-S02 given.plant() returns a fresh scope id on each call"
- template-hash.int.test.ts: "E02-S02 the template name changes with the migration files and an unchanged run reuses it"

## Design
none

## ADRs
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
docs/adr/0008-row-level-security-with-transaction-local-scopes.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md

## Out of scope
The audit context and the raw-insert guard (E05-S02), company and plant rows (E05-S03), configForTest and createTestApp (E02-S02-T07).

## Changelog
none, internal

## Acceptance criteria
- [ ] A row written with db.command at one given.plant() is invisible to another
- [ ] A changed migration file changes the template name, and an unchanged run reuses the template
- [ ] @northmes/testing imports nothing from apps/server or the modules
```

##### E02-S02-T07, #237 testing: Build test apps with configForTest and createTestApp

Labels: `task`, `human`, `area: ci` (first task of a new pattern). Blocked by: E02-S02-T06 (#236).

Covers: the story's note on the `db-test` recipe; the app factory that E00-S02-T01 hands to E02.

```markdown
Plan: E02-S02-T07

## Goal
@northmes/testing adds configForTest(overrides), which validates an explicit record with loadEnv and never touches process.env, and createTestApp({ modules, hostFactory }), which builds the host app in the test process with in-repo modules only. The host factory comes from the ./testing export of apps/server, and the caller passes it in, so the MIT package imports no AGPL code. The db-test recipe records the files, the pnpm commands and each migrate and row-level security error known so far with its meaning. It is the first project skill: it gets no skills-lock.json entry, and the skills check in test/meta/agent-files.test.ts accepts the five project skills plan 13 names (db-test, vertical-slice, graphql-subgraph, web-remote, dst-test) next to the pinned skills.

## Where in the code
packages/testing/src/config-for-test.ts, packages/testing/src/create-test-app.ts (new)
apps/server/src/testing.ts (new): the host factory, exported at ./testing
packages/testing/test/config-for-test.test.ts, apps/server/test/testing/create-test-app.int.test.ts (new)
.claude/skills/db-test/SKILL.md (new): a project skill
test/meta/agent-files.test.ts (exists): the skills check; CLAUDE.md (exists): names the project skills next to the pinned ones
Seam: configForTest is pure; create-test-app.int.test.ts calls createTestApp with the host factory from apps/server; the skills check takes the folder list and the lock file as input.

## Tests first
- config-for-test.test.ts: "E02-S02 building two apps with configForTest leaves process.env unchanged"
- create-test-app.int.test.ts: "E02-S02 createTestApp boots the in-repo modules in the test process"
- agent-files.test.ts: "E02-S02 a .claude/skills folder that skills-lock.json does not list fails unless it is a project skill"

## Design
none

## ADRs
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
docs/adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md
docs/adr/0063-agent-skills-from-library-authors-pinned-in-the-repository.md

## Out of scope
gqlClient (E02-S03-T03), tests of the built server (bootBuilt, E02-S01-T09), the migrate errors of E02-S02-T03 and E02-S02-T04, which those tasks add to the recipe.

## Changelog
none, internal

## Acceptance criteria
- [ ] Two apps built with configForTest leave process.env unchanged
- [ ] createTestApp boots core and planning in the test process
- [ ] packages/testing imports nothing from apps/server
- [ ] .claude/skills/db-test/SKILL.md lists the files, the pnpm commands and each migrate and row-level security error with its meaning
- [ ] skills-lock.json is unchanged, and the skills check passes with db-test and fails on a folder that is neither pinned nor a project skill
```

#### E02-S03 platform: Compose module subgraphs behind one embedded gateway

Issue: northMES/northmes#21. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s03-platform-compose-module-subgraphs-behind-one-embedded-gateway). Blocked by: E02-S01 (#19).

Notes: tasks E02-S03-T01 to E02-S03-T08 test with fixture modules. E02-S03-T09 prints the snapshots of the in-repo modules, so it waits for the release command (E02-S04-T07), and the story closes after that task; E02-S04 starts after E02-S03-T03. Criterion 1 is split over E02-S03-T02, T03 and T04, and criterion 3 over E02-S03-T06 and T07. The `graphql-subgraph` recipe and the first `pnpm gen` stage come with E02-S03-T09. The plugin rule of the route check arrives in E02-S04-T10.

##### E02-S03-T01, #247 platform: Declare REST controllers with ApiController and apiPath

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S01-T09 (#232).

Covers: criterion 4; criterion 5; tests `api-controller.test.ts` and `api-path.test.ts`.

```markdown
Plan: E02-S03-T01

## Goal
@northmes/contracts exports API_MAJOR (1) and apiPath(...segments), which returns /api/v<API_MAJOR>/<segments>. @northmes/sdk/rest exports ApiController({ module, family }), a class decorator that applies Nest's Controller with the path api/v<API_MAJOR>/<module>/ and records the module and the family (first-party or public) as metadata for the boot route check. The server never calls app.setGlobalPrefix or app.enableVersioning, and a meta test keeps it so.

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
The boot route check (E02-S03-T08), the module list controller (E02-S05-T06), public routes and OpenAPI (the public API epic).

## Changelog
none, internal

## Acceptance criteria
- [ ] API_MAJOR is 1 and apiPath("web", "modules") returns /api/v1/web/modules
- [ ] A class decorated with ApiController({ module: "web", family: "first-party" }) has the path api/v1/web and metadata module web and family first-party
- [ ] ApiController takes the major from API_MAJOR
- [ ] A fixture call to app.setGlobalPrefix under apps fails no-global-prefix.test.ts
```

##### E02-S03-T02, #238 platform: Build one subgraph per module with the in-process driver

Labels: `task`, `human`, `area: sdk` (new shared package code). Blocked by: E02-S01-T09 (#232).

Covers: criterion 1 (defineSubgraph with the in-process driver).

```markdown
Plan: E02-S03-T02

## Goal
@northmes/sdk/graphql exports InProcessSubgraphDriver, which needs neither @nestjs/apollo nor @apollo/server; defineSubgraph({ name, module, subscriptions }), where name is the module's GraphQL name from moduleNames, which calls GraphQLModule.forRoot with the driver, include [module], the federation link pinned to v2.9, a lexicographically sorted schema and fieldResolverEnhancers guards, interceptors and filters; graphqlKit(() => Module), which applies includeModules and the orphaned entity stubs that @nestjs/graphql 14 needs under federation; entityRef("Article"), a key-only stub of an entity another module owns; loaderFor, a per-request batch loader; and SubgraphRegistry, which collects { name, sdl, schema } per module.

## Where in the code
packages/sdk/src/graphql/driver.ts, define-subgraph.ts, entity-ref.ts, loader.ts, registry.ts, index.ts (new)
packages/sdk/test/graphql/define-subgraph.test.ts (new)
packages/sdk/test/fixtures/graphql/ (new): one module that owns Article and one that references it
Port from docs/sources/spike-integration/packages/sdk/src/ (subgraph.ts, types.ts, context.ts, loader.ts).
Seam: defineSubgraph inside a Nest TestingModule; SubgraphRegistry exposes each subgraph's SDL and schema.

## Tests first
- define-subgraph.test.ts: "E02-S03 defineSubgraph builds a subgraph SDL with the v2.9 federation link and only its module's root fields"
- define-subgraph.test.ts: "E02-S03 a subgraph built for module production-start is named productionStart"
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
- [ ] A subgraph's name is its module's GraphQL name
- [ ] Two subgraphs build in one Nest app without a "multiple types named" error
- [ ] entityRef("Article") yields a key-only stub, and the owning subgraph resolves the reference
- [ ] loaderFor makes one batched call for three keys in one request
```

##### E02-S03-T03, #239 platform: Serve the module subgraphs at /graphql over HTTP

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S03-T02 (#238).

Covers: criterion 1 (the gateway over HTTP); criterion 8.

```markdown
Plan: E02-S03-T03

## Goal
GatewayModule composes the registered subgraphs with composeServices in onApplicationBootstrap, hashes the supergraph and creates the Hive gateway runtime with createGatewayRuntime: an in-process transport with one subgraph context per client request and subgraph, maskedErrors on, no landing page and no GraphiQL. It is mounted as middleware on /graphql and answers 503 until boot has awaited runtime.getSchema(). The boot log shows supergraph=<12 hex>. @northmes/testing adds gqlClient for HTTP.

## Where in the code
apps/server/src/gateway/gateway.module.ts, compose.ts, transport.ts (new)
apps/server/src/app.module.ts (exists): SubgraphRegistry, one defineSubgraph per module, GatewayModule
packages/testing/src/gql-client.ts (new)
apps/server/test/gateway/serve.int.test.ts (new)
apps/server/test/fixtures/subgraphs/ (new): fixture modules alpha (owns Thing) and beta (references it)
Port from docs/sources/spike-integration/apps/server/src/gateway/ (compose.ts, gateway.module.ts), without HTTP subgraph mode.
Seam: boot() with the fixture catalog on PORT 0; gqlClient(url) sends the operations.

## Tests first
- serve.int.test.ts: "E02-S03 a query across two fixture subgraphs resolves the entity reference over HTTP"
- serve.int.test.ts: "E02-S03 /graphql answers 503 until the gateway has its schema"
- serve.int.test.ts: "E02-S03 the boot log shows supergraph= and a 12 hex hash"

## Design
none

## ADRs
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
Subscriptions over graphql-ws and SSE (E02-S03-T04), the NorthMES composition rules (E02-S03-T05), the plant and the tracer principal (E02-S04-T01), the hash on /health/ready (E02-S07-T01), depth and cost limits (E05).

## Changelog
none, internal

## Acceptance criteria
- [ ] /graphql answers a query that spans two fixture subgraphs over HTTP
- [ ] /graphql answers 503 before the gateway has its schema
- [ ] The boot log carries supergraph= followed by 12 hex characters
```

##### E02-S03-T04, #263 platform: Serve subscriptions over graphql-ws and SSE at /graphql

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S03-T03 (#239).

Covers: criterion 1 (graphql-ws and SSE through the in-process transport).

```markdown
Plan: E02-S03-T04

## Goal
graphql-ws runs on one ws server with noServer: true on the upgrade of /graphql, and SSE is served on /graphql, both through the gateway runtime and its in-process transport. A subscription sent before the first HTTP request works. Nothing is read from connectionParams; a subscription takes its plant from its arguments (ADR 0018). gqlClient gains graphql-ws and SSE.

## Where in the code
apps/server/src/gateway/gateway.module.ts, apps/server/src/gateway/transport.ts (exist)
packages/testing/src/gql-client.ts (exists)
apps/server/test/gateway/subscriptions.int.test.ts (new)
apps/server/test/fixtures/subgraphs/ (exists): beta gains a subscription
Port the hybrid transport from docs/sources/spike-federation/src/gateway/gateway.module.ts, without HTTP subgraph mode.
Seam: boot() with the fixture catalog on PORT 0; gqlClient subscribes.

## Tests first
- subscriptions.int.test.ts: "E02-S03 a subscription delivers one event over graphql-ws"
- subscriptions.int.test.ts: "E02-S03 a subscription delivers one event over SSE"
- subscriptions.int.test.ts: "E02-S03 a subscription sent before the first HTTP request works"

## Design
none

## ADRs
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md

## Out of scope
The event tail (E02-S06-T03), authorization per subscription and per event (E05-S10), reconnects (E04-S05).

## Changelog
none, internal

## Acceptance criteria
- [ ] A fixture subscription delivers over graphql-ws on /graphql
- [ ] The same subscription delivers over SSE on /graphql
- [ ] A subscription sent before any HTTP request works
```

##### E02-S03-T05, #264 platform: Stop boot when composition breaks a NorthMES rule

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S03-T03 (#239), E02-S02-T02 (#234).

Covers: criterion 2; tests `composition.test.ts` and `boot.int.test.ts`.

```markdown
Plan: E02-S03-T05

## Goal
Before composeServices, the gateway runs NORTHMES_ROOT_FIELD_PREFIX (every root field starts with its module's GraphQL name), NORTHMES_TYPE_OWNERSHIP (a type has one owning module; shared types come from an allowlist that starts with PageInfo) and NORTHMES_CONTRIBUTED_FIELD_NULLABLE (a field one module adds to another module's entity is nullable). Rule and composition errors throw one SupergraphCompositionError with a "[code] message" line per error that names the field and both subgraphs, and boot exits 1. northmes migrate runs the same composition before its first file, so a composition error stops it before any file applies (ADR 0006).

## Where in the code
apps/server/src/gateway/rules.ts (new), apps/server/src/gateway/compose.ts (exists)
apps/server/test/gateway/composition.test.ts, apps/server/test/gateway/boot.int.test.ts (new)
apps/server/test/fixtures/subgraphs/ (exists): unprefixed, two-owners and non-null-contribution fixtures
Port from docs/sources/spike-federation/test/composition.test.mjs and docs/sources/spike-federation/examples/plugin-broken/broken.module.ts.
Seam: checkRules(subgraphs) and compose(subgraphs) over SDL strings; boot.int.test.ts boots a fixture catalog and runs migrate on it.

## Tests first
- composition.test.ts: "E02-S03 a root field without a module prefix fails with its rule id"
- composition.test.ts: "E02-S03 a type owned by two modules fails with NORTHMES_TYPE_OWNERSHIP naming both subgraphs"
- composition.test.ts: "E02-S03 a non-nullable contributed field fails with NORTHMES_CONTRIBUTED_FIELD_NULLABLE naming the field"
- boot.int.test.ts: "E02-S03 a composition error exits with code 1"
- boot.int.test.ts: "E02-S03 northmes migrate with a composition error exits 1 before its first file"

## Design
none

## ADRs
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md

## Out of scope
NORTHMES_SDK_TYPE_DRIFT (not in an E02 story), the plugin corpus job (E21-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] An unprefixed root field fails with NORTHMES_ROOT_FIELD_PREFIX and names the field
- [ ] A type owned by two modules fails naming both subgraphs
- [ ] A non-nullable contributed field fails naming the field and both subgraphs
- [ ] Boot with any of them exits 1 with one message that lists every error
- [ ] northmes migrate with a composition error exits 1 and applies no file
```

##### E02-S03-T06, #265 platform: Fail boot when two subgraph roots reach one resolver module

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S03-T05 (#264), E02-S02-T04 (#262).

Covers: criterion 3 (two roots reaching one resolver module, and the controller owners).

```markdown
Plan: E02-S03-T06

## Goal
After Nest create (boot step 8), the isolation check computes, the way Nest's explorer does, which resolver-bearing modules each subgraph root reaches through its imports. Boot fails when one is reachable from two roots, and the message prints both import paths. The same walk assigns each REST controller to the module root that reaches it, or to the host, for the route check (E02-S03-T08).

## Where in the code
apps/server/src/isolation.ts (new), apps/server/src/boot/boot.ts (exists; step 8)
apps/server/test/isolation.int.test.ts (new)
apps/server/test/fixtures/isolation/ (new): two roots that import one resolver module, a typed control, controllers under a root and in the host
Port from docs/sources/spike-integration/apps/server/src/isolation.ts; the walk follows Nest's reachability instead of the spike's per-root import walk.
Seam: checkIsolation(app, roots) returns { controllerOwners } or throws BootError.

## Tests first
- isolation.int.test.ts: "E02-S03 a resolver module imported by two module roots makes boot exit 1 printing both import paths"
- isolation.int.test.ts: "E02-S03 the typed control boots"
- isolation.int.test.ts: "E02-S03 a controller is assigned to the module root that reaches it, or to the host"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md

## Out of scope
Globals, sub-modules and untyped resolvers (E02-S03-T07), the route check itself (E02-S03-T08), import lints between modules (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] A resolver module reachable from two subgraph roots stops boot, and the message prints both import paths
- [ ] The typed control fixture boots
- [ ] Every controller is assigned to exactly one module root or to the host
```

##### E02-S03-T07, #266 platform: Fail boot on resolvers reached through globals or sub-modules

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0003). Blocked by: E02-S03-T06 (#265).

Covers: criterion 3 (the other ways a resolver-bearing module becomes reachable from two roots).

```markdown
Plan: E02-S03-T07

## Goal
The isolation check also stops boot, printing the import path, when a resolver-bearing module is reached through a global host module, when a module root imports a sub-module of another module, when an untyped Resolver() is reached from a root, and when a module's API module imports its own resolver module.

## Where in the code
apps/server/src/isolation.ts (exists)
apps/server/test/isolation.int.test.ts (exists)
apps/server/test/fixtures/isolation/ (exists): global host module, sub-module of another module, untyped Resolver(), API module importing its own resolver module
Seam: checkIsolation(app, roots), as in E02-S03-T06.

## Tests first
- isolation.int.test.ts: "E02-S03 a resolver module reached through a global host module makes boot exit 1 printing its path"
- isolation.int.test.ts: "E02-S03 a sub-module of another module reached from a root makes boot exit 1 printing its path"
- isolation.int.test.ts: "E02-S03 an untyped Resolver() reached from a root makes boot exit 1 printing its path"
- isolation.int.test.ts: "E02-S03 an API module that imports its own resolver module makes boot exit 1 printing its path"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md

## Out of scope
Import lints between modules (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] A resolver module reached through a global host module stops boot with its import path
- [ ] A sub-module of another module reached from a root stops boot with its import path
- [ ] An untyped Resolver() reached from a root stops boot with its import path
- [ ] An API module that imports its own resolver module stops boot with its import path
```

##### E02-S03-T08, #267 platform: Refuse REST controllers outside the route families at boot

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S03-T06 (#265), E02-S03-T01 (#247).

Covers: criterion 6; tests `routes.int.test.ts`.

```markdown
Plan: E02-S03-T08

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
The plugin rule (E02-S04-T10), the route inventory test (E05-S07), the real health controller (E02-S07-T01).

## Changelog
none, internal

## Acceptance criteria
- [ ] A controller at api/web/modules and a plain @Controller off the root allowlist each stop boot naming the class
- [ ] Two controllers on POST /api/v1/web/client-errors stop boot naming both classes
- [ ] A public controller with module segment scheduling inside the planning module stops boot naming both ids
- [ ] A health controller at /health passes as a root route
```

##### E02-S03-T09, #268 platform: Print the schema snapshots without a database

Labels: `task`, `human`, `area: sdk` (first generated snapshot). Blocked by: E02-S03-T08 (#267), E02-S04-T07 (#246).

Covers: criterion 7; test `print.int.test.ts`; the story's notes on the first `pnpm gen` stage and the `graphql-subgraph` recipe.

```markdown
Plan: E02-S03-T09

## Goal
pnpm northmes schema print builds the subgraphs of the in-repo modules only, never reading northmes.config.json or loading a plugin, with DATABASE_URL unset and no pool created. It composes them and writes schema/api.graphql, schema/supergraph.graphql and modules/<id>/schema.graphql, sorted with lexicographicSortSchema. scripts/gen.mjs gets its first stage, schema, and the drift report it left out while its stage list was empty, so pnpm gen --check fails naming each stale snapshot. The graphql-subgraph recipe records the files a module writes, the commands and each composition error with its meaning.

## Where in the code
apps/server/src/schema/print.ts (new), apps/server/src/cli.ts (exists; schema print)
scripts/gen.mjs (exists): the schema stage and the drift report
schema/api.graphql, schema/supergraph.graphql, modules/core/schema.graphql, modules/planning/schema.graphql (new, generated)
apps/server/test/schema/print.int.test.ts (new), scripts/gen.test.ts (exists)
.claude/skills/graphql-subgraph/SKILL.md (new)
Port from docs/sources/spike-federation/export-supergraph.mjs; the spike's full boot on a listening port is not ported.
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
The links.snapshot.json stage (E21-S04), the OpenAPI snapshot (the public API epic).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm northmes schema print with DATABASE_URL unset writes the four files and constructs no pool
- [ ] The committed snapshots equal a fresh print
- [ ] pnpm gen --check exits 1 naming schema/api.graphql when a resolver changes without a new snapshot
- [ ] .claude/skills/graphql-subgraph/SKILL.md names the files, the commands and each NorthMES rule id with its meaning
```

#### E02-S04 platform: Run a validatable command vetoed by a drop-in plugin

Issue: northMES/northmes#22. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s04-platform-run-a-validatable-command-vetoed-by-a-drop-in-plugin). Blocked by: E02-S02-T07 (#237), E02-S03-T03 (#239). The roadmap names the stories E02-S02 and E02-S03; this story starts before E02-S03 closes, because E02-S03-T09 waits for E02-S04-T07.

Notes: criterion 1 is split over E02-S04-T02, T03, T04 and T07, criterion 2 over E02-S04-T08, T09 and T11, and criterion 6 over E02-S04-T09 and T10. E02-S04-T01 carries the tracer data path that criterion 1 needs. Commands follow [ADR 0012](../adr/0012-commands-as-the-single-write-path.md): the bus opens the scoped transaction, builds and parses the validator payload, runs the validators and then the handler, and the handler's events go into the same transaction. Tests that load a built plugin boot the built server through `bootBuilt` (E02-S01-T09), because `createTestApp` takes in-repo modules only ([ADR 0037](../adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)). The `vertical-slice` recipe comes with E02-S04-T07. The example validator keeps no table of its own in E02, because that is open item M-41 in [16-open-questions.md](16-open-questions.md#design-points-from-the-plan-documents).

##### E02-S04-T01, #240 platform: Run module queries in a transaction scoped to the plant

Labels: `task`, `human`, `area: sdk` (touches row-level security scopes). Blocked by: E02-S02-T07 (#237), E02-S03-T03 (#239).

Covers: no criterion alone; the scoped data path of criterion 1.

```markdown
Plan: E02-S04-T01

## Goal
@northmes/sdk/data exports the DATABASE token and the ScopedDatabase interface: transaction(fn) runs fn in a Kysely transaction whose first statement sets northmes.read_scopes and northmes.write_scopes with set_config(..., true). apps/server provides it from one pg pool that connects as nm_app. Until E05-S03 and E05-S04, a tracer principal plugin in the gateway takes the request's plant scope id from the x-northmes-plant header, grants every permission, and both scope sets hold that one id. A request without a plant reads nothing. Subscriptions take their plant from their plantId argument instead (E02-S06-T03).

## Where in the code
packages/sdk/src/data/database.ts, packages/sdk/src/data/index.ts (new)
apps/server/src/db/pool.ts, apps/server/src/db/scoped-database.ts (new)
apps/server/src/gateway/tracer-principal.ts (new), apps/server/src/gateway/gateway.module.ts (exists)
apps/server/src/app.module.ts (exists; DatabaseModule)
apps/server/test/db/scoped-database.int.test.ts (new): a fixture table rendered from the migration template
apps/server/test/gateway/tracer-principal.test.ts (new)
Port principalPlugin from docs/sources/spike-integration/apps/server/src/gateway/gateway.module.ts and resolvePrincipal from sessions.ts there, without cookies and without the spike's connectionParams fallback.
Seam: ScopedDatabase.transaction(fn) resolved from createTestApp with a principal context per plant; the plugin's context hook called with fake requests.

## Tests first
- scoped-database.int.test.ts: "E02-S04 a transaction for plant A reads plant A's rows and none of plant B's"
- scoped-database.int.test.ts: "E02-S04 a transaction without a plant reads zero rows"
- scoped-database.int.test.ts: "E02-S04 the pool connects as nm_app and sets scopes only inside the transaction"
- tracer-principal.test.ts: "E02-S04 a request with x-northmes-plant gets that plant and every permission"

## Design
none

## ADRs
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0008-row-level-security-with-transaction-local-scopes.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md

## Out of scope
The transaction helper with write sets from roles (E05-S04), sign-in and permissions (E05-S05, E05-S06), plant slugs and the plant header check (E05-S03). The first read through gqlClient with the header is in E02-S04-T02.

## Changelog
none, internal

## Acceptance criteria
- [ ] Inside transaction(), a query for plant A returns only plant A rows
- [ ] Without x-northmes-plant the same query returns zero rows
- [ ] current_user in the pool is nm_app, and the scope settings are transaction-local
- [ ] The tracer principal takes the plant from x-northmes-plant and grants every permission
```

##### E02-S04-T02, #241 core: Serve articles from Postgres through the core subgraph

Labels: `task`, `human`, `area: core` (first module table; builds on proposed ADR 0006). Blocked by: E02-S04-T01 (#240).

Covers: criterion 1 (Article at tracer depth).

```markdown
Plan: E02-S04-T02

## Goal
core.article (code, name) comes from a migration made with pnpm gen:migration, which also grants references (id) to nm_ext so planning can point at it. CoreApiModule (providers only, under server/api) holds ArticleService, which reads through ScopedDatabase. CoreModule holds the code-first Article entity keyed on id and the root field coreArticle(id). The core manifest gains its lazy server entry. Kysely table types for core are written by hand. This is the first task that serves module data from Postgres through the gateway.

## Where in the code
modules/core/migrations/<timestamp>_article.sql (new, generated)
modules/core/server/api/article.service.ts, modules/core/server/api/core-api.module.ts (new)
modules/core/server/article.resolver.ts, core.module.ts, db.ts, index.ts (new)
modules/core/northmes.module.ts (exists; server entry), modules/core/package.json (exists; scripts), modules/core/tsconfig.json (new)
modules/core/test/article.int.test.ts (new)
Port from docs/sources/spike-integration/modules/core/ (server/api.ts, server/core.module.ts, migrations/0001_article.sql), with Postgres instead of in-memory rows.
Seam: createTestApp with core; fixtures through db.command at given.plant(); queries through gqlClient with x-northmes-plant.

## Tests first
- article.int.test.ts: "E02-S04 coreArticle returns an article written at the request's plant and null for another plant's"
- article.int.test.ts: "E02-S04 core.article is owned by nm_mod_core and grants references (id) to nm_ext"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md

## Out of scope
The batched reference resolver (E02-S04-T03), article master data with routings and units (E06-S06), core contracts and screens (E06), generated Kysely types (not in an E02 story).

## Changelog
none, internal

## Acceptance criteria
- [ ] The core.article migration applies as nm_mod_core and grants references (id) to nm_ext
- [ ] coreArticle(id) sent with x-northmes-plant returns code and name at that plant, and null for another plant's article
- [ ] The core manifest's server entry is a lazy import, so the manifest still loads without Nest
```

##### E02-S04-T03, #242 planning: List production orders with their article names

Labels: `task`, `human`, `area: planning` (first planning table; builds on proposed ADR 0006). Blocked by: E02-S04-T02 (#241).

Covers: criterion 1 (ProductionOrder at tracer depth).

```markdown
Plan: E02-S04-T03

## Goal
planning.production_order (number, article_id with a foreign key to core.article, quantity numeric(18,6), status text with a check of planned or released, version) comes from the migration template. PlanningModule holds the ProductionOrder entity, the root field planningProductionOrders, which lists the request plant's orders, and the article field, which resolves through entityRef("Article") from the core subgraph. Core's Article reference resolver batches with loaderFor, so the articles of a list cost one query. This is the first query that joins two subgraphs.

## Where in the code
modules/planning/migrations/<timestamp>_production_order.sql (new, generated)
modules/planning/server/api/production-order.service.ts, modules/planning/server/api/planning-api.module.ts (new)
modules/planning/server/production-order.resolver.ts, planning.module.ts, db.ts, index.ts (new)
modules/core/server/article.resolver.ts (exists; the reference resolver)
modules/planning/northmes.module.ts (exists; server entry), modules/planning/package.json (exists; scripts), modules/planning/tsconfig.json (new)
modules/planning/test/production-orders.int.test.ts (new)
Port from docs/sources/spike-integration/modules/planning/ (server/planning.module.ts, migrations/0001_production_order.sql).
Seam: createTestApp with core and planning; db.command fixtures; gqlClient; a query counter on the pool.

## Tests first
- production-orders.int.test.ts: "E02-S04 planningProductionOrders lists the plant's orders with their article names"
- production-orders.int.test.ts: "E02-S04 an order at another plant is not listed"
- production-orders.int.test.ts: "E02-S04 three orders on three articles resolve their articles with one SQL query"

## Design
none

## ADRs
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md
docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md

## Out of scope
Connections with paging (E06-S02), operations and job orders (E07-S01), the release command (E02-S04-T07), the schema snapshots (E02-S03-T09).

## Changelog
none, internal

## Acceptance criteria
- [ ] planningProductionOrders returns number, quantity, status and article code and name for the request's plant
- [ ] Orders at another plant are not listed
- [ ] The articles of three orders resolve with one SQL query on core.article
- [ ] quantity is numeric(18,6), and status is text with a check, not a Postgres enum
```

##### E02-S04-T04, #244 platform: Generate a command's mutation field from its contract

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0012). Blocked by: E02-S04-T01 (#240).

Covers: criterion 1 (a mutation that maps to a registered handler).

```markdown
Plan: E02-S04-T04

## Goal
@northmes/contracts exports defineCommandContract({ name, target, fields, validatable, payload }) in the shape of ADR 0012: fields is the Zod schema the input comes from (ADR 0017), target "existing" adds id to the input, and payload is the Zod schema of the validator payload (ADR 0037); permission, reason and signature stay optional until E05-S01. @northmes/sdk/commands exports defineCommand(contract, { buildPayload, handle }) for AGPL module server code, the COMMAND_BUS token and the CommandBus interface. The SDK generates the prefixed Mutation field from the contract (planning.releaseProductionOrder gives planningReleaseProductionOrder) with an input type built from the fields, parses the input with the contract and sends it to the command bus, so a module writes no resolver for it. Input conversion covers the field kinds the skeleton uses (ID, string, number).

## Where in the code
packages/contracts/src/define-command-contract.ts (new), packages/contracts/src/index.ts (exists)
packages/sdk/src/commands/define-command.ts, mutation-field.ts, index.ts (new)
packages/contracts/test/define-command-contract.test.ts, packages/sdk/test/commands/mutation-field.test.ts (new)
Port from docs/sources/spike-integration/packages/sdk/src/commands.ts.
Seam: defineCommand inside a Nest TestingModule with a fake COMMAND_BUS; the test reads the printed SDL and calls the field.

## Tests first
- define-command-contract.test.ts: "E02-S04 a contract with target existing has an input of id plus its fields"
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
The shared reason input, expectedVersion, fieldErrors and the boot check for a mutation without a handler (E05-S01), the full Zod to GraphQL input converter (E05-S01), the bus itself (E02-S04-T05).

## Changelog
none, internal

## Acceptance criteria
- [ ] A contract plus defineCommand yields Mutation.planningReleaseProductionOrder with a prefixed input type of id plus the contract's fields
- [ ] The field calls the bus with the parsed input and returns the handler's result
- [ ] An invalid input returns a validation error, and the fake bus is not called
```

##### E02-S04-T05, #245 platform: Run validators and the handler in one scoped transaction

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0012). Blocked by: E02-S04-T04 (#244).

Covers: criterion 4; criterion 5; test `command-bus.test.ts`.

```markdown
Plan: E02-S04-T05

## Goal
CommandBusImpl in apps/server runs each command in the order of ADR 0012. It opens the ScopedDatabase transaction; for a validatable command it calls buildPayload in that transaction, parses the payload with the owner's MIT schema and rejects a mismatch with core.validator_contract_mismatch, then runs the validators (CommandValidator from @northmes/sdk/commands) in catalog order and then by name; then it calls handle with the same transaction. A veto throws CommandRejected (core.command_rejected, details.rejectedBy) and rolls back. @northmes/sdk/errors exports DomainError and the exception filter, registered once as APP_FILTER, which writes code, errorCode and details of a DomainError into the GraphQL error.

## Where in the code
packages/sdk/src/commands/validator.ts (new); packages/sdk/src/errors/domain-error.ts, exception-filter.ts, index.ts (new)
apps/server/src/commands/command-bus.ts, apps/server/src/commands/commands.module.ts (new)
apps/server/src/app.module.ts (exists; CommandsModule, APP_FILTER)
apps/server/test/command-bus.test.ts, apps/server/test/errors/filter.int.test.ts (new)
apps/server/test/fixtures/commands/ (new): a validatable fixture command and two vetoing validators
Port from docs/sources/spike-integration/apps/server/src/commands.ts; DomainError and the filter replace the spike's GraphQLError subclass, and the bus, not the handler, owns the transaction.
Seam: CommandBusImpl.run(command, input, context) with a fake ScopedDatabase and a handler spy; the filter test boots a fixture catalog and sends a mutation through gqlClient.

## Tests first
- command-bus.test.ts: "E02-S04 a payload with quantity as an object is rejected with core.validator_contract_mismatch and the handler spy is not called"
- command-bus.test.ts: "E02-S04 validators run in catalog order and then by name, and handle gets the transaction they ran in"
- filter.int.test.ts: "E02-S04 a veto reaches the client with code, errorCode core.command_rejected and details.rejectedBy"
- filter.int.test.ts: "E02-S04 the exception filter is registered once as APP_FILTER"

## Design
none

## ADRs
docs/adr/0012-commands-as-the-single-write-path.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md

## Out of scope
Time limits, thrown validators and the boot checks for validators (E02-S04-T06); the permission check, audit context, expectedVersion, correlation id and defineErrors (E05-S01).

## Changelog
none, internal

## Acceptance criteria
- [ ] A payload that fails the owner's schema is rejected with core.validator_contract_mismatch, and the handler does not run
- [ ] Validators and the handler run in one transaction that the bus opens, validators in catalog order and then by name
- [ ] A veto rolls back and reaches the client with code, errorCode core.command_rejected and details.rejectedBy
- [ ] The filter is registered once as APP_FILTER
```

##### E02-S04-T06, #269 platform: Fail closed on slow, throwing and misplaced validators

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0012). Blocked by: E02-S04-T05 (#245).

Covers: criterion 3.

```markdown
Plan: E02-S04-T06

## Goal
The bus gives each validator its time limit and a frozen payload. A validator slower than its limit rejects the command; a throw rejects it and reaches the client masked as "Unexpected error."; the handler never runs after either. At boot the bus discovers validators and refuses, with a BootError, a validator on a command not declared validatable or from a module whose dependsOn lacks the owner (ADR 0037).

## Where in the code
apps/server/src/commands/command-bus.ts (exists), apps/server/src/commands/discover-validators.ts (new)
apps/server/test/command-bus.test.ts (exists), apps/server/test/commands/discover-validators.test.ts (new)
apps/server/test/fixtures/commands/ (exists): slow, throwing and misplaced validators
Seam: CommandBusImpl.run with a handler spy; discoverValidators(catalog, providers) returns the validators or throws BootError.

## Tests first
- command-bus.test.ts: "E02-S04 a validator slower than its limit rejects the command and the handler does not run"
- command-bus.test.ts: "E02-S04 a throwing validator returns Unexpected error. and the handler does not run"
- command-bus.test.ts: "E02-S04 a validator that changes its payload throws, because the payload is frozen"
- discover-validators.test.ts: "E02-S04 a validator on a command that is not validatable, or without dependsOn on the owner, stops boot"

## Design
none

## ADRs
docs/adr/0012-commands-as-the-single-write-path.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md

## Out of scope
The example validator plugin (E02-S04-T11), audit rows of rejected commands (E05-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] A validator slower than its limit rejects the command, and the handler does not run
- [ ] A throwing validator rejects the command, and the client sees "Unexpected error."
- [ ] A validator cannot change the payload it gets
- [ ] A validator on a command not declared validatable, or from a module without dependsOn on the owner, stops boot with a named message
```

##### E02-S04-T07, #246 planning: Release a production order through the command bus

Labels: `task`, `human`, `area: planning` (first command of a new pattern). Blocked by: E02-S04-T03 (#242), E02-S04-T05 (#245).

Covers: criterion 1 (planningReleaseProductionOrder maps to a registered, validatable handler); the story's note on the `vertical-slice` recipe.

```markdown
Plan: E02-S04-T07

## Goal
@northmes/planning-contracts declares releaseProductionOrder with defineCommandContract: target existing, no other fields, validatable, and a validator payload schema with productionOrderId, plantId, articleId and quantity. The planning module registers it with defineCommand: buildPayload reads the order in the transaction the bus passes, and handle sets the status to released and bumps version in that same transaction, refusing an order that is not planned with a DomainError. planningReleaseProductionOrder is generated from the contract. This is the first save through a command. The vertical-slice recipe records the files from migration to command to field, the commands and the errors.

## Where in the code
modules/planning/contracts/src/release-production-order.ts, modules/planning/contracts/src/index.ts (new)
modules/planning/contracts/tsconfig.json, modules/planning/contracts/LICENSE (new, MIT); modules/planning/contracts/package.json (exists; scripts)
modules/planning/server/commands/release-production-order.ts (new), modules/planning/server/planning.module.ts (exists)
modules/planning/test/release.int.test.ts, modules/planning/contracts/test/payload.test.ts, packages/contracts/test/pure-imports.test.ts (new)
.claude/skills/vertical-slice/SKILL.md (new)
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
The event in core.event (E02-S06-T01), the schema snapshots (E02-S03-T09), the Release button (E02-S05-T09), audit rows (E05-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] planningReleaseProductionOrder(input: { id }) releases a planned order and returns it with its new version
- [ ] Releasing an order twice fails with a DomainError and leaves the row unchanged
- [ ] The payload for an order parses with the schema in @northmes/planning-contracts, and no contracts package loads Nest or React
- [ ] .claude/skills/vertical-slice/SKILL.md lists the files, commands and errors of the slice
```

##### E02-S04-T08, #270 platform: Build a drop-in plugin with pnpm plugin:build

Labels: `task`, `human`, `area: sdk` (ADR 0037 has open needs-confirmation). Blocked by: E02-S04-T05 (#245).

Covers: criterion 2 (the build with Rolldown, `HOST_PROVIDED` external).

```markdown
Plan: E02-S04-T08

## Goal
pnpm plugin:build <id> builds a plugin with Rolldown into dist/manifest.js and dist/server.js, keeps every HOST_PROVIDED specifier external, bundles the rest (the example bundles ms) and copies the package with its migrations to plugins/<id>/. The example-validator package gets its manifest and a server part without a validator yet; it depends on planning and takes the host packages as peerDependencies.

## Where in the code
scripts/plugin-build.mjs, scripts/plugin-build.test.ts (new)
examples/plugin-validator/src/manifest.ts, examples/plugin-validator/src/server.ts (new)
examples/plugin-validator/tsconfig.json (new), examples/plugin-validator/package.json (exists; scripts)
Port from docs/sources/spike-integration/examples/plugin-validator/ (build.mjs, src/manifest.ts).
Seam: buildPlugin(dir, outDir) returns the output files and the imports left in them.

## Tests first
- plugin-build.test.ts: "E02-S04 plugin:build keeps every HOST_PROVIDED import external and bundles ms"
- plugin-build.test.ts: "E02-S04 plugin:build copies the package and its migrations to plugins/<id>/"

## Design
none

## ADRs
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md

## Out of scope
Loading plugins (E02-S04-T09), the validator (E02-S04-T11), plugin:check and the manifest range from peerDependencies (E21-S02).

## Changelog
feat(platform): build drop-in plugins with pnpm plugin:build

## Acceptance criteria
- [ ] pnpm plugin:build example-validator writes dist/manifest.js and dist/server.js with no HOST_PROVIDED code inside
- [ ] ms is bundled into dist/server.js
- [ ] plugins/example-validator/ holds the package, its dist files and its migrations
```

##### E02-S04-T09, #271 platform: Load plugins from plugins/ through the resolve hook

Labels: `task`, `human`, `area: sdk` (ADR 0037 has open needs-confirmation). Blocked by: E02-S04-T08 (#270).

Covers: criterion 2 (the load from `plugins/`); criterion 6 (the resolve hook for a plugin in the host tree).

```markdown
Plan: E02-S04-T09

## Goal
northmes.config.json at the repository root holds the NorthMES version and the plugins to load. Boot step 1 reads it; a version that differs from the image stops boot naming both. Boot step 2 installs one module.registerHooks resolve hook: when the importing file lies under a plugin root and the specifier is host-provided, it resolves as if the host had imported it; every other import passes through. Without the hook a plugin under plugins/ cannot reach @nestjs/common, because the root package.json does not depend on it. Plugins join the catalog after the in-repo modules, and a listed plugin whose dist/server.js throws on import stops boot naming the plugin. bootBuilt builds the listed plugins once per test run as well.

## Where in the code
northmes.config.json (new)
apps/server/src/boot/config-file.ts, apps/server/src/plugins/resolve-hook.ts (new), apps/server/src/boot/boot.ts (exists; steps 1 and 2)
packages/testing/src/boot-built.ts (exists; plugins)
apps/server/test/plugins/load.int.test.ts (new)
Port from docs/sources/spike-integration/apps/server/src/plugin-resolution.ts and docs/sources/spike-integration/apps/server/test/helpers.mjs. The spike kept its plugins under apps/server/plugins, where plain lookup reached the server's node_modules.
Seam: bootBuilt({ env, config }) returns the exit code and output.

## Tests first
- load.int.test.ts: "E02-S04 a plugin listed in northmes.config.json loads from plugins/ after the in-repo modules with the host's @nestjs/core"
- load.int.test.ts: "E02-S04 config version 0.3.0 with image 0.4.0 stops boot naming both"
- load.int.test.ts: "E02-S04 a listed plugin whose dist/server.js throws on import stops boot naming the plugin id"

## Design
none

## ADRs
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
docs/adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md

## Out of scope
Plugins outside the host tree or with their own Nest copy (E02-S04-T10), the validator (E02-S04-T11), the block reason field of ADR 0037, which no roadmap story holds yet.

## Changelog
feat(platform): load drop-in plugins listed in northmes.config.json

## Acceptance criteria
- [ ] With example-validator in northmes.config.json, the boot log lists it after core and planning
- [ ] The plugin's @nestjs imports resolve to the host's copies through the resolve hook
- [ ] A config version that differs from the image, and a plugin whose server part throws on import, each stop boot with a named message
```

##### E02-S04-T10, #272 platform: Boot plugins outside the tree and refuse plugin controllers

Labels: `task`, `human`, `area: sdk` (ADR 0037 has open needs-confirmation). Blocked by: E02-S04-T09 (#271), E02-S03-T08 (#267).

Covers: criterion 6; criterion 7; tests `resolve-hook.int.test.ts` and `plugin-controller.int.test.ts`.

```markdown
Plan: E02-S04-T10

## Goal
With the resolve hook of E02-S04-T09, a plugin outside the host tree and a plugin with its own node_modules copy of Nest boot against the host's packages, and a plugin that bundles host packages fails boot as designed. The route check also exits 1 when a plugin root reaches a REST controller, naming the plugin id; plugins add no REST controller until the public API epic.

## Where in the code
apps/server/src/plugins/resolve-hook.ts (exists), apps/server/src/routes/route-check.ts (exists; plugin rule)
apps/server/test/plugins/resolve-hook.int.test.ts, apps/server/test/boot/plugin-controller.int.test.ts (new)
apps/server/test/fixtures/plugins/ (new): own-nest, bundled and controller fixtures
Port the config.bundled.json and config.ownmods.json cases from docs/sources/spike-integration/apps/server/.
Seam: bootBuilt({ env, config }); the outside case copies the built example into a temporary directory outside the repository.

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
Requiring the resolve-hook test in ci / gate (from M1), the plugin-outside CI job (E21-S03).

## Changelog
none, internal

## Acceptance criteria
- [ ] A plugin outside the repository and a plugin with its own Nest copy both boot and get the host's @nestjs/core
- [ ] A plugin that bundles @nestjs/graphql fails boot with a message naming the plugin
- [ ] A plugin whose Nest module reaches a controller stops boot naming the plugin id
```

##### E02-S04-T11, #273 platform: Veto a release with the example validator plugin

Labels: `task`, `human`, `area: sdk` (ADR 0037 has open needs-confirmation). Blocked by: E02-S04-T10 (#272), E02-S04-T07 (#246), E02-S04-T06 (#269).

Covers: criterion 2 (the veto with `core.command_rejected` naming `rejectedBy`); test `validator.int.test.ts`.

```markdown
Plan: E02-S04-T11

## Goal
examples/plugin-validator registers ReleaseLimitValidator with CommandValidator for planning.releaseProductionOrder. It rejects a release whose quantity is above an example limit, with a 2 s time limit written with ms. Built with pnpm plugin:build and loaded from plugins/, it makes planningReleaseProductionOrder fail with core.command_rejected and details.rejectedBy example-validator, and the order stays planned. The validator takes the payload schema from the plugin's bundled copy of @northmes/planning-contracts. The test boots the built server through bootBuilt from @northmes/testing, so the example imports no AGPL code.

## Where in the code
examples/plugin-validator/src/release-limit.validator.ts (new), examples/plugin-validator/src/server.ts (exists)
examples/plugin-validator/test/validator.int.test.ts, examples/plugin-validator/test/build.test.ts (new)
Port from docs/sources/spike-integration/examples/plugin-validator/src/server.ts.
Seam: bootBuilt with the plugin listed and a database from useTestDatabase(); gqlClient sends the release.

## Tests first
- validator.int.test.ts: "E02-S04 a release over the example limit is rejected"
- validator.int.test.ts: "E02-S04 a release under the limit passes and the order is released"
- build.test.ts: "E02-S04 the built example bundles @northmes/planning-contracts and imports host packages only as externals"

## Design
none

## ADRs
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
docs/adr/0012-commands-as-the-single-write-path.md

## Out of scope
The nullable block reason field of ADR 0037, which no roadmap story holds yet; offline composition (E21-S02); a table of the plugin's own (open item M-41).

## Changelog
none, internal

## Acceptance criteria
- [ ] A release above the example limit fails with core.command_rejected and details.rejectedBy example-validator, and the order stays planned
- [ ] A release under the limit succeeds with the plugin loaded
- [ ] The built dist/server.js bundles @northmes/planning-contracts and imports host packages only as externals
```

#### E02-S05 web: Load the planning remote in the runtime shell

Issue: northMES/northmes#23. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s05-web-load-the-planning-remote-in-the-runtime-shell). Blocked by: E02-S03-T01 (#247); E02-S05-T03 also waits for E02-S04-T07 (#246) and E02-S05-T06 for E02-S02-T07 (#237). The roadmap names the story E02-S03. The story closes after E02-S08-T02 and E02-S08-T03, which hold its spec `e2e/shell-degraded.spec.ts` and the browser check for zero CSP violations.

Notes: every task runs in a session, because `handoff-demo` arrives with E02-S08-T05. Design: none (tracer screen). In E02 a disabled module is one the catalog did not load, such as a plugin that `northmes.config.json` does not list, because release 1 knows only "installed" ([ADR 0037](../adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)). The menu is a plain list in module order; E04-S02 builds the sidebar. The placeholder itself is tested in E02-S05-T07. Criterion 4 names `@northmes/ui`, which arrives with E04-S01: `shared.mjs` leaves it out until E04-S01 adds the package and its share key together, so no remote can bundle it before then. E02-S05-T09 adds the Release button, which no S05 criterion names; E02-S06 criterion 3 and the skeleton spec need it, and it makes the shell save through a command as early as possible. Criterion 2 is split over E02-S05-T06 and T07, criterion 3 over E02-S05-T04 and T08, criterion 7 over E02-S05-T06 and E02-S08-T03, and criterion 8 over E02-S05-T01 and T08. The `web-remote` recipe comes with E02-S05-T08.

##### E02-S05-T01, #248 contracts: Declare module links with defineModuleLinks

Labels: `task`, `human`, `area: sdk` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S03-T01 (#247).

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
planningLinks (E02-S05-T08), typed search keys and enums (E04), station section builders (E11), moved patterns (E21-S04).

## Changelog
none, internal

## Acceptance criteria
- [ ] A builder returns to, params, search and href, with every value encoded
- [ ] An empty param value throws naming the param
- [ ] A missing param, an extra argument and an unknown entry are type errors in the types project
- [ ] packages/contracts imports no router package
```

##### E02-S05-T02, #249 repo: Fail the check on app paths written as string literals

Labels: `task`, `human`, `area: ci` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S05-T01 (#248).

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
The link snapshot check (E21-S04).

## Changelog
none, internal

## Acceptance criteria
- [ ] A literal path in to=, href=, navigate, redirect or page.goto in a scanned folder fails naming the file and line
- [ ] A builder call passes
- [ ] An allowlist entry without a reason fails, and pnpm check runs the test
```

##### E02-S05-T03, #250 web: Keep shared singletons out of remote bundles

Labels: `task`, `human`, `area: web` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S04-T07 (#246).

Covers: criterion 4 (without `@northmes/ui`, which arrives with E04-S01); tests `guards.test.ts`.

```markdown
Plan: E02-S05-T03

## Goal
@northmes/web-build holds shared.mjs, the one singleton list for the shell and every remote: react, react-dom, react/jsx-runtime, @tanstack/react-router, @apollo/client, @apollo/client/react and @northmes/web-sdk, plus react/jsx-dev-runtime in dev. Every subpath is its own share key, and @northmes/ui joins with E04-S01. remote.mjs's defineRemoteConfig({ id, version }) sets the base /modules/<id>/<version>/, exposes ./module with a manifest and dts: false, declares each singleton { singleton: true, import: false, requiredVersion: false }, and fails the build when the remote's defineWebModule version differs from its module manifest (ADR 0003). The northmes:no-bundled-singletons plugin fails the build naming the package when a remote chunk holds code from a singleton or from graphql; zod, @northmes/contracts and @northmes/<id>-contracts are bundled per remote on purpose. A remote under modules/*/web that emits CSS fails.

## Where in the code
packages/web-build/shared.mjs, remote.mjs, guards.mjs (new), packages/web-build/LICENSE (new, MIT), packages/web-build/package.json (exists; scripts)
packages/web-build/test/guards.test.ts (new)
packages/web-build/test/fixtures/ (new): remote-apollo, remote-graphql, remote-zod-contracts, remote-css and remote-version
Port from docs/sources/spike-integration/packages/web-build/ (shared.mjs, remote.mjs).
Seam: the tests build each fixture remote with Vite through defineRemoteConfig and read the result.

## Tests first
- guards.test.ts: "E02-S05 a remote bundling @apollo/client fails naming the package"
- guards.test.ts: "E02-S05 a remote bundling graphql fails naming the package"
- guards.test.ts: "E02-S05 a fixture remote that bundles zod and @northmes/planning-contracts passes"
- guards.test.ts: "E02-S05 a remote under modules/*/web that emits CSS fails"
- guards.test.ts: "E02-S05 a remote whose defineWebModule version differs from its manifest fails naming both versions"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md

## Out of scope
@northmes/ui and its forbidden-bundle list (E04-S01), plugin remotes with prefixed stylesheets and remotes built outside the workspace (E21), the Rsbuild path (only if the skeleton is red on 2026-11-27).

## Changelog
none, internal

## Acceptance criteria
- [ ] A fixture remote that bundles @apollo/client or graphql fails its build naming the package
- [ ] A fixture remote that bundles zod and @northmes/planning-contracts builds
- [ ] A remote under modules/*/web that emits CSS fails its build
- [ ] A remote whose defineWebModule version differs from its manifest fails its build
- [ ] shared.mjs lists the singletons of ADR 0019 except @northmes/ui, each subpath as its own key, and defineRemoteConfig gives each import false
```

##### E02-S05-T04, #251 web: Define web modules and the shell routes in @northmes/web-sdk

Labels: `task`, `human`, `area: web` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S03-T01 (#247).

Covers: criterion 3 (defineWebModule).

```markdown
Plan: E02-S05-T04

## Goal
@northmes/web-sdk exports defineWebModule({ id, version, routes }), where routes(plantRoute) returns the module's TanStack Router route tree, without nav (ADR 0062); validateWebModule, which names each problem (missing id, a version that differs from the server's entry, a route path that is not the module id); and createShellRoutes, which builds the root route and the $plant route the modules mount under.

## Where in the code
packages/web-sdk/src/web-module.ts, routes.ts, index.ts (new)
packages/web-sdk/tsconfig.json, packages/web-sdk/LICENSE (new, MIT); packages/web-sdk/package.json (exists; scripts)
packages/web-sdk/test/web-module.test.ts, packages/web-sdk/test/routes.test.ts (new)
Port from docs/sources/spike-integration/packages/web-sdk/src/ (contract.ts, routes.ts), without slots.
Every new file in packages/web-sdk starts with // SPDX-License-Identifier: MIT.
Seam: validateWebModule is pure; createShellRoutes is read back through the router's route tree.

## Tests first
- web-module.test.ts: "E02-S05 validateWebModule names a missing id, a version that differs from the server entry and a route path that is not the module id"
- routes.test.ts: "E02-S05 createShellRoutes mounts a module's routes under /$plant/<id>"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md

## Out of scope
The Apollo client and the shell context (E02-S05-T05), slots (E21-S01).

## Changelog
none, internal

## Acceptance criteria
- [ ] validateWebModule returns one named problem per case
- [ ] createShellRoutes puts each module's routes under the $plant route
- [ ] Every file in packages/web-sdk carries the MIT SPDX line, and the package has its LICENSE
```

##### E02-S05-T05, #252 web: Create the shell's Apollo client and context in @northmes/web-sdk

Labels: `task`, `human`, `area: web` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S05-T04 (#251).

Covers: no criterion alone; the client and context that the shell (criterion 1) and the remote (criterion 3) use.

```markdown
Plan: E02-S05-T05

## Goal
@northmes/web-sdk exports createNorthmesClient({ plantId }), one Apollo Client 4 whose HTTP link sends the plant in x-northmes-plant and whose own graphql-ws client puts nothing in connectionParams, because subscriptions take their plant from their plantId argument (ADR 0018). It also exports ShellProvider and useShell, which throws when the shell and a module hold two copies of the shell context.

## Where in the code
packages/web-sdk/src/apollo.ts, packages/web-sdk/src/shell-context.tsx (new), packages/web-sdk/src/index.ts (exists)
packages/web-sdk/test/apollo.test.ts, packages/web-sdk/test/shell-context.test.tsx (new)
Port from docs/sources/spike-integration/packages/web-sdk/src/ (apollo.ts, shell-context.tsx), without the spike's plantId in connectionParams.
Seam: createNorthmesClient takes a fake fetch and a mock WebSocket.

## Tests first
- apollo.test.ts: "E02-S05 createNorthmesClient sends the plant in x-northmes-plant over HTTP"
- apollo.test.ts: "E02-S05 the graphql-ws client sends empty connectionParams"
- shell-context.test.tsx: "E02-S05 useShell throws when a module holds a second copy of the shell context"

## Design
none

## ADRs
docs/adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md

## Out of scope
The CSRF header (E05-S07), reconnect options (E04-S05), switching plants and disposing the old client (E04-S04).

## Changelog
none, internal

## Acceptance criteria
- [ ] The client sends the plant in x-northmes-plant over HTTP
- [ ] The graphql-ws client sends nothing in connectionParams
- [ ] useShell throws on a second context copy
```

##### E02-S05-T06, #253 platform: Serve the web module list and the remotes under a strict CSP

Labels: `task`, `human`, `area: sdk` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S02-T07 (#237), E02-S03-T01 (#247).

Covers: criterion 2 (the controller); criterion 5; criterion 7 (the header; the browser check for zero violations is in E02-S08-T03); test `web-modules.int.test.ts`.

```markdown
Plan: E02-S05-T06

## Goal
The module list controller is declared with ApiController({ module: "web", family: "first-party" }) and answers GET /api/v1/web/modules with no-store: per catalog module with a web block, its id, remote name, label, order, version, manifest URL and the SHA-384 hash of its mf-manifest.json (null when files are missing), plus the NorthMES version and the supergraph hash. Nest serves each catalog remote at /modules/<id>/<version>/ with immutable caching for hashed files and no-cache for mf-manifest.json and the entry, and the shell at the SPA paths. Every SPA response sends a Content-Security-Policy of 'self'. A module the catalog did not load gets no list entry and no static mount, even when its built remote files are on disk.

## Where in the code
apps/server/src/web/web-modules.controller.ts, static-mounts.ts, web.module.ts (new)
apps/server/src/app.module.ts (exists; WebModule)
apps/server/test/rest/web-modules.int.test.ts (new)
apps/server/test/fixtures/web/ (new): built remote and shell files, and the remote files of a module outside the catalog
Port from docs/sources/spike-integration/apps/server/src/web.ts and docs/sources/spike-mf/apps/server/src/web-modules.ts.
Seam: createTestApp with fixture files; requests with fetch.

## Tests first
- web-modules.int.test.ts: "E02-S05 a disabled module is not listed"
- web-modules.int.test.ts: "E02-S05 a module outside the catalog gets 404 on its mf-manifest.json although its files are on disk"
- web-modules.int.test.ts: "E02-S05 the module list answers at apiPath(web, modules) from a controller declared with ApiController"
- web-modules.int.test.ts: "E02-S05 hashed remote files are immutable and mf-manifest.json is no-cache"
- web-modules.int.test.ts: "E02-S05 an SPA path answers with the strict self Content-Security-Policy"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md

## Out of scope
401 without a session and 403 for a plant (E05), the plant filter (E05-S06), hash checks in the shell (E04-S02), client errors (E04-S06), shared version checks (E21-S04).

## Changelog
none, internal

## Acceptance criteria
- [ ] GET /api/v1/web/modules lists planning with its manifest URL and hash, and leaves out a module the catalog did not load
- [ ] A module outside the catalog gets 404 under /modules/<id>/<version>/ although its files are on disk
- [ ] The controller's path comes from ApiController, not from a string
- [ ] Hashed files under /modules/planning/<version>/ are immutable, and mf-manifest.json is no-cache
- [ ] Every SPA response carries the strict 'self' Content-Security-Policy header
```

##### E02-S05-T07, #254 web: Load remotes in the shell from the module list

Labels: `task`, `human`, `area: web` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S05-T03 (#250), E02-S05-T05 (#252), E02-S05-T06 (#253).

Covers: criterion 1; criterion 2 (the shell builds the URL with `apiPath`); criterion 6.

```markdown
Plan: E02-S05-T07

## Goal
apps/web is a Vite SPA and a pure @module-federation/runtime host with no federation build plugin. It calls registerShared with its own module instances for every name in shared.mjs, fetches the module list from apiPath("web", "modules"), registers each listed remote, loads ./module, checks it with validateWebModule and builds the route tree from createShellRoutes plus each remote's routes(plantRoute). Each $plant route renders ShellProvider with the client from createNorthmesClient({ plantId }). A remote that fails to load gets a placeholder route and an "(unavailable)" menu entry in its usual position. The E02 menu is a plain list of modules in order.

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
Timeouts and retries, the sidebar from routes and the degraded e2e spec's hash case (E04-S02), styles and tokens (E04-S01), the degraded e2e spec itself (E02-S08-T02).

## Changelog
none, internal

## Acceptance criteria
- [ ] The shell fetches /api/v1/web/modules through apiPath, registers each remote and mounts its routes under /$plant
- [ ] A remote that fails to load shows a placeholder route and "(unavailable)" in its menu position
- [ ] registerShared covers exactly the names in shared.mjs
- [ ] pnpm build builds apps/web with no federation build plugin
```

##### E02-S05-T08, #255 planning: Show production orders with article names on the board stub

Labels: `task`, `human`, `area: planning` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S05-T07 (#254), E02-S05-T02 (#249), E02-S04-T07 (#246).

Covers: criterion 3 (the remote and its board stub); criterion 8 (planningLinks); test `routes.links.test.tsx`; the story's note on the `web-remote` recipe.

```markdown
Plan: E02-S05-T08

## Goal
modules/planning/web is a remote built through defineRemoteConfig that exposes ./module = defineWebModule(...). Its routes take their paths from planningLinks in @northmes/planning-contracts, declared with defineModuleLinks. The board stub at planningLinks.board runs planningProductionOrders and lists each order's number, quantity, status and article name, with data-testid hooks for the e2e specs. The remote imports no stylesheet. The web-remote recipe records the files, the commands and each load error with its meaning.

## Where in the code
modules/planning/contracts/src/links.ts (new), modules/planning/contracts/src/index.ts (exists)
modules/planning/web/vite.config.ts (new)
modules/planning/web/src/module.tsx, routes.tsx, board-screen.tsx, board.graphql.ts (new)
modules/planning/web/tsconfig.json (new), modules/planning/web/package.json (exists; scripts)
modules/planning/web/test/routes.links.test.tsx, modules/planning/web/test/board-screen.test.tsx (new)
.claude/skills/web-remote/SKILL.md (new)
Port from docs/sources/spike-integration/modules/planning/web/ and docs/sources/spike-mf/modules/planning/web/src/module.test.tsx.
Seam: the remote's module tested as a plain React package with MockedProvider; routes compared with planningLinks.

## Tests first
- routes.links.test.tsx: "E02-S05 every planningLinks entry matches a route fullPath"
- board-screen.test.tsx: "E02-S05 the board stub lists production orders with their article names"

## Design
none

## ADRs
docs/adr/0019-web-shell-with-react-module-federation-remotes.md
docs/adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md
docs/adr/0003-module-package-shape-and-the-definemodule-manifest.md

## Out of scope
The Release button (E02-S05-T09), live updates (E02-S06-T04), the real board (E08), links.snapshot.json (E21-S04).

## Changelog
feat(planning): list production orders with their article names on the board

## Acceptance criteria
- [ ] The planning remote builds through defineRemoteConfig and exposes ./module
- [ ] Every planning route path comes from planningLinks, and every planningLinks entry matches a route
- [ ] The board stub lists number, quantity, status and article name for each order of the plant
- [ ] .claude/skills/web-remote/SKILL.md lists the files, the commands and each load error with its meaning
```

##### E02-S05-T09, #256 planning: Release a production order from the board stub

Labels: `task`, `human`, `area: planning` (runs in a session: handoff-demo arrives with E02-S08-T05). Blocked by: E02-S05-T08 (#255).

Covers: no S05 criterion; the release in the browser that E02-S06 criterion 3 and the skeleton spec need. After this task the shell shows module data and saves it through a command.

```markdown
Plan: E02-S05-T09

## Goal
Each planned order on the board stub has a Release button that sends planningReleaseProductionOrder with the order's id. On success the row shows released and its new version without a reload; on failure the row shows the error's message and errorCode (for a veto, core.command_rejected with the validator's message), and the row stays planned.

## Where in the code
modules/planning/web/src/board-screen.tsx (exists), modules/planning/web/src/release.graphql.ts (new)
modules/planning/web/test/board-screen.test.tsx (exists)
Seam: the board screen with MockedProvider.

## Tests first
- board-screen.test.tsx: "E02-S05 the Release button sends planningReleaseProductionOrder and the row shows released"
- board-screen.test.tsx: "E02-S05 a rejected release shows the message and errorCode in the row"

## Design
none

## ADRs
docs/adr/0012-commands-as-the-single-write-path.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md

## Out of scope
Live updates in other browsers (E02-S06-T04), forms with fieldErrors (E05-S01), the real board actions (E08), trying it in a browser (E02-S08-T05).

## Changelog
feat(planning): release a production order from the board

## Acceptance criteria
- [ ] A planned order's Release button sends planningReleaseProductionOrder with its id
- [ ] A released row shows its status and new version without a reload
- [ ] A rejected release shows the message and the errorCode, and the row stays planned
```

#### E02-S06 platform: Push a release to the board over a subscription

Issue: northMES/northmes#24. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s06-platform-push-a-release-to-the-board-over-a-subscription). Blocked by: E02-S04 (#22), E02-S05 (#23); its first task waits for E02-S04-T11 (#273) and E02-S05-T09 (#256).

Notes: the release publishes `planning.production_order.released`, which is not in the release 1 event list of [04-data-and-platform.md](04-data-and-platform.md#release-1-events). `core.event`, `core.event_sequencer` and `core.inbox` carry no policies, by the working default of [ADR 0014](../adr/0014-outbox-event-log-and-pg-boss-jobs.md); their allowlist entries arrive with the catalog lint (E05-S04). pg-boss jobs wait for E05-S09. Criterion 1 is split over E02-S06-T01 and E02-S06-T02, and criterion 4 over E02-S06-T03 and T04. Criterion 3 is proved in the browser by `e2e/skeleton.spec.ts` (E02-S08-T03); in E02-S06-T04 a person checks it with `pnpm dev`.

##### E02-S06-T01, #274 platform: Write command events in the command's transaction

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0014). Blocked by: E02-S04-T11 (#273), E02-S05-T09 (#256).

Covers: criterion 1 (the release writes its event in its transaction).

```markdown
Plan: E02-S06-T01

## Goal
core.event and core.event_sequencer come from a core migration with the DDL of ADR 0014; position stays null until a sequencer assigns it. A handler publishes events through the events context the bus passes, inside the bus's transaction, after the row update that returned the new version (ADR 0012 step 9). The release handler publishes planning.production_order.released with ids only. A command that rolls back leaves no event.

## Where in the code
modules/core/migrations/<timestamp>_event.sql (new)
packages/sdk/src/commands/events.ts (new), packages/sdk/src/commands/index.ts (exists)
apps/server/src/commands/command-bus.ts (exists): the events context
modules/planning/server/commands/release-production-order.ts (exists; publishes the event)
apps/server/test/events/publish.int.test.ts (new)
No spike source: the spike publishes from the handler without a transaction.
Seam: createTestApp with core and planning; the release goes through gqlClient; core.event is read through useTestDatabase().

## Tests first
- publish.int.test.ts: "E02-S06 a release writes one planning.production_order.released row with ids only in the command's transaction"
- publish.int.test.ts: "E02-S06 a publish inside a rolled-back command leaves no event"

## Design
none

## ADRs
docs/adr/0014-outbox-event-log-and-pg-boss-jobs.md
docs/adr/0012-commands-as-the-single-write-path.md

## Out of scope
The sequencer (E02-S06-T02), pg-boss jobs and the inbox (E05-S09), causation ids from audit (E05-S02), retention (not decided).

## Changelog
none, internal

## Acceptance criteria
- [ ] A release writes one planning.production_order.released row to core.event in the command's transaction, with ids only
- [ ] A rolled-back command leaves no event
- [ ] A new event's position is null until a sequencer assigns it
```

##### E02-S06-T02, #275 platform: Sequence events in commit order and notify once per batch

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0014). Blocked by: E02-S06-T01 (#274).

Covers: criterion 1 (the sequencer); test `sequencer.int.test.ts`.

```markdown
Plan: E02-S06-T02

## Goal
In roles worker and all, one sequencer per batch of up to 500 rows takes pg_try_advisory_xact_lock, assigns positions to rows with position null in seq order and sends one NOTIFY carrying only the last position, all in one transaction. Role api starts no sequencer.

## Where in the code
apps/server/src/events/sequencer.ts, apps/server/src/events/events.module.ts (new), apps/server/src/app.module.ts (exists)
apps/server/test/events/sequencer.int.test.ts (new)
Seam: runSequencerBatch(pool) against a database from useTestDatabase().

## Tests first
- sequencer.int.test.ts: "E02-S06 events committed out of order get positions in commit order"
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
The event tail (E02-S06-T03), pg-boss jobs (E05-S09).

## Changelog
none, internal

## Acceptance criteria
- [ ] Transactions committed out of insertion order get positions in commit order
- [ ] Two sequencers running at once never give one position twice
- [ ] Each batch sends one NOTIFY that carries only a position
- [ ] Role api runs no sequencer
```

##### E02-S06-T03, #276 platform: Tail core.event and feed planningBoardChanged

Labels: `task`, `human`, `area: sdk` (builds on proposed ADR 0014). Blocked by: E02-S06-T02 (#275), E02-S03-T04 (#263), E02-S03-T09 (#268).

Covers: criterion 2; criterion 4 (the message carries ids only); test `board-changed.int.test.ts`.

```markdown
Plan: E02-S06-T03

## Goal
In roles api and all, the event tail holds one direct LISTEN connection outside the pool, starts at the current maximum position, treats a notification as a wake-up, reads core.event where position is greater than the last seen and hands each event to an in-process PubSub; no third-party Postgres pub/sub library is used. Planning's subscription planningBoardChanged(plantId: ID!) takes its plant from its argument and yields the ids of production orders changed in that plant's scope, and nothing else. The schema snapshots are regenerated.

## Where in the code
apps/server/src/events/event-tail.ts (new), apps/server/src/events/events.module.ts (exists)
packages/sdk/src/graphql/events.ts (new): the EVENTS token and its interface, exported from @northmes/sdk/graphql
modules/planning/server/board-changed.resolver.ts (new), modules/planning/server/planning.module.ts (exists)
modules/planning/test/board-changed.int.test.ts, apps/server/test/events/event-tail.int.test.ts (new)
schema/api.graphql, schema/supergraph.graphql, modules/planning/schema.graphql (regenerated with pnpm gen)
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

##### E02-S06-T04, #277 planning: Update the board stub live when an order is released

Labels: `task`, `human`, `area: planning` (builds on proposed ADR 0020). Blocked by: E02-S06-T03 (#276).

Covers: criterion 3; criterion 4 (the client refetches).

```markdown
Plan: E02-S06-T04

## Goal
The board stub subscribes to planningBoardChanged for its plant over graphql-ws and, on each message, refetches its visible range of orders, so a release made in one browser shows on the board in another without a reload. Messages carry ids only; the rows come from the refetch.

## Where in the code
modules/planning/web/src/board-screen.tsx, modules/planning/web/src/board.graphql.ts (exist)
modules/planning/web/test/board-screen.test.tsx (exists)
Seam: the board screen with MockedProvider and a mocked subscription result.

## Tests first
- board-screen.test.tsx: "E02-S06 the board subscribes to planningBoardChanged with its plant id"
- board-screen.test.tsx: "E02-S06 a planningBoardChanged message makes the board refetch its orders and show the new status"

## Design
none

## ADRs
docs/adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md

## Out of scope
Pausing live updates (E08-S11), the reconnect banner (E04-S05), the end-to-end test (E02-S08-T03).

## Changelog
feat(planning): update the board live when an order is released

## Acceptance criteria
- [ ] The board subscribes to planningBoardChanged with its plant id
- [ ] A message triggers one refetch of the board's orders, and the row shows the new status
- [ ] With pnpm dev, a release in one browser appears on the board in another without a reload
```

#### E02-S07 platform: Shut down cleanly and report the supergraph hash

Issue: northMES/northmes#25. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s07-platform-shut-down-cleanly-and-report-the-supergraph-hash). Blocked by: E02-S06 (#24).

Notes: pg-boss `stop()` (E05-S09), the schema compatibility number (E18-S03) and the audit row of the 1.5 s mutation (E05-S02) are not part of E02. The `/health/ready` check that [ADR 0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) puts in `dev-up.int.test.ts` lands in E02-S07-T01, because E02-S08-T01 runs before this story.

##### E02-S07-T01, #278 platform: Report liveness and readiness with the supergraph hash

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S06-T04 (#277), E02-S08-T01 (#243).

Covers: criterion 4.

```markdown
Plan: E02-S07-T01

## Goal
/health/live answers 200 while the process runs. /health/ready returns JSON with status, the NorthMES version and the supergraph hash through custom @nestjs/terminus indicators for the pool and the gateway, and answers 503 until the gateway is ready. Both are root routes on the route check's allowlist. On the stack the script starts, the built server answers 200 on /health/ready (ADR 0058).

## Where in the code
apps/server/src/health/health.controller.ts, health.module.ts, indicators.ts (new)
apps/server/src/app.module.ts (exists)
apps/server/test/health.int.test.ts (new), scripts/stack/dev-up.int.test.ts (exists)
Port from the health/ready route in docs/sources/spike-integration/apps/server/src/web.ts.
Seam: createTestApp with fetch on /health/live and /health/ready; dev-up.int.test.ts starts the built server on the stack through bootBuilt.

## Tests first
- health.int.test.ts: "E02-S07 /health/live answers 200"
- health.int.test.ts: "E02-S07 /health/ready returns status, version and the supergraph hash from the boot log"
- dev-up.int.test.ts: "E02-S07 the built server on the stack's database answers 200 on /health/ready"

## Design
none

## ADRs
docs/adr/0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
docs/adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md

## Out of scope
Degraded states, the watchdog and System health (E16), signing in the seeded planner (E05-S05).

## Changelog
feat(platform): report liveness and readiness with the supergraph hash

## Acceptance criteria
- [ ] GET /health/live returns 200
- [ ] GET /health/ready returns status, version and supergraph, and the hash equals the boot log's
- [ ] Both routes pass the boot route check as root routes
- [ ] On a stack started by the stack script, /health/ready returns 200
```

##### E02-S07-T02, #279 platform: Shut down cleanly on SIGTERM and finish in-flight requests

Labels: `task`, `human`, `area: sdk` (first task of a new pattern). Blocked by: E02-S07-T01 (#278).

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
Seam: boot() of a fixture catalog in the test process for the mutation, readiness and order cases; bootBuilt for the exit case.

## Tests first
- shutdown.int.test.ts: "E02-S07 a 1.5 s mutation with app.close() after 300 ms returns 200"
- shutdown.int.test.ts: "E02-S07 readiness returns 503 during shutdown"
- shutdown.int.test.ts: "E02-S07 a subscriber gets 1001 and the process exits"
- shutdown.int.test.ts: "E02-S07 shutdown disposes graphql-ws, then closes HTTP, then the gateway, then the pools"

## Design
none

## ADRs
docs/adr/0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md

## Out of scope
pg-boss stop (E05-S09), assistant streams (E14), the audit row of the slow mutation (E05-S02).

## Changelog
feat(platform): finish in-flight requests and exit cleanly on SIGTERM

## Acceptance criteria
- [ ] A 1.5 s mutation running when app.close() starts after 300 ms returns 200
- [ ] /health/ready returns 503 once shutdown starts
- [ ] A graphql-ws subscriber gets close code 1001, and the process exits on its own after SIGTERM
- [ ] graphql-ws, HTTP, the gateway and the pools close in that order
```

#### E02-S08 platform: Start the stack with one script and gate on the skeleton spec

Issue: northMES/northmes#26. Statement, criteria and tests: [14-roadmap.md](14-roadmap.md#e02-s08-platform-start-the-stack-with-one-script-and-gate-on-the-skeleton-spec). Blocked by: E02-S07 (#25) for E02-S08-T02 to T04 and T06. E02-S08-T01 waits only for E02-S04-T03, and E02-S08-T05 for E02-S08-T01 and E02-S05-T09, so a person can try the app by hand at the stop point; the roadmap blocks the whole story on E02-S07.

Notes: criterion 2 lands in E02-S01-T08. Criterion 1 in the roadmap names the tracer seed of E02-S08-T01: fictional articles and production orders at one company and plant scope id, with no planner and no operator. The planner and the operator, with dev-only credentials in the seed package, need Better Auth (E05-S05), whose tests sign in "the seeded planner"; the E05-S05 task "Seed a planner and an operator with dev-only credentials" adds them to the seed. `playwright.config.ts` comes from E01-S04-T01, and E02-S08-T02 adds the e2e and skeleton projects to it. From M1, `e2e/skeleton.spec.ts` and the resolve-hook test become required in `ci / gate`, which is a ruleset change outside these tasks. E02-S08-T06 is the epic's end docs task.

##### E02-S08-T01, #243 platform: Start Postgres, migrate and seed with one stack script

Labels: `task`, `human`, `area: sdk` (touches secrets handling). Blocked by: E02-S04-T03 (#242).

Covers: criterion 1; criterion 3; test `scripts/stack/config.test.ts`.

```markdown
Plan: E02-S08-T01

## Goal
scripts/stack/stack.mjs runs the shared steps of ADR 0058: write .northmes/dev.env (NODE_ENV=development, *_FILE keys) and random dev secret files under .northmes/secrets/ with mode 0600 and the dev marker when missing; start Postgres through Testcontainers from infra/pg-image.json (withReuse only on a laptop behind an opt-in variable, never in CI); run northmes db bootstrap as the container superuser, then northmes migrate; run an idempotent seed of fictional articles and production orders at one fixed company and plant scope id; and take ports by binding 127.0.0.1:0. A port in use stops boot with EADDRINUSE naming PORT.

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
pnpm dev and handoff-demo (E02-S08-T05), /health/ready on the stack (E02-S07-T01), the planner and the operator in the seed and their sign-in (E05-S05), the Compose stack (E17-S02), the server's missing default port (E02-S01-T07).

## Changelog
none, internal

## Acceptance criteria
- [ ] A first run writes .northmes/dev.env and the secret files with mode 0600 and the dev marker, and a second run keeps them
- [ ] The stack starts Postgres from infra/pg-image.json, bootstraps the roles, migrates and seeds, and a second run adds nothing
- [ ] Two stack instances started together get disjoint ports and no EADDRINUSE
- [ ] A port in use stops boot with a message naming PORT
```

##### E02-S08-T02, #280 testing: Run Playwright specs on the built all process

Labels: `task`, `human`, `area: ci` (first task of a new pattern). Blocked by: E02-S08-T01 (#243), E02-S07-T02 (#279), E01-S04-T01.

Covers: E02-S05 test `e2e/shell-degraded.spec.ts`; the Playwright harness and the skeleton project criterion 5 runs on.

```markdown
Plan: E02-S08-T02

## Goal
playwright.config.ts gets two projects next to the board-perf project of E01-S04-T01: e2e and skeleton, both Chromium, with no webServer. skeleton runs only e2e/skeleton.spec.ts, so ci / gate can require it alone from M1, and e2e runs the other specs. The globalSetup runs the stack script into a template database; a worker fixture clones e2e_<parallelIndex> and spawns the built server with NORTHMES_ROLE=all and PORT=0. pnpm e2e builds once and runs both projects. The first spec proves the shell's degraded path: with the planning remote's files missing, the shell shows the placeholder route and the "(unavailable)" menu entry.

## Where in the code
playwright.config.ts (exists): the e2e and skeleton projects
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
The skeleton spec itself (E02-S08-T03), Better Auth storage states (E05-S05), the stack2 fixture (E05-S10), the accessibility project (E20), the wrong-hash case (E04-S02).

## Changelog
none, internal

## Acceptance criteria
- [ ] pnpm e2e builds once and runs the e2e and skeleton projects on Chromium with one database and one built server per worker
- [ ] The skeleton project runs only e2e/skeleton.spec.ts
- [ ] The config has no webServer entry, and no spec writes an app path as a literal
- [ ] With the planning remote's files removed, the shell shows the placeholder route and "(unavailable)" in the menu
```

##### E02-S08-T03, #281 repo: Gate on the skeleton spec in e2e

Labels: `task`, `human`, `area: ci` (changes CI workflows). Blocked by: E02-S08-T02 (#280), E00-S04-T01 (#196).

Covers: criterion 5; E02-S05 criterion 7 (zero violations in the browser); tests `e2e/skeleton.spec.ts`.

```markdown
Plan: E02-S08-T03

## Goal
e2e/skeleton.spec.ts runs on the built all process with core, planning and example-validator loaded from plugins/. The board lists the seeded orders with article names under the strict CSP with zero securitypolicyviolation events; a release over the example limit shows the validator's message; a release in a second browser context appears on the board. ci.yml gets the e2e job, which builds and runs pnpm e2e on every pull request.

## Where in the code
e2e/skeleton.spec.ts (new)
.github/workflows/ci.yml (exists; e2e job)
test/meta/workflows.test.ts (exists)
Seam: the e2e fixtures from E02-S08-T02; workflows.test.ts parses ci.yml.

## Tests first
- skeleton.spec.ts: "E02-S08 the board lists orders with article names"
- skeleton.spec.ts: "E02-S08 a vetoed release shows the validator message"
- skeleton.spec.ts: "E02-S08 a release in a second context appears on the board"
- workflows.test.ts: "E02-S08 e2e builds and runs pnpm e2e"

## Design
none

## ADRs
docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
docs/adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
docs/adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md

## Out of scope
The ruleset edit that adds e2e after the merge (a person's, ADR 0069), the Chromium project with Temporal deleted (later).

## Changelog
ci(repo): run the walking skeleton spec in e2e

## Acceptance criteria
- [ ] skeleton.spec.ts passes on the built all process with example-validator loaded
- [ ] The board test records zero securitypolicyviolation events
- [ ] A vetoed release shows the validator's message, and a release in one context appears in the other
- [ ] CI / e2e runs the spec on every pull request
```

##### E02-S08-T04, #282 repo: Run integration tests in a fresh worktree in CI

Labels: `task`, `human`, `area: ci` (changes CI workflows). Blocked by: E02-S08-T03 (#281).

Covers: criterion 6.

```markdown
Plan: E02-S08-T04

## Goal
The fresh-worktree job in ci.yml runs git worktree add, pnpm install --frozen-lockfile and pnpm test:int with no build step, and passes, so a fresh worktree runs every integration test after one install. Tests that boot the built server build it through bootBuilt (E02-S01-T09).

## Where in the code
.github/workflows/ci.yml (exists; fresh-worktree job)
test/meta/workflows.test.ts (exists)
Seam: workflows.test.ts parses ci.yml.

## Tests first
- workflows.test.ts: "E02-S08 the fresh-worktree job runs git worktree add, pnpm install --frozen-lockfile and pnpm test:int and no build"

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

##### E02-S08-T05, #257 repo: Run the app with pnpm dev and the handoff-demo launch entry

Labels: `task`, `human`, `area: ci` (first task of a new pattern). Blocked by: E02-S08-T01 (#243), E02-S05-T09 (#256).

Covers: criterion 4. After this task a person can try the app by hand: this is the stop point.

```markdown
Plan: E02-S08-T05

## Goal
pnpm dev runs the stack script, then tsc -b --watch over the backend projects with a server restart after each completed build, the shell's Vite dev server and one Vite dev server per remote, with ports from the stack; a changed migration file runs northmes migrate again. .claude/launch.json gets handoff-demo, which runs pnpm demo: the production build of role all through the stack script on $PORT with the fictional seed, so a demo has one origin and one port. Both print the board URL, built with planningLinks.board for the seeded plant's scope id.

## Where in the code
scripts/stack/dev.mjs, scripts/stack/demo.mjs (new)
.claude/launch.json (new)
scripts/stack/dev.test.ts, test/meta/launch.test.ts (new)
Seam: devPlan(ports) returns the processes to start and the board URL; launch.test.ts reads .claude/launch.json.

## Tests first
- dev.test.ts: "E02-S08 pnpm dev starts tsc -b --watch, the shell dev server and one dev server per remote on the stack's ports"
- dev.test.ts: "E02-S08 the printed board URL is planningLinks.board for the seeded plant"
- launch.test.ts: "E02-S08 handoff-demo runs the built all process through the stack script on PORT"

## Design
none

## ADRs
docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
docs/adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md

## Out of scope
Fast Refresh for every remote (E04-S08), the live update (E02-S06-T04).

## Changelog
feat(repo): start the app with pnpm dev

## Acceptance criteria
- [ ] pnpm dev starts Postgres, migrates, seeds and serves the server, the shell and the planning remote with rebuilds on change
- [ ] pnpm dev prints the board URL of the seeded plant
- [ ] .claude/launch.json has handoff-demo, which runs the built all process through the stack script on $PORT
- [ ] Through handoff-demo the board lists the seeded orders and a release changes a row
```

##### E02-S08-T06, #283 docs: Update the guides and ADR statuses after the walking skeleton

Labels: `task`, `human`, `area: docs` (the epic's end docs task, run alone). Blocked by: E02-S08-T03 (#281), E02-S08-T04 (#282), E02-S08-T05 (#257), E02-S01-T03 (#258), E02-S01-T06 (#260), E02-S03-T07 (#266).

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
Seam: none, docs only.

## Tests first
none, docs only

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
- [ ] test/meta/doc-links.test.ts and the ADR index test pass
```

#### Project order

The order for `set_order`, which keeps every blocker ahead of its task and reaches the stop point (E02-S08-T05) as early as the blockers allow. Groups 1 to 4 lead to it; groups 5 to 7 finish the epic.

1. E02-S01-T00, E02-S01-T01, E02-S01-T02, E02-S01-T04, E02-S01-T07, E02-S01-T08, E02-S01-T09
2. E02-S02-T01, E02-S02-T02, E02-S02-T05, E02-S02-T06, E02-S02-T07
3. E02-S03-T02, E02-S03-T03, E02-S04-T01, E02-S04-T02, E02-S04-T03, E02-S08-T01, E02-S04-T04, E02-S04-T05, E02-S04-T07
4. E02-S03-T01, E02-S05-T01, E02-S05-T02, E02-S05-T03, E02-S05-T04, E02-S05-T05, E02-S05-T06, E02-S05-T07, E02-S05-T08, E02-S05-T09, E02-S08-T05
5. E02-S01-T03, E02-S01-T05, E02-S01-T06, E02-S02-T03, E02-S02-T04, E02-S03-T04, E02-S03-T05, E02-S03-T06, E02-S03-T07, E02-S03-T08, E02-S03-T09, E02-S04-T06, E02-S04-T08, E02-S04-T09, E02-S04-T10, E02-S04-T11
6. E02-S06-T01, E02-S06-T02, E02-S06-T03, E02-S06-T04, E02-S07-T01, E02-S07-T02
7. E02-S08-T02, E02-S08-T03, E02-S08-T04, E02-S08-T06
