// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { defineCommandContract } from '@northmes/contracts';
import { COMMAND_BUS, type Command, type CommandBus, defineCommand } from '@northmes/sdk/commands';
import { execute, type GraphQLSchema, parse, printSchema } from 'graphql';
import type { Transaction } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PlanningModule, ReleaseProductionOrder } from '../fixtures/commands/planning.ts';
import { buildSchema } from '../fixtures/graphql/schema.ts';

const ORDER_ID = '01920000-0000-7000-8000-000000000001';

/**
 * Records every command it gets and runs its handler, as the bus does after its own steps. The
 * fixture's handler reads no table, so it gets a stand-in for the transaction.
 */
class FakeCommandBus implements CommandBus {
  readonly calls: { readonly command: Command; readonly input: unknown }[] = [];

  async run<Input, Result>(command: Command<Input, Result>, input: Input): Promise<Result> {
    this.calls.push({ command, input });
    return command.handle(input, { tx: {} as Transaction<unknown> });
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

  it('E05-S01 defineCommand refuses a contract field that is not a required ID, string, number or 32-bit integer, naming it', () => {
    const fieldsWith = {
      urgent: z.object({ urgent: z.boolean() }),
      note: z.object({ note: z.string().optional() }),
      count: z.object({ count: z.int() }),
    };

    for (const [field, fields] of Object.entries(fieldsWith)) {
      const contract = defineCommandContract({
        name: 'planning.flagProductionOrders',
        target: 'none',
        fields,
      });
      expect(
        () => defineCommand(contract, { returns: () => Boolean, handle: async () => true }),
        field,
      ).toThrow(
        `Command planning.flagProductionOrders: input field ${field} is not a required ID, string, number or 32-bit integer, the kinds a generated mutation input supports so far`,
      );
    }
  });

  it('E05-S01 defineCommand refuses a command on an existing entity without the target that the bus checks expectedVersion on', () => {
    const contract = defineCommandContract({
      name: 'planning.flagProductionOrder',
      target: 'existing',
      fields: z.object({}),
    });

    expect(() =>
      defineCommand(contract, { returns: () => Boolean, handle: async () => true }),
    ).toThrow(
      'Command planning.flagProductionOrder changes an existing entity, so its definition needs target, which the command bus loads to check expectedVersion (ADR 0012)',
    );
  });
});
