---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 03, 06, 10, 11, 19 and 32
informed: contributors, coding agents and the product owner
release: "1"
needs-confirmation: "product owner (customer order line scope); maintainer (one plant at a time)"
---

# Tenancy: company, plants and the scope tree

## Context and problem statement

A manufacturer may run several plants, and one customer may hold several companies. Articles and routings are shared across a company, while equipment belongs to one plant. Better Auth's organization plugin offers organizations and memberships, but no sub-organization, no role on team membership and no scope below the organization, so it cannot scope a role to a plant (internal research note 01).

Krister Johansson decided that a Better Auth organization is a company, that plants live in NorthMES's own table, that a scope tree holds the company and its plants, that master data rows sit at company or plant level, and that codes are unique per scope. This ADR records that decision and the rules that follow from it: where each entity lives, how a request names its plant, and the proposed scope of customer order lines.

It covers core's tenancy tables, the gateway's plant handling, the shell's plant routes and every module table with a `scope_id`. Row-level security is in [ADR 0008](0008-row-level-security-with-transaction-local-scopes.md), code uniqueness and cross-scope references in [ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md), roles and `can()` in [ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md).

## Decision drivers

* Reading at plant A returns plant A rows plus company rows, never plant B rows.
* Company roles and plant roles need a scope node to attach to.
* A planner may keep two plants open in two browser tabs.
* An unknown or unauthorized plant must fail, never fall back to a default plant. The integration spike silently fell back to the user's first plant (internal research note 32).
* Areas and lines may join below plants later without a rewrite.

## Considered options

* A Better Auth organization as the company, plants and a scope tree in core tables, one plant per request
* One Better Auth organization per plant
* The active plant stored on the session

## Decision outcome

Chosen option: "A Better Auth organization as the company, plants and a scope tree in core tables, one plant per request", because it gives company rows and plant rows one model, keeps every authorization fact in NorthMES tables, and lets two tabs work on two plants. The one-plant-per-request rule and the customer order line scope come from the stress test (internal research note 32) and wait for the confirmations named in the front matter.

### Companies, plants and the scope tree

* A Better Auth organization is a company. NorthMES uses Better Auth for identity, sessions and organization membership; roles and role assignments live in core tables ([ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md)).
* Plants live in `core.plant`. Each plant's id equals its node id in `core.scope`, and each plant has a slug that is unique per company.
* `core.scope` is the scope tree. The company is the root and plants are its children. Areas and lines can join below plants later.
* Each scope node has an `int8range` span. The company's span is unbounded `(,)`. Plant number k gets `[k << 32, (k + 1) << 32)`, which leaves room for areas and lines. Spans drive the code uniqueness constraint and the cross-scope reference check ([ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md)).
* Every scoped row carries `scope_id`, and child tables copy `scope_id` from their parent.
* One installation serves one customer, which may hold several companies.

```sql
-- core.scope (shape; core's migration is the source)
create table core.scope (
  id         uuid primary key default uuidv7(),
  company_id uuid not null,
  parent_id  uuid references core.scope (id),
  kind       text not null check (kind in ('company', 'plant')),
  span       int8range not null,
  unique (id, company_id, span)
);
```

### Where rows live

Each entity type declares the scope levels it allows in its master-data definition ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)).

| Entity | Scope level |
|---|---|
| Equipment | plant |
| Equipment groups | company or plant |
| Tools | company or plant; the level of operation tools is open ([ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md)) |
| Articles, routings | company |
| Customers | company |
| Customer order header | company |
| Customer order line | the delivering plant when known, otherwise the company (proposed, see below) |
| Production orders, their operations and job orders | plant |
| Production order demand | the production order's plant |

A child production order is always created in its parent's plant.

### One plant per request

* In release 1 every request carries exactly one plant: the route `/$plant/...` and the `x-northmes-plant` header that the Apollo link sends. REST routes take the plant from the path and never default it for a user with several plants.
* The plant is never stored on the session, so one planner can keep two plants open in two tabs.
* An unknown plant slug in the URL is `NOT_FOUND`, never a fallback to a default plant.
* The gateway checks `x-northmes-plant` against `core.role_assignment` with the ancestor walk. An unknown or unauthorized plant fails with `FORBIDDEN`, `errorCode` `core.plant_forbidden`, and writes one `permission.denied` security event.
* A request reads the company scope plus its plant. The write set is computed in [ADR 0008](0008-row-level-security-with-transaction-local-scopes.md).
* Before one installation holds two companies, either the company joins the URL or the server rejects a slug outside the session's organization.
* Company mode (`x-northmes-plant: *`, `/_company/<id>/*`) and `core.code_holders` wait for a customer that uses several plants at once. When the two-plant production-day report is built, the core API exposes each plant's `time_zone` and `production_day_start` ([ADR 0025](0025-plant-calendars-shift-patterns-and-the-production-day.md)).
* The maintainer confirms that a company user works one plant at a time in release 1.

### Customer order lines (working proposal)

The product owner confirms this before the customer order migration is written. Until then it is the working default.

* The customer order header sits at company scope.
* Each line's `scope_id` is the delivering plant when known, from the connector's warehouse-to-plant mapping of the order row ([ADR 0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md)), and the company otherwise.
* Setting or changing a line's delivering plant is its own command and needs permission at company scope.
* Production order demand sits at the production order's plant and may reference only lines of the same plant or the company.
* Supplying one plant's production to another plant's line is rejected in release 1.

### Consequences

* Good, because every module uses one row model: a `scope_id` plus the ancestor walk.
* Good, because company master data is shared by every plant, and plant rows stay invisible to other plants.
* Good, because a planner can work on two plants in two tabs, and every request, job and MCP call names its plant explicitly.
* Bad, because every request, REST route, subscription and MCP tool must carry a plant, and a missing or wrong plant is an error.
* Bad, because a company user sees one plant at a time until company mode exists.
* Bad, because Better Auth's own organization roles are not used for authorization, so NorthMES maintains its own role tables and checks.
* Bad, because changing the customer order line scope after the customer order migration means a data migration.

### Confirmation

Integration tests with Testcontainers, using a company with plants HEL and STO:

* Reading equipment groups at HEL returns HEL rows and company rows and no STO rows.
* A viewer at plant A who sends `x-northmes-plant` B gets `FORBIDDEN` with `errorCode` `core.plant_forbidden`, `data` null and one security event with `detail.plant` B.
* An unknown plant slug returns `NOT_FOUND`.
* `companyPlanner` with only a company assignment reads orders at HEL and at STO.
* `helPlanner` calling `coreUpdateArticle` on a company article on `/hel` gets `FORBIDDEN` with `errorCode` `core.forbidden`; `companyPlanner` succeeds, and `audit.command.roles` lists the role held at the company.
* `GET /api/web/modules` without a session returns 401, and with `?plant=B` for a viewer at A returns 403.
* Customer order 9001 with line 1 from STO, line 2 from HEL and line 3 unassigned: `helPlanner` reads the header and lines 2 and 3, updates line 2's promised date, and gets `FORBIDDEN` assigning line 3; `companyPlanner` succeeds. Allocating a HEL production order to line 1 fails with `core.crossScopeReference`. An order row whose warehouse maps to HEL gives a line scoped HEL.
* Creating a child production order of a HEL order creates it at HEL.

End-to-end: one signed-in browser context opens `/hel` and `/sto` in two pages, and each page shows only its own plant's orders.

## Pros and cons of the options

### Organization as company, scope tree in core tables, one plant per request

* Good, because company and plant rows, roles and codes share one tree that can grow areas and lines.
* Bad, because NorthMES writes the tree, the ancestor walk and the plant checks itself.

### One Better Auth organization per plant

* Good, because Better Auth's organization roles and invitations would apply per plant.
* Bad, because company master data shared by all plants would belong to no organization.
* Bad, because a company role would need a membership in every plant's organization, and Better Auth has no organization hierarchy to tie them together.

### The active plant on the session

* Good, because requests would need no plant header or route segment.
* Bad, because a planner with two tabs on two plants would act on whichever plant the last tab selected (internal research note 01).
* Bad, because subscriptions, REST exports and MCP tools still need an explicit plant.

## More information

* Related ADRs: [0008](0008-row-level-security-with-transaction-local-scopes.md) row-level security, [0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md) codes and cross-scope references, [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md) roles and `can()`, [0011](0011-principals-credentials-and-same-origin-rules.md) principals, [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md) subscriptions, [0025](0025-plant-calendars-shift-patterns-and-the-production-day.md) production day, [0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md) and [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) connector plant mapping, [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md) MCP plant argument.
* Plan: [04 data and platform](../plan/04-data-and-platform.md) (tenancy and the scope tree), [07 production planning](../plan/07-production-planning.md), [16 open questions](../plan/16-open-questions.md).
* Terms: [GLOSSARY.md](../../GLOSSARY.md).
* Revisit when a customer needs company mode across plants, when a second company joins one installation, or when areas or lines need their own scope nodes.
