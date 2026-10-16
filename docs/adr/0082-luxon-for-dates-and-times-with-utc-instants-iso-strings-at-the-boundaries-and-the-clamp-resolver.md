---
status: "proposed"
date: 2026-10-17
decision-makers: "proposed by the planning session, to be confirmed by Krister Johansson"
consulted: "Krister Johansson; internal research note 11"
informed: "contributors, plugin authors and coding agents"
release: "1"
needs-confirmation: "maintainer (Date.now as the clock source; luxon as a host-provided package; the allowlist of library boundaries; Settings.throwOnInvalid and Settings.defaultZone in the host entries)"
---

# Luxon for dates and times, with UTC instants, ISO strings at the boundaries and the clamp resolver

## Context and problem statement

[ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) chooses Temporal, with `temporal-polyfill` as the fallback, for every time computation on the server and in the browser, and rules Luxon out. On 2026-10-17 Krister Johansson decided that NorthMES always uses Luxon when it works with dates and times.

No source file calls Temporal yet. `temporal-polyfill` 1.0.5 is in the catalog, four package manifests list it and `HOST_PROVIDED` names it, but nothing imports it. The code that exists computes with the native `Date` in 17 files, which `scripts/lint/date-time.allow.json` lists.

This ADR decides the date library and where the native `Date` stays, for the backend, the web app, the MIT SDK packages, the planning domain package, plugins built on the SDK, scripts and tests. Storage, the driver rules, the GraphQL scalars, the clamp rule and the presentation settings stay as [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) and [ADR 0061](0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md) decide them, expressed in Luxon terms below.

## Decision drivers

* One date library on the server, in the browser, in the SDK and in plugins.
* Correct results on DST nights in any IANA zone, with the clamp rule of ADR 0024: a time in the spring gap resolves to the end of the gap, a repeated autumn time to its first occurrence, and interval endpoints resolve monotonically.
* Domain results that depend neither on the host time zone nor on the runtime.
* Format patterns for dates and clock times without a pattern engine of NorthMES's own (ADR 0061 notes that ECMA-402 accepts no pattern strings).
* Calendar expansion and autoplan within their performance budget ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* A check in `pnpm check` that keeps new code on the chosen library.

## Considered options

* Luxon 3.7 everywhere, with the clamp resolver and the native `Date` only at library boundaries
* Temporal with `temporal-polyfill` as the fallback, as ADR 0024 decides
* The native `Date` with `Intl` only

## Decision outcome

Chosen option: "Luxon 3.7 everywhere, with the clamp resolver and the native `Date` only at library boundaries", because the maintainer decided on 2026-10-17 that NorthMES uses Luxon for dates and times, Luxon runs the same code on every Node version and browser in the support floor without a polyfill, its IANA zones and format tokens cover the plant wall clock and the presentation settings, and the clamp resolver keeps NorthMES's rule for clock changes in one function.

### Versions

* `luxon` 3.7.2 (MIT, published 2025-09-05) and `@types/luxon` 3.7.6 (MIT, published 2026-09-29). On 2026-10-17 both are older than the 14-day `minimumReleaseAge` in `pnpm-workspace.yaml`. They enter the strict catalog in their own pull request. `3.8.0-alpha.1` is a prerelease and is not used.
* `luxon` is host-provided: `HOST_PROVIDED` lists it in place of `temporal-polyfill`, so the host and every plugin share one copy and one `Settings` object.
* A package whose public types name Luxon types lists `@types/luxon` in `dependencies`; every other package lists it in `devDependencies`.

### Which Luxon type holds which time

| Kind of time | Stored as (ADR 0024) | In code |
|---|---|---|
| An instant: a fact happened | `timestamptz` in UTC | `DateTime` in zone `utc`; epoch milliseconds inside loops |
| A plant-local definition: a shift start, a break, an ERP deadline | `time`, `date` or `timestamp` plus the plant zone | the branded strings `PlainTimeString`, `PlainDateString` and `PlainDateTimeString` |
| An instant shown in a plant | | `DateTime` in the plant zone by IANA name |
| A length of time: a retention period, a late window | as the owning ADR decides | `Duration` |
| A window between two instants | as the owning ADR decides | `Interval` at the edges; half-open millisecond windows inside loops |

* Every `DateTime` carries an explicit zone: `utc` for instants, the plant zone by IANA name for plant time. Code passes `{ zone }` to `fromISO`, `fromMillis`, `fromJSDate` and `fromObject`, or calls `setZone`.
* The host entries (the Nest bootstrap and the web entry) set `Settings.defaultZone = 'utc'` and `Settings.throwOnInvalid = true` before other code runs. `@northmes/contracts` declares `interface TSSettings { throwOnInvalid: true }` for the `luxon` module, so `DateTime` types are valid ones. With the setting, `DateTime.fromISO('2026-02-30')` throws instead of returning an invalid `DateTime`.
* A plant zone is valid when `IANAZone.isValidZone` accepts it and `pg_timezone_names` lists it.
* `plus({ hours })`, `plus({ minutes })` and smaller units add exact time; `plus({ days })` and larger units add calendar time in the `DateTime`'s zone. A shift of 8 hours adds hours; the next production day adds a day.
* Calendar arithmetic on a plant-local date or time (the next date, the weekday of a date) runs on a `DateTime` in zone `utc`, which has no clock changes, and goes back to a branded string with `toISODate()` or `toFormat('HH:mm:ss')`.
* A wall-clock value becomes an instant only through `resolveWallClock`. Code never builds an instant with `DateTime.fromISO(local, { zone: plantZone })` or `fromObject` in a plant zone, because Luxon moves a time in the spring gap forward by the length of the gap: in `Europe/Stockholm`, 2027-03-28 02:30 becomes 03:30 (01:30Z), so a break `[02:30, 03:15)` on 2026-03-29 would invert. Luxon resolves a repeated autumn time to its first occurrence, as the clamp rule does.
* Domain code never calls `DateTime.now()`, `DateTime.local()` or `Date.now()`. `now` is an input, or comes from an injected clock built on `Date.now()`, which fake timers control. Luxon's `DateTime.now()` reads the same `Date.now()` through `Settings.now`.
* Loops (availability, autoplan, the board) work in epoch milliseconds and use Luxon only at their edges, with zone offsets cached per date. In the earlier attempt at this product, about 70 percent of a 500-row autoplan run went to Luxon's offset lookup.
* Luxon reads IANA zones through `Intl`, so the backend's tzdata is Node's ICU data and the web app's is the browser's. Boot logs the Node and Postgres tzdata versions, and images are rebuilt on every release.

### The clamp resolver

`resolveWallClock(zone, date, time)` in MIT `@northmes/contracts` turns a wall-clock value into an instant with the clamp rule of ADR 0024. Luxon has no transition lookup, so the resolver finds the end of a gap by bisection.

```ts
import { DateTime, IANAZone } from 'luxon';

const MINUTE = 60_000;
const DAY = 86_400_000;

export function resolveWallClock(zone: string, date: PlainDateString, time: PlainTimeString): number {
  const tz = IANAZone.create(zone);
  const wall = DateTime.fromISO(`${date}T${time}`, { zone: 'utc' }).toMillis(); // the clock as if UTC
  const offsets = [...new Set([tz.offset(wall - DAY), tz.offset(wall), tz.offset(wall + DAY)])]
    .map((minutes) => minutes * MINUTE)
    .sort((a, b) => b - a);
  for (const offset of offsets) {
    const instant = wall - offset;
    if (tz.offset(instant) * MINUTE === offset) return instant; // exists: its first occurrence
  }
  let before = wall - offsets[0]; // in the gap: bisect to the transition, the end of the gap
  let after = wall - offsets[offsets.length - 1];
  const offsetBefore = tz.offset(before);
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (tz.offset(middle) === offsetBefore) before = middle;
    else after = middle;
  }
  return after;
}
```

On 2026-10-17 this resolver ran with Luxon 3.7.2 on Node 26.11.0: in `Europe/Stockholm`, 2027-03-28 02:30 gave 01:00Z and 2026-10-25 02:30 gave 00:30Z, and the break `[02:30, 03:15)` on 2026-03-29 gave `[01:00Z, 01:15Z)`; in `Australia/Lord_Howe`, whose clocks move by 30 minutes, 2026-10-04 02:15 gave 2026-10-03T15:30Z. Every 15-minute step of 2026 in `Europe/Stockholm`, `America/Santiago` and `Australia/Lord_Howe` resolved monotonically.

### Where the native Date stays

* `Date.now()` is the source of the current epoch millisecond: the injected clock, deadlines and elapsed time.
* A library that hands out or takes a `Date`: node-postgres for `timestamptz` until the string parsers of ADR 0024 are registered, the `Date` column types that `kysely-codegen` generates, better-auth's adapter and session fields, and Zod's `z.date()`. The value converts where the library hands it over, with `DateTime.fromJSDate(value, { zone: 'utc' })`, and `toJSDate()` turns a `DateTime` back into a `Date` where the library takes one.
* The Kysely plugin of ADR 0024 serializes `DateTime` parameters with `toISO()` and throws on `Date` parameters.
* `scripts/lint/date-time.allow.json` names every file that still uses `Date` for date math or parsing, with a reason. An entry for code that moves to Luxon names its issue.

### GraphQL, the cache and the browser

* The scalars of ADR 0024 stay: `Instant` with an offset, and `LocalDate`, `LocalTime` and `LocalDateTime` without one. `toISO()` of a `DateTime` in zone `utc` gives `2026-10-25T00:30:00.000Z`.
* The Apollo cache keeps instants as ISO strings, as ADR 0024 decides; no `DateTime` enters the cache. The board converts instants to epoch milliseconds once at its data edge.
* Board time snaps on epoch milliseconds. Hour ticks come from exact instants (`plus({ hours: 1 })`), day ticks from `startOf('day')` plus `{ days: 1 }` in the plant zone.
* `formatPlantTime` in `@northmes/contracts` (subpath `format`) formats with Luxon: `DateTime.fromMillis(ms, { zone }).setLocale('en-GB-u-ca-gregory-nu-latn')` and `toFormat` tokens built from the presentation settings, with the short zone name (`ZZZZ`) when the offset differs from the hour before or after. On 2026-10-17 it gave `02:30 CEST` for 2026-10-25T00:30Z and `02:30 CET` for 01:30Z in `Europe/Stockholm`.

### Changes to ADR 0024

This ADR replaces these parts of [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md). The rest stands: storage, session zones, the driver's string parsers, SQL that never turns local time into an instant, the scalars, the cache rule and the test cases TIME1 to TIME7.

* The chosen option: Luxon in place of Temporal and `temporal-polyfill`.
* "Temporal at run time": the Luxon rules above replace it. No polyfill, no guarded polyfill import, no two-step shell bootstrap for Temporal. Boot still throws unless `resolveWallClock('Europe/Stockholm', '2027-03-28', '02:30')` is 01:00Z, and System health no longer reports whether Temporal is native.
* Storage: a plant zone is validated with `IANAZone.isValidZone` in place of constructing a `Temporal.ZonedDateTime`.
* Driver: repositories convert instants to `DateTime` in zone `utc` and keep plain values as branded strings; the Kysely plugin serializes `DateTime` parameters.
* The clamp resolver: the Luxon code above, taking branded strings.
* The board: snapping on epoch milliseconds in place of `ZonedDateTime.round`.
* Confirmation: the native and forced-polyfill legs, the boot guard test with a stubbed Temporal, the Chromium project that deletes `globalThis.Temporal` and the lint rules on module-scope Temporal calls and `temporal-polyfill` imports go. The date and time check below replaces the lint rules. The hover test at 2027-03-28T01:00Z runs in the ordinary Chromium project.

### Changes to ADR 0004

[ADR 0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md) keeps Node 26 for its other reasons (`module.registerHooks` and LTS until 2029-04-30).

* The driver "Time handling uses Temporal on server and browser" and the reason "Node 26 gives native Temporal" no longer apply, and a Node 26 build without Temporal (the Alpine image, the Homebrew bottle) no longer affects NorthMES's time code.
* The SDK's entry `.d.ts` drops `/// <reference lib="esnext.temporal" />`. The CI job that compiles `examples/plugin-validator` with `lib: ["es2024"]` against the packed SDK tarball stays and proves that a plugin compiles against the SDK's Luxon types.
* The Temporal benchmarks of the time zone spike leave the pin gate; the time zone suite stays in it.

### Changes to ADR 0020 and ADR 0030

* [ADR 0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md): the cache test that writes an identical board result twice runs in the web Vitest project, not in a Temporal polyfill project.
* [ADR 0030](0030-a-planning-board-built-in-house.md): spike SP3 no longer runs with the Temporal polyfill forced, and the hover test at 2027-03-28T01:00Z runs in the ordinary Chromium project.

### Changes to ADR 0037

[ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md): `HOST_PROVIDED` lists `luxon` in place of `temporal-polyfill`.

### Changes to ADR 0041, ADR 0043 and ADR 0057

* [ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md): the two nightly projects that run the scheduling and time suites with native Temporal and with `temporal-polyfill` forced go, and so does the Chromium project that deletes `globalThis.Temporal`. The time zone legs `UTC`, `Europe/Stockholm` and `Pacific/Chatham` and the hostile `Pacific/Chatham` server leg stay.
* [ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md): System health shows the Node and Postgres tzdata versions and no longer shows whether Temporal is native.
* [ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md): the domain suites no longer run in native-Temporal and forced-polyfill projects. `resolveWallClock` and the millisecond window functions stay in `@northmes/contracts`.

### Changes to ADR 0059 and ADR 0068

* [ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md): `Temporal.Instant` in the time series port becomes a `DateTime` in zone `utc`, and `Temporal.Duration` becomes a Luxon `Duration`.
* [ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md): `HostContext.clock.now()` returns a `DateTime` in zone `utc`.

### Changes to ADR 0061

[ADR 0061](0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md) keeps its settings, its pinned base locale and its lint on `Intl` and `toLocale*` calls outside `packages/contracts/src/format/`, which also covers Luxon's `toLocaleString`.

* The formatters take `DateTime` values or epoch milliseconds and may build output from Luxon's `toFormat` tokens with the pinned base locale. They still pass no `dateStyle`, `timeStyle` or `toLocaleString` defaults, so the output never follows a runtime's defaults; the reason that native Temporal and `temporal-polyfill` differ in those defaults goes.
* The plant form's zone picker lists the `pg_timezone_names` ids that `IANAZone.isValidZone` accepts.
* The format tests run under the time zone legs, without native and forced-polyfill legs.

### Consequences

* Good, because every runtime runs the same Luxon code, so the polyfill path, its boot guard and its test legs go.
* Good, because Luxon's format tokens let the formatters express the presentation settings without a pattern engine of NorthMES's own.
* Good, because one check in `pnpm check` keeps `Date` math, Temporal and other date libraries out of new code, and its allowlist shows what still has to move.
* Bad, because Luxon has published no stable release since 3.7.2 on 2025-09-05, and ADR 0024 records that a breaking version 4 is planned with no date. Luxon types are in the SDK's public types and `luxon` is host-provided, so a Luxon major is a breaking SDK change.
* Bad, because Luxon's zone offset lookup is slow enough to dominate an autoplan run, so loops stay in epoch milliseconds with offsets cached per date, and the availability benchmark of ADR 0024 (60 machines over 8 weeks in under 30 ms on the CI runner) guards it.
* Bad, because a `DateTime` holds milliseconds and `timestamptz` holds microseconds, so a stored instant read into a `DateTime` and written back loses its microseconds. Code that must round-trip a stored instant exactly keeps the driver's ISO string.
* Bad, because Luxon has no plain date or plain time type, so plant-local values stay branded strings, and the clamp resolver is NorthMES code with its own bisection.
* Neutral, because tzdata still comes from Node's ICU on the server and from the OS in Postgres, and the two can drift as ADR 0024 describes.

### Confirmation

* `test/meta/date-time.test.ts`, which runs `scripts/lint/date-time.mjs` over the tracked sources under `apps`, `packages`, `modules`, `examples`, `scripts`, `test` and `e2e`: it fails on `new Date`, `Date()`, every static `Date` method other than `Date.now`, the `Temporal` global and imports of `temporal-polyfill`, `@js-temporal/polyfill`, `date-fns`, `date-fns-tz`, the `@date-fns` scope, `dayjs`, `moment` and `moment-timezone`, outside `scripts/lint/date-time.allow.json`. An allowlist entry without a reason, or one that matches no use, fails it too.
* `resolve-wall-clock.test.ts` in `@northmes/contracts` runs the cases of ADR 0024 against the Luxon resolver: in `Europe/Stockholm`, 2027-03-28 02:30 gives 01:00Z and 2026-10-25 02:30 gives 00:30Z; the break `[02:30, 03:15)` on 2026-03-29 never inverts; a fast-check property shows the resolver is monotonic in `Europe/Stockholm`, `America/Santiago` and `Australia/Lord_Howe`.
* A host entry test: after the backend bootstrap and the web entry run, `Settings.throwOnInvalid` is true, `Settings.defaultZone` is UTC and `DateTime.fromISO('2026-02-30')` throws.
* `test/meta/tooling.test.ts`: `luxon` 3.7.x and `@types/luxon` 3.7.x are in the strict catalog; once `temporal-polyfill` is removed, it is in neither the catalog nor a manifest.
* `packages/sdk/test/host-provided.test.ts`: `HOST_PROVIDED` lists `luxon` and not `temporal-polyfill`.
* `packages/contracts/src/format/plant-time.test.ts` (TIME6) gives `02:30 CEST` and `02:30 CET` with Luxon, under `LANG=en_US.UTF-8` and `LANG=fi_FI.UTF-8`.

## Pros and cons of the options

### Luxon 3.7 everywhere

* Good, because one immutable `DateTime` with IANA zones, `Duration` and `Interval` run on every Node version and browser in the support floor without a polyfill.
* Good, because format tokens and the pinned locale give the presentation settings their date and clock layouts.
* Good, because ADR 0024 records that Luxon gave the same results as Temporal on the simple Stockholm cases.
* Bad, because its last stable release is from 2025-09-05 and a breaking version 4 is planned.
* Bad, because its offset lookup is slow, its precision is milliseconds, it has no plain date or time type and, without `throwOnInvalid`, it returns invalid objects instead of throwing.

### Temporal with temporal-polyfill as the fallback

* Good, because its types separate instants, plain dates, plain times and zoned values with nanosecond precision.
* Good, because ADR 0024 records that Temporal is enabled by default in Node 26.0.0, Chrome and Edge 144 and Firefox 139.
* Bad, because Safari ships it only in Technology Preview and some Node 26 builds lack it, so a polyfill path, a boot guard and test legs for both paths stay.
* Bad, because the maintainer chose Luxon on 2026-10-17.

### The native Date with Intl only

* Good, because it needs no dependency.
* Bad, because `Date` is mutable and knows only UTC and the host zone, so `formatDateTime` in the web app formats in the browser zone, not the plant zone.
* Bad, because it has no durations and ECMA-402 accepts no pattern strings.

## More information

* Related ADRs: [0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md), [0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md), [0030](0030-a-planning-board-built-in-house.md), [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md), [0059](0059-time-series-storage-port-with-an-open-default-backend.md), [0061](0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md), [0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md).
* Plan: [04-data-and-platform.md](../plan/04-data-and-platform.md#time-in-the-database), [07-production-planning.md](../plan/07-production-planning.md#time-and-dst-rules), [11-quality-and-testing.md](../plan/11-quality-and-testing.md).
* Issues: [#650](https://github.com/northMES/northmes/issues/650) brings `luxon` and `@types/luxon` into the catalog; [#652](https://github.com/northMES/northmes/issues/652), [#653](https://github.com/northMES/northmes/issues/653) and [#654](https://github.com/northMES/northmes/issues/654) move the allowlisted code to Luxon; [#655](https://github.com/northMES/northmes/issues/655) makes `luxon` host-provided and removes `temporal-polyfill`.
* Public sources: [Luxon documentation](https://moment.github.io/luxon/), [Luxon zones](https://moment.github.io/luxon/#/zones), [PostgreSQL handling of invalid or ambiguous timestamps](https://www.postgresql.org/docs/current/datetime-invalid-input.html).
* Revisit when Luxon 4 ships, and when the maintainer wants to reconsider Temporal once every browser in the support floor ships it.
* Background: internal research note 11.
