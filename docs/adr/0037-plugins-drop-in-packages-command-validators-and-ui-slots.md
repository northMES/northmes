---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 08, 14, 19, 20, 32 and 33
informed: plugin authors, pilot IT, contributors and coding agents
release: "1"
needs-confirmation: "maintainer (no third-party plugin on the pilot; web-only plugins degrade); product owner (unpaid-invoice validator)"
---

# Plugins: drop-in packages, command validators and UI slots

## Context and problem statement

NorthMES is meant to be extended by plugins: code that is not part of a core release but runs in the same server process and the same page. The original brief described a full plugin system: a public SDK, an app repository that rebuilds the image, component overrides, codemods and upgrade tooling. A review of comparable platforms found that one developer cannot build and hold that stable before the pilot (internal research note 08). Krister Johansson decided that release 1 ships the internal `defineModule` contract plus two example plugins, a backend command validator and a frontend widget, and that the public npm SDK, the app repository and the upgrade tooling come after the pilot.

An integration spike installed two built plugins into a running image without rebuilding core (internal research note 20). The stress test then found four gaps: a validator that reads a reshaped input field passes everything, a removed slot fails the whole boot, plugin files were not part of what a rollback restores, and the example plugins sat outside the workspace with their own lockfiles (internal research note 32).

This ADR decides how a plugin is installed, which packages the host provides, how command validators and UI slots work, what the example plugins prove and what waits. The manifest shape is in [ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md), versions and ranges in [ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), licenses in [ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) and [ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md).

## Decision drivers

* Krister Johansson's decision: the internal contract and two examples in release 1; the public SDK and its tooling after the pilot.
* The official image stays unchanged and signed; adding a plugin never rebuilds core.
* One copy of Nest, `graphql` and the SDK per process, and one copy of each shared web singleton per page.
* A plugin with server code must never be skipped silently, because a skipped validator removes a business rule.
* An owner can change its command inputs and screens without breaking validators and widgets unnoticed.
* CI exercises the real plugin path, including an install from outside the repository.
* Every extension point is accessible (WCAG 2.2 AA, [ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)).

## Considered options

* Drop-in packages loaded at boot into the official image, with veto-only command validators and versioned UI slots
* Build-time install: an app repository lists plugins, a generator wires them, and the image is rebuilt
* Install into a running server without a restart
* The full public plugin system in release 1
* Command interceptors that may also change the command input

## Decision outcome

Chosen option: "Drop-in packages loaded at boot into the official image, with veto-only command validators and versioned UI slots", because the spike ran it end to end, it needs no generator and no rebuild, and it keeps release 1 to the internal contract Krister decided.

### Install

* Build the plugin package, place it in `plugins/<id>/` or a layer of a site image, list it in `northmes.config.json`, run `northmes migrate`, restart. Enabling or removing a plugin always means a restart, because Nest cannot add resolver modules after the schema is built.
* Package contents: `package.json` with `exports["./manifest"]` and a peer dependency on `@northmes/sdk`; `dist/manifest.js`; `dist/server.js` with host-provided packages external and everything else bundled; `migrations/*.sql` for its own schema only; `web/dist/` with the remote.
* The SDK exports `HOST_PROVIDED`: `@nestjs/*`, `@nestjs/graphql`, `@apollo/subgraph`, `graphql`, `reflect-metadata`, `rxjs`, `zod`, `@northmes/sdk` and `temporal-polyfill`. At boot the host installs a `module.registerHooks` resolve hook that maps these specifiers, imported from any plugin root, to the host's copy. A plugin that needs another version of one of them, a new shared web singleton or a native addon for another platform needs a new image.
* Each plugin migrates as its own NOLOGIN owner role and owns only its schema. A foreign key into another module exists only where the owner grants `references` to `nm_ext`, with `ON DELETE CASCADE` or `SET NULL` per the owner's grant policy. A removed plugin leaves its schema, and System health lists it.
* For the pilot the supported path is a site image `FROM ghcr.io/northmes/northmes:<v>` with `COPY plugins/` and the config, tagged per upgrade, so a rollback returns to the previous site image ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)).
* No third-party plugin runs on the pilot installation (the maintainer confirms). Plugins run with full access in the process and in the page, and the docs and `SECURITY.md` say so.
* Release 1 knows only "installed". Per-organization enablement waits for an installation with more than one company.

| Situation | Result |
|---|---|
| a plugin with a server part fails to load, has an invalid manifest or fails composition | boot stops and names the plugin |
| a web-only plugin (no server part, no migrations) contributes to a slot that no longer exists | status `incompatible`, boot continues (the maintainer confirms) |
| a validator throws or exceeds its time limit | that command is rejected; everything else works |
| a plugin's remote files are missing or its manifest hash differs | the module list marks it, and the shell shows a placeholder |

### Command validators

The brief's "command interceptors" are renamed, because Nest already uses "interceptor".

* Veto only: a validator cannot change the input. It attaches only to a command its owner declares `validatable`, and only from a module whose `dependsOn` includes the owner; both are boot errors otherwise.
* Validators run inside the command transaction after the permission check, the audit context and the `expectedVersion` check, in dependency order and then by name ([ADR 0012](0012-commands-as-the-single-write-path.md)).
* Each has a time limit. A throw or a timeout rejects the command (fail closed), and a throw reaches the client masked as "Unexpected error.". A veto returns `core.command_rejected` with `rejectedBy`.
* The owner builds a validator payload for each validatable command and declares its Zod schema in its MIT contracts package (for example `productionOrderId`, `plantId`, `articleId`, `quantity` and the demand's customer references). `CommandValidator` takes the schema from the contracts copy the plugin bundled; the bus parses the payload before it calls the validator and rejects with `core.validator_contract_mismatch` on failure.
* Release 1 validatable commands are planner commands: `planning.releaseProductionOrder` and `planning.commitScheduleChanges`. Fact commands at the station are not validatable ([ADR 0033](0033-online-operator-station-in-the-production-start-module.md)).
* A plugin database API, an SDK jobs API with a system principal and invoice data wait for a pilot need. Whether a validator that blocks releases for customers with unpaid invoices is wanted at all is open for the product owner; it is not built.

### UI slots

* Cross-module UI goes only through slots that the rendering module owns. A contributor must depend on the owner; the boot catalog and the shell both check this.
* Slot ids are typed and versioned: owner id first, version last, for example `planning/board/side/v1`. Slot prop types live in `@northmes/web-sdk` in release 1 under one contract key name.
* A contribution carries an id, the slot id, a component, a required `label`, a numeric `order` and a permission. `validateWebModule` rejects a missing label. `<Slot>` renders each contribution in `WidgetFrame` as a section with `aria-labelledby`, inside its own error boundary.
* No slot renders a widget (`WidgetFrame` and error boundary) per board block or per row. The one exception is `planning/board/block-fields/v1`, whose contributions are synchronous text and icon renderers with `accessibleText`; hover renderers may fetch. Other per-item slots render only for the selected item.
* Changing a slot's props means adding `v2` and keeping `v1` for one deprecation window. A CI check fails when a slot id from the previous release's snapshot disappears.
* Release 1 slots: `planning/board/side/v1` (the example widget), `planning/order/panels/v1` (production-start), `planning/board/block-fields/v1` (fields on every board block, filled by core, the Pyramid connector and plugins through `BoardFieldSlot`), `planning/board/header/v1` (the board header, where the Pyramid connector shows "Pyramid data as of <time>") and one shell aside slot for the AI chat panel. The ids of the two board slots are proposed; the maintainer confirms them.

### The example plugins

| | `example-validator` (`examples/plugin-validator`) | `example-widget` (`examples/plugin-widget`) |
|---|---|---|
| Parts | manifest and server part | manifest and web remote only |
| Proves | a veto of `planning.releaseProductionOrder` with `rejectedBy: "example-validator"`; a nullable field on planning's `ProductionOrder` through `@requires`; an offline composition check | a contribution to `planning/board/side/v1` with its own query and a prefixed stylesheet |

* Both are workspace members with the host packages as `peerDependencies` plus catalog `devDependencies`. `pnpm plugin:build <id>` builds them (Rolldown with `HOST_PROVIDED` externals, `@northmes/web-build` for the remote) and `pnpm plugin:check <id>` composes the plugin's SDL against the committed snapshot. Neither is ever imported as workspace source.
* CI boots the `all` process with both loaded from `plugins/`. Tests that load built plugins boot the built server in a child process; `createTestApp` takes in-repo modules only, because Vitest's module runner does not apply the resolve hook.
* The validator plugin is part of the walking skeleton's exit. The widget plugin, `plugin check` and building a remote from outside the workspace move to milestone M2 ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)).

### What waits until after the pilot

The public npm SDK and `create-northmes-plugin`; the app repository, the builder image, `northmes upgrade`, codemods and override tracking; component overrides (none before 1.0); `@public` API tags; per-organization enablement; a plugin database API and a jobs API; MIT service interfaces for in-process calls into core; `northmes plugin purge <id>`.

### Consequences

* Good, because a plugin installs into the signed official image with no generator, and a rollback returns to the previous site image tag.
* Good, because the example plugins go through the same build, catalog checks and composition as a third-party plugin would, on every pull request.
* Good, because validators see a declared contract, so an owner's input change fails loudly instead of letting every command pass.
* Bad, because every plugin change needs a restart, and a broken server plugin stops the boot by design.
* Bad, because plugins run with full trust in the process and the page; there is no sandbox.
* Bad, because shared host packages and web singletons are API in practice: a major upgrade of one of them can break plugins.
* Neutral, because release 1 has no outside plugin authors, so the contract can still change in 0.x.

### Confirmation

* `catalog.test.ts`: a validator on a command not declared validatable, a validator from a module without `dependsOn` on the owner, and a slot contribution outside the `dependsOn` closure each exit 1 with a named message; several problems are listed together.
* Command bus unit test: input `{ quantity: { value: 1500, unit: "pcs" } }` against a payload schema `z.object({ quantity: z.number() })` is rejected with `core.validator_contract_mismatch`, and the handler spy is not called. A contract test validates planning's built payload against its MIT schema.
* Validator limit tests: a validator slower than its limit rejects the command; a throwing validator is masked and the handler does not run.
* Slot tests: a contribution without a label fails `validateWebModule`; with label "Large orders" a region with that name holds a heading; a web-only widget on a removed slot gets `incompatible` and boot succeeds; a server plugin on an unknown slot still fails boot.
* Lockfile test: `pnpm-lock.yaml` holds one `@nestjs/core` and one `@nestjs/graphql` resolution, each with a single peer suffix, examples included.
* Plugin migration tests on Testcontainers Postgres: a plugin's `ALTER TABLE` on a core table, a `CREATE TABLE ... AS SELECT` from planning and a `CREATE TABLE` in the core schema are refused and change nothing. `migrate-guards.test.ts`: a module migration that would drop a plugin's foreign key raises an error naming the key.
* `plugin-outside` CI job: packs the MIT packages, installs an example from those tarballs in a directory outside the repository, builds it, drops it into a plugins directory, boots and runs the example e2e spec, which asserts the validator veto and the widget inside its slot.
* Slot id check in CI against the previous release's snapshot; the accessibility route suite runs with the example plugins enabled.
* Nightly Compose test with `example-validator` in a site image: `northmes migrate` applies its migration and `app` reaches ready.

## Pros and cons of the options

### Drop-in packages loaded at boot

* Good, because the spike installed and removed both examples with the shell build and the planning remote unchanged.
* Bad, because it needs the resolve hook on Node, which ties the Node version to a tested hook ([ADR 0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md)).

### Build-time install through an app repository

* Good, because a plugin is compiled together with core, so type errors show at build.
* Bad, because every customer rebuilds the image, needs a builder image and generated route shims, and the official signed image is no longer what runs.

### Install into a running server

* Good, because no restart is needed.
* Bad, because Nest cannot add resolver modules after the schema is built, so the backend cannot do it.

### The full public plugin system in release 1

* Good, because outside authors could start now.
* Bad, because it adds work the pilot does not need, for outside authors who do not exist before the pilot, and its public API would freeze while the contract is still moving.

### Interceptors that may change the input

* Good, because a plugin could fill in derived values.
* Bad, because input changes by several handlers need ordering rules, which caused conflicts in other platforms; veto-only needs no such rules.

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md), [0003](0003-module-package-shape-and-the-definemodule-manifest.md), [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md), [0012](0012-commands-as-the-single-write-path.md), [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md), [0019](0019-web-shell-with-react-module-federation-remotes.md), [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), [0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md), [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).
* Plan: [03-modules-and-extensibility.md](../plan/03-modules-and-extensibility.md#plugins), [06-web-and-ux.md](../plan/06-web-and-ux.md), [16-open-questions.md](../plan/16-open-questions.md) (M-13, M-41, PO-06).
* Open: whether the example validator drops its unused rejection table or the docs say plugin tables need the later database API; the maintainer's confirmation of the slot ids `planning/board/block-fields/v1` and `planning/board/header/v1`.
* Revisit when a pilot customer or partner wants to write a plugin, when a second company shares an installation, and before the public SDK is published.
