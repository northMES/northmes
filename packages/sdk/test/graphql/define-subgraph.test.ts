// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { moduleNames } from '@northmes/sdk';
import {
  defineSubgraph,
  type SubgraphContext,
  type SubgraphEntry,
  SubgraphRegistry,
  SubgraphRegistryModule,
} from '@northmes/sdk/graphql';
import { execute, isTypeDefinitionNode, Kind, parse } from 'graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogArticles, CatalogModule } from '../fixtures/graphql/catalog.ts';
import { ProductionStartModule } from '../fixtures/graphql/production-start.ts';
import { QualityModule } from '../fixtures/graphql/quality.ts';

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
  // Nest logs every error a resolver throws, also the NOT_FOUND a test expects.
  moduleRef.useLogger(false);
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

/** A fresh subgraph context, as the gateway creates one per client request and subgraph. */
function requestContext(): SubgraphContext {
  return { loaders: new Map() };
}

const ARTICLE_ENTITIES = parse(`
  query ($representations: [_Any!]!) {
    _entities(representations: $representations) {
      ... on Article { id name }
    }
  }
`);

/** Resolves Article references the way the gateway asks the owning subgraph for them. */
function resolveArticles(entry: SubgraphEntry, context: SubgraphContext, ids: readonly string[]) {
  return execute({
    schema: entry.schema,
    document: ARTICLE_ENTITIES,
    variableValues: { representations: ids.map((id) => ({ __typename: 'Article', id })) },
    contextValue: context,
  });
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

  it('E02-S03 two subgraphs build in one process without multiple types named', async () => {
    // Both modules declare a type named Article: catalog owns it, production-start references it.
    const { registry } = await buildSubgraphs({
      catalog: CatalogModule,
      'production-start': ProductionStartModule,
    });

    expect(registry.all().map((entry) => entry.name)).toEqual(['catalog', 'productionStart']);
  });

  it('E02-S03 a subgraph SDL lists its definitions in lexicographic order', async () => {
    const { registry } = await buildSubgraphs({
      catalog: CatalogModule,
      'production-start': ProductionStartModule,
    });
    const { definitions } = parse(subgraph(registry, 'productionStart').sdl);

    const typeNames = definitions.filter(isTypeDefinitionNode).map((node) => node.name.value);
    const directiveNames = definitions
      .filter((node) => node.kind === Kind.DIRECTIVE_DEFINITION)
      .map((node) => node.name.value);

    expect(typeNames).toContain('ProductionOrder');
    expect(directiveNames).toContain('key');
    expect(typeNames).toEqual([...typeNames].sort());
    expect(directiveNames).toEqual([...directiveNames].sort());
  });

  it('E02-S03 entityRef(Article) adds a key-only Article stub to the referencing subgraph', async () => {
    const { registry } = await buildSubgraphs({
      catalog: CatalogModule,
      'production-start': ProductionStartModule,
    });

    expect(subgraph(registry, 'productionStart').sdl).toContain(
      'type Article @key(fields: "id") {\n  id: ID!\n}',
    );
    expect(subgraph(registry, 'catalog').sdl).toContain(
      'type Article @key(fields: "id") {\n  id: ID!\n  name: String!\n}',
    );
  });

  it('E02-S03 a module that only adds a field to Article keeps its entityRef stub in its subgraph', async () => {
    // No field of the quality module returns Article; the stub is only the parent of a field.
    const { registry } = await buildSubgraphs({ catalog: CatalogModule, quality: QualityModule });

    expect(subgraph(registry, 'quality').sdl).toContain(
      'type Article @key(fields: "id") {\n  id: ID!\n  qualityInspectionRequired: Boolean\n}',
    );
  });
});

describe('loaderFor', () => {
  it('E02-S03 loaderFor batches three loads in one request into one call', async () => {
    const { registry, moduleRef } = await buildSubgraphs({ catalog: CatalogModule });

    const result = await resolveArticles(subgraph(registry, 'catalog'), requestContext(), [
      'a-1',
      'a-2',
      'a-3',
    ]);

    expect(result.errors).toBeUndefined();
    expect(result.data?._entities).toEqual([
      { id: 'a-1', name: 'Hex bolt M8' },
      { id: 'a-2', name: 'Flat washer 8' },
      { id: 'a-3', name: 'Lock nut M8' },
    ]);
    expect(moduleRef.get(CatalogArticles).batches).toEqual([['a-1', 'a-2', 'a-3']]);
  });

  it('E02-S03 two requests never share a cached value', async () => {
    const { registry, moduleRef } = await buildSubgraphs({ catalog: CatalogModule });
    const catalog = subgraph(registry, 'catalog');

    const first = await resolveArticles(catalog, requestContext(), ['a-1']);
    moduleRef.get(CatalogArticles).rename('a-1', 'Hex bolt M8 zinc plated');
    const second = await resolveArticles(catalog, requestContext(), ['a-1']);

    expect(first.data?._entities).toEqual([{ id: 'a-1', name: 'Hex bolt M8' }]);
    expect(second.data?._entities).toEqual([{ id: 'a-1', name: 'Hex bolt M8 zinc plated' }]);
  });

  it('E02-S03 a NOT_FOUND for one key rejects only that key', async () => {
    const { registry } = await buildSubgraphs({ catalog: CatalogModule });

    const result = await resolveArticles(subgraph(registry, 'catalog'), requestContext(), [
      'a-1',
      'a-9',
      'a-2',
    ]);

    expect(result.data?._entities).toEqual([
      { id: 'a-1', name: 'Hex bolt M8' },
      null,
      { id: 'a-2', name: 'Flat washer 8' },
    ]);
    expect(
      result.errors?.map((error) => ({ code: error.extensions.code, path: error.path })),
    ).toEqual([{ code: 'NOT_FOUND', path: ['_entities', 1] }]);
  });
});
