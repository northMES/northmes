---
status: "proposed"
date: 2026-10-05
decision-makers: "proposed by the planning session, to be confirmed by Krister Johansson"
consulted: "internal research notes 03, 05, 06, 11, 18, 32 and 35"
informed: "contributors and coding agents"
release: "1"
needs-confirmation: ""
---

# Time: UTC instants, plant wall clock, Temporal and the clamp resolver

## Context and problem statement

Planning mixes two kinds of time. Facts happen at instants: a job order started, a report arrived, a row changed. Definitions are wall-clock values in a plant: a shift starts at 06:00, overtime runs from Saturday 22:00, an ERP deadline is a date. Plants in Sweden and Finland change clocks on Sunday nights such as 2026-10-25 (an hour repeats) and 2027-03-28 (an hour is skipped), and the tools disagree on those nights:

* Postgres resolves a repeated local time to its second occurrence; NorthMES needs the first.
* Temporal's `compatible` disambiguation moves a skipped time forward by the length of the gap, so a break `[02:30, 03:15)` on 2026-03-29 resolves to an inverted interval.
* node-postgres turns a `date` column into a JavaScript `Date` at local midnight: `2026-10-25` read in a CEST process becomes `2026-10-24T22:00:00.000Z`.
* Node reads tzdata from its bundled ICU and Postgres images from the OS package, and the two can drift.

This ADR covers how time is stored, read through the driver, typed in GraphQL, computed on the server and on the board, and shown in the browser. Calendars and the production day are [ADR 0025](0025-plant-calendars-shift-patterns-and-the-production-day.md); the Node version is [ADR 0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md).

## Decision drivers

* Correct results on DST nights in any IANA zone, with one rule shared by the server, the board, autoplan and the ERP connector.
* A repeated autumn time means its first occurrence.
* Interval endpoints resolve monotonically, so adjacent windows stay adjacent and no window inverts.
* The MIT SDK does not tie plugin authors to a third-party date library's major versions.
* Domain results do not depend on the host time zone or on whether Temporal is native.
* Calendar expansion and autoplan fit their performance budget ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* tzdata updates reach every installation.

## Considered options

* Temporal everywhere with `temporal-polyfill` as the fallback, UTC instants plus plant wall clock, and one TypeScript clamp resolver
* A date library: Luxon 3.7.2, as in the earlier attempt, or date-fns 4 with `@date-fns/tz`
* Converting local times to instants in SQL with `AT TIME ZONE`

## Decision outcome

Chosen option: "Temporal everywhere with `temporal-polyfill` as the fallback, UTC instants plus plant wall clock, and one TypeScript clamp resolver", because Temporal has separate types for instants, plain dates, plain times and zoned values, is native in Node 26, Chromium and Firefox, keeps the SDK free of a date library, and the clamp resolver puts one monotonic rule in one place.

### Storage

* Facts are `timestamptz` instants in UTC. Record times come from the database clock.
* Each plant has an IANA zone (`core.plant.time_zone`), validated by constructing a `Temporal.ZonedDateTime` with it and against `pg_timezone_names` on write.
* Plant-local definitions (shifts, breaks, deviations, ERP deadlines) are stored as wall-clock `time`, `date` or `timestamp` plus the plant zone, which keeps the planner's intent when tzdata changes.
* SQL converts instants to local time (reports, production-day grouping) and never local time to instants.
* Session zones are pinned to UTC per role (`ALTER ROLE ... SET timezone = 'UTC'` for `nm_app`, `nm_owner`, the module owner roles and the pg-boss role), not per database, because a database cloned from a template loses database settings. Partition bounds are explicit UTC values. The audit capture and require-context functions declare `set timezone = 'UTC'`. Exports run in UTC and add the plant zone.
* Time-of-day columns carry `CHECK (end_time < '24:00')`; `timestamptz` columns carry `CHECK (isfinite(col))`.

### Driver and generated types

String parsers are registered for OIDs 1082 (`date`), 1114 (`timestamp`) and 1184 (`timestamptz`) and their arrays 1115, 1182 and 1185; OIDs 1083, 1266 and 1270 are left alone and range types stay text. `kysely-codegen` maps `timestamptz` to `InstantString`, `timestamp` to `PlainDateTimeString`, `date` to `PlainDateString` and `time` to `PlainTimeString`; repositories convert to Temporal. One Kysely plugin, active in every environment, serializes Temporal parameters with `toString()` and throws on `Date` parameters. `numeric` values arrive as strings and never pass through `parseFloat` before arithmetic, and queries never select `numeric[]`, which the driver parses as floats; they aggregate in SQL or use `array_agg(x::text)`.

### Temporal at run time

* `temporal-polyfill` 1.0.5 installs through `temporal-polyfill/global` in host entry points only (the Nest bootstrap and the shell entry), guarded on `typeof globalThis.Temporal?.ZonedDateTime?.prototype?.getTimeZoneTransition === 'function'`. It covers Safari, Node 24 if [ADR 0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md) falls back to it, and Node builds compiled without Temporal.
* The shell entry is a two-step bootstrap: it awaits the conditional polyfill import and then imports the app module, because static imports of shared packages evaluate before an un-awaited dynamic import resolves.
* Temporal is always the global. Shared packages make no Temporal calls at module scope, nothing outside the host entries imports `temporal-polyfill` or `@js-temporal/polyfill`, and `temporal-polyfill` is in `HOST_PROVIDED` for plugins.
* Boot throws unless `resolveWallClock('Europe/Stockholm', 2027-03-28, 02:30)` is 01:00Z, and logs whether Temporal is native plus the Node and Postgres tzdata versions; System health shows them ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)).
* Domain code never calls `Temporal.Now` or `Date.now()`. `now` is an input, or comes from an injected clock built on `Date.now()`, which every fake-timer tool can control.
* Loops (availability, autoplan, the board) work in epoch milliseconds and use Temporal only at the edges.
* Luxon is not used. Images are rebuilt on every release to pick up tzdata.

### The clamp resolver

One function, `resolveWallClock(zone, date, time)` in MIT `@northmes/contracts`, turns a wall-clock value into an instant. A time in the spring gap resolves to the first instant after the gap; a repeated autumn time resolves to its first occurrence. The rule is monotonic.

```ts
function resolveWallClock(zone: string, date: Temporal.PlainDate, time: Temporal.PlainTime): number {
  const local = date.toPlainDateTime(time);
  const first = local.toZonedDateTime(zone, { disambiguation: "earlier" });
  if (first.toPlainDateTime().equals(local)) return first.epochMilliseconds; // exists: first occurrence
  return first.getTimeZoneTransition("next")!.epochMilliseconds;           // in the gap: its end
}
```

Callers that echo a resolved time, such as agent proposals, report `resolvedGap` and `resolvedAmbiguous` flags ([ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)). ERP times from the Pyramid connector go through the same function ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)).

### GraphQL and the browser

* The MIT SDK defines shareable scalars `Instant` (offset required) and `LocalDate`, `LocalTime` and `LocalDateTime` (no offset), validated with Zod in the subgraph driver and mapped in codegen to branded strings. Only the server turns a `LocalDateTime` into an instant, through `resolveWallClock`.
* The Apollo cache keeps instants as ISO strings, because `@wry/equality` 0.5.7 treats two equal `Temporal.Instant` values as different, which would re-render the board. The board converts instants to epoch milliseconds once at its data edge.
* Board time snaps with offset-preserving `ZonedDateTime.round`, never with wall-clock rounding. Hour ticks come from exact instants; day ticks from `startOfDay()` plus one day.
* `formatPlantTime` in `@northmes/web-sdk` formats instants in the plant zone and adds the short zone name when the offset differs from the hour before or after. Screens show plant time, with a zone label when the user's zone differs.

### Consequences

* Good, because one resolver and one set of window functions give the server, the board and the connector the same answers on DST nights.
* Good, because results do not depend on the host time zone or the session zone, and the test matrix proves it.
* Good, because the SDK exposes Temporal types from the TypeScript lib, so plugins pin no date library.
* Bad, because browsers without native Temporal (Safari as of October 2026) download about 20 kB of polyfill.
* Bad, because two instants inside the repeated autumn hour format to the same local string, so a local-time interface such as Pyramid write-back cannot tell them apart.
* Bad, because the driver returns strings for date and time types, so every repository converts explicitly.
* Neutral, because the polyfill path stays tested as long as any supported runtime lacks Temporal.

### Confirmation

* `resolve-wall-clock.test.ts` in `@northmes/contracts`: in `Europe/Stockholm`, 2027-03-28 02:30 gives 01:00Z and 2026-10-25 02:30 gives 00:30Z; a break `[02:30, 03:15)` on 2026-03-29 never inverts; a fast-check property shows the resolver is monotonic in `Europe/Stockholm`, `America/Santiago` and `Australia/Lord_Howe`.
* A boot guard unit test: a stubbed Temporal without `getTimeZoneTransition` gets the polyfill, and `resolveWallClock` returns `Date.UTC(2027, 2, 28, 1, 0)`.
* A driver test in both time zone legs: `array[timestamp '2027-03-28 02:30']`, `array[date '2026-03-29']` and `array[timestamptz '2026-10-25 01:30+00']` return identical strings. A repository call with `new Date()` throws. A migration test that inserts `end_time '24:00'` fails the check.
* `pnpm db:types --verify` fails on any generated `Date` type.
* A session zone test against a container started with `-c timezone=Pacific/Chatham`: every pool reports `current_setting('TimeZone') = 'UTC'`; partition maintenance under `SET LOCAL TimeZone = 'Europe/Stockholm'` followed by inserts at 2026-10-31T23:30Z and 2026-11-01T00:30Z succeeds; the same insert under UTC and `Europe/Stockholm` writes byte-identical audit diff text ending in `+00:00`.
* A pattern check fails on SQL that turns a `timestamp` into an instant with `AT TIME ZONE`.
* Scalar tests: the Zod scalars refuse an `Instant` without an offset and a `LocalDateTime` with one.
* Board tests: `snap(2026-10-25T01:10Z, 15 min)` is 01:15Z and snap is monotone; hour ticks number 25 for 2026-10-25 and 23 for 2027-03-28; `formatPlantTime` gives `02:30 CEST` for 00:30Z and `02:30 CET` for 01:30Z. In the polyfill Vitest project, writing an identical board result twice causes zero extra block-layer renders, and availability for 60 machines over 8 weeks takes under 30 ms on the CI runner.
* Lint rules fail on `Intl.DateTimeFormat` without `timeZone`, on module-scope Temporal calls in shared packages and on `temporal-polyfill` imports outside host entries (a fixture remote that imports it fails).
* Vitest runs the domain suites under `TZ=UTC`, `Europe/Stockholm` and `Pacific/Chatham`, with native Temporal and with the polyfill forced, and the results are identical. A Chromium Playwright project deletes `globalThis.Temporal` before load; hovering a block at 2027-03-28T01:00Z shows 03:00. The planner flows run once with the browser in `America/New_York`.

## Pros and cons of the options

### Temporal with temporal-polyfill as the fallback

* Good, because the types separate instants, plain dates, plain times and zoned values with nanosecond precision, so a `timestamptz` read and written back is unchanged.
* Good, because Temporal is enabled by default in Node 26.0.0, Chrome and Edge 144 and Firefox 139.
* Bad, because Safari ships it only in Technology Preview and some Node 26 builds lack it, so the polyfill path stays.

### A date library: Luxon or date-fns with @date-fns/tz

* Good, because both are mature and gave the same results as Temporal on the simple Stockholm cases.
* Bad, because Luxon has had no release since 2025-09-05 and plans a breaking version 4 with no date, which would tie the SDK's semver to it; in the earlier attempt about 70 percent of a 500-row autoplan run went to Luxon's offset lookup.
* Bad, because `TZDate` extends the mutable `Date`, has no plain date or wall-clock type and lets plain `Date` values mix in silently.

### Local to instant in SQL

* Good, because calendar expansion would stay next to the data.
* Bad, because Postgres resolves a repeated time to its second occurrence: `timestamp '2026-10-25 02:30' AT TIME ZONE 'Europe/Stockholm'` gives 01:30Z, not 00:30Z.
* Bad, because Postgres reads tzdata from the OS, so server and database could disagree after a tzdata change.

## More information

* Related ADRs: [0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md), [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md), [0013](0013-audit-trail-written-in-the-command-transaction.md) (audit partitions and capture functions), [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) (shared scalars), [0019](0019-web-shell-with-react-module-federation-remotes.md) (shell bootstrap and browser floor), [0025](0025-plant-calendars-shift-patterns-and-the-production-day.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md).
* Plan: [04-data-and-platform.md](../plan/04-data-and-platform.md#time-in-the-database) (storage and driver rules), [07-production-planning.md](../plan/07-production-planning.md#time-and-dst-rules) (test cases TIME1 to TIME7), [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md), [06-web-and-ux.md](../plan/06-web-and-ux.md).
* Public sources: [Node.js 26.0.0 release notes](https://nodejs.org/en/blog/release/v26.0.0), [PostgreSQL handling of invalid or ambiguous timestamps](https://www.postgresql.org/docs/current/datetime-invalid-input.html), [IANA tz NEWS](https://data.iana.org/time-zones/tzdb/NEWS), [TC39 finished proposals](https://github.com/tc39/proposals/blob/main/finished-proposals.md).
* Revisit when every browser in the supported floor ships Temporal (the browser polyfill can go), when the Node pin changes, and when a tzdata release changes a zone where a customer has a plant.
* Background: internal research note 11.
