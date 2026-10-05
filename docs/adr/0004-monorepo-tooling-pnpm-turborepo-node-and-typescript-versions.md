---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 03, 11, 13, 14, 17, 20, 25, 28 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (Node pin after the week-1 test; TypeScript 6.0.x)"
---

# Monorepo tooling: pnpm, Turborepo, Node and TypeScript versions

## Context and problem statement

One monorepo holds every NorthMES module with its services and its frontend ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)). Coding agents build in fresh worktrees and run the same commands as CI, so the toolchain must install the same way every time and fail early when a worker runs the wrong runtime.

Three facts force choices here. All spikes ran on Node 24.18.1, and the plugin loader depends on `module.registerHooks`, which has been a release candidate API (stability 1.2) since Node 24.13.1. Node 24 enters maintenance on 2026-10-20 and has Temporal only behind `--harmony-temporal`, while Node 26 enables Temporal by default and becomes active LTS on 2026-10-28 (internal research note 11). TypeScript 7.0.2, the native compiler, is the npm `latest`, while the spike backend ran TypeScript 5.9.3, which has no Temporal lib (internal research notes 14 and 32).

This ADR decides the package manager, the task runner, the linter, the TypeScript version and the Node runtime for every workspace package and the production image. The developer environment scripts are in [ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).

## Decision drivers

* Plugin loading relies on `module.registerHooks`, so the runtime must pass the resolve-hook and host-provided boot tests.
* Time handling uses Temporal on server and browser ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* The pilot runs into 2027 and later, so the runtime should be in active LTS, not maintenance.
* One TypeScript version must compile Nest decorators with metadata, the web remotes and the SDK declarations, and work with the doc and API tools.
* A fresh worktree must install with `pnpm install --frozen-lockfile` and give GitHub's dependency graph a readable lockfile.

## Considered options

* pnpm, Turborepo, Biome and TypeScript 6.0.x, on Node 26 LTS in a Debian-based image, gated by a week-1 test with Node 24 LTS as the recorded fallback
* The same toolchain on Node 24 LTS from the start
* Node 26 on the Alpine image
* TypeScript 7 (the native compiler) instead of 6.0.x

## Decision outcome

Chosen option: "pnpm, Turborepo, Biome and TypeScript 6.0.x, on Node 26 LTS in a Debian-based image, gated by a week-1 test", because Node 26 gives native Temporal and active LTS through the pilot, the gate keeps the plugin resolve hook safe, and TypeScript 6.0.x is the newest version that `@nestjs/graphql` and the doc tools accept.

### Workspace

* pnpm workspaces. `packageManager` names the exact pnpm version. `pnpm-workspace.yaml` sets `pmOnFail: ignore`, which keeps `pnpm-lock.yaml` one YAML document; with two documents GitHub's dependency graph read zero dependencies (internal research note 25).
* `pnpm-workspace.yaml` does not allow `cpu-features`, `protobufjs` and `ssh2` to run build scripts. These are native dependencies of Testcontainers, and without that setting pnpm 12 failed a frozen install in another project (internal research note 28).
* A strict catalog: dependencies that several packages use are declared once in the pnpm catalog with `catalogMode: strict` and referenced as `catalog:`.
* Every workspace package sets its `license` field, because the license gate picks its policy from it ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)).
* Turborepo caches `build`, `typecheck` and `lint`. Tests run outside Turborepo from one root Vitest config with projects, because the integration project owns exactly one Postgres container per run ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).
* Biome 2.5 with one root `biome.json`. Nested configs set `"root": false` and `"extends": "//"`.

### TypeScript

* One TypeScript 6.0.x, pinned in the pnpm catalog, for server, web and SDK. TypeScript 7 is not used.
* `@nestjs/graphql` 14.0.3 accepts `^5.5 || ^6`. Decorator metadata on 6.0 is verified by the `design:paramtypes` guard test, which fails when a provider parameter's metadata is `Object` and it has no `@Inject` token.
* The SDK's entry `.d.ts` carries `/// <reference lib="esnext.temporal" />`, and the API Extractor rollup keeps it. TypeScript 6.0 is the documented minimum for plugin authors.

### Node

* The runtime is Node 26 LTS on a Debian-based Node image pinned by digest. Alpine is not used.
* In week 1 of the build (from 2026-10-15) these run on the `node:26` Debian image: the four host-provided boot tests, the `module.registerHooks` resolve-hook test, the time zone suite, and the Temporal benchmarks of the time zone spike in `docs/sources/tz-spike/`, whose file paths and measurements `docs/sources/README.md` lists.
* If they fail, Node 24 LTS (24.13.1 or later) is pinned instead, and this ADR records the failure and the reason.
* `.node-version` and `.nvmrc` both name the pinned version, because nvm does not read `.node-version`.
* The Vitest global setup and the start of `pnpm check` assert the Node major. `runtime.test.ts` asserts the Node major and that `module.registerHooks` is a function.
* The repository adopts `devEngines.runtime` only after a check that `pnpm-lock.yaml` stays one YAML document and that handoff's Tester actually runs the pinned Node.

### Consequences

* Good, because Node 26 runs Temporal natively, and the polyfill stays only as a fallback ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* Good, because the Debian image matches the database image ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)) and avoids musl and ICU differences.
* Good, because a strict catalog gives every package the same version of a shared dependency, which the singleton rules of the web remotes need.
* Bad, because no spike has run on Node 26 yet, so the pin waits for the week-1 test and the maintainer's confirmation before M0 (2026-10-30).
* Bad, because Node 26 builds without Rust ship without Temporal: the official `node:26-alpine` image (docker-node issue #2486, fixed by a pull request merged on 2026-05-19; whether current tags are fixed is not verified) and the Homebrew arm64 bottle. Developer machines need a Node 26 build with Temporal, and the boot log states whether Temporal is native or the polyfill.
* Bad, because TypeScript 7 is already the npm `latest`, and a later move to it needs the doc and API tools on the TypeScript 6 API.

### Confirmation

* `runtime.test.ts` asserts the Node major from `.node-version` and that `module.registerHooks` is a function. It runs in `pnpm check` and in `ci / gate`.
* The resolve-hook test is required in `ci / gate` from M1 ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)), and the four host-provided boot tests run in the integration project.
* A catalog check asserts that every workspace package resolves `typescript` to 6.0.x.
* A CI job compiles `examples/plugin-validator` with `lib: ["es2024"]` against the packed SDK tarball, which proves that the Temporal lib reference reaches plugin authors.
* The `design:paramtypes` guard test walks all providers and fails on an `Object` entry without an `@Inject` token.
* `test/meta/lockfile.test.ts` asserts that `pnpm-lock.yaml` is one YAML document.
* The license gate fails on a workspace package without a `license` field.
* `ci / lint` runs `biome ci` from the root config.
* The planning session records the week-1 result (pass, or the named failures) in this ADR before it moves to `accepted`.

## Pros and cons of the options

### Node 26 LTS on Debian, gated, with TypeScript 6.0.x

* Good, because Temporal is enabled by default in Node 26 (26.0.0, 2026-05-05), and Node 26 is in LTS until 2029-04-30.
* Good, because the gate tests the exact APIs the plugin loader and the time code depend on.
* Bad, because the decision is not final until the week-1 test passes.

### Node 24 LTS from the start

* Good, because every spike ran on Node 24.18.1, so the resolve hook and the boot tests are proven there.
* Bad, because Node 24 enters maintenance on 2026-10-20 and ends on 2028-04-30.
* Bad, because Temporal needs `--harmony-temporal`, which V8 marks experimental, and the only native measurement so far took 9.8 s for calls that took 0.37 s on the polyfill (internal research note 32).

### Node 26 on Alpine

* Good, because the dependency license audit named an Alpine Node image as one possible base (internal research note 13).
* Bad, because the official Alpine Node 26 image shipped without Temporal, and musl and ICU differ from the Debian database image.

### TypeScript 7

* Good, because the native compiler is the current npm `latest` release.
* Bad, because TypeDoc's peer range stops at TypeScript 6.0.x and API Extractor bundles TypeScript 5.9.3, so the doc and API tools would need `@typescript/typescript6` (internal research note 14).
* Bad, because `@nestjs/graphql` 14.0.3 declares `^5.5 || ^6`.

## More information

* Related ADRs: [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) Temporal and the boot guard, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) the resolve hook and host-provided packages, [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) API Extractor reports, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) license gate, [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) Vitest projects, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) Renovate and CI, [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) developer environment.
* Plan: [02 architecture](../plan/02-architecture.md) (repository layout, open items), [04 data and platform](../plan/04-data-and-platform.md), [13 delivery and GitHub](../plan/13-delivery-and-github.md), [16 open questions](../plan/16-open-questions.md).
* Node release schedule: https://github.com/nodejs/Release
* Node 26.0.0 release notes: https://nodejs.org/en/blog/release/v26.0.0
* pnpm catalogs: https://pnpm.io/catalogs
* Revisit after the week-1 test, when the next Node LTS line starts, or when `@nestjs/graphql`, TypeDoc and API Extractor support TypeScript 7.
