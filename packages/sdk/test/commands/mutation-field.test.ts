// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { defineCommandContract } from '@northmes/contracts';
import {
  COMMAND_BUS,
  type Command,
  type CommandBus,
  commandInput,
  defineCommand,
  parseCommandInput,
  registerCommand,
  type TargetRow,
} from '@northmes/sdk/commands';
import { execute, type GraphQLSchema, parse, printSchema } from 'graphql';
import type { Transaction } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PlanningModule, ReleaseProductionOrder } from '../fixtures/commands/planning.ts';
import { buildSchema } from '../fixtures/graphql/schema.ts';

const ORDER_ID = '01920000-0000-7000-8000-000000000001';

/**
 * Records every command it gets and runs its handler, as the bus does after its own steps. The
 * fixture's target and handler read no table, so they get a stand-in for the transaction.
 */
class FakeCommandBus implements CommandBus {
  readonly calls: { readonly command: Command; readonly input: unknown }[] = [];

  async run<Input, Result, Target extends TargetRow | undefined>(
    command: Command<Input, Result, Target>,
    input: Input,
  ): Promise<Result> {
    this.calls.push({ command, input });
    const tx = {} as Transaction<unknown>;
    const context = { tx, plantId: undefined, require: () => undefined };
    const target = (await command.target?.load((input as { id: string }).id, context)) as Target;
    return command.handle(input, { ...context, target });
  }
}

const opened: TestingModule[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((moduleRef) => moduleRef.close()));
});

/** Builds planning's schema the way the host does, with a fake bus under COMMAND_BUS. */
async function buildPlanningSchema() {
  const bus = new FakeCommandBus();
  @Module({ providers: [{ provide: COMMAND_BUS, useValue: bus }], exports: [COMMAND_BUS] })
  class FakeCommandsModule {}
  const { schema, moduleRef } = await buildSchema([
    { module: FakeCommandsModule, global: true },
    PlanningModule,
  ]);
  opened.push(moduleRef);
  return { schema, sdl: printSchema(schema), bus };
}

const RELEASE = parse(`
  mutation ($input: PlanningReleaseProductionOrderInput!) {
    planningReleaseProductionOrder(input: $input) { id status }
  }
`);

/** Sends planningReleaseProductionOrder to the schema, as the server does for a client. */
function release(schema: GraphQLSchema, input: Record<string, unknown>) {
  return execute({
    schema,
    document: RELEASE,
    variableValues: { input },
    contextValue: { loaders: new Map() },
  });
}

describe('defineCommand', () => {
  it("E05-S01 defineCommand for planning.releaseProductionOrder adds Mutation.planningReleaseProductionOrder with the contract's input and expectedVersion as Int", async () => {
    const { sdl } = await buildPlanningSchema();

    expect(sdl).toContain(
      'type Mutation {\n  planningReleaseProductionOrder(input: PlanningReleaseProductionOrderInput!): ProductionOrder!\n}',
    );
    expect(sdl).toContain(
      'input PlanningReleaseProductionOrderInput {\n  expectedVersion: Int!\n  id: ID!\n  note: String!\n  quantity: Float!\n}',
    );
  });

  it('E02-S04 the generated field sends the parsed input to the command bus', async () => {
    const { schema, bus } = await buildPlanningSchema();

    const result = await release(schema, {
      id: ORDER_ID,
      expectedVersion: 1,
      note: '  Rush order  ',
      quantity: 120,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      planningReleaseProductionOrder: { id: ORDER_ID, status: 'released' },
    });
    // The contract trims note, so the bus gets the parsed input and not the one the client sent.
    expect(bus.calls).toEqual([
      {
        command: ReleaseProductionOrder.command,
        input: { id: ORDER_ID, expectedVersion: 1, note: 'Rush order', quantity: 120 },
      },
    ]);
  });

  it('E02-S04 an input that fails the contract never reaches the bus', async () => {
    const { schema, bus } = await buildPlanningSchema();

    // GraphQL accepts any string as an ID; the contract wants a uuid.
    const result = await release(schema, {
      id: 'po-1',
      expectedVersion: 1,
      note: 'Rush order',
      quantity: 120,
    });

    expect(result.data).toBeNull();
    expect(result.errors?.map((error) => error.extensions.code)).toEqual(['BAD_USER_INPUT']);
    expect(bus.calls).toEqual([]);
  });

  it('E05-S01 an input that fails the contract returns BAD_USER_INPUT with a fieldErrors entry per Zod issue', async () => {
    const { schema } = await buildPlanningSchema();

    const result = await release(schema, {
      id: 'po-1',
      expectedVersion: 0,
      note: 'Rush order',
      quantity: 120,
    });

    expect(result.errors?.map(({ extensions }) => extensions)).toEqual([
      {
        code: 'BAD_USER_INPUT',
        fieldErrors: [
          { path: ['id'], message: 'Invalid UUID', code: 'invalid_format' },
          {
            path: ['expectedVersion'],
            message: 'Too small: expected number to be >=1',
            code: 'too_small',
          },
        ],
      },
    ]);
  });

  it('E05-S06 the generated input carries an optional string as a nullable String and a list of strings as [String!]!, and a null optional string reaches the bus as absent', async () => {
    const contract = defineCommandContract({
      name: 'planning.tagProductionOrders',
      target: 'none',
      fields: z.object({ tags: z.array(z.string()), note: z.string().optional() }),
      permission: 'planning.productionOrder:tag',
    });
    const handled: unknown[] = [];
    const TagProductionOrders = defineCommand(contract, {
      returns: () => Boolean,
      handle: async (input) => {
        handled.push(input);
        return true;
      },
    });
    const bus = new FakeCommandBus();
    @Module({ providers: [{ provide: COMMAND_BUS, useValue: bus }], exports: [COMMAND_BUS] })
    class FakeCommandsModule {}
    @Module({ providers: [TagProductionOrders] })
    class TagModule {}
    const { schema, moduleRef } = await buildSchema([
      { module: FakeCommandsModule, global: true },
      // Planning's fixture brings the Query root that a schema needs.
      PlanningModule,
      TagModule,
    ]);
    opened.push(moduleRef);
    const tag = (input: Record<string, unknown>) =>
      execute({
        schema,
        document: parse(`mutation ($input: PlanningTagProductionOrdersInput!) {
          planningTagProductionOrders(input: $input)
        }`),
        variableValues: { input },
        contextValue: { loaders: new Map() },
      });

    const withNote = await tag({ tags: ['rush', 'export'], note: 'Call first' });
    const withNullNote = await tag({ tags: [], note: null });
    const withoutNote = await tag({ tags: ['rush'] });

    expect(printSchema(schema)).toContain(
      'input PlanningTagProductionOrdersInput {\n  note: String\n  tags: [String!]!\n}',
    );
    expect([withNote.errors, withNullNote.errors, withoutNote.errors]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(handled).toEqual([
      { tags: ['rush', 'export'], note: 'Call first' },
      { tags: [] },
      { tags: ['rush'] },
    ]);
  });

  it('ADR0073-W2 the generated input carries a boolean as Boolean!, an optional boolean as Boolean and an optional list of strings as [String!], and nulls for them reach the bus as absent', async () => {
    const contract = defineCommandContract({
      name: 'planning.flagProductionOrders',
      target: 'none',
      fields: z.object({
        urgent: z.boolean(),
        late: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      }),
      permission: 'planning.productionOrder:flag',
    });
    const handled: unknown[] = [];
    const FlagProductionOrders = defineCommand(contract, {
      returns: () => Boolean,
      handle: async (input) => {
        handled.push(input);
        return true;
      },
    });
    const bus = new FakeCommandBus();
    @Module({ providers: [{ provide: COMMAND_BUS, useValue: bus }], exports: [COMMAND_BUS] })
    class FakeCommandsModule {}
    @Module({ providers: [FlagProductionOrders] })
    class FlagModule {}
    const { schema, moduleRef } = await buildSchema([
      { module: FakeCommandsModule, global: true },
      PlanningModule,
      FlagModule,
    ]);
    opened.push(moduleRef);
    const flag = (input: Record<string, unknown>) =>
      execute({
        schema,
        document: parse(`mutation ($input: PlanningFlagProductionOrdersInput!) {
          planningFlagProductionOrders(input: $input)
        }`),
        variableValues: { input },
        contextValue: { loaders: new Map() },
      });

    const full = await flag({ urgent: true, late: false, tags: ['rush'] });
    const nulls = await flag({ urgent: false, late: null, tags: null });

    expect(printSchema(schema)).toContain(
      'input PlanningFlagProductionOrdersInput {\n  late: Boolean\n  tags: [String!]\n  urgent: Boolean!\n}',
    );
    expect([full.errors, nulls.errors]).toEqual([undefined, undefined]);
    expect(handled).toEqual([{ urgent: true, late: false, tags: ['rush'] }, { urgent: false }]);
  });

  it('ADR0073-W3 the generated input carries an optional 32-bit integer as Int, and a null for it reaches the bus as absent', async () => {
    const contract = defineCommandContract({
      name: 'planning.flagProductionOrders',
      target: 'none',
      fields: z.object({ expectedVersion: z.int32().min(1).optional() }),
      permission: 'planning.productionOrder:flag',
    });
    const handled: unknown[] = [];
    const FlagProductionOrders = defineCommand(contract, {
      returns: () => Boolean,
      handle: async (input) => {
        handled.push(input);
        return true;
      },
    });
    const bus = new FakeCommandBus();
    @Module({ providers: [{ provide: COMMAND_BUS, useValue: bus }], exports: [COMMAND_BUS] })
    class FakeCommandsModule {}
    @Module({ providers: [FlagProductionOrders] })
    class FlagModule {}
    const { schema, moduleRef } = await buildSchema([
      { module: FakeCommandsModule, global: true },
      PlanningModule,
      FlagModule,
    ]);
    opened.push(moduleRef);
    const flag = (input: Record<string, unknown>) =>
      execute({
        schema,
        document: parse(`mutation ($input: PlanningFlagProductionOrdersInput!) {
          planningFlagProductionOrders(input: $input)
        }`),
        variableValues: { input },
        contextValue: { loaders: new Map() },
      });

    const given = await flag({ expectedVersion: 3 });
    const nulls = await flag({ expectedVersion: null });

    expect(printSchema(schema)).toContain(
      'input PlanningFlagProductionOrdersInput {\n  expectedVersion: Int\n}',
    );
    expect([given.errors, nulls.errors]).toEqual([undefined, undefined]);
    expect(handled).toEqual([{ expectedVersion: 3 }, {}]);
  });

  it('ADR0073-W2 registerCommand gives a provider whose command carries the handler and adds no Mutation field', async () => {
    const contract = defineCommandContract({
      name: 'planning.flagProductionOrders',
      target: 'none',
      fields: z.object({ urgent: z.boolean() }),
      permission: 'planning.productionOrder:flag',
    });
    const handle = async () => true;
    const FlagProductionOrders = registerCommand(contract, { handle });
    const bus = new FakeCommandBus();
    @Module({ providers: [{ provide: COMMAND_BUS, useValue: bus }], exports: [COMMAND_BUS] })
    class FakeCommandsModule {}
    @Module({ providers: [FlagProductionOrders] })
    class FlagModule {}
    const { sdl, moduleRef } = await (async () => {
      const built = await buildSchema([
        { module: FakeCommandsModule, global: true },
        PlanningModule,
        FlagModule,
      ]);
      return { sdl: printSchema(built.schema), moduleRef: built.moduleRef };
    })();
    opened.push(moduleRef);

    expect(FlagProductionOrders.command).toMatchObject({ contract, handle });
    expect(sdl).not.toContain('planningFlagProductionOrders');
  });

  it('ADR0073-W2 commandInput names the input type of a command once, and parseCommandInput drops null optional fields and refuses an input that fails the contract with BAD_USER_INPUT', () => {
    const contract = defineCommandContract({
      name: 'planning.noteProductionOrder',
      target: 'none',
      fields: z.object({ note: z.string().min(1), late: z.boolean().optional() }),
      permission: 'planning.productionOrder:note',
    });

    expect(commandInput(contract)).toBe(commandInput(contract));
    expect(commandInput(contract).name).toBe('PlanningNoteProductionOrderInput');
    expect(parseCommandInput(contract, { note: 'Call first', late: null })).toEqual({
      note: 'Call first',
    });
    expect(() => parseCommandInput(contract, { note: '' })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/^Invalid input for planning.noteProductionOrder: note:/),
        extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }),
      }),
    );
  });

  it('E05-S01 defineCommand refuses a contract field of a kind the generated input cannot carry, naming it', () => {
    const fieldsWith = {
      note: z.object({ note: z.number().optional() }),
      count: z.object({ count: z.int() }),
    };

    for (const [field, fields] of Object.entries(fieldsWith)) {
      const contract = defineCommandContract({
        name: 'planning.flagProductionOrders',
        target: 'none',
        fields,
        permission: 'planning.productionOrder:flag',
      });
      expect(
        () => defineCommand(contract, { returns: () => Boolean, handle: async () => true }),
        field,
      ).toThrow(
        `Command planning.flagProductionOrders: input field ${field} is not a required ID, string, number, boolean, 32-bit integer or list of strings, or an optional string, boolean, 32-bit integer or list of strings, the kinds a generated mutation input supports so far`,
      );
    }
  });

  it('E05-S01 defineCommand refuses a command on an existing entity without the target that the bus checks expectedVersion on', () => {
    const contract = defineCommandContract({
      name: 'planning.flagProductionOrder',
      target: 'existing',
      fields: z.object({}),
      permission: 'planning.productionOrder:flag',
    });

    expect(() =>
      defineCommand(contract, { returns: () => Boolean, handle: async () => true }),
    ).toThrow(
      'Command planning.flagProductionOrder changes an existing entity, so its definition needs target, which the command bus loads to check expectedVersion (ADR 0012)',
    );
  });

  it('E05-S06 defineCommand hands the bus the scope hook of a command without a target', () => {
    const contract = defineCommandContract({
      name: 'planning.createCalendar',
      target: 'new',
      fields: z.object({}),
      permission: 'planning.calendar:create',
    });
    const scope = async () => ORDER_ID;

    const { command } = defineCommand(contract, {
      returns: () => Boolean,
      scope,
      handle: async () => true,
    });

    expect(command.scope).toBe(scope);
  });

  it('E05-S06 defineCommand refuses a scope hook on a command on an existing entity, whose row names the scope', () => {
    const contract = defineCommandContract({
      name: 'planning.flagProductionOrder',
      target: 'existing',
      fields: z.object({}),
      permission: 'planning.productionOrder:flag',
    });

    expect(() =>
      defineCommand(contract, {
        returns: () => Boolean,
        target: {
          entity: 'Production order',
          scopeOf: async () => ORDER_ID,
          load: async () => undefined,
        },
        scope: async () => ORDER_ID,
        handle: async () => true,
      }),
    ).toThrow(
      'Command planning.flagProductionOrder changes an existing entity, whose row names the scope the bus checks its permission at, so its definition takes no scope (ADR 0012)',
    );
  });
});
