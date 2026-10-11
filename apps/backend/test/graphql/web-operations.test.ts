// SPDX-License-Identifier: AGPL-3.0-or-later
import { globSync, readFileSync } from 'node:fs';
import { maxAliasesRule } from '@escape.tech/graphql-armor-max-aliases';
import { maxDepthRule } from '@escape.tech/graphql-armor-max-depth';
import { buildSchema, parse, specifiedRules, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { operationCost } from '../../src/graphql/cost.ts';
import { graphqlLimits } from '../../src/graphql/limits.ts';
import { schemaSdl } from '../../src/graphql/schema-sdl.ts';

// The web's screens must keep loading under the limits of #477. Each operation file in apps/web
// holds one operation inside gql`...`; a screen change that crosses a limit fails here, not in the
// browser.

const webSource = new URL('../../../web/src/', import.meta.url);

/** Every web operation, by its file under apps/web/src. */
function webOperations(): { file: string; source: string }[] {
  return globSync('**/*.graphql.ts', { cwd: webSource }).map((file) => {
    const text = readFileSync(new URL(file, webSource), 'utf8');
    const blocks = [...text.matchAll(/gql`([\s\S]*?)`/g)].map((match) => match[1] ?? '');
    const [source] = blocks;
    if (blocks.length !== 1 || source === undefined) {
      throw new Error(`${file} holds ${blocks.length} gql blocks, and an operation file holds one`);
    }
    return { file, source };
  });
}

/**
 * Variables that set every first or last to 100, the largest page the list kit serves (ADR 0016),
 * so an operation is priced at the most its screen can ask for.
 */
const largestPages: Record<string, unknown> = new Proxy({}, { get: () => 100 });

describe('the web operations under the request limits (B4)', () => {
  it('B4 every web operation stays within the depth, alias and cost limits', async () => {
    const schema = buildSchema(await schemaSdl());
    const operations = webOperations();
    const rules = [
      ...specifiedRules,
      maxDepthRule({ n: graphqlLimits.maxDepth }),
      maxAliasesRule({ n: graphqlLimits.maxAliases }),
    ];

    const overLimits = operations.flatMap(({ file, source }) => {
      const document = parse(source, { maxTokens: graphqlLimits.maxTokens });
      const errors = validate(schema, document, rules).map((error) => error.message);
      const cost = operationCost(schema, document, {
        variables: largestPages,
        defaultListSize: graphqlLimits.defaultListSize,
      });
      if (cost > graphqlLimits.maxCost) errors.push(`costs ${cost}`);
      return errors.map((error) => `${file}: ${error}`);
    });

    expect(operations.length).toBeGreaterThan(0);
    expect(overLimits).toEqual([]);
  });
});
