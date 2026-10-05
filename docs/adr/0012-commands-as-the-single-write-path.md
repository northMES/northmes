---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 02, 16, 18, 20, 22, 24, 32, 33 and 34
informed: module and plugin authors, coding agents
release: "1"
needs-confirmation: ""
---

# Commands as the single write path

## Context and problem statement

Writes reach NorthMES from many surfaces: GraphQL mutations from the web, the operator station, the MCP propose tool, the in-app assistant, jobs such as autoplan, the Pyramid connector, the CLI and, later, an integration REST API. Each write needs the same permission check at the changed row's scope, one audit record in the same transaction, the command validators that dependent modules and plugins attach, an optimistic version check, outbox events and a stable error. The earlier attempt marked mutations with an `@Audited` decorator that no runtime ever read, and each service wired permissions, audit and error mapping by hand, so the copies drifted.

This ADR decides that every write is a command run by one pipeline, the order of the pipeline's steps, where a command's contract and handler live, and the error model every surface shares. It covers `@northmes/sdk/commands`, the module contracts packages, the GraphQL mutation exposure, the SDK exception filter and every other surface that writes.

## Decision drivers

* Audit is written in the same transaction as the change ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).
* Plugins attach backend command validators through the module contract ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)).
* Permission is checked at the scope of the row a command changes ([ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md)).
* The GraphQL contract must not change when a later compliance profile requires a reason or a signature ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)).
* A retry after a timeout or a restart must not create a row twice.
* Error codes are a public contract that clients and plugins match on.
* Unknown errors never leak their message to a client.

## Considered options

* One command pipeline that every surface calls, with every Mutation field mapped to a registered command
* Resolvers and services that write directly, with decorators for permission and audit
* Mutation payload unions that return errors as data, with direct writes behind them

## Decision outcome

Chosen option: "One command pipeline that every surface calls", because it is the one place where permission, audit, validators, version checks and events can be enforced for every surface, plugins included, and a write that bypasses it fails on the audit trigger.

A command has two parts. Its contract lives in the module's MIT contracts package: name, target, the Zod `fields` schema from which the SDK derives the input ([ADR 0017](0017-zod-contracts-as-the-single-source-for-inputs.md)), permission, `validatable` flag, reason and signature requirements, and error codes. Its handler lives in the module's AGPL server code. The command `planning.releaseProductionOrder` is exposed as the mutation `planningReleaseProductionOrder`; the SDK generates the mutation field, so a module writes no resolver for it.

```ts
// modules/planning/contracts (MIT)
export const releaseProductionOrder = defineCommandContract({
  name: "planning.releaseProductionOrder",
  target: "existing",       // contract.input adds id and expectedVersion
  fields: z.object({}),
  permission: "planning.productionOrder:release",
  validatable: true,
  reason: "optional",
  signature: "none",
});
// modules/planning/server/commands (AGPL)
export const releaseProductionOrderHandler = defineCommand(releaseProductionOrder, {
  scope: ({ id }, { data }) => productionOrders.scopeOf(data, id),
  async handle({ id, expectedVersion }, { data, events }) { /* domain rule, update, events.publish */ },
});
```

The pipeline runs every command, from every surface, in this order:

| Step | Rule |
|---|---|
| 1. Parse | Parse the input with the contract's Zod schema. A failure is `BAD_USER_INPUT` with `fieldErrors`. The contract validates measured values in the unit the person typed; after the parse, this step converts them to canonical SI units and then checks their limits, and a limit failure returns `fieldErrors` at the field's path with the limit stated in the unit the person typed ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md), [ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md)). |
| 2. Scopes | Open the transaction; its first statement sets `read_scopes` and `write_scopes` ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)). |
| 3. Permission | Load the target (or take the requested scope for a create), check references with the SDK reference resolver ([ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md)) and call `can(principal, permission, scope)`. A denial rolls back and writes a `permission.denied` security event on a separate connection. |
| 4. Audit context | `audit.begin_command(...)` records principal, surface, scope, roles, reason, proposal id and correlation id. The reason comes from one shared optional input that every mutation accepts. |
| 5. Version | A stale `expectedVersion` fails with `core.version_conflict`. |
| 6. Validators | Validators run only on commands declared `validatable`, from modules that depend on the owner, in dependency order and then by name. They can only veto (`core.command_rejected` with `rejectedBy`). A validator that times out or throws also rejects the command, and a throw is masked as an unexpected error. |
| 7. Signature | Reserved stage, a no-op in release 1, so a later re-authentication binds to one command id. |
| 8. Execute | The handler writes through the `/data` helpers; the audit trigger records field diffs. |
| 9. Events | Events go into `core.event` in the same transaction, with the entity's new version and the audit command id as causation id ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)). |
| 10. Commit | Commit, then map errors as below. |

* One transaction is one audit command. Nested commands share the outer command's audit id.
* Every GraphQL Mutation field maps to a registered command handler, and boot exits when one does not.
* Release 1 requires a reason only where a contract says so, for example breaking a soft lock or correcting a station report. A later profile that requires reasons everywhere returns `REASON_REQUIRED` without changing the schema.
* Create-type commands take a client-generated uuidv7 `id` and insert with `on conflict do nothing`, so a retry after a timeout or a restart returns the first row.
* Fact commands at the station (start, pause, finish, report quantity, correct report) are not validatable, because they record something that already happened ([ADR 0033](0033-online-operator-station-in-the-production-start-module.md)).
* Validation errors are not audited. A denied or failed command rolls back, so it leaves no command row.

Error model:

* One error type, `DomainError { code, kind, message, details?, fieldErrors? }`. `kind` is `validation`, `unauthenticated`, `not_found`, `forbidden`, `conflict`, `precondition` or `unavailable`. A `DomainError` may carry `fieldErrors: [{ path, message, code }]` with paths relative to the command input.
* Each module declares its codes with `defineErrors` in its contracts package, each with a kind, an optional Zod schema for `details` and an optional `field: <dot path>`. A thrown error of a code that declares `field` fills `fieldErrors` from it. Codes start with the owning module's id and are never renamed after a release.
* Codes named so far include `core.forbidden`, `core.plant_forbidden`, `core.version_conflict`, `core.not_found`, `core.archived`, `core.code_taken`, `core.crossScopeReference`, `core.command_rejected`, `core.validator_contract_mismatch`, `core.client_outdated`, `core.secret_reentry_required`, `core.list.invalid_cursor`, `planning.production_order.locked`, the request codes `core.request.malformed`, `core.request.too_large`, `core.request.unsupported_media_type` and `core.request.rate_limited` (M-51), and `core.internal` for a masked error.
* GraphQL errors carry `extensions` with `code` (from the kind), `errorCode`, `fieldErrors`, `details` and `correlationId`. The exception filter writes a `DomainError`'s `fieldErrors` to `extensions.fieldErrors` in the same shape as a Zod failure. REST routes answer with RFC 9457 problem details built from the same error. Result unions are not used.
* Database errors map in one SDK function, `toDomainError(error)`, which the pipeline's error step, the jobs wrapper, the tool runner and the exception filter all call: SQLSTATE 42501 to `FORBIDDEN` (`core.forbidden`); 23P01 on a code exclusion constraint and 23505 on a code key to `core.code_taken`, with `fieldErrors` on the definition's `code` field; 23514 on a scope span check to `core.crossScopeReference`. When a versioned update touches zero rows, the `/data` update helper raises `core.version_conflict`, or `core.not_found` when the row is gone.
* One global exception filter (`@Catch()` with no arguments, registered once as `APP_FILTER`) answers resolvers with GraphQL extensions and REST routes with problem details. Guards throw `DomainError` instead of returning false; Nest `HttpException`s and body-parser errors map by status; other 4xx statuses keep their status with a `core.request.*` code. The filter masks every unknown error as "Unexpected error." with the correlation id, inside the subgraph, whatever the transport. The gateway's masking is a second layer. The rules are in [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md#the-exception-filter).

### Consequences

* Good, because a new surface or a plugin gets permission, audit, validators, versions and events by calling the pipeline.
* Good, because a write outside a command fails on the audit trigger, so a missed path shows up in tests.
* Good, because the reason input and the signature stage exist now, so a regulated profile changes behaviour without changing the GraphQL contract.
* Bad, because validators add latency and a failure mode to validatable commands; a slow or broken plugin validator blocks those writes, by design.
* Bad, because error codes are permanent once released, so naming mistakes stay; earlier names such as `batch_row` are removed before the first release ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)).
* Bad, because seeds, fixtures and CLI tools also need a command context; `@northmes/testing` provides `db.command({ principal, scopes, reason }, fn)` with surface `cli`.

### Confirmation

* Boot test: a Mutation field without a registered handler makes boot exit 1 and names the field.
* Command pipeline contract suite in `@northmes/testing`, `command-pipeline.int.test.ts`:
  * A command denied at the target's scope leaves no command row and writes one security event.
  * A validator that sleeps past its limit rejects the command, and the handler does not run.
  * A validator that throws returns "Unexpected error." and the handler does not run.
  * A successful command writes exactly one `audit.command` row whose id equals the `causation_id` of each of its events.
  * A stale `expectedVersion` returns `core.version_conflict` and leaves the row unchanged.
  * A create retried with the same client id returns the first row and writes one audit command.
* Boot test: a validator on a command that is not declared validatable, or from a module without `dependsOn` on the owner, makes boot exit 1.
* Permission test: a plant planner calling `coreUpdateArticle` on a company article gets `FORBIDDEN` with `errorCode` `core.forbidden`, never "Unexpected error.".
* Schema test: every Mutation field accepts the shared reason input; a test profile that requires reasons returns `REASON_REQUIRED` while the committed supergraph snapshot stays unchanged.
* Masking test: a plain `Error` thrown in a resolver reaches the client as "Unexpected error." with a correlation id, over HTTP and over graphql-ws; a plain `Error` on a REST route returns 500 `application/problem+json` with the correlation id and without the error text; an error thrown by the per-event check ends that subscription with "Unexpected error." and a correlation id.
* Filter test: a guard denial on a REST route returns 403 problem details with code `core.forbidden`; malformed JSON returns 400 problem details.
* Pipeline contract case: a 23P01 on a code inside a command run by a job gives `core.code_taken`.
* Master-data kit contract suite: a duplicate code returns `fieldErrors` on `code`.
* `gateway/errors.int.test.ts` (proposed name): a `DomainError` with a declared `field` returns `fieldErrors` in the Zod shape.
* Error catalog check: CI compares the declared error codes with the previous release's list and fails when a released code is removed or renamed.
* Shutdown test ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)): a 1.5-second mutation with `app.close()` after 300 ms returns 200 and leaves one `audit.command` row.

## Pros and cons of the options

### One command pipeline for every surface

* Good, because permission, audit and validators cannot be forgotten per resolver.
* Good, because the order of steps is fixed and tested once.
* Bad, because simple writes still pass through every step.

### Direct writes with decorators

* Good, because each resolver is short and explicit.
* Bad, because decorators are metadata; the earlier attempt shipped 135 `@Audited` marks that no runtime read.
* Bad, because jobs, the connector and the CLI do not pass through GraphQL resolvers, so each would need its own wiring.

### Errors as data in payload unions

* Good, because the schema lists each mutation's errors.
* Bad, because every client handles a union per mutation, and REST, MCP and the assistant runner still need a separate error shape.
* Bad, because it changes nothing about where permission, audit and events are enforced.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md) (manifest `commands` with `validatable`), [0008](0008-row-level-security-with-transaction-local-scopes.md), [0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md), [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0014](0014-outbox-event-log-and-pg-boss-jobs.md), [0017](0017-zod-contracts-as-the-single-source-for-inputs.md), [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) (lock break reasons), [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) (API reports), [0051](0051-regulated-readiness-no-regret-rules.md), [0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md) (measured limits after the parse, field errors in web forms).
* Plan: [04 data and platform, commands](../plan/04-data-and-platform.md#commands-the-single-write-path), [05 GraphQL and APIs, error model](../plan/05-graphql-and-apis.md#error-model), [03 modules and extensibility](../plan/03-modules-and-extensibility.md).
* RFC 9457 problem details: https://www.rfc-editor.org/rfc/rfc9457.
* Revisit when electronic signatures are built (step 7), when the integration REST API arrives, and when a regulated profile requires reasons.
