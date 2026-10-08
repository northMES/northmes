---
name: vertical-slice
description: NorthMES recipe for a slice through a module, from its table to the GraphQL field a client calls: migration, Kysely types, API service, entity and query, MIT contract, command and its generated mutation. Use when adding a table, a query or entity field, a reference to another module's entity, a command or a contracts package export, or when a command, contract or mutation error needs its meaning.
---

# Vertical slice

A slice runs from a module's table to the field a client calls through the gateway. The first slice lists production orders with core's article names and releases an order through the command bus (E02-S04); the files below are that slice. Reads go through the module's API service and the ScopedDatabase. Every write is a command: its contract lives in the module's MIT contracts package, its server code in the module's AGPL server folder, and the SDK generates its mutation (ADR 0012). The test harness, fixtures and the database errors are in the `db-test` skill.

## Files

In the order a slice builds them:

1. `modules/planning/migrations/20261008131056_production_order.sql`: the table from `pnpm gen:migration`, with its four policies and the trigger that bumps `version` on every update. A table that another module points at by foreign key also grants `references (id)` to `nm_ext`, as `modules/core/migrations/20261008125631_article.sql` does.
2. `modules/planning/server/db.ts`: the Kysely table types by schema-qualified name. They are written by hand until generated types arrive (ADR 0006), so they change with every migration of the module.
3. `modules/planning/server/api/production-order.service.ts`, `planning-api.module.ts` and `index.ts`: the API module, providers only. The service injects `DATABASE` (`ScopedDatabase` from `@northmes/sdk/data`) and reads in its own transaction; `recordColumns` names the columns of the record it hands out. Other in-repo modules import it through `@northmes/module-planning/api` (ADR 0003).
4. `modules/planning/server/production-order.resolver.ts`: the code-first entity, registered with `registerIn: () => PlanningModule`, the prefixed root field `planningProductionOrders`, and the `article` field. That field returns `{ __typename: 'Article', id }` for `gql.entityRef('Article')`, and the core subgraph resolves it: `modules/core/server/article.resolver.ts` declares `@key(fields: "id")` and a `@ResolveReference()` that batches with `loaderFor`, so the articles of a list cost one query.
5. `modules/planning/contracts/src/release-production-order.ts`, exported from `src/index.ts`: the command's contract, `defineCommandContract({ name, target, fields, validatable, payload })` from `@northmes/contracts`. Every file starts with `// SPDX-License-Identifier: MIT` and imports only `zod` and `@northmes/contracts`, so web remotes and plugin bundles load it without Nest or React (ADR 0062).
6. `modules/planning/server/commands/release-production-order.ts`: `defineCommand(contract, { returns, buildPayload, handle })` from `@northmes/sdk/commands`. `returns` is the entity the mutation returns. `buildPayload` builds what command validators get, and `handle` makes the change; both run in the transaction the bus opened, typed with the module's tables through the context annotation `{ tx }: PlanningContext`. `release-payload.ts` holds `releasePayload`, the payload as a function of the order row.
7. `modules/planning/server/planning.module.ts`: the providers of the module's Nest module, resolvers and commands. A command provider there adds the prefixed Mutation field and its input type to the module's subgraph: `planning.releaseProductionOrder` gives `planningReleaseProductionOrder(input: PlanningReleaseProductionOrderInput!)`. The module writes no resolver for it.
8. `modules/planning/northmes.module.ts`: the manifest. `server: () => import('./server/index.ts')` loads the Nest module lazily, and `commands` lists each command the module owns with its `validatable` flag (ADR 0037).
9. `modules/planning/contracts/package.json`, `tsconfig.json`, `tsconfig.build.json` and `LICENSE`: what a new contracts package needs. `exports["."]` names `@northmes/source` before `default`, the scripts are `lint`, `typecheck` and `build`, and the license is MIT.

The tests of the slice:

- `modules/core/test/article.int.test.ts` and `modules/planning/test/production-orders.int.test.ts`: the reads through `gqlClient`, rows at another plant, and the one query for a list's articles through `statementsDuring`.
- `modules/planning/test/release.int.test.ts`: the release through the gateway. It checks the answer and then reads the order back through `planningProductionOrders`: the new status and version, a second release that is refused and changes nothing, and an order at another plant.
- `modules/planning/test/payload.test.ts`: the payload `releasePayload` builds for an order parses with the payload schema of `@northmes/planning-contracts`. It lives in the module and not in the contracts package, because an MIT package imports no AGPL code.
- `packages/contracts/test/pure-imports.test.ts`: imports every contracts package in a fresh Node process and fails on any module of `@nestjs/*`, `react` or `react-dom` that loads.

## Commands

- `pnpm gen:migration <module> <slug>`: the migration file of a new table.
- `pnpm exec vitest run --project integration modules/planning/test/release.int.test.ts`: one integration file. Docker must be running.
- `pnpm exec vitest run --project unit modules/planning/test/payload.test.ts packages/contracts/test/pure-imports.test.ts`: the unit files of the slice.
- `pnpm --filter @northmes/module-planning run typecheck`: one package; `lint` and `build` run the same way.
- `pnpm check`: the gate before the work is handed over.

## Building a slice

1. Write the migration with `pnpm gen:migration` and add the table's columns after `version`. The trigger bumps `version`, so an update sets only the columns it changes.
2. Add the table to the module's `db.ts`.
3. Read through the API service and expose the read on the entity's resolver as a root field with the module prefix. A field that points at another module's entity returns a reference, and the owner resolves it.
4. Declare the command's contract in the module's contracts package. `target: 'existing'` gives an input of `id` plus the fields, `new` an input of the client-generated `id` plus the fields, and `none` the fields alone. A validatable command declares `payload`, the Zod schema of what validators get, and its manifest entry says `validatable: true`.
5. Write the command with `defineCommand`. Read the target row with `forUpdate()`, so the validators and the handler judge the same row and a second run of the command waits for the first. Throw a `DomainError` from `@northmes/sdk/errors` for every refusal a client should read: `core.not_found` with kind `not_found` when no row is at the principal's scopes, and a code of the module, such as `planning.production_order.not_planned` with kind `precondition`, for a rule.
6. List the command provider in the module's Nest module.
7. Test through the gateway with fixtures from `db.command`, and read the result back through a query field.

## Errors and their meaning

- `Unknown type "PlanningReleaseProductionOrderInput"` with `GRAPHQL_VALIDATION_FAILED` and status 400: the gateway has no such mutation. The command provider is missing from the providers of the module's Nest module, or `createTestApp` did not boot the module.
- `Command <name>: input field <field> is not a required ID, string or number, the kinds a generated mutation input supports so far`: `defineCommand` threw while the server entry loaded, for a contract field that the generated input type cannot carry yet.
- `Command <name> is validatable, so its contract needs a payload schema (ADR 0037)`: `defineCommandContract` got `validatable: true` without `payload`.
- `Invalid input for planning.releaseProductionOrder: id: Invalid UUID` with `BAD_USER_INPUT`: the input failed the contract, and the bus never ran the command.
- `Production order <id> was not found` with `NOT_FOUND` and `errorCode` `core.not_found`: no order with that id is at the request's plant, or the request named no plant in `x-northmes-plant`. Row-level security hides another plant's order, so it reads as missing.
- `Production order <number> is released, and only a planned order can be released` with `PRECONDITION` and `errorCode` `planning.production_order.not_planned`: the transaction rolled back, and the order keeps its status and version.
- `core.validator_contract_mismatch` with `PRECONDITION`: the payload from `buildPayload` does not parse with a validator's copy of the payload schema. Change the payload and its schema together; `payload.test.ts` shows the drift on the owner's side.
- `core.command_rejected` with `PRECONDITION`: a validator vetoed. `details.rejectedBy` names its module, and the message is the validator's.
- `Unexpected error.` with `INTERNAL_SERVER_ERROR`: the command threw a plain `Error`, such as Kysely's `NoResultError` from `executeTakeFirstOrThrow()` on a row the scopes hide. Throw a `DomainError` for that case.
- `Argument of type 'string' is not assignable to parameter of type 'TableExpressionOrList<unknown, never>'` from `tsc` in a command: the bus types its transaction without tables. Annotate the context parameter with the module's table types, as `{ tx }: PlanningContext` does.
- `pure-imports.test.ts` lists URLs under `node_modules/@nestjs/`, `react/` or `react-dom/`: a contracts package loads server or web code, itself or through a dependency. Move that code out of the contracts package.
- `pure-imports.test.ts` fails with `ERR_MODULE_NOT_FOUND` naming a `src/index.ts`: the `@northmes/source` entry in a contracts package's `exports["."]` names a file that does not exist.
