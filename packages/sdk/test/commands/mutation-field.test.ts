// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { COMMAND_BUS, type Command, type CommandBus } from '@northmes/sdk/commands';
import { defineSubgraph, SubgraphRegistry, SubgraphRegistryModule } from '@northmes/sdk/graphql';
import { execute, type GraphQLSchema, parse } from 'graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanningModule, ReleaseProductionOrder } from '../fixtures/commands/planning.ts';

const ORDER_ID = '01920000-0000-7000-8000-000000000001';

/** Records every command it gets and runs its handler, as the bus does after its own steps. */
class FakeCommandBus implements CommandBus {
  readonly calls: { readonly command: Command; readonly input: unknown }[] = [];

  async run<Input, Result>(command: Command<Input, Result>, input: Input): Promise<Result> {
    this.calls.push({ command: command as Command, input });
    return command.handle(input);
  }
}

const opened: TestingModule[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((moduleRef) => moduleRef.close()));
});

/** Builds planning's subgraph the way the host does, with a fake bus under COMMAND_BUS. */
async function buildPlanningSubgraph() {
  const bus = new FakeCommandBus();
  @Module({ providers: [{ provide: COMMAND_BUS, useValue: bus }], exports: [COMMAND_BUS] })
  class FakeCommandsModule {}
  const moduleRef = await Test.createTestingModule({
    imports: [
      SubgraphRegistryModule,
      { module: FakeCommandsModule, global: true },
      PlanningModule,
      defineSubgraph({ name: 'planning', module: PlanningModule }),
    ],
  }).compile();
  opened.push(moduleRef);
  await moduleRef.init();
  const [planning] = moduleRef.get(SubgraphRegistry).all();
  if (!planning) throw new Error('No planning subgraph');
  return { planning, bus };
}

const RELEASE = parse(`
  mutation ($input: PlanningReleaseProductionOrderInput!) {
    planningReleaseProductionOrder(input: $input) { id status }
  }
`);

/** Sends planningReleaseProductionOrder to the subgraph, as the gateway does for a client. */
function release(schema: GraphQLSchema, input: Record<string, unknown>) {
  return execute({
    schema,
    document: RELEASE,
    variableValues: { input },
    contextValue: { loaders: new Map() },
  });
}

describe('defineCommand', () => {
  it("E02-S04 defineCommand for planning.releaseProductionOrder adds Mutation.planningReleaseProductionOrder with the contract's input", async () => {
    const { planning } = await buildPlanningSubgraph();

    expect(planning.sdl).toContain(
      'type Mutation {\n  planningReleaseProductionOrder(input: PlanningReleaseProductionOrderInput!): ProductionOrder!\n}',
    );
    expect(planning.sdl).toContain(
      'input PlanningReleaseProductionOrderInput {\n  id: ID!\n  note: String!\n  quantity: Float!\n}',
    );
  });

  it('E02-S04 the generated field sends the parsed input to the command bus', async () => {
    const { planning, bus } = await buildPlanningSubgraph();

    const result = await release(planning.schema, {
      id: ORDER_ID,
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
        input: { id: ORDER_ID, note: 'Rush order', quantity: 120 },
      },
    ]);
  });

  it('E02-S04 an input that fails the contract never reaches the bus', async () => {
    const { planning, bus } = await buildPlanningSubgraph();

    // GraphQL accepts any string as an ID; the contract wants a uuid.
    const result = await release(planning.schema, {
      id: 'po-1',
      note: 'Rush order',
      quantity: 120,
    });

    expect(result.data).toBeNull();
    expect(result.errors?.map((error) => error.extensions.code)).toEqual(['BAD_USER_INPUT']);
    expect(bus.calls).toEqual([]);
  });
});
