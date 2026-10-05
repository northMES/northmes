---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 02, 04, 33
informed: NorthMES contributors
release: "1"
needs-confirmation: ""
---

# Zod contracts as the single source for inputs

## Context and problem statement

A NorthMES command receives input from several surfaces: GraphQL mutations from the web, the station REST route, the Pyramid import job, MCP tools, the in-app assistant's tools, and later an integration REST API. Command validators, settings, event payloads and web forms need the same shapes. If each surface declares its own input type, the shapes drift: the earlier attempt held 137 GraphQL input classes that mirrored a contracts type by hand (internal research note 33).

This ADR decides where input shapes are declared and how each surface gets its types and validation from that one declaration. It covers the module contracts packages (`@northmes/<id>-contracts`, MIT), `@northmes/contracts`, the GraphQL kit in `@northmes/sdk/graphql`, REST controllers, MCP tool definitions and the form engine in `@northmes/ui`.

## Decision drivers

* Validate once, the same way, whatever surface a command arrives through.
* Contracts are plain data in MIT packages, so manifests, plugins, validators and web remotes read them without Nest or React.
* `@Args()` in `@nestjs/graphql` 14 has no schema option, so GraphQL inputs still need decorated classes.
* No maintained library turns Zod 4 schemas into Nest 12 GraphQL input classes; `nestjs-zod` peers stop at `@nestjs/common` 11.
* Nest 12 has Standard Schema validation built in for REST, and `@nestjs/swagger` 12 builds OpenAPI from the same schemas.
* Field errors must reach web forms in a shape the form engine can map to fields.

## Considered options

* GraphQL input classes written by hand next to each Zod schema.
* `nestjs-zod` or a third-party Zod-to-Nest-GraphQL library.
* A file generator that writes input classes from Zod schemas into committed files.
* An own `inputFromZod` factory that builds input classes at boot from the schema's JSON Schema, with Nest 12 Standard Schema for REST.

## Decision outcome

Chosen option: "An own `inputFromZod` factory that builds input classes at boot, with Nest 12 Standard Schema for REST", because it keeps one schema per command, uses only public Zod output, and adds no dependency that lags the Nest and Zod majors the project runs.

Rules:

* Each command's input schema lives in the owning module's MIT contracts package inside `defineCommandContract({ name, input, permission, validatable, reason, signature })`. That schema is the single source. The command pipeline parses the input with it as its first step, before permission, audit and validators ([ADR 0012][adr-0012]).
* `inputFromZod(name, schema)` in `@northmes/sdk/graphql` walks `z.toJSONSchema(schema, { io: "input" })` and applies `@InputType` and `@Field` programmatically. It supports scalars, enums, lists, nested named objects, nullability and defaults, and throws at boot, naming the field path, on anything else. An integer maps to `Int` only when it is bounded to 32 bits. Enum and nested object names come from `.meta({ id })`.
* `objectFromZod` builds output types for the master-data kit from the same kind of definition ([ADR 0022][adr-0022]).
* The time scalars `Instant`, `LocalDate`, `LocalTime` and `LocalDateTime` are validated with Zod in the subgraph driver ([ADR 0024][adr-0024]).
* A Zod parse failure becomes `BAD_USER_INPUT` with `fieldErrors: [{ path, message, code }]` in the error extensions.
* REST routes in release 1 parse their request bodies with Zod. When the integration REST API arrives, its routes pass the same schemas to Nest 12 Standard Schema (`@Body({ schema })`), and `@nestjs/swagger` 12 builds OpenAPI with zod-openapi as converter for named components ([ADR 0031][adr-0031]).
* Validator payloads, `defineSettings` schemas, `defineEvent` payloads and the input and output schemas of `defineTool` (MCP and assistant tools) are Zod too. Agent-visible tool inputs stay in a portable subset without unions, records or recursion ([ADR 0034][adr-0034]).
* Web forms bind the same schemas: `useZodForm` in `@northmes/ui` uses react-hook-form 7 with the Standard Schema resolver, and `useCommandForm` in `@northmes/web-sdk` binds it to the command's mutation and maps `fieldErrors` onto fields ([ADR 0020][adr-0020]).
* `nestjs-zod`, `nestjs-graphql-zod`, `zod-to-nestjs-graphql` and `@asteasolutions/zod-to-openapi` are not used.

```ts
// modules/planning/contracts/src/commands/release-production-order.ts (MIT), sketch
export const releaseProductionOrder = defineCommandContract({
  name: "planning.releaseProductionOrder",   // mutation planningReleaseProductionOrder
  input: z.object({ id: z.uuid(), expectedVersion: z.int() }),
  permission: "planning.productionOrder:release",
  validatable: true,
  reason: "optional",
  signature: "none",
});
```

### Consequences

* Good, because a new command needs one schema; the GraphQL input, the REST body check, the tool schema and the form validation follow from it.
* Good, because the factory reads `z.toJSONSchema`, a public output, rather than Zod internals; internal research note 02 sized it at about 150 lines with tests.
* Good, because the printed subgraph SDL (`modules/<id>/schema.graphql`) shows every generated input in review, and `pnpm gen --check` fails when it changes unnoticed.
* Good, because there are no generated input files to keep in sync.
* Bad, because the factory accepts only what GraphQL inputs can express; a union or record in a command input fails at boot, and the author must restructure the contract.
* Bad, because GraphQL input and enum names come from `.meta({ id })`; renaming one changes the public schema, which GraphQL Inspector reports ([ADR 0015][adr-0015]).
* Bad, because NorthMES owns the factory and must follow changes in Zod's JSON Schema output across Zod majors.
* Neutral, because OpenAPI generation waits until the integration REST API exists.

### Confirmation

* `packages/sdk/src/graphql/input-from-zod.test.ts` (proposed name): scalars, enums, lists, nested named objects, nullability and defaults map to the expected SDL; a 32-bit bounded integer becomes `Int`; a `z.union` field throws at boot and names the field path; enum and object names come from `.meta({ id })`.
* A snapshot of each module's printed SDL, enforced by `pnpm gen --check` in `pnpm check`.
* Boot check: every Mutation field maps to a registered command handler, so no mutation bypasses the contract parse ([ADR 0012][adr-0012]).
* `gateway/errors.int.test.ts` (proposed name): an invalid mutation input returns `BAD_USER_INPUT` with `fieldErrors` paths that match the Zod issue paths.
* Web: a `useCommandForm` test maps a server `fieldErrors` response onto the matching fields and keeps the entered values.
* `mcp/schema-subset.test.ts`: the propose tool's input passes the schema lint, and a `z.union` input fails.
* `test/meta/forbidden-deps.test.ts` (proposed name): fails when `nestjs-zod`, `nestjs-graphql-zod` or `zod-to-nestjs-graphql` appears in any workspace `package.json`.

## Pros and cons of the options

### Hand-written input classes

* Good, because each input is visible as ordinary code.
* Bad, because every input exists twice and drifts; this is the earlier attempt's 137 mirrored classes.

### `nestjs-zod` or a third-party Zod-to-GraphQL library

* Good, because nothing new needs to be written.
* Bad, because `nestjs-zod`'s peers stop at Nest 11 and it is not needed for REST with Nest 12.
* Bad, because the Zod-to-Nest-GraphQL libraries checked (`nestjs-graphql-zod`, `zod-to-nestjs-graphql`, `zod-nestjs-graphql`) were last published in 2024 and do not target Zod 4 and Nest 12.

### A file generator for input classes

* Good, because the generated classes are readable files.
* Bad, because generated files can go stale and need their own drift check, which the printed SDL snapshot already gives without them.

### An own `inputFromZod` factory at boot

* Good, because it is small, uses public Zod output and keeps one schema.
* Bad, because NorthMES maintains it and its supported subset.

## More information

* Related ADRs: [0012][adr-0012] (command pipeline and error model), [0015][adr-0015] (subgraphs and schema snapshot), [0020][adr-0020] (forms), [0022][adr-0022] (contracts packages, master-data kit), [0024][adr-0024] (time scalars), [0031][adr-0031] (no integration REST API in release 1), [0034][adr-0034] (MCP tool schemas).
* Plan: [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md) (mutations are commands, error extensions), [03-modules-and-extensibility.md](../plan/03-modules-and-extensibility.md) (contracts packages), [06-web-and-ux.md](../plan/06-web-and-ux.md) (forms).
* Open point for the first command task: the contract sketch uses `z.int()` for `expectedVersion`, and the factory maps an integer to `Int` only when the schema carries 32-bit bounds. What `z.toJSONSchema` emits for `z.int()` was not verified; the task adds explicit bounds or a shared `version` value type in `@northmes/contracts` if needed.
* Revisit when the integration REST API is built (OpenAPI from the same schemas, an oasdiff gate), when a maintained library covers Zod-to-Nest-GraphQL for the pinned majors, or when `@Args()` gains a schema option.

[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0015]: 0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
[adr-0020]: 0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0024]: 0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md
[adr-0031]: 0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md
[adr-0034]: 0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
