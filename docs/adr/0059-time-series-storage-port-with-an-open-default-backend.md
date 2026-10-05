---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research note 37
informed: contributors, coding agents, module and plugin authors, hosting partners
release: "later"
needs-confirmation: "maintainer (no TimescaleDB backend from the project); product owner (raw pulse retention)"
---

# Time-series storage port with an open default backend

## Context and problem statement

Data collection is a later module. It receives machine data through one ingestion port, a REST batch endpoint first and MQTT and OPC UA adapters later: pulses (one event per produced cycle), state changes with reasons, and analog signals sampled at roughly 0.1 to 1 Hz, all stored in SI units ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md)). Process follow-up (OEE) and analysis modules need rollups per minute, per shift and per production day in plant time ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [ADR 0025](0025-plant-calendars-shift-patterns-and-the-production-day.md)), long retention of rollups and shorter retention of raw samples. Large plants may have hundreds of machines. Gateways buffer during outages and resend late, repeated and out-of-order data.

[ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md) left TimescaleDB out of the release 1 database image and expected it to join the image when Data collection starts. TimescaleDB's compression, continuous aggregates, retention policies and job scheduler are under the Timescale License (TSL), not Apache-2.0. The TSL costs nothing. A manufacturer that hosts NorthMES for itself fits its Internal Use grant (section 2.1(a)). A partner that hosts NorthMES for customers must use its Value Added Products or Services grant (sections 2.1(b) and 3.10), which requires a TSL notice to every customer and a contractual or technical ban on customers "defining, redefining, or modifying the database schema". NorthMES plugins ship their own SQL migrations ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)), and a read-only BI login on Postgres 18 can create temporary tables until `TEMPORARY` is revoked from `PUBLIC`. Every hosting partner would need its own legal review of how that ban fits NorthMES (internal research note 37).

A full-scale benchmark loaded 193.5 million signal rows (40 machines, 8 signals each at 1 Hz, 7 days), 1.69 million pulses and 26 902 state changes into five candidates, each limited to 4 CPUs and 4 GiB of memory. The data was synthetic and the runs used Docker Desktop on an Apple Silicon laptop, so every number in this ADR is an estimate for ratios and rough sizing, not a figure to promise a customer (internal research note 37).

| Candidate | Bulk ingest, rows/s | One connection, 1 000-row batches | Bytes per raw sample | Hourly averages of all signals, one day |
|---|---|---|---|---|
| Plain Postgres 18.6, daily partitions | 1.09 to 1.38 million | 395 000 | 83.8 | 4 218 ms; 100 ms from the minute rollup |
| TimescaleDB 2.30.2, Apache-2.0 build | 0.65 to 1.15 million | 249 000 | 83.8 | 4 151 ms |
| TimescaleDB with TSL compression | 0.98 to 1.11 million, plus 88 to 103 s to compress | 357 000 | 8.74 | 2 325 ms |
| Citus columnar 14.2.0 on closed days | 1.29 to 1.35 million, plus 189 to 268 s to convert | 437 000 | 5.15 | 5 278 ms |
| ClickHouse 26.8.17.4 with `async_insert=0` | 5.03 million | 428 000 | 7.89 | 195 ms |

Bytes per raw sample are for one closed day, except for ClickHouse, which is a 7-day average. The plain Postgres row used a non-unique btree, so 83.8 bytes is a lower bound; with the primary key on `(series_id, ts)` that the default adapter uses, the planning figure is about 100 bytes on disk per raw row (84 to 105 bytes measured across the layouts tried). Postgres committed every batch with `synchronous_commit=on`, while ClickHouse ran with its default `fsync_after_insert = 0`, so the ingest rates are not like for like. Bulk ingest varied up to 1.8 times between identical runs, and query medians up to 2 times between passes.

On plain Postgres, dashboard and state queries took 3 to 12 ms, and shift and production-day queries from a minute rollup took 4 to 110 ms. Plain Postgres used about 2 microseconds of CPU per inserted row. TimescaleDB's Apache-2.0 build used the same 16.22 GB as plain daily partitions, with queries within run-to-run noise. A plant of 300 machines with 8 signals at 1 Hz sends 2 400 rows a second. The limit is disk, WAL and backup volume of raw samples, not CPU or ingest rate.

This ADR decides how Data collection stores, deduplicates, rolls up, keeps and reads time-series data, which backends NorthMES ships and supports, and when an installation moves to a heavier backend. It covers the storage port in `@northmes/sdk/timeseries`, Data collection's tables and jobs, the reporting views over rollups and adapter plugins.

## Decision drivers

* Nobody who installs or hosts NorthMES has to accept a license that is not OSI-approved. Core is AGPL-3.0-or-later ([ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)) and the SDK is MIT ([ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)).
* Plugins create schema objects through their own migrations ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)), and customers get a read-only BI login ([04 data and platform](../plan/04-data-and-platform.md#reporting-schema-later)).
* Row-level security scopes every read and write by company and plant ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)).
* A small plant runs one host with Docker Compose, and one pgBackRest backup restores everything to one point in time ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md), [ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).
* Late, repeated and out-of-order samples must not double counts or change closed reports without a trace.
* A plant that outgrows row storage must move raw samples to a compressing backend without changes to Process follow-up, analysis modules or BI views.

## Considered options

* A storage port with plain Postgres 18 as the default backend, rollups always in Postgres, and OSI-licensed compressing backends as adapter plugins
* TimescaleDB with the TSL in the database image: hypertables, compression, continuous aggregates and retention policies
* TimescaleDB's Apache-2.0 build in the database image as the default backend
* ClickHouse as the store for all machine data
* Plain Postgres tables without a port, read directly by the modules that need them

## Decision outcome

Chosen option: "A storage port with plain Postgres 18 as the default backend, rollups always in Postgres, and OSI-licensed compressing backends as adapter plugins", because plain Postgres handled ingest, dashboards and OEE reporting in the benchmark with no TSL code, every installation and hosting partner stays on OSI licenses, the pilot-class host keeps one database and one backup, and plants that need long raw retention have a measured path to compression.

### The port

The ingestion port maps gateway signals to series, converts values to SI units and validates them. The storage port stores, deduplicates, rolls up, keeps and reads samples. Data collection owns both. Other modules get `TimeSeriesReader` through Data collection's public API module and never read its tables, partitions or any external store.

```ts
// @northmes/sdk/timeseries (MIT). Abridged.
export type SeriesKind = "pulse" | "state" | "analog";
export type Quality = "good" | "uncertain" | "bad" | "stale";
export type Sample =
  | { kind: "analog"; seriesId: number; ts: Temporal.Instant; value: number; quality: Quality }
  | { kind: "pulse"; seriesId: number; ts: Temporal.Instant; pieces: number }
  | { kind: "state"; seriesId: number; ts: Temporal.Instant; state: string; reason: string | null };
export interface AppendBatch {
  gatewayId: string; batchSeq: bigint; plantId: string;
  receivedAt: Temporal.Instant; samples: readonly Sample[];
}
export type RejectReason = "series_out_of_scope" | "kind_mismatch" | "not_finite"
  | "before_retention" | "beyond_late_window" | "future_skew";
export interface AppendResult {
  replayed: boolean; accepted: number; duplicates: number;
  rejected: readonly { index: number; reason: RejectReason }[];
  lateFrom: Temporal.Instant | null;
}
export type RollupLevel = "minute" | "quarter_hour" | "shift" | "production_day";
// Rollup rows: seriesId, start, end, productionDay, shiftCode, revision, plus
// analog n, nGood, avg, min, max; pulse pulses, validPulses, pieces; state secondsByState.

export interface TimeSeriesReader {   // what other modules get
  queryRaw(scope: Scope, q: { seriesIds: readonly number[]; from: Temporal.Instant; to: Temporal.Instant; pageSize?: number }):
    AsyncIterable<readonly Sample[]>;  // ascending ts per series; range per call is capped
  queryRollup(scope: Scope, q: { seriesIds: readonly number[]; level: RollupLevel; from: Temporal.Instant; to: Temporal.Instant }):
    Promise<{ rows: readonly Rollup[]; completeUntil: Temporal.Instant }>;
  completeUntil(scope: Scope, plantId: string): Promise<Temporal.Instant>;
}

export interface RawStore {           // what an adapter implements
  append(tx: Tx, batch: AppendBatch, accept: readonly Sample[]): Promise<{ inserted: number; duplicates: number }>;
  readRaw(scope: Scope, q: { seriesIds: readonly number[]; from: Temporal.Instant; to: Temporal.Instant; after?: RawCursor; limit: number }):
    Promise<{ samples: readonly Sample[]; next: RawCursor | null }>;
  aggregateMinutes(scope: Scope, q: { plantId: string; kind: SeriesKind; from: Temporal.Instant; to: Temporal.Instant }):
    AsyncIterable<readonly MinuteAggregate[]>;
  dropBefore(kind: SeriesKind, before: Temporal.Instant): Promise<RetentionReport>;
  maintain(now: Temporal.Instant): Promise<MaintenanceReport>;
  exportRange(q: { kind: SeriesKind; from: Temporal.Instant; to: Temporal.Instant }): AsyncIterable<readonly Sample[]>;
  importRange(rows: AsyncIterable<readonly Sample[]>): Promise<number>;
}

export interface RetentionPolicy {
  raw: Readonly<Record<SeriesKind, Temporal.Duration>>;
  rollups: Readonly<Record<RollupLevel, Temporal.Duration | "forever">>;
  lateWindow: Temporal.Duration;      // never longer than raw retention
  futureSkew: Temporal.Duration;
}
```

Rollup definitions are a closed set in the SDK, not code an adapter or plugin extends. Analog rollups store `n`, `nGood`, sum, min and max over good samples, and the API returns the average, never the sum. Pulse rollups store pulses, valid pulses and pieces; validity comes from Data collection's in-order derivation, not from the store, so every pulse is stored and a pulse below the valid cycle time is counted in pulses but not in valid pulses. State rollups store seconds per state, with the open interval ending at the frontier. Minute rollups keep no first and last values: in a spike they doubled the cost of a one-hour catch-up.

The port guarantees, each covered by a contract test:

1. A batch whose `(gatewayId, batchSeq)` was stored before returns `replayed: true` with the first answer and stores nothing. A Postgres ledger table decides this for every adapter.
2. A sample whose `(seriesId, ts)` exists is counted as a duplicate and not stored; the first value wins.
3. Reads return samples in ascending `ts` per series. `completeUntil(plant)` is the frontier below which rollups are final, except for late data inside the late window.
4. Analog values are canonical SI values in the series' unit. The store never converts. A unit change creates a new series.
5. Rollups, retention and maintenance are idempotent.
6. Reads in one plant's scope never return another plant's series, and appends outside the write scope are rejected per sample.
7. Samples older than raw retention, older than the late window or further in the future than `futureSkew` are rejected with a reason before any insert.

### The default adapter

* Raw tables per kind (`sample_analog`, `sample_pulse`, `state_change`) are partitioned by UTC day, with a primary key on `(series_id, ts)`, a BRIN index on `ts` with `pages_per_range = 32`, and no default partition. Columns are ordered so that the 8-byte columns come first, for example `(ts, value, series_id, quality)`. On 1 million time-ordered synthetic rows in `postgres:18.6`, that order took 52.2 bytes of heap per row against 60.2 bytes for `(series_id, ts, value, quality)`, with the same 42.1 bytes of primary key index.
* Partitions live in a schema without `USAGE` for `nm_app` and the BI login roles, and carry no grants. As for every partitioned table ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)), each partition also gets row-level security and its parent's policies when it is created. Row-level security sits on the parent tables in the form `series_id in (select id from <series registry>)`, where the series registry has its own scope policy. Postgres applies a parent's policies to rows from partitions when the query names the parent, and a partition's own policies only when the partition is named. In a server-side spike, the `IN` form cost 6.9 ms per 1 000-row batch, against 18.5 ms for the `= any (array)` form and 4.2 ms without row-level security.
* The raw tables carry `series_id` instead of a copied `scope_id`, which keeps raw rows narrow. They are an exception to the child-table rule of ADR 0008, and each gets a catalog lint allowlist entry with that reason.
* The batch ledger is a plain table keyed on `(gateway_id, batch_seq)`, pruned after 14 days, with a per-gateway floor that refuses older batches as a whole.
* One transaction per batch, as `nm_app` with the plant's scopes set: insert the ledger row with `on conflict do nothing`; insert the accepted samples with `on conflict (series_id, ts) do nothing` from column arrays; insert one dirty row per touched minute below the plant's frontier; update the ledger counts; commit.
* Rollup tables are partitioned by month and live in Postgres for every adapter: minute and quarter hour bucketed in UTC with `date_bin`, shift from minute rows inside the shift windows that Data collection projects from core's calendar, and production day from minute rows grouped by local time minus the production day start. Every current UTC offset is a multiple of 15 minutes, so UTC minutes and quarter hours line up with local time in every zone. No stored hourly level exists; hourly views sum quarter hours in plant time.
* No report converts raw rows with `AT TIME ZONE`. The same production-day pulse count over 7 days took 792 ms with per-row conversion and 194 ms against precomputed day boundaries.
* A cron enqueues one rollup job per active plant every minute on a singleton queue, and the job also takes a transaction advisory lock on the plant ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)). Each run consumes the dirty set, upserts minute rows with `revision = revision + 1`, recomputes the quarter-hour, shift and production-day rows that contain them, moves `complete_until`, and publishes `datacollection.rollups.advanced` or `datacollection.rollups.revised` through the outbox. One plant-minute for 3 000 series took 79 ms. At the benchmark plant, a 7-day backfill took 60.8 s and the steady state cost 12 ms per one-minute run.
* A generic core partition job, which the audit partitions of [ADR 0013](0013-audit-trail-written-in-the-command-transaction.md) can share, creates partitions 14 days ahead and removes partitions past retention with `ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY` and `DROP TABLE` on a direct connection, as a dedicated maintenance role that owns the time-series parents. A concurrent detach cannot run inside a transaction block, so it cannot run inside a `SECURITY DEFINER` function. In a spike, an insert through the parent finished in 87 ms while a detach waited on a long reader.
* Reporting views for BI are versioned `security_invoker` views over rollup tables, never over raw samples.

### Retention defaults

Retention is a per-installation setting per kind and level. Proposed defaults: raw analog 30 days, raw pulses 90 days, raw state changes 400 days; minute rollups 90 days, quarter-hour rollups 3 years, shift and production-day rollups kept; late window 7 days; future skew 10 minutes.

The product owner confirms the raw pulse retention (PO-80 in [16 open questions](../plan/16-open-questions.md#data-collection-later-module)). A raw pulse row took 88.5 bytes in the benchmark. A 300-machine plant with 10 s cycles writes 2.6 million pulses a day, about 21 GB in 90 days and about 92 GB in 400 days, which is more than 30 days of the same plant's analog samples at 0.1 Hz (about 78 GB). Pulse rollups keep pulses, valid pulses and pieces per minute for as long as rollups are kept, so average cycle time per minute outlives the raw pulses; the distribution of single cycle times does not.

### Optional adapters

An adapter implements `RawStore` for raw samples only. The series registry, the batch ledger, the dirty set, the watermark and every rollup table stay in Postgres for every adapter, so BI views, row-level security on rollups, OEE reads and pgBackRest coverage of history are the same on every installation, and moving between adapters moves only raw data. Routing is per kind, so `{ analog: "clickhouse", pulse: "postgres", state: "postgres" }` is a valid configuration. An adapter is supported when it passes the contract suite and the benchmark gate, and its docs publish its bytes per row and read times. The project builds an adapter only when an installation needs it ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)). Candidates, in order:

1. `citus_columnar` (AGPL-3.0, Citus 14.2.0 or later) for raw partitions older than the late window. A nightly step rewrites each such daily partition into a columnar table sorted by `(series_id, ts)`, detaches the heap partition and attaches the columnar one. It took 5.15 bytes per sample in the benchmark, so raw disk drops about 16 times; WAL per ingested row does not change, because rows land in heap partitions first. The rewrite took 27 to 38 s per day of the benchmark plant. Columnar partitions are append-only, have no BRIN and no intra-node parallel scan: one day of raw scans took 5.3 s against 4.2 s on heap, and a narrow lookup without a btree took 51 ms against 11 ms. Use it when the problem is how long raw data must stay online. Conditions: the database image carries it built from a Citus release tag for amd64 and arm64, since Citus publishes Postgres 18 packages for amd64 only; the superuser creates the extension, since it is not marked trusted; a backup and point-in-time restore with columnar partitions passes before the first installation uses it; the dependency license gate has a recorded class for the database image ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)).
2. ClickHouse (Apache-2.0) for analog samples, with pulses and states in Postgres, because they are small and need exact counts and joins. It took 7.89 bytes per sample and scanned raw data about 20 times faster than plain Postgres in the benchmark (195 ms against 4 218 ms). Use it when the daily raw volume itself overloads WAL and backups, or when analysts scan raw data across many machines and weeks as routine work. Conditions: the host has the memory for a second server, since ClickHouse's docs recommend 32 GB of RAM and the pilot-class host has 16 GB; the hosting partner accepts a second container with its own backup; inserts follow ClickHouse's batching guidance and set `async_insert` explicitly, because it is on by default since 26.2 and made the same loader 24 times slower; the Postgres ledger stays the judge of batch deduplication, with `insert_deduplication_token` set to the batch key; queries filter by the scope's series ids, because the app's ClickHouse user is not read-only and row policies do not protect it; the docs state that the raw analog recovery point is the ClickHouse backup interval, because Postgres and ClickHouse backups share no point in time.

Data moves between adapters by cut-over at a time T recorded in a routing table, so the old adapter empties as raw retention passes T, or by copying day by day with `exportRange` and `importRange`.

The project builds and tests no TimescaleDB adapter, with or without the TSL (M-50 in [16 open questions](../plan/16-open-questions.md#later-modules)). The Apache-2.0 build added nothing measurable over the default and brings the chunk row-level security gap and an extra upgrade step. A third party may write a TSL adapter against the MIT port outside the NorthMES repository and images; whoever installs it accepts the TSL from Tiger Data. The hosting docs state in one paragraph, without advice, which TSL conditions such an adapter brings. QuestDB, GreptimeDB, VictoriaMetrics and InfluxDB 3 Core are not candidates, because their open editions lack TLS, RBAC, downsampling or compaction that this use needs.

### Thresholds

Raw rows a day are analog signals times samples per second times 86 400, plus one pulse row per cycle; state changes are few (26 902 for 40 machines over 7 days). Planning figures per raw row: about 100 bytes on disk with indexes, 176 bytes of WAL, about 47 bytes of compressed archived WAL and about 18 bytes in a compressed full backup. A minute rollup row costs about 150 bytes whatever the sample rate, so 3 000 series write about 0.65 GB of minute rollups a day and about 58 GB in 90 days.

| Level | Raw rows a day | Raw rows kept | Host | Storage |
|---|---|---|---|---|
| 1 | up to about 10 million (about 115 signals at 1 Hz or 1 150 at 0.1 Hz) | up to about 300 million (about 30 GB) | pilot class: 4 vCPU, 16 GB RAM, 100 GB data disk, 200 GB backup disk | default adapter |
| 2 | up to about 50 million (about 580 signals at 1 Hz or 5 800 at 0.1 Hz) | up to about 1.5 billion (about 150 GB) | 500 GB to 1 TB data disk, backup disk about twice that | default adapter |
| 3 | above about 50 million | above about 1.5 billion, or raw scans across machines and weeks are routine | sized per installation | shorten raw retention, reduce at the edge, then `citus_columnar` for long raw history, then ClickHouse for high daily volume or raw-scan analysis |

At level 2's upper bound the default writes about 8.8 GB of WAL and about 2.4 GB of compressed archived WAL a day. Example plants, derived from the planning figures and not measured (pulse counts assume the cycle times shown):

| Plant | Raw rows a day | Raw on disk a day | WAL a day | Raw kept 30 days | Level |
|---|---|---|---|---|---|
| 30 machines, 5 signals at 0.1 Hz, 30 s cycles | 1.4 million | 0.14 GB | 0.24 GB | 4.1 GB | 1 |
| 100 machines, 10 signals at 0.1 Hz, 20 s cycles | 9.1 million | 0.91 GB | 1.6 GB | 27 GB | 1 |
| 40 machines, 8 signals at 1 Hz, 10 to 14 s cycles (the benchmark plant) | 27.9 million | 2.8 GB (2.3 measured) | 4.9 GB | 84 GB | 2 |
| 300 machines, 10 signals at 0.1 Hz, 10 s cycles | 28.5 million | 2.9 GB | 5.0 GB | 86 GB | 2 |
| 300 machines, 10 signals at 1 Hz, 10 s cycles | 262 million | 26 GB | 46 GB | 785 GB | 3 |

Machine count alone does not decide the level; signals times sample rate times days kept does. A press with a 1 s cycle sends as many pulse rows as a 1 Hz signal. When an installation approaches level 3, the steps run in this order: shorten raw retention, since rollups keep the history that OEE and reports read; reduce rows at the edge with a deadband or report by exception and lower rates for slow signals (not measured); move closed days to `citus_columnar` when raw history must stay long; move analog samples to ClickHouse when the daily volume itself is the problem or raw-scan analysis is routine.

The levels are estimates from synthetic data on a laptop. On the customer's class of hardware, the benchmark gate settles a borderline case. System health lists raw rows a day per kind, days of partitions ahead and the raw size projected at the configured retention against free space on the data disk, and warns before the projection passes a set share of that disk, proposed at 70 % ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)).

### The license rule

Core never depends on the TSL. That means four checkable things:

1. No NorthMES artifact contains or pulls TSL code: not the database image, the Compose bundle, the offline bundle, the test images or CI.
2. No first-party code or migration calls TimescaleDB.
3. Every Data collection feature works on the default adapter: rollups, retention, late data, OEE inputs and BI views. Adapters change raw storage only.
4. A TSL adapter, if anyone writes one, is a separate package outside the NorthMES repository, and whoever installs it takes the TSL from Tiger Data.

A partner hosting NorthMES then accepts AGPL-3.0-or-later for core and modules, MIT for the SDK, the PostgreSQL License for Postgres and MIT for pgBackRest, and, only where an installation uses them, AGPL-3.0 for `citus_columnar` and Apache-2.0 for the ClickHouse server and `@clickhouse/client`.

### Consequences

* Good, because every installation and hosting partner stays on OSI-approved licenses: no TSL notice duty, schema ban or other TSL term, and no legal review per hosting partner.
* Good, because plugins create tables freely and the BI login works as designed.
* Good, because the default keeps one database, one backup and one restore point, and BI views, row-level security and OEE reads stay the same whatever adapter holds raw samples.
* Good, because rollups are NorthMES code under contract tests, so late data, 23- and 25-hour production days and state intervals split at minute boundaries behave the same on every adapter. Continuous aggregates cannot split state intervals at bucket boundaries.
* Good, because the measured headroom is wide: one connection without row-level security took about 165 times the 2 400 rows a second of a 300-machine plant with 8 signals at 1 Hz, and a server-side spike with the primary key and row-level security took about 60 times.
* Bad, because the default does not compress: a raw sample costs about 100 bytes, 10 to 16 times more than a compressing store, and a year of raw samples at 320 signals and 1 Hz would take about 846 GB, against about 52 GB in `citus_columnar`.
* Bad, because NorthMES writes and maintains rollup, retention and partition code that TimescaleDB would have provided, and analysis modules write their own gap filling and time weighting.
* Bad, because plants that need long raw history depend on `citus_columnar`, whose Postgres 18 packages are amd64 only and whose closed partitions are append-only, or on ClickHouse, a second database with its own backup.
* Bad, because the thresholds are estimates until the benchmark runs on a Linux server. Not yet measured: the full append path through node-postgres, autovacuum and BRIN summarization at 1 Hz over weeks, backup and restore times at these sizes, and compression on real machine signals.

### Confirmation

* Contract suite `@northmes/sdk/timeseries/testing`, a Vitest suite that takes an adapter factory and a Testcontainers Postgres, run in CI against the default adapter: "replays a repeated batch without storing it again"; "accepts a batch sent on two connections at once exactly once"; "stores a repeated (seriesId, ts) once and keeps the first value"; "returns raw samples in ascending ts per series after shuffled appends"; "never returns or accepts another plant's series"; "rejects samples before retention, beyond the late window and beyond the future skew without storing any"; "revises minute, shift and production-day rollups for late data and publishes rollups.revised"; "rollups equal a brute-force recomputation from raw samples" (fast-check; exact counts, min and max, relative tolerance 1e-9 for sums); "builds shift and production-day rows across 23- and 25-hour days, a night shift over midnight and an Asia/Kathmandu plant"; "counts bad, stale and uncertain samples in n but not in nGood, sum, min or max"; "drops raw samples past retention and keeps rollups by their own policy"; "gives identical rollups after exportRange from one adapter and importRange into another".
* Benchmark gate `bench/timeseries`, a nightly job on the Linux CI runner. It loads one deterministic production day of a reference plant through the port as `nm_app` with row-level security: 300 machines, 3 000 analog series at 0.1 Hz, one pulse per machine every 10 s and state changes, 28.5 million raw rows. The job fails when any floor is missed: append on one connection in 1 000-row batches at 30 000 rows/s or more (ten times the 3 000 rows a second of 3 000 series at 1 Hz, so two days of the reference plant's buffered data, 57 million rows, catch up in about 32 minutes); at most 110 bytes per raw analog row on disk after `VACUUM (ANALYZE)`; one plant-minute rollup at most 1 s at the 95th percentile; one hour of rollup backlog at most 60 s; `queryRollup` for one shift of one machine's series and for one production day of one series, and the first page of `queryRaw` for one series over 6 hours, at most 500 ms each; no append waits longer than 1 s while `dropBefore` detaches a partition under a 5-second reader. Results are stored per run, and a result more than 50 % worse than the median of the last seven runs opens an issue.
* An optional adapter is listed as supported only when the contract suite and the benchmark gate pass for it in CI.
* Image test ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)): `pg_available_extensions` lists no `timescaledb`.
* Migration lint: a first-party or example-plugin migration fails on `create extension timescaledb` and on the TimescaleDB names `create_hypertable`, `add_columnstore_policy`, `add_compression_policy`, `add_retention_policy`, `add_continuous_aggregate_policy` and `timescaledb.continuous`.
* Dependency license gate ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)): the Timescale License is denied for everything NorthMES ships, including the database image's SBOM.
* Catalog lint ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)): every partitioned parent in a scoped schema has row-level security and policies; every partition has row-level security and its parent's policies; no partition grants a privilege to `nm_app` or a BI login role; partition schemas grant them no `USAGE`; no time-series parent has a default partition.
* Health test: with a fixed clock and raw partitions up to day D, the degraded list names Data collection at D minus 3. Readiness does not fail on time-series partitions, because a missing partition stops only Data collection's appends, and planning must keep working.

## Pros and cons of the options

### Storage port, plain Postgres default, OSI adapters

* Good, because it needs no license beyond OSI terms for any installation or partner.
* Good, because the benchmark measured ingest at about 165 times a 300-machine plant's rate without row-level security (about 60 times with it) and report reads from rollups in 4 to 110 ms.
* Good, because the port keeps readers and BI unchanged when raw storage moves.
* Bad, because raw samples are uncompressed in the default.
* Bad, because NorthMES owns rollup, retention and partition code.

### TimescaleDB with the TSL

* Good, because compression with automatic policies reached 8.74 bytes per sample, and continuous aggregates and hyperfunctions come ready.
* Good, because the project is active (21 releases in 2026) and widely known.
* Bad, because a hosting partner must give every customer the TSL and ban customer schema changes, which collides with plugin migrations and the BI login, and NorthMES can never publish an image that contains it.
* Bad, because columnstore chunks do not support row-level security, a continuous aggregate's source hypertable must not have row-level security, and chunks do not carry the hypertable's policies (issue #7830, open on 2026-10-05).
* Bad, because continuous aggregates cannot split state intervals at bucket boundaries, so OEE inputs need NorthMES jobs anyway.

### TimescaleDB Apache-2.0 build

* Good, because it is Apache-2.0, PGDG packages it for the existing image, and it adds automatic chunk creation and `time_bucket` with a time zone.
* Bad, because it gave no measurable gain over plain partitions: 16.22 GB for both and queries within run-to-run noise.
* Bad, because chunks do not carry the hypertable's row-level security policies, and every package bump needs `ALTER EXTENSION timescaledb UPDATE`.
* Bad, because partners must check which TimescaleDB build they run, since the same project ships TSL builds.

### ClickHouse for all machine data

* Good, because it loaded 5.03 million rows a second (without fsync of inserted parts, the server default), stored 7.89 bytes per sample and scanned raw data about 20 times faster.
* Bad, because every installation, small plants included, would run a second database with its own backup and no shared restore point with Postgres.
* Bad, because pulses and states need exact counts and joins with Postgres data, and the BI and row-level security model differs from the rest of NorthMES.
* Bad, because its docs recommend 32 GB of RAM against the pilot-class host's 16 GB, and its default `async_insert` made the same loader 24 times slower.

### Plain tables without a port

* Good, because it is the least code at first.
* Bad, because every reader would query raw tables directly, so moving raw samples to a compressing store would rewrite every module that reads them, and modules would read another module's tables.

## More information

* Related ADRs: [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md) database image, [0008](0008-row-level-security-with-transaction-local-scopes.md) row-level security and the catalog lint, [0013](0013-audit-trail-written-in-the-command-transaction.md) audit partitions, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) outbox and pg-boss, [0023](0023-si-units-with-a-northmes-unit-catalog.md) units, [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) time, [0025](0025-plant-calendars-shift-patterns-and-the-production-day.md) calendars and the production day, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) plugins, [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) license, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) dependency license gate, [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md) health, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) Compose deployment, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) backups, [0054](0054-file-storage-port-with-a-postgres-driver.md) the same port pattern for files, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) scope rule, [0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md) MIT SDK.
* Plan: [01 product and scope](../plan/01-product-and-scope.md#later-modules) (later modules), [04 data and platform](../plan/04-data-and-platform.md#time-series-storage-later) (time-series storage, database image, reporting schema), [11 quality and testing](../plan/11-quality-and-testing.md#time-series-storage-later) (contract suite and benchmark gate), [16 open questions](../plan/16-open-questions.md) (PO-80, M-50).
* Timescale License: https://github.com/timescale/timescaledb/blob/main/tsl/LICENSE-TIMESCALE
* PostgreSQL partitioning: https://www.postgresql.org/docs/18/ddl-partitioning.html
* Citus columnar: https://github.com/citusdata/citus/tree/main/src/backend/columnar
* Revisit when the first Data collection customer gives signal counts, sample rates and raw retention needs; when an installation reaches level 3; when Tiger Data moves compression or continuous aggregates to Apache-2.0; and when Citus changes how it packages or supports `citus_columnar`.
