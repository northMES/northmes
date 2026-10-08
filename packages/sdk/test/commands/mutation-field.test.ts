// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { COMMAND_BUS, type Command, type CommandBus } from '@northmes/sdk/commands';
import { defineSubgraph, SubgraphRegistry, SubgraphRegistryModule } from '@northmes/sdk/graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanningModule } from '../fixtures/commands/planning.ts';

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
});
