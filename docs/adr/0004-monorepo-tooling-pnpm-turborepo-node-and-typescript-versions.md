---
status: "proposed"
date: 2026-10-07
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 03, 11, 13, 14, 17, 20, 25, 28 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (TypeScript 6.0.x)"
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

The gate ran on 2026-10-07. Every gated test passed on the `node:26` image, so the pin is Node 26 ([Node 26 test (2026-10-07)](#node-26-test-2026-10-07)).

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
* The pin depends on a test on the `node:26` Debian image that runs the four host-provided boot tests, the `module.registerHooks` resolve-hook test, the time zone suite, and the Temporal benchmarks of the time zone spike in `docs/sources/tz-spike/`, whose file paths and measurements `docs/sources/README.md` lists. The rule: Node 26 if every test passes; otherwise Node 24 LTS (24.13.1 or later), and this ADR records the failure and the reason.
* The test ran on 2026-10-07, ahead of week 1, and every gated test passed, so the pin is Node 26. `.node-version` and `.nvmrc` stay on `26`.
* `.node-version` and `.nvmrc` both name the pinned version, because nvm does not read `.node-version`.
* The Vitest global setup and the start of `pnpm check` assert the Node major. `runtime.test.ts` asserts the Node major and that `module.registerHooks` is a function.
* The repository adopts `devEngines.runtime` only after a check that `pnpm-lock.yaml` stays one YAML document and that handoff's Tester actually runs the pinned Node.

### Node 26 test (2026-10-07)

Task E01-S05-T01 ran the gated tests on 2026-10-07. The spike folders were copied out of the repository and installed inside containers of the official Docker Hub images, as `docs/sources/README.md` describes. The copied `pnpm-workspace.yaml` of the integration spike holds placeholders under `allowBuilds`, and the test set all four entries to `false`. The same install and build then ran on Node 24 for comparison. The machine was an Apple M4 with Docker 28.5.1 on Docker Desktop (linux/arm64, a VM with 10 CPUs and 8.2 GB of memory), so the tests ran the linux/arm64 platform image of the `node:26` index. The table below gives the index digest (`node@sha256:9965105b7a4e201d7f07268402bb4971670592b46c9b9058cc643961199a1ab6`); the linux/arm64 platform manifest inside that index has the digest `sha256:7ca987b3557ad96124ee9d44e9530cddd4dd15043abc226185d6f4088b93eefb`.

A second run on the same day checked the first. It installed a fresh copy of the sources in the same `node:26` image (the same index digest and the same linux/arm64 platform digest) and ran `boot.test.mjs` again (11 of 11 passed). It also ran a separate resolve-hook probe with ESM and CommonJS packages on `node:26` and `node:24`, ran `tzlab/tc.mjs`, which the first run had left out, and measured `temporal-cost2.mjs` on the polyfill on Node 26 (see the notes under the benchmark table).

| Image | Index digest | Node | Debian | V8 | ICU | tz data |
|---|---|---|---|---|---|---|
| `node:26` | `node@sha256:9965105b7a4e201d7f07268402bb4971670592b46c9b9058cc643961199a1ab6` | 26.10.0 | 13 (trixie) | 14.6.202.34 | 78.3 | 2026c |
| `node:24`, for comparison | `node@sha256:fdddfb3e688158251943d52eba361de991548f6814007acba4917ae6b512d6be` | 24.18.0 | 12 (bookworm) | 13.6.233.17 | 78.3 | 2026b |
| `node:24-slim`, one tz data check | `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` | 24.21.0 | 12 (bookworm) | 13.6.233.17 | 78.3 | 2026c |

`t2.mjs`, `t6.mjs` and `tc.mjs` ran against `postgres:18` (`postgres@sha256:8ff36f3c66371cba71d20ceedccfc3de9669a68737607888c4ef0af93abe8e39`, PostgreSQL 18.4). `tc.mjs` starts its own container through Testcontainers, so the second run gave the Node container the Docker socket and turned off Ryuk, which would otherwise pull an image of its own. The boot tests need no database. On Node 26.10.0, `Temporal` is a global without flags and `module.registerHooks` is a function. On Node 24.18.0, `Temporal` exists only with `--harmony-temporal`.

The boot tests are in `spike-integration/apps/server/test/boot.test.mjs` (Vitest). A boot test passes when Vitest reports it passed. The time zone scripts print results, and only `props.mjs` asserts, so a script passes when it exits 0 and its output matches the output of the other runs, apart from the differences listed after the table.

| Test | Node 26.10.0 | Node 24.18.0 |
|---|---|---|
| host-provided packages > plugin that bundles Nest, graphql and the SDK fails at boot | pass | pass |
| host-provided packages > plugin shipping its own node_modules copy of Nest fails without the resolve hook | pass | pass |
| host-provided packages > the same plugin boots when the hook maps host packages for every plugin root | pass | pass |
| host-provided packages > plugin outside the host tree needs the hook | pass | pass |
| role all with a drop-in plugin built outside the workspace (the clean plugin boot, 4 tests) | pass | pass |
| The other 3 tests of `boot.test.mjs` (validator time limit, throwing validator, module isolation) | pass | pass |
| `catalog.test.mjs` (9 tests) | pass | pass |
| Resolve-hook probe: `module.registerHooks` is a function | pass | pass |
| Resolve-hook probe: without the hook, a plugin outside the host tree cannot resolve the host package, and a plugin with its own copy gets that copy | pass | pass |
| Resolve-hook probe: with the hook, both plugins get the host's copy, the same module instance | pass | pass |
| Resolve-hook probe: `deregister()` removes the hook | pass | pass |
| Resolve-hook probe, extra check: the hook also applies to `require()` from a plugin root | fail | fail |
| `tzlab/dst.mjs`, `clamp.mjs`, `cases.mjs`, `cases2.mjs`, `misc.mjs` and `props.mjs` (5 000 fast-check cases) | pass | pass |
| `s03-dst/t1.mjs`, `t2.mjs`, `t3.mjs`, `t4.mjs` and `t6.mjs` | pass | pass |
| `tzlab/tc.mjs` (second run) | pass | pass |
| `dst`, `clamp`, `cases`, `cases2`, `misc`, `t4` and `t6` with native Temporal in place of `temporal-polyfill` (Node 24 with `--harmony-temporal`) | pass, output byte-identical to the polyfill run | fail: `dst`, `clamp`, `cases2`, `misc` and `t4` exit 1 with `getTimeZoneTransition is not a function`; `cases` passes; `t6` not run |

* The spike has no separate resolve-hook test file. `apps/server/src/plugin-resolution.ts` calls `module.registerHooks`, and the last three host-provided tests exercise that hook. The probe repeats the hook's shape on a two-package fixture to check the API directly.
* The `require()` check is outside the gated tests and fails the same way on both versions. The hook runs for `require()`, but passing another `parentURL` to `nextResolve` does not change the file that `require()` loads. On Node 26.10.0 and Node 24.18.0, the second run's probe found that a CommonJS file in a plugin with its own copy keeps that copy, and that a CommonJS file in a plugin outside the host tree fails with `MODULE_NOT_FOUND`. An `import` from a plugin root gets the host's copy, also of a CommonJS package. A hook that resolves the specifier from the host and returns that URL with `shortCircuit: true` gave the host's copy to `require()` and to `import` on both versions. The spike's plugins load through ESM `import`. This matters for the plugin loader port in E02-S04-T09 ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)).
* `misc.mjs` differs between the versions only in the Africa/Casablanca lines, because Node 24.18.0 carries tz data 2026b and Node 26.10.0 carries 2026c. `node:24-slim` (Node 24.21.0, tz data 2026c) prints the same output as Node 26.
* `t3.mjs` mixes native and polyfill objects. On Node 26 the polyfill accepts a native `PlainDate` in `compare` and `equals`. On Node 24 with `--harmony-temporal` those calls throw "Invalid Calendar: iso8601". The polyfill's `ZonedDateTime.from` with a native `ZonedDateTime` throws on both versions ("Missing timeZone" on Node 26).
* In `t1.mjs`, every DST resolution line of Node 26 with native Temporal equals Node 24 on the polyfill. Only error message text and the fi-FI hour padding ("2.30" native, "02.30" polyfill) differ.
* `tc.mjs` printed the same output on both versions. With the server zone `Pacific/Chatham`, a `::date` cast of 2026-10-25 23:30 UTC gives 2026-10-26, and after `SET TIME ZONE 'UTC'` it gives 2026-10-25.
* Not run: `s03-dst/rv-wry.mjs`, which does not resolve in this layout, as `docs/sources/README.md` says, and the `tzlab/b/` bundle-size probes, which do no timing.
* `s03-dst/tscheck` is a TypeScript check, not a runtime test. With TypeScript 6.0.3 it fails as copied (TS2304 "Cannot find name 'Temporal'") and passes once the SDK declaration starts with `/// <reference lib="esnext.temporal" />`, as the TypeScript section above requires.

Each benchmark figure is the median of three runs on the machine above. The Node 26 polyfill runs use `--no-harmony-temporal`, which removes the global. The Node 26 polyfill figures of `temporal-cost2.mjs` come from the second run; every other figure comes from the first. The last column holds the spike's Node 24 figures from internal research note 32, as `docs/sources/README.md` lists them.

| Benchmark and measure | Node 26 native | Node 26 polyfill | Node 24 polyfill | Node 24 `--harmony-temporal` | Spike, Node 24 |
|---|---|---|---|---|---|
| `t5.mjs`, 10 000 `Instant.from` | 2.1 ms | 34.2 ms | 35.5 ms | 2.3 ms | not recorded |
| `t5.mjs`, 10 000 `toZonedDateTimeISO` | 4.3 ms | 45.3 ms | 45.0 ms | 605.6 ms | not recorded |
| `t5.mjs`, 10 000 `.offset` reads | 0.7 ms | 13.2 ms | 11.8 ms | 539.7 ms | not recorded |
| `t5.mjs`, 10 000 `Intl.DateTimeFormat.format` of an `Instant` | 67.9 ms | 5.9 ms | 6.4 ms | 74.6 ms | not recorded |
| `t5.mjs`, 10 000 `format` of epoch milliseconds | 4.0 ms | 5.6 ms | 5.2 ms | 3.7 ms | not recorded |
| `t5.mjs`, 10 000 `Date.parse` | 0.9 ms | 0.8 ms | 1.2 ms | 1.3 ms | not recorded |
| `t7.mjs`, 40 320 `resolveWallClock` calls | 50 ms | 332 ms | 349 ms | 6 804 ms | 9.8 s native, 0.37 s polyfill |
| `temporal-cost.mjs`, 32 000 conversions in total | 29.5 ms | native only | native only | 3 641.9 ms | 3.95 s |
| `temporal-cost.mjs`, per conversion | 0.92 µs | native only | native only | 113.81 µs | 121 to 123 µs |
| `temporal-cost2.mjs`, 32 000 conversions | 31.1 ms | 198.5 ms | 210.1 ms | 3 639.7 ms | not recorded |
| `temporal-cost2.mjs`, with the per-date cache | 0.6 ms | 4.5 ms | 4.9 ms | 90.7 ms | 94 to 149 ms |
| `temporal-cost3.mjs`, `toZonedDateTime` per operation | 0.5 µs | native only | native only | 113.2 µs | not recorded |
| `temporal-cost3.mjs`, `ZonedDateTime.add({ hours: 1 })` | 0.6 µs | native only | native only | 0.4 µs | not recorded |
| `temporal-cost3.mjs`, `PlainDate.from().add({ days: 1 })` | 0.7 µs | native only | native only | 1.0 µs | not recorded |
| `temporal-cost3.mjs`, `Intl` `longOffset` `formatToParts` | 1.4 µs | native only | native only | 1.2 µs | not recorded |

* In the zone conversion benchmarks, native Temporal on Node 26 is about 120 to 230 times faster than on Node 24 with `--harmony-temporal` (`temporal-cost.mjs` 0.92 µs against 113.81 µs per conversion, `temporal-cost3.mjs` 0.5 µs against 113.2 µs, `t7.mjs` 50 ms against 6 804 ms). It is also 6 to 19 times faster than the polyfill on Node 26 (`t7.mjs` 50 ms against 332 ms, `temporal-cost2.mjs` 31.1 ms against 198.5 ms).
* `temporal-cost2.mjs` imports the default entry of `temporal-polyfill` 1.0.5, which returns the global `Temporal` when one exists. Its row labelled "temporal-polyfill" therefore measures the polyfill only when no global exists (Node 26 with `--no-harmony-temporal`, Node 24 without a flag). With a global, both of its rows measure native Temporal, and the first run's figures for that row (30.0 ms on Node 26, 3 633.1 ms on Node 24 with the flag) are left out of the table.
* The spike's per-date cache figure of 94 to 149 ms is close to this run's Node 24 figure with the flag (90.7 ms).
* On Node 26, `Intl.DateTimeFormat.format` of a native `Temporal.Instant` takes 67.9 ms per 10 000 calls, about 17 times the 4.0 ms for the same instants as epoch milliseconds.
* `temporal-cost2.mjs` labels its native row "node24 --harmony-temporal" on every Node version. On Node 26 that row is native Temporal without a flag.

Result: every gated test passed on `node:26` (`node@sha256:9965105b7a4e201d7f07268402bb4971670592b46c9b9058cc643961199a1ab6`, Node 26.10.0), and the benchmarks ran. By the rule above, the pin is Node 26. The one failing check, `require()` through the resolve hook, is outside the gated tests and fails the same way on Node 24.18.0. This result settles the Node pin that the ADR needed before it moves to `accepted`.

### Consequences

* Good, because Node 26 runs Temporal natively, and the polyfill stays only as a fallback ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* Good, because the Debian image matches the database image ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)) and avoids musl and ICU differences.
* Good, because a strict catalog gives every package the same version of a shared dependency, which the singleton rules of the web remotes need.
* Bad, because the Node 26 test ran on one linux/arm64 machine. The linux/amd64 image behind the same index digest has not run these tests.
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

## Pros and cons of the options

### Node 26 LTS on Debian, gated, with TypeScript 6.0.x

* Good, because Temporal is enabled by default in Node 26 (26.0.0, 2026-05-05), and Node 26 is in LTS until 2029-04-30.
* Good, because the gate tests the exact APIs the plugin loader and the time code depend on.
* Good, because every gated test passed on `node:26` on 2026-10-07, and a native zone conversion took 0.92 µs there, against 113.81 µs on Node 24 with `--harmony-temporal` on the same machine.
* Bad, because `Intl.DateTimeFormat.format` of a native `Temporal.Instant` took 67.9 ms per 10 000 calls on Node 26, about 17 times the cost of formatting the same instants as epoch milliseconds.

### Node 24 LTS from the start

* Good, because every spike ran on Node 24.18.1, so the resolve hook and the boot tests are proven there.
* Bad, because Node 24 enters maintenance on 2026-10-20 and ends on 2028-04-30.
* Bad, because Temporal needs `--harmony-temporal`, which V8 marks experimental. Native `t7.mjs` took 9.8 s for calls that took 0.37 s on the polyfill in the spike (internal research note 32), and 6 804 ms against 349 ms in the test of 2026-10-07.
* Bad, because with `--harmony-temporal` on Node 24.18.0, five of the six time zone scripts run with native Temporal failed with `getTimeZoneTransition is not a function`.

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
* Revisit when the next Node LTS line starts, or when `@nestjs/graphql`, TypeDoc and API Extractor support TypeScript 7.
