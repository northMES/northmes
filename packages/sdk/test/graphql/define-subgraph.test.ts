// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { moduleNames } from '@northmes/sdk';
import {
  defineSubgraph,
  type SubgraphEntry,
  SubgraphRegistry,
  SubgraphRegistryModule,
} from '@northmes/sdk/graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogModule } from '../fixtures/graphql/catalog.ts';
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

function subgraph(registry: SubgraphRegistry, name: string): SubgraphEntry {
  const entry = registry.all().find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`No subgraph named ${name}`);
  return entry;
}

/** The Query fields a module declared, without the _service and _entities fields of federation. */
function rootFields(entry: SubgraphEntry): string[] {
  const fields = Object.keys(entry.schema.getQueryType()?.getFields() ?? {});
  return fields.filter((field) => field !== '_service' && field !== '_entities');
}

describe('defineSubgraph', () => {
  it("E02-S03 defineSubgraph builds a subgraph SDL with the v2.9 federation link and only its module's root fields", async () => {
    const { registry } = await buildSubgraphs({
      catalog: CatalogModule,
      'production-start': ProductionStartModule,
    });
    const catalog = subgraph(registry, 'catalog');
    const productionStart = subgraph(registry, 'productionStart');

    for (const { sdl } of [catalog, productionStart]) {
      expect(sdl).toContain('@link(url: "https://specs.apollo.dev/federation/v2.9"');
    }
    expect(rootFields(catalog)).toEqual(['catalogArticle']);
    expect(rootFields(productionStart)).toEqual(['productionStartOrders']);
  });

  it('E02-S03 a subgraph built for module production-start is named productionStart', async () => {
    const { registry } = await buildSubgraphs({ 'production-start': ProductionStartModule });

    expect(registry.all().map((entry) => entry.name)).toEqual(['productionStart']);
  });
});
