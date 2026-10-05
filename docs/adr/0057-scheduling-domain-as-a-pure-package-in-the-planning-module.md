---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 05, 16, 17, 20, 25, 28, 30, 32 and 33
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer"
---

# Scheduling domain as a pure package in the planning module

## Context and problem statement

The scheduling domain is the set of rules that compute and check a plan: the planned duration and release functions, autoplan's `plan()`, `validate()` for conflicts, the lock rules (`judgeMove`), snapping and the material projection `projectMaterial`. The planning server runs them for autoplan, for moves and for Save. The planning board in the planning web remote needs the same duration, snapping and lock rules, so that a drag preview agrees with what the server later accepts.

Earlier design notes put this code in four places: a shared scheduling package used by client and server, a scheduling package outside the MIT set, a `domain/` folder inside the planning server package (`modules/planning/server/domain`), and `modules/planning/src/domain`. The planning web remote cannot import cleanly from the server package. E03, the scheduling domain epic, is the first work handed to handoff, so its task briefs, the Vitest coverage include, the Biome domain override, the tests-changed check and the CodeRabbit path instructions would point at different folders.

This ADR decides the package, its path, what it holds and what it must not import. It covers the planning module's packages, the boundary to core's calendar expansion and the time arithmetic in `@northmes/contracts`. It is decided before E03 is shaped.

## Decision drivers

* Planning server and planning web need the same rules; the server stays the authority, and the board preview must agree with it ([ADR 0030](0030-a-planning-board-built-in-house.md)).
* Domain logic is never shared by import between modules; other modules call the owner's API module ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md), [ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)).
* MIT packages import no AGPL code, and `@northmes/ui` must compute block text colors ([ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md), [ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)).
* Pure functions that take `now` as input make the scheduling tests plain arithmetic with no database, clock or fake timers ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).
* The earlier attempt's placement, calendar, lock, operation and readiness rules are ported test-first with their six placement defects fixed ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)); they need one home that both server and board reach.
* Coding agents work from the path in the task brief, and every tool that keys on a path must name the same one.

## Considered options

* `@northmes/planning-domain`, an AGPL workspace package in `modules/planning/domain`
* `packages/scheduling`, a top-level package next to the shared packages
* A `domain/` folder inside the planning server package (`modules/planning/server/domain`)

## Decision outcome

Chosen option: "`@northmes/planning-domain`, an AGPL workspace package in `modules/planning/domain`", because both planning packages can import it without pulling Nest into the browser, the rules stay inside the module that owns them, and one path serves every tool.

### The package

| Field | Value |
|---|---|
| Name | `@northmes/planning-domain` |
| Path | `modules/planning/domain` |
| License | `AGPL-3.0-or-later` in `package.json` |
| Exports | the `.ts` entry under `"@northmes/source"`, then `dist` under `"default"` ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)) |
| May import | `@northmes/contracts` (MIT value types, `resolveWallClock`, millisecond windows) |
| Imported by | `@northmes/module-planning` (server) and `@northmes/planning-web` (board) only |

The planning module therefore has four workspace packages instead of the three that [ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md) gives every module. Scheduling rules have one home: they are not split between this package and a `server/domain/` folder in the planning server package.

### What it holds

| Function | Called by |
|---|---|
| Planned duration and release functions | `plan()`, `validate()` and the board preview ([ADR 0027](0027-planned-duration-formula-and-override-precedence.md)) |
| `plan(snapshot)` | the autoplan job ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)) |
| `validate()` | Save, which checks a draft's changes plus the committed rows ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)), and the board's conflict states |
| `judgeMove` (lock rules) | the board, the Move dialog, the job order table view, `planning.commitScheduleChanges` and agent proposals ([ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)) |
| Snapping | the board's drag preview and keyboard move mode, and the server when it accepts a move |
| `projectMaterial(placements, movements, now)` | `plan()`, the board read model and the board's draft overlay |

### What it does not hold

* Generic time arithmetic that core also needs: `resolveWallClock` and half-open millisecond windows with `union`, `subtract`, `addWork` and `subtractWork` live in MIT `@northmes/contracts` ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* `textColorFor`, which `@northmes/ui` calls, also lives in `@northmes/contracts`, because an MIT package cannot import this AGPL package.
* Calendar expansion from calendar versions belongs to core. Planning gets availability through `CoreApiModule.availability(...)`, and the board gets it through an availability query ([ADR 0025](0025-plant-calendars-shift-patterns-and-the-production-day.md)). The domain functions receive availability as UTC millisecond windows.
* Input and output of any kind: no database, no clock, no environment, no Nest.

### Rules

* The package imports no `@nestjs/*`, `pg` or `kysely` and reads no `process.env`. It throws or returns domain errors, never Nest exceptions.
* `now` and the plant time zone are arguments. Nothing inside reads the clock or uses randomness.
* Comparators compare code units and end on the id; `localeCompare` and `Intl.Collator` are banned here ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* Other modules reach scheduling results through `PlanningApiModule`, never by importing this package. Plugins import only MIT packages ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)), so they cannot import it either.
* One path, `modules/planning/domain`, appears in the task template, the Vitest coverage include and the scheduling coverage threshold, the Biome domain override, `scripts/handoff/tests-changed.mjs` and `.coderabbit.yaml`.

### Order of work

This ADR is on the list of decisions due at M0 (2026-10-30), and it is decided before E03 is shaped. E03 has no platform dependency, so its domain work runs beside E02, the foundation epic. The first E03 runs start only when this path is decided, the Vitest projects and the source exports work ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)), and the E02 foundation pull request has settled the root configs (or all root-config changes land in one session pull request before the first E03 run starts). The synthetic cases TC1 to TC16 in [07-production-planning.md](../plan/07-production-planning.md) are the first failing tests.

### Consequences

* Good, because the board preview and the server compute durations, snaps and lock verdicts with the same code.
* Good, because domain tests run in the unit project with no container, and the scheduling coverage gate has exactly one folder to measure.
* Good, because the tests-changed check, the coverage gate and CodeRabbit's domain rules all see a change under the same path.
* Bad, because the planning module carries a fourth package with its own `package.json`, exports map and TypeScript project reference.
* Bad, because the planning remote bundles the package (it is not a federation share), and no plugin remote can reuse the rules.
* Neutral, because the package is AGPL like the rest of planning; an MIT extraction waits until someone needs it.

### Confirmation

* `modules/planning/domain/domain-imports.test.ts` fails on an import of `@nestjs/*`, `pg` or `kysely`, on a read of `process.env`, and on `localeCompare` or `Intl.Collator` in the package. A Biome `noRestrictedImports` override on `modules/planning/domain/**` reports the same imports in the editor.
* `test/meta/domain-path.test.ts` (name proposed) asserts that the task template in [13-delivery-and-github.md](../plan/13-delivery-and-github.md), `vitest.config.ts` (coverage include and threshold), `biome.json`, `scripts/handoff/tests-changed.mjs` and `.coderabbit.yaml` name `modules/planning/domain`. It also reads every workspace `package.json` and fails when a package other than `@northmes/module-planning` and `@northmes/planning-web` depends on `@northmes/planning-domain`.
* The MIT license check fails when an MIT package imports `@northmes/planning-domain` or a `modules/` path ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)).
* `test/meta/collection.test.ts` places every `*.test.ts` under `modules/planning/domain` in the unit project ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).
* The coverage threshold on `modules/planning/domain/**` runs in the UTC leg; the task that adds the gate sets its value.
* The domain suites also run in the native-Temporal and forced-polyfill Vitest projects ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).

## Pros and cons of the options

### `@northmes/planning-domain` in `modules/planning/domain`

* Good, because server and web import a package with no server dependencies.
* Good, because the rules stay in the planning module folder, which keeps ownership visible and makes a cross-module import stand out in review.
* Neutral, because `textColorFor` and the generic time functions must move to `@northmes/contracts`.
* Bad, because it is an exception to the three-package module shape.

### `packages/scheduling`

* Good, because one design note already described a shared scheduling package used by client and server.
* Bad, because every package under `packages/` today is an MIT building block that any module may import; a scheduling package there invites imports from other modules, against the rule that domain logic is never shared by import.
* Bad, because the license rules would need an exception for one AGPL package in that folder.
* Bad, because planning changes would span two top-level folders.

### `modules/planning/server/domain`

* Good, because it matches the `server/domain/` folder other modules use for their own pure rules.
* Bad, because the planning web remote cannot import from the server package cleanly, so the board would need its own copy of duration and snapping rules, which can drift from the server.
* Bad, because the coverage gate and the import ban would cover a folder inside a package that also holds Nest code.

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md), [0003](0003-module-package-shape-and-the-definemodule-manifest.md), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0025](0025-plant-calendars-shift-patterns-and-the-production-day.md), [0027](0027-planned-duration-formula-and-override-precedence.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md), [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md), [0030](0030-a-planning-board-built-in-house.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md), [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).
* Plan: [07-production-planning.md](../plan/07-production-planning.md#module-boundaries) (boundaries and the domain unit tests), [03-modules-and-extensibility.md](../plan/03-modules-and-extensibility.md#package-shape), [11-quality-and-testing.md](../plan/11-quality-and-testing.md#lints-and-meta-tests), [16-open-questions.md](../plan/16-open-questions.md) (M-02), [14-roadmap.md](../plan/14-roadmap.md).
* Background: internal research notes 05, 16, 17, 20, 32 and 33.
* Revisit when a second module needs a scheduling rule (the rule then becomes a call on `PlanningApiModule`, not an import), when a solver plugin behind the `Scheduler` port needs the domain types, or when a plugin author asks for the rules in an MIT package.
