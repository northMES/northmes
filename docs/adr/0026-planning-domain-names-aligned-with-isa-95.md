---
status: "proposed"
date: 2026-10-05
decision-makers: "proposed by the planning session, to be confirmed by Krister Johansson"
consulted: "internal research notes 09, 10, 16, 24 and 32"
informed: "product owner"
release: "1"
needs-confirmation: ""
---

# Planning domain names aligned with ISA-95

## Context and problem statement

The first brief calls a production order a "batch" and a block on the planning board a "batch row", while the product owner's own description uses "batch" for one operation step. Elsewhere the same words mean other things: in ERPNext a batch is a lot of finished goods, in ISA-88 a batch is a recipe execution, and the later ingestion port receives event batches. "Work center" is the machine in Odoo and SAP but a grouping of equipment in ISA-95. "Job" also names background jobs in the queue library. Names in code become public contracts once released: GraphQL types and fields, event names, error codes, permission ids and test names. Connector authors meet ERP and ISA-95 vocabulary and need one mapping.

The product owner has also answered the planning questions on the ERP sample files. Those answers are the planning baseline, and they must not make core ERP-specific.

This ADR fixes the code names, UI labels and statuses of the planning domain and records the product owner's planning rules that other ADRs build on. `GLOSSARY.md` at the repository root holds the definitions.

## Decision drivers

* Unambiguous names for people who also read ERP and ISA-95 documents.
* Stable public contracts: a name in GraphQL, events or error codes is expensive to change after a release.
* Core stays ERP-agnostic: NorthMES is built first for companies without an ERP, and each ERP connects through one integration module.
* Code, tests and issues use the glossary terms.
* An order keeps a copy of its routing with the source operation id and version ([ADR 0051](0051-regulated-readiness-no-regret-rules.md), rule 8).

## Considered options

* ISA-95 names in code where a term exists, ISA-95 as a glossary page in the docs, and separate UI labels
* The product owner's and the brief's words in code (`batch`, `batchRow`)
* ISA-95 and B2MML as the schema (operations requests, segment requirements and job orders as tables and types)

## Decision outcome

Chosen option: "ISA-95 names in code where a term exists, ISA-95 as a glossary page in the docs, and separate UI labels", because the names have published definitions, avoid the collisions above, and leave the UI free to use the words planners know.

### Names

| Code name | UI label | ISA-95 | Pyramid word | Not in code |
|---|---|---|---|---|
| `company` | Company | Enterprise | | organization (stays inside the auth module) |
| `plant` | Plant | Site | | site |
| `equipmentGroup` | Equipment group | Equipment class | `EquipmentCategory` | work center, category |
| `equipment` | Machine | Work center of type work cell | `EquipmentCode` | work center, resource |
| `tool` | Tool | Equipment specification | a `CustomData` field named in the connector mapping | |
| `article` | Article | Material definition | `ArticleNumber` | material, item, product |
| `routing`, `routingOperation` | Routing, Operation | Operations definition, operations segment | | |
| `operationEquipment`, `operationTool`, `operationMaterial` | Machines, tools and material for an operation | Equipment and material specifications | `BillOfMaterials` line for material | |
| `customerOrder`, `customerOrderLine` | Customer order, line | outside ISA-95 | `CustomerOrderNumber` | |
| `productionOrder` | Production order | Operations request of type production | `OrderNumber` | batch, lot |
| `productionOrderOperation` | Operation (on an order) | Segment requirement | `ProductionOrderNumber`, such as `1001.20` | |
| `jobOrder` | Job | Job order | (the product owner's "batch row") | batch row, batch, job |
| `productionOrderDemand` | Demand | Pegging | | allocation |

Naming rules:

* No `batch` for a planning concept and no `workCenter` anywhere in code. `batch_row` disappears from event, error and test names before they become public contracts.
* "Job" is a UI label only. Code uses `jobOrder`, and prose calls queue work a "background job".
* `allocation` stays free for later stock reservations. Better Auth's `organization` stays inside the auth module.
* "Frozen window" means the planning time fence and "frozen by reports" means a job order that carries reports. Neither is shortened to "frozen".
* ISA-95 is a glossary page in the docs, not a schema. Each glossary definition names the Pyramid word where one exists, and Pyramid words appear in code only inside the Pyramid connector module.

### Statuses

Production orders, production order operations and job orders use the product owner's six statuses plus `cancelled`: `registered`, `planned`, `active`, `paused`, `finished`, `delivered` and `cancelled`. Pyramid's `ProductionStatusId` 1 to 6 map to the first six in that order. Operations have no `delivered`; job orders have neither `registered` nor `delivered`. Each entity follows a transition table, and cancelling never deletes rows. The working transition tables and their open points are in [07-production-planning.md](../plan/07-production-planning.md#statuses-and-transitions). Status columns are `text` with a check constraint, not Postgres enums ([04-data-and-platform.md](../plan/04-data-and-platform.md#query-rules)).

### Planning rules from the product owner

These answers are the planning baseline. The ADR named next to each rule specifies it.

* NorthMES is built first for companies without an ERP; every ERP connects through one integration module, and nothing in core is ERP-specific ([ADR 0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md)).
* Several customer order lines for the same article are gathered into one production order at production start. A production order splits into job orders, for example on two machines. NorthMES creates its own production orders and BOMs.
* Autoplan plans backward from the order deadline; equal deadlines go to the lowest priority number ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* Retool time is per operation and varies per article. Lead time sits on the waiting operation; NorthMES has no separate lag time, and the connector maps Pyramid's `LagTime` onto lead time ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)). The send-ahead quantity (Pyramid's `StartNextAfterQuantity`) lets the next operation start after N pieces ([ADR 0027](0027-planned-duration-formula-and-override-precedence.md)).
* Cycle time is entered as seconds or pieces per hour and stored as seconds, with a target, a minimum and maximum alarm window and a valid cycle time ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md)).
* "Do not update" on an operation or operation equipment row blocks import updates to that row. Unknown tools are created on import.
* Equipment with `isPlannable` or `isOee` appears on the board. An equipment group keeps an existing color, else takes the import color, else one of 20 palette colors. Board settings choose the fields shown on a block and on hover.
* Hard-locked rows (`isLocked`) cannot move. A planner's unsaved move blocks other planners, who are told and can break the lock ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)).
* Times from ERPs are plant local time ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* Releasing an order copies its routing; each production order operation records `source_operation_id` and `source_operation_version`.

### Consequences

* Good, because code, GraphQL, events and tests share one vocabulary that maps to ISA-95 and to each ERP through the glossary.
* Good, because a job order and a background job can no longer be confused in code.
* Bad, because planners and the product owner say "batch" and "batch row", so the glossary and the UI labels must translate, and issue writers must use the glossary terms.
* Bad, because `jobOrder` and `productionOrderOperation` are long in every name.
* Neutral, because ISA-95 levels that release 1 does not need (areas, lines, material lots) are reserved in the glossary, not built.

### Confirmation

* A lint fails on `batch_row` in contracts packages; the same pattern check fails on `batchRow`, `BatchRow` and `workCenter` identifiers in `modules/*` and `packages/*`.
* A schema test fails when the committed `api.graphql` contains a type, field or enum value whose name contains `Batch` or `WorkCenter`.
* `status-transitions.test.ts` per entity: every transition outside the table is refused, and cancelling an order cancels its unstarted job orders without deleting a row.
* `release.int.test.ts` on Testcontainers Postgres: releasing an order copies its routing with `source_operation_id` and `source_operation_version`, and editing the routing afterwards leaves the order unchanged.
* The pull request review checklist asks that a new domain term is added to `GLOSSARY.md` in the same pull request, with the words to avoid.

## Pros and cons of the options

### ISA-95 names in code, a glossary page, separate UI labels

* Good, because each term has a published definition in ISA-95 and B2MML.
* Good, because it avoids the batch, work center and job collisions.
* Bad, because some names are long and unfamiliar to planners, so UI labels differ from code names.

### The product owner's and the brief's words in code

* Good, because they match how the pilot plant talks today.
* Bad, because "batch" collides with lots, ISA-88 batches and ingestion batches, and the source material itself uses it for two different things.

### ISA-95 and B2MML as the schema

* Good, because a later B2MML import or export would map one to one.
* Bad, because ISA-95 models far more than release 1 needs, such as segment dependencies and twelve request states.
* Bad, because B2MML leaves unit codes and code lists open, so the schema would still need NorthMES rules on top.

## More information

* Related ADRs: [0014](0014-outbox-event-log-and-pg-boss-jobs.md) (event names), [0023](0023-si-units-with-a-northmes-unit-catalog.md), [0027](0027-planned-duration-formula-and-override-precedence.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md), [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md), [0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0051](0051-regulated-readiness-no-regret-rules.md).
* Glossary: [GLOSSARY.md](../../GLOSSARY.md). Plan: [07-production-planning.md](../plan/07-production-planning.md#names).
* Public sources: [ISA-95 standard](https://www.isa.org/standards-and-publications/isa-standards/isa-95-standard), [MESA B2MML-BatchML schemas](https://github.com/MESAInternational/B2MML-BatchML).
* Revisit when a second ERP connector arrives, when B2MML export is built, and when Data collection or traceability add material lots and reports.
* Background: internal research note 09.
