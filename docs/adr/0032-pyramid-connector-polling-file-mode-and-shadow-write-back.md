---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 06, 07, 10, 11, 16, 30, 32 and 35
informed: contributors and coding agents
release: "1"
needs-confirmation: "pilot IT (write method, Pyramid field meanings); product owner (fallback write path, plant moves)"
---

# Pyramid connector: polling, file mode and shadow write-back

## Context and problem statement

Pyramid is an on-premises Windows ERP. Its web service, WTSWS, is an ASP.NET application on IIS that forwards requests to Pyramid's WTS service. The pilot's sample responses come from an order list method and a stock list method that no public source documents; they may be a reseller customization. No public source documents a push from Pyramid, or a method that writes planned times, lock, status or quantities back to an operation row. Reading Pyramid's database through ODBC is possible, but writing to it bypasses Pyramid's own logic (internal research note 10).

Krister Johansson decided that the Pyramid connector is in release 1: orders, operations, materials and stock in, write-back out. This ADR decides how the connector reads, how it recognizes its own writes when it polls them back, how write-back starts while the write method is unknown, and the dates by which the method must exist. It covers `modules/pyramid-connector`. The rules every connector follows (module shape, field ownership, pending changes) are in [ADR 0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md).

## Decision drivers

* The write method is unknown, and the release cannot wait for it.
* NorthMES never writes to Pyramid's database.
* Write-back sends minute-precision plant local text, and DST nights repeat or skip an hour, so values read back must not look like ERP changes.
* One company can have several plants with the same codes, so lookups must run inside the order's plant ([ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md)).
* A hung or unreachable Pyramid must not hold workers for minutes or zero the stock balances.
* Unit, cycle-time basis and setup-row meanings are not verified, so no default may guess them.
* Customer data stays out of the repository, and payloads carry addresses and phone numbers that NorthMES does not import.
* Volume: in an internal measurement, replacing 50 000 stock rows wrote 33 MB of WAL per sync.

## Considered options

* Poll the SOAP web service and accept uploaded XML files; write back through a write-method adapter that starts in shadow mode
* Read Pyramid's database through ODBC, and write to it for write-back
* Exchange files only: import uploaded exports, and write back through the export file of Pyramid's graphical planning tool
* Write back live from the first build, with no shadow mode

## Decision outcome

Chosen option: "Poll the SOAP web service and accept uploaded XML files; write back through a write-method adapter that starts in shadow mode", because it works with what exists today (sample responses and uploaded files), lets write-back be built and checked against recorded request and response pairs before any live call, and lets a file export or a REST bridge replace the SOAP method behind the adapter if Pyramid has no write method. The mechanics come from internal research note 10 and the stress test (internal research note 32). The write method and the field meanings wait for pilot IT and the Pyramid administrator.

### Reading

* SOAP 1.1 over HTTPS with `fetch` and one hand-written envelope per method. NorthMES makes outbound calls only, from its host to IIS on the LAN. Every call uses `AbortSignal.timeout` with the connector's timeout setting.
* pg-boss queues ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)), names proposed: `pyramid_connector.poll_orders` (cron, default every 5 minutes, plus Sync now) and `pyramid_connector.poll_stock` (default every 15 minutes), both `stately` with `singletonKey` = connector id; `pyramid_connector.write_back`, `stately` with `singletonKey` = production order id; `pyramid_connector.reconcile`; `pyramid_connector.prune_payloads`.
* Each response is a full snapshot. fast-xml-parser runs with `parseTagValue: false` and options that reject external entities, `__proto__` element names, entity-expanding DOCTYPEs and deep nesting; Zod validates every element after parsing. `ProductionOrderNumber` (for example `5001.20`), `ReferenceNumber` and all codes stay opaque strings. The suffix of `5001.20` is an order row number, not the operation number.
* Only customer number and name are imported.
* Idempotency: a raw payload hash per run, a canonical hash per order, one transaction per changed order, and no writes for unchanged orders. Missing orders are found by set difference in memory, never by stamping rows, and a missing order is never deleted.
* File mode imports an uploaded response through the same parser: one endpoint, `POST /api/v1/pyramid-connector/import-file` (a first-party route of the connector, [ADR 0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md)), one file of at most 25 MB, content type `text/xml` or `application/xml`, the file's SHA-256 as input digest, permission `pyramidConnector.import:upload` at company scope (admin only by default). The import job acts for the uploader. The first import of pilot data runs in file mode on a throwaway installation and is reviewed there; there is no dry-run command.
* Inbox items are keyed by (externalRef, errorCode) with first seen, last seen and a count. An order whose last import failed shows `sourceStale`.

### Plants

* For each order the connector resolves the plant first (warehouse-to-plant rules, else the default plant) and runs the order's transaction with read and write scopes {company, mapped plant}, so a code lookup sees at most one match.
* Auto-created equipment and tools go to the mapped plant; equipment groups and customers go to the company. A company-level auto-create that hits the code exclusion constraint (SQLSTATE 23P01) goes to the inbox with the clash named.
* Per-entity state is `pyramid_connector.external_link(company_id, connector_id, entity_type, external_ref, entity_id, plant_id, last_seen, last_sent)`, unique on the first four columns.
* The connector settings hold no plant, zone or deadline time-of-day keys. ERP local times parse in the mapped plant's zone, read through `CoreApiModule`; write-back formats in the zone of the order's plant.
* An order that moves to another plant's warehouse, or whose operations map to two plants, is a row error. It goes to the inbox with a named reason, and the existing order stays unchanged until the product owner decides how plant moves work. Assigning an inbox item's `candidate_plant_id` checks `can()` at the target plant.

### Mapping settings without guessed defaults

* `cycleTimeBasis` (`perPiece` or `perCycle`) has no default; `perPiece` maps to `cycleSeconds = CycleTime x QuantityPerCycle`. The time units of `CycleTime`, `RetoolTime`, `LeadTime`, `LagTime` and `ExtendedTime` have no defaults either. The import refuses to map operations until they are set, and the integration card names the missing setting ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md)).
* A setting decides the plannable flag of auto-created equipment: plannable with an inbox review item, or the order is blocked until the code is mapped. `plan()` returns job orders on non-plannable equipment under `notPlannable`.
* OEE imports as a fraction; 0 or empty maps to null (inherit) with an import warning ([ADR 0027](0027-planned-duration-formula-and-override-precedence.md)).
* A setup row (`CycleTime` 0 with `ExtendedTime` set) followed by a production row on the same `EquipmentCode` folds into that operation's retool seconds by default, so autoplan cannot place another order's job between them. `setupRowRule: separate` keeps setup rows as operations and then requires adjacency on the same machine.
* A move to a machine without an external code warns. Write-back then keeps Pyramid's `EquipmentCode`, and the board marks the row "not mirrored".

### Echo detection on exact wire strings

* Last seen and last sent are stored per external reference and field as exact text: the raw XML text and the formatter's output. A poll classifies each value by string equality before any parsing. Equal to last sent (state `sending` or `sent`) is an echo; equal to last seen is unchanged; anything else is a real ERP change, handled by the ownership rules of [ADR 0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md).
* Write-back sends `yyyy-MM-dd HH:mm` in plant local time. Seconds are lost, and a time in the repeated autumn hour reads back as its first occurrence, so comparing instants would raise a false pending change after almost every write.
* The write-back job commits a `sending` row (value and job id) before the SOAP call and marks it `sent` afterwards. There is no per-order advisory lock, because a lock cannot span the SOAP call.
* If Pyramid normalizes written values, the first value read back after each write becomes that field's echo baseline.
* Local times parse with `resolveWallClock` and its clamp rule ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)): in `Europe/Stockholm`, `2027-03-28 02:30` resolves to 01:00Z and `2026-10-25 02:30` to 00:30Z. The formatter clamps an end that would format before its start to the first wall time after the repeated hour.
* On first import an operation becomes one job order at Pyramid's planned start. NorthMES computes the end with `addWork` over its own availability and logs the difference from Pyramid's end.

### Write-back

* Write-back is state transfer. The handler reads the order's current committed state and sends every operation row whose state differs from last sent: planned start (earliest job order start), planned end (latest job order end), `EquipmentCode` when all job orders of the operation sit on one machine with an external code, `IsLocked`, the statuses NorthMES owns and priority. Reported quantities go only when operators report in NorthMES and the method accepts them. Draft and proposal content never reach Pyramid. A payload equal to last sent after minute rounding is skipped, and worker concurrency is a setting.
* A write-method adapter hides the transport, so a file export or a REST bridge can replace the SOAP method.
* Shadow mode is the default, and the only mode until a write method is verified. A shadow send writes `shadow_payload` and `shadow_at`, makes no call and never updates last sent. The planner gets a daily write-back report of what NorthMES would have written. In shadow mode every polled planned time that differs from the latest shadow text is logged, so the pilot shows how Pyramid's text and NorthMES's formatting compare.
* Going live is an audited settings command ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)). The settings schema refuses `writeBackMode: live` until the write-method adapter is configured and field ownership is answered. Going live enqueues a one-time reconcile of all open orders: compare each order's state with Pyramid's last seen values, show the admin the count and a sample, and on confirmation enqueue one write-back per differing order. The sender re-reads the mode inside the job right before the call.
* The same reconcile is the last step of `restore.sh` and `rollback.sh`, after the next poll has reset last seen, because a restore sets last sent back in time while Pyramid keeps the later plans ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).
* Build order: file-mode import, then shadow write-back whose body matches the recorded pairs, then the live transport.
* A diff preview screen before going live and a switch per field group (which fields write back) wait until the write method is known.

### Downtime and storage

* Transport errors retry with `retryBackoff` and a high `retryLimit`, or a dead letter that failed on transport is redriven on the first successful poll. The dead letter keeps only SOAP faults on data.
* A shrink guard holds a run as an inbox item for an admin when it would flag more than max(10, 20 percent) of open orders missing, or cut the stock rows below 50 percent of the previous run.
* The board header shows "Pyramid data as of <time>" through planning's header slot `planning/board/header/v1` ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)), and `/health/ready` lists Pyramid as degraded while it is unreachable ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)).
* A raw payload is stored only when its hash changes, after stripping `Customer` elements other than `ExternalId` and `CustomerName`. The connector keeps the last 50 runs per method plus runs that open inbox items reference, and nothing older than 7 days. The raw payload, inbox and run log tables are command-only with the payload hash on the command row. The stock snapshot applies as a diff keyed by (connector, ReferenceType, ReferenceNumber, ArticleNumber, Warehouse). Postgres TOAST compresses payloads; the app does not.
* A circuit-breaker table and per-order desired and sent versions wait.

### Dates and fallback

| Date | What must hold |
|---|---|
| 2026-10-15 | One written request goes to the pilot's Pyramid administrator and the Pyramid reseller ([08-pyramid-connector.md](../plan/08-pyramid-connector.md), section 17) |
| 2026-11-13 | Method names received |
| 2026-12-18 | A test company endpoint or recorded request and response pairs |
| 2027-01-22 | Live write-back verified (target) |
| 2027-02-26 | If no write path exists, the product owner picks one: a file export that Pyramid imports, a third-party REST bridge for Pyramid, or a pilot without ERP write-back |

If live write-back is late, item 4 of the cut order in [ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) applies: the pilot runs shadow mode with the daily report, if the product owner accepts double entry in Pyramid for a set period. Recorded pairs are customer data: they arrive only after the data processing agreement with the pilot customer is signed, and they are never committed to any repository. Tests use a synthetic pair written to their structure.

### Consequences

* Good, because development and the first pilot weeks run on uploaded files before network access to the web service exists.
* Good, because write-back is built and tested against recorded pairs and a fake server before any live call, and a missing method changes only the adapter.
* Good, because echo detection on wire text survives minute rounding and DST nights without false pending changes.
* Good, because unchanged polls write nothing and stored payloads hold no addresses or phone numbers.
* Bad, because polling every 5 minutes limits how fresh ERP data is.
* Bad, because until a write method is verified, planners may have to enter plans in Pyramid by hand.
* Bad, because the import refuses to run until pilot IT confirms units and the cycle-time basis.

### Confirmation

The tests run against a fake PWS server and synthetic fixtures; names other than `write-back.contract.test.ts` are proposed in [08-pyramid-connector.md](../plan/08-pyramid-connector.md), section 16.

* `parser.test.ts`: references stay strings and `5001.20` differs from `5001.2`; three date formats parse and others fail; external entities, entity-expanding DOCTYPEs, `__proto__` names and deep nesting are rejected.
* `mapper.test.ts`: a setup pair folds into one operation with 2 700 s of retool; `CycleTime` 15, `QuantityPerCycle` 3 and quantity 9 give 135 s with `perPiece` and 45 s with `perCycle`, and mapping fails while the basis is unset; OEE 0 maps to null with a warning.
* `echo-detection.int.test.ts`: a committed job order [2026-10-25T01:30:00Z, 2026-11-06T13:31:20Z] writes `2026-10-25 02:30` and `2026-11-06 14:31`; a poll returning those strings is an echo with zero pending changes; `2026-10-25 02:45` yields one pending change; a poll held between the SOAP call and the `sent` mark sees an echo.
* `shadow-live.int.test.ts`: two saves in shadow mode write two shadow rows and make no calls; after going live the reconcile lists both orders and the fake server receives exactly two writes; switching back to shadow with a job queued gives zero requests.
* `plant-scope-import.int.test.ts`: with warehouses mapped to plants in `Europe/Stockholm` and `Europe/Helsinki`, every job order and tool lands in its own plant and a replay produces zero commands; an order moved to the other plant's warehouse creates one inbox item and no new order.
* `downtime.int.test.ts`: 24 simulated hours of refused connections while a planner moves 30 orders end with one write-back per order and an empty dead letter; an empty order list after recovery flags zero orders missing; a 60 s response delay fails at the configured timeout.
* `payload-storage.int.test.ts`: a 20 000-row stock snapshot applied twice with 5 percent changed stays under the agreed WAL budget; stored payloads hold no address or phone elements; 288 identical polls produce zero `audit.change` rows.
* `inbox.int.test.ts`, `auto-create-equipment.int.test.ts`, `dst-formatter.test.ts` (fast-check: the formatted end is never earlier than the start on both transition nights), `settings.test.ts` (rejects a `timeZone` key; refuses `live` without a write method), and an upload test (a 26 MB file returns 413; the permission at one plant only returns 403).
* `write-back.contract.test.ts` compares canonicalized XML from the envelope builder with the synthetic fixture, and the fake server received that body. An opt-in live test runs only against the Pyramid test company with `NORTHMES_PYRAMID_LIVE=1`, never on pull requests.
* The nightly restore drill: a drill copy with live write-back configured sends zero requests to the fake server. `e2e/pyramid-import.spec.ts` imports through the fake server, saves a planner's move and checks the recorded shadow or live body.

## Pros and cons of the options

### SOAP polling, file mode and a shadow-first write-method adapter

* Good, because it uses the web service that Pyramid's handbook documents, and file mode needs no network path.
* Good, because shadow mode and the reconcile make the switch to live a checked, audited step.
* Bad, because the methods in the samples may be a customization that other Pyramid sites lack.

### ODBC on Pyramid's database

* Good, because reading needs no web service.
* Bad, because writing bypasses Pyramid's logic, so write-back would still need another path.
* Bad, because reads bind NorthMES to one database schema and engine of one Pyramid version.

### Files only

* Good, because Pyramid's graphical planning tool already has file menus to import from and export to Pyramid.
* Bad, because the file format is not public, every sync needs a manual step, and imports cannot run every 5 minutes.

### Live write-back from the first build

* Good, because planners never enter plans twice.
* Bad, because the method is unknown, and a wrong write changes the ERP's plan before anyone has compared the formats.

## More information

* Related ADRs: [0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md) codes per scope, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) jobs, [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) settings, [0023](0023-si-units-with-a-northmes-unit-catalog.md) units, [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) time, [0027](0027-planned-duration-formula-and-override-precedence.md) duration, [0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md) connector rules, [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md) health, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) restore and rollback, [0047](0047-secrets-and-the-installation-key.md) the SOAP password and endpoint binding, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) cut order, [0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md) the upload route's family.
* Plan: [08-pyramid-connector.md](../plan/08-pyramid-connector.md) (field mapping, settings, fixtures, the questions for the Pyramid administrator); [17-risks.md](../plan/17-risks.md), R-03; [16-open-questions.md](../plan/16-open-questions.md).
* Open for pilot IT and the Pyramid administrator: the write method and its key, whether Pyramid stores written times verbatim and how it treats an end before its start, `CycleTime` per piece or per cycle, the time units, whether `EquipmentCode` is a machine or a resource group, whether `FinishedQuantity` counts good pieces only and whether scrap exists, and whether setup rows are separate operations at this site. Open for the product owner: the fallback write path, plant moves and orders that span two plants.
* Revisit on each date in the table above, and when the administrator confirms a changed-since filter, which would end full snapshots.
