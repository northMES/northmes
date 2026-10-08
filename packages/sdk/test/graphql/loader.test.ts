// SPDX-License-Identifier: MIT
import type { TestingModule } from '@nestjs/testing';
import type { RequestContext } from '@northmes/sdk/graphql';
import { execute, type GraphQLSchema, parse } from 'graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogArticles, CatalogModule } from '../fixtures/graphql/catalog.ts';
import { buildSchema } from '../fixtures/graphql/schema.ts';

const opened: TestingModule[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((moduleRef) => moduleRef.close()));
});

async function buildCatalog() {
  const built = await buildSchema([CatalogModule]);
  opened.push(built.moduleRef);
  return built;
}

/** A fresh request context, as the host creates one per request. */
function requestContext(): RequestContext {
  return { loaders: new Map() };
}

const ARTICLES = parse(`
  query ($ids: [ID!]!) {
    catalogArticles(ids: $ids) { id name }
  }
`);

/** Reads the articles of these ids in one request with this context. */
function readArticles(schema: GraphQLSchema, context: RequestContext, ids: readonly string[]) {
  return execute({
    schema,
    document: ARTICLES,
    variableValues: { ids },
    contextValue: context,
  });
}

describe('loaderFor', () => {
  it('E02-S03 loaderFor batches three loads in one request into one call', async () => {
    const { schema, moduleRef } = await buildCatalog();

    const result = await readArticles(schema, requestContext(), ['a-1', 'a-2', 'a-3']);

    expect(result.errors).toBeUndefined();
    expect(result.data?.catalogArticles).toEqual([
      { id: 'a-1', name: 'Hex bolt M8' },
      { id: 'a-2', name: 'Flat washer 8' },
      { id: 'a-3', name: 'Lock nut M8' },
    ]);
    expect(moduleRef.get(CatalogArticles).batches).toEqual([['a-1', 'a-2', 'a-3']]);
  });

  it('E02-S03 two requests never share a cached value', async () => {
    const { schema, moduleRef } = await buildCatalog();

    const first = await readArticles(schema, requestContext(), ['a-1']);
    moduleRef.get(CatalogArticles).rename('a-1', 'Hex bolt M8 zinc plated');
    const second = await readArticles(schema, requestContext(), ['a-1']);

    expect(first.data?.catalogArticles).toEqual([{ id: 'a-1', name: 'Hex bolt M8' }]);
    expect(second.data?.catalogArticles).toEqual([{ id: 'a-1', name: 'Hex bolt M8 zinc plated' }]);
  });

  it('E02-S03 a NOT_FOUND for one key rejects only that key', async () => {
    const { schema } = await buildCatalog();

    const result = await readArticles(schema, requestContext(), ['a-1', 'a-9', 'a-2']);

    expect(result.data?.catalogArticles).toEqual([
      { id: 'a-1', name: 'Hex bolt M8' },
      null,
      { id: 'a-2', name: 'Flat washer 8' },
    ]);
    expect(
      result.errors?.map((error) => ({ code: error.extensions.code, path: error.path })),
    ).toEqual([{ code: 'NOT_FOUND', path: ['catalogArticles', 1] }]);
  });
});
