// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { moduleNames } from '@northmes/sdk';
import { defineSubgraph, SubgraphRegistry, SubgraphRegistryModule } from '@northmes/sdk/graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductionStartModule } from '../fixtures/graphql/production-start.ts';

const opened: TestingModule[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((moduleRef) => moduleRef.close()));
});

/** Builds one subgraph per module the way the host does: the name comes from moduleNames. */
async function buildSubgraphs(modules: Record<string, Type>) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      SubgraphRegistryModule,
      ...Object.values(modules),
      ...Object.entries(modules).map(([id, module]) =>
        defineSubgraph({ name: moduleNames(id).gql, module }),
      ),
    ],
  }).compile();
  opened.push(moduleRef);
  await moduleRef.init();
  return { registry: moduleRef.get(SubgraphRegistry), moduleRef };
}

describe('defineSubgraph', () => {
  it('E02-S03 a subgraph built for module production-start is named productionStart', async () => {
    const { registry } = await buildSubgraphs({ 'production-start': ProductionStartModule });

    expect(registry.all().map((entry) => entry.name)).toEqual(['productionStart']);
  });
});
