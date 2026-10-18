// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { cli } from '../../src/cli.ts';
import type { OpenApiDocument } from '../../src/openapi/document.ts';
import { openApiJson } from '../../src/openapi/print.ts';

const repository = new URL('../../../../', import.meta.url);

function committed(path: string): string {
  return readFileSync(new URL(path, repository), 'utf8');
}

describe('openApiJson', () => {
  it('ADR0064 prints the document of the in-repo modules without a database or an environment, as schema/openapi-v1.json commits it', async () => {
    const env = { ...process.env };
    delete process.env.DATABASE_URL;
    try {
      expect(await openApiJson()).toBe(committed('schema/openapi-v1.json'));
    } finally {
      process.env = env;
    }
  });

  it('ADR0064 two runs give identical bytes, with info.version the API major and every key in name order', async () => {
    const first = await openApiJson();
    const document = JSON.parse(first) as OpenApiDocument;

    expect(await openApiJson()).toBe(first);
    expect(document.info.version).toBe('1');
    expect(Object.keys(document)).toEqual([...Object.keys(document)].sort());
    expect(first.endsWith('}\n')).toBe(true);
  });

  it("ADR0073-W4 covers core's article and article group routes, each with its operation id", async () => {
    const document = JSON.parse(await openApiJson()) as OpenApiDocument;
    const operations = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item).map(([method, { operationId }]) => `${method} ${path} ${operationId}`),
    );

    expect(operations).toEqual(
      expect.arrayContaining([
        'get /api/v1/core/articles coreArticles',
        'get /api/v1/core/articles/{id} coreArticle',
        'post /api/v1/core/commands/create-article coreCreateArticle',
        'post /api/v1/core/commands/update-article coreUpdateArticle',
        'post /api/v1/core/commands/set-article-plants coreSetArticlePlants',
        'post /api/v1/core/commands/archive-article coreArchiveArticle',
        'post /api/v1/core/commands/restore-article coreRestoreArticle',
        'post /api/v1/core/commands/upsert-article coreUpsertArticle',
        'get /api/v1/core/article-groups coreArticleGroups',
        'get /api/v1/core/article-groups/{id} coreArticleGroup',
        'post /api/v1/core/commands/create-article-group coreCreateArticleGroup',
        'post /api/v1/core/commands/update-article-group coreUpdateArticleGroup',
        'post /api/v1/core/commands/archive-article-group coreArchiveArticleGroup',
        'post /api/v1/core/commands/restore-article-group coreRestoreArticleGroup',
      ]),
    );
    expect(document.components.schemas).toHaveProperty('CoreArticle');
    expect(document.components.schemas).toHaveProperty('CoreArticleGroup');
  });

  it("ADR0064 every operation id is unique and starts with its tag followed by an upper-case letter, and a command route's is its mutation", async () => {
    const document = JSON.parse(await openApiJson()) as OpenApiDocument;
    const mutations = Object.keys(
      buildSchema(committed('schema/api.graphql')).getMutationType()?.getFields() ?? {},
    );
    const operations = Object.values(document.paths).flatMap((item) => Object.entries(item));
    const ids = operations.map(([, { operationId }]) => operationId);

    expect(new Set(ids).size).toBe(ids.length);
    for (const [method, { operationId, tags }] of operations) {
      expect(operationId).toMatch(new RegExp(`^${tags?.[0]}[A-Z]`));
      if (method === 'post') expect(mutations).toContain(operationId);
    }
  });

  it('ADR0064 pnpm northmes openapi print writes the document to standard output', async () => {
    const printed: string[] = [];

    await cli(['openapi', 'print'], {
      env: {},
      exit: (code) => {
        throw new Error(`exit ${code}`);
      },
      log: console,
      print: (text) => printed.push(text),
    });

    expect(printed).toEqual([committed('schema/openapi-v1.json')]);
  });
});
