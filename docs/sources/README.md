# Spike sources

This folder holds the reference code that epics E02 and E03 port: the spikes from the planning phase and five rule files from the earlier attempt at the product. It is reference input, not product code. A task that ports from here writes new code and tests under the NorthMES layout and does not import from this folder.

Nothing here is built, linted, type-checked or tested:

- `biome.json` excludes `docs/sources`.
- Every Vitest project in `vitest.config.ts` excludes `docs/sources/**`, and `test/meta/no-customer-data.test.ts` checks that.
- No root `tsconfig.json` includes this folder, and the package globs in `pnpm-workspace.yaml` do not reach it. The nested `package.json`, `pnpm-workspace.yaml`, `tsconfig.json` and Vitest config files belong to the copied projects only.

The customer-data lint (`pnpm lint:customer-data`, `scripts/lint/no-customer-data.mjs`) does cover this folder: it fails on the organisation number pattern in any tracked file and, when `NORTHMES_DENY_HASHES` holds the hashes of the deny list, on a deny-listed customer name under `docs/sources/` or a `fixtures/` folder.

## What was copied

Code, specs, configuration, SQL migrations and hand-written test fixtures. Left out: `node_modules`, lockfiles, build output, logs, process id files, captured test output, generated code (the federation spike's `out/` SDL exports and `__generated__` codegen output, and the bundle outputs in `tzlab/b/`), packed tarballs and benchmark result files. The integration spike's `schema-snapshot/` is generated SDL too, but stays because its plugin check compares against it. Without lockfiles, an install resolves transitive versions afresh; most direct versions are exact pins or catalog pins.

Sample data is synthetic. When the files were copied, values close to real planning data were replaced with invented ones: the order numbers in the spikes' seed rows, tests and order number generator, the shift times in the time zone spike, and the worked example, calendars and sample rows in the earlier attempt's specs. Printed results of the time zone scripts can therefore differ from the figures in the internal research notes.

To run a spike, copy its folder out of the repository and install it there, so the root workspace and gates stay out of it. The spikes ran on Node 24.

## spike-integration

The integration spike, which joined the federation and Module Federation results into one host. `apps/server` is a NestJS host that reads a boot config (`northmes.config.json` and the `config.*.json` variants), loads the modules `modules/core` and `modules/planning` and drop-in plugins, composes their GraphQL subgraphs in one process, runs per-module migrations with owner roles and serves the web module list. `apps/shell` is the web shell, `packages/sdk`, `packages/ui`, `packages/web-build` and `packages/web-sdk` are the SDK packages, and `examples/plugin-validator` and `examples/plugin-widget` are plugins built outside the workspace. ADRs 0002, 0003 and 0043 cite its results.

- `outside-plugins/example-validator` is a plugin package that lives outside the host tree. `apps/server/test/boot.test.mjs` and `apps/server/config.outside.json` expect it one level above the spike root, next to the `spike-integration` folder, so move it there before running the test "plugin outside the host tree needs the hook".
- `apps/server/test/fixtures/*/dist/` hold hand-written plugin modules, not build output. `.gitignore` re-includes them.
- The plugins in `apps/server/plugins/` ship without their `dist` folders. `examples/plugin-validator/build.mjs` writes them with `OUT_DIR` set to the target folder; `bundled-validator` also needs `BUNDLE_HOST=1`, which bundles Nest, graphql and the SDK into the plugin as a negative test. `example-widget` is built from `examples/plugin-widget`. `ownmods-validator` was installed on its own with npm, because its test needs the plugin's private copy of Nest.
- `schema-snapshot/*.graphql` is generated SDL that `examples/plugin-validator/plugin-check.mjs` compares against.
- License fields: the packages are MIT, the apps and modules AGPL-3.0-or-later, and the `@acme` plugins UNLICENSED on purpose, as the proprietary plugin case.

## spike-federation

The GraphQL federation spike. Nest code-first subgraphs per module (`src/modules`) are composed by an embedded Hive Gateway runtime in one process (`src/gateway`), with an HTTP subgraph mode for comparison. The tests cover boot and composition errors, composition rules, guards on fields reached through `_entities`, plant scoping, error masking, subscriptions over graphql-ws and a Postgres-backed query. ADR 0015 records the decision it informed.

- `bench.mjs` boots the app and reports latency percentiles and throughput for the planning subgraph alone (an in-process execute, or direct HTTP in the HTTP mode) and for three queries through the gateway. `bench-client.mjs` runs the same gateway queries from a separate process against a running server, and `bench-standalone.mjs` runs them against `standalone-gateway.mjs`, the gateway runtime in its own process. `s09-guard-cost.mjs` times a 5 000-row query, with the field resolver enhancers on or, with `SPIKE_NO_ENHANCERS=1`, off.
- `export-supergraph.mjs` writes the supergraph and API SDL files that `codegen-super.ts` and `codegen.ts` read; `sub.mjs` is a subscription client; `dbg.mjs`, `dbg2.mjs` and `dbg3.mjs` are debug probes.
- The scripts and tests import from `dist/`, so build with `tsc` first.
- "ADR-014 style" in `test/composition.test.mjs` refers to an earlier draft's numbering, not to NorthMES ADR 0014.
- The package is UNLICENSED because it was never published.

## spike-mf

The Module Federation spike. `apps/shell` is a Vite and React shell that loads module remotes at run time from the module list that `apps/server`, a small Nest server, serves under a Content-Security-Policy. `modules/planning/web` is a remote built with Vite, and with Rsbuild through `rsbuild.config.ts`; `modules/quality/web` is a second remote; `packages/ui`, `packages/web-build` and `packages/web-sdk` are the shared packages. `dev.mjs` starts the server, the shell and one dev server per remote. ADR 0019 cites the result. The plant id `plant-a` is a development seed value.

## tcspike

The Testcontainers spike. `spike.mjs` starts a Postgres container for each image named on the command line, creates the timescaledb extension, reads settings, checks for pgBackRest, then takes and restores a container snapshot. `spike2.mjs` starts timescaledb with its default background workers and with none, lists the other database sessions, then tries a snapshot and restore. The Postgres image decision is ADR 0005, and the Testcontainers harness is ADR 0041.

## tz-spike

The time zone spike, in three folders:

- `tzlab/`: DST cases, the interval engine (`engine.mjs`) and the clamp resolver (`engine2.mjs`), with bundle-size probes in `b/`.
- `s03-dst/`: the stress test of both DST nights, with the `t5` and `t7` benchmarks.
- `s08/`: three Temporal cost probes from the autoplan stress test. The rest of that stress test is not here.

Install in `tzlab/` and link `s03-dst/node_modules` to `../tzlab/node_modules`, as the spike did. `s03-dst/t4.mjs` imports `../tzlab/engine.mjs`, and `s08/temporal-cost2.mjs` imports `../tzlab/node_modules/temporal-polyfill/index.js`; both resolve in this layout. ADRs 0004 and 0024 build on the spike.

### Temporal benchmarks

Unless a row says otherwise, a benchmark uses native Temporal when the global exists (Node 26, or Node 24 with `--harmony-temporal`) and the `temporal-polyfill` shim otherwise.

| File | What it measures |
|---|---|
| `tz-spike/s03-dst/t5.mjs` | 10 000 ISO strings 517 s apart from 2026-10-19: `Instant.from`, `toZonedDateTimeISO("Europe/Stockholm")`, reading `.offset`, `Intl.DateTimeFormat("sv-SE").format` on an `Instant` and on epoch milliseconds, and `Date.parse` as a baseline. |
| `tz-spike/s03-dst/t7.mjs` | 40 320 `resolveWallClock` calls: 60 machines, 56 days from 2026-10-05 and 12 shift and break edges, with disambiguation `"earlier"` and `getTimeZoneTransition("next")` for a time in a gap. Internal research note 32 records 9.8 s with native Temporal (Node 24 with `--harmony-temporal`) and 0.37 s on the polyfill. |
| `tz-spike/s08/temporal-cost.mjs` | Native only: 32 000 `PlainDateTime.toZonedDateTime` conversions with `"compatible"` (40 machines, 140 days with weekends skipped, 8 edges), as total ms and µs per conversion. Internal research note 32 records 121 to 123 µs per call and 3.95 s in total. |
| `tz-spike/s08/temporal-cost2.mjs` | The same 32 000 conversions on the polyfill, and natively when the global exists, plus a variant that converts each date once and reuses it for every machine. Internal research note 32 records 94 to 149 ms with that per-date cache. |
| `tz-spike/s08/temporal-cost3.mjs` | Native only: 5 000 iterations each of `toZonedDateTime`, `ZonedDateTime.add({ hours: 1 })`, `PlainDate.from().add({ days: 1 })` and an `Intl` `longOffset` `formatToParts`, as µs per operation. |

The shift and break times in `t7.mjs` and the `s08` scripts were replaced with invented ones when the files were copied; the number of edges and calls is unchanged. `tzlab/b/*.mjs` (temporal-polyfill, Luxon, date-fns with `@date-fns/tz`, Day.js) are bundle-size probes and do no timing.

### DST cases and other probes

- `tzlab/dst.mjs`: Stockholm and Helsinki transitions in 2026 and 2027 and `hoursInDay`, comparing Temporal's `compatible`, `earlier` and `later` with Luxon, `@date-fns/tz` and Day.js on times in a gap and in an overlap.
- `tzlab/clamp.mjs`: the clamp resolver against `compatible`.
- `tzlab/cases.mjs` and `tzlab/cases2.mjs`: shifts across both nights, production days in two zones and crew rotation parity; `cases2.mjs` uses the clamp resolver from `engine2.mjs`.
- `tzlab/misc.mjs`: Postgres timestamp text, ISO weeks, unusual zones and zone ids.
- `tzlab/props.mjs`: 5 000 fast-check property cases over the interval engine.
- `tzlab/tc.mjs`: a Postgres 18 container with the server zone `Pacific/Chatham`.
- `s03-dst/t1.mjs`: the resolver, rounding, ticks, parsing and `Intl` labels.
- `s03-dst/t2.mjs` and `s03-dst/t6.mjs`: need a Postgres on the port given as the first argument, with the roles `postgres` and `nm_app` and the password `pw`. No script here starts it.
- `s03-dst/t3.mjs`: native and polyfill objects mixed.
- `s03-dst/t4.mjs`: shifts with Saturday overtime as one row or two, with work run forward and backward.
- `s03-dst/rv-wry.mjs`: imports from `../spike-integration/node_modules/.pnpm/`, which does not resolve in this layout.
- `s03-dst/tscheck/`: a TypeScript check of a plugin against an SDK declaration typed with Temporal.

## earlier-attempt

Five rule files with their specs from the earlier attempt at the product, a separate repository by the maintainer, copied from its last commit. `placement.ts`, `calendar-rules.ts` and `lock-rules.ts` come from its scheduling service, `operation-rules.ts` and `readiness-rules.ts` from its planning service. The folder is flat; every relative import points at a sibling.

- These imports do not resolve here: `luxon`, `vitest`, `@mes/contracts` (`PlanningDirection`, `ScheduledOperationState`, `RoutingOperationInput`, `routingOperationInputSchema`, `WorkOrderOperationReadinessKind`) and `@mes/service-common` (`canonicalUnitFromInput`). The last two were packages of that repository and are not copied.
- `placement.spec.ts` uses TC1 and the A1 calendar of [ADR 0027](../adr/0027-planned-duration-formula-and-override-precedence.md) as its worked example, and ends TC1 on Friday 2026-11-06 at 14:30 as the ADR does. With these synthetic values, all five specs passed against that repository's dependencies.
- [ADR 0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md) lists six known defects of the placement code, which the port fixes; [ADR 0029](../adr/0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) ports the lock rules as they are.
- "ADR-006" refers to that repository's ADRs, not to NorthMES ADR 0006, and "O-2", "O-5" and "O-6" are items of its plan.
- No license is stated in that repository.
