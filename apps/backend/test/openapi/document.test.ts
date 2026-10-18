// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import 'reflect-metadata';
import { Get, type Type } from '@nestjs/common';
import {
  defineCommandContract,
  defineListDeclaration,
  defineListQueryContract,
  defineOperations,
  defineQueryContract,
  timestamp,
  version,
} from '@northmes/contracts';
import { ApiController, toRestRoutes } from '@northmes/sdk/rest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { openApiDocument } from '../../src/openapi/document.ts';

const gauge = z
  .object({
    id: z.uuid(),
    code: z.string(),
    size: z.int(),
    note: z.string().nullable(),
    version,
    calibratedAt: timestamp.nullable(),
  })
  .meta({ id: 'ToolsGauge' });

const gaugeOperations = defineOperations({
  module: 'tools',
  resource: 'gauges',
  scope: 'companyOrPlant',
  operations: {
    find: {
      contract: defineListQueryContract({
        name: 'tools.findGauges',
        list: defineListDeclaration({
          name: 'Gauge',
          node: gauge,
          sortFields: { code: { column: 'code', type: 'text' } },
          defaultOrderBy: ['code'],
          filters: { calibrated: z.boolean() },
          search: ['code'],
          archivable: true,
        }),
        permission: 'tools.gauge:read',
      }),
      rest: { method: 'GET', path: 'gauges', status: 200, maxPageSize: 100 },
      tool: false,
    },
    get: {
      contract: defineQueryContract({
        name: 'tools.getGauge',
        input: z.object({ id: z.uuid() }),
        output: gauge,
        permission: 'tools.gauge:read',
      }),
      rest: { method: 'GET', path: 'gauges/{id}', status: 200 },
      tool: false,
    },
    create: {
      contract: defineCommandContract({
        name: 'tools.createGauge',
        description: 'Creates a gauge.',
        target: 'new',
        fields: z.object({ code: z.string().min(1) }),
        permission: 'tools.gauge:create',
      }),
      output: gauge,
      rest: { method: 'POST', path: 'commands/create-gauge', status: 201 },
      tool: false,
    },
    rename: {
      contract: defineCommandContract({
        name: 'tools.renameGauge',
        target: 'existing',
        fields: z.object({ code: z.string().min(1) }),
        permission: 'tools.gauge:update',
      }),
      output: gauge,
      rest: { method: 'POST', path: 'commands/rename-gauge', status: 200 },
      tool: false,
    },
  },
});

/** A first-party controller of the tools module, which the document leaves out. */
@ApiController({ module: 'tools', family: 'first-party' })
class ToolsWebController {
  @Get('gauge-picker')
  picker(): string[] {
    return [];
  }
}

/** A module whose read answers a component of the given shape under the id ToolsGauge. */
function stockOperations(component: z.ZodType) {
  return defineOperations({
    module: 'stock',
    resource: 'bins',
    scope: 'companyOrPlant',
    operations: {
      get: {
        contract: defineQueryContract({
          name: 'stock.getBin',
          input: z.object({ id: z.uuid() }),
          output: z.object({ id: z.uuid(), gauge: component }),
          permission: 'stock.bin:read',
        }),
        rest: { method: 'GET', path: 'bins/{id}', status: 200 },
        tool: false,
      },
    },
  });
}

const tools = toRestRoutes([gaugeOperations]);

function document(controllers: readonly Type[] = [tools, ToolsWebController]) {
  return openApiDocument(controllers, { version: '1' });
}

/** Every value of a JSON tree, depth first, with the keys that lead to it. */
function* walk(value: unknown, path: string[] = []): Generator<[string[], unknown]> {
  yield [path, value];
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) yield* walk(child, [...path, key]);
  }
}

describe('openApiDocument', () => {
  it('ADR0064 openapi is 3.1.0 with the given version, and no schema uses nullable', () => {
    const built = document();

    expect(built.openapi).toBe('3.1.0');
    expect(built.info).toMatchObject({ title: 'NorthMES API', version: '1' });
    const nullable = [...walk(built)].filter(([path]) => path.at(-1) === 'nullable');
    expect(nullable).toEqual([]);
    expect(built.components.schemas.ToolsGauge?.properties?.note).toEqual({
      type: ['string', 'null'],
    });
  });

  it('ADR0064 every route of a public controller is an operation with its operation id and its module as tag, and a first-party route is not', () => {
    const built = document();

    expect(built.tags).toEqual([{ name: 'tools' }]);
    expect(
      Object.entries(built.paths).flatMap(([path, item]) =>
        Object.entries(item).map(([method, operation]) => [
          method,
          path,
          operation.operationId,
          operation.tags,
        ]),
      ),
    ).toEqual([
      ['post', '/api/v1/tools/commands/create-gauge', 'toolsCreateGauge', ['tools']],
      ['post', '/api/v1/tools/commands/rename-gauge', 'toolsRenameGauge', ['tools']],
      ['get', '/api/v1/tools/gauges', 'toolsGauges', ['tools']],
      ['get', '/api/v1/tools/gauges/{id}', 'toolsGauge', ['tools']],
    ]);
    expect(built.paths['/api/v1/tools/commands/create-gauge']?.post?.description).toBe(
      'Creates a gauge.',
    );
  });

  it('ADR0073-W4 a GET route takes its path parameters, the rest of its input as query parameters and the optional plant', () => {
    const built = document();

    expect(built.paths['/api/v1/tools/gauges/{id}']?.get?.parameters).toEqual([
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
      },
      { $ref: '#/components/parameters/plant' },
    ]);
    const list = built.paths['/api/v1/tools/gauges']?.get?.parameters ?? [];
    expect(
      list.map((parameter) => ('name' in parameter ? parameter.name : parameter.$ref)),
    ).toEqual([
      'first',
      'after',
      'orderBy',
      'calibrated',
      'search',
      'includeArchived',
      '#/components/parameters/plant',
    ]);
    expect(list.every((parameter) => !('in' in parameter) || parameter.in === 'query')).toBe(true);
    expect(
      list.find((parameter) => 'name' in parameter && parameter.name === 'orderBy'),
    ).toMatchObject({
      required: false,
      style: 'form',
      explode: false,
      schema: { type: 'array' },
    });
    expect(built.components.parameters.plant).toEqual({
      name: 'plant',
      in: 'query',
      required: false,
      description: expect.stringContaining('slug'),
      schema: { type: 'string' },
    });
  });

  it('ADR0073-W4 a POST route takes its contract input as the body, and every route answers its output schema, a route that may create with 201 and 200', () => {
    const built = document();
    const create = built.paths['/api/v1/tools/commands/create-gauge']?.post;

    expect(create?.parameters).toEqual([{ $ref: '#/components/parameters/plant' }]);
    expect(create?.requestBody).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: expect.objectContaining({
            type: 'object',
            required: ['code', 'id'],
          }),
        },
      },
    });
    const ok = { 'application/json': { schema: { $ref: '#/components/schemas/ToolsGauge' } } };
    expect(create?.responses?.['201']).toEqual({ description: 'Created', content: ok });
    expect(create?.responses?.['200']).toEqual({ description: 'OK', content: ok });
    expect(built.paths['/api/v1/tools/gauges/{id}']?.get?.responses?.['200']).toEqual({
      description: 'OK',
      content: ok,
    });
    expect(built.paths['/api/v1/tools/gauges/{id}']?.get?.responses).not.toHaveProperty('201');
  });

  it('ADR0073-W4 a timestamp is the date-time string that JSON carries', () => {
    const built = document();

    expect(built.components.schemas.ToolsGauge?.properties?.calibratedAt).toEqual({
      anyOf: [expect.objectContaining({ type: 'string', format: 'date-time' }), { type: 'null' }],
    });
  });

  it('ADR0064 every operation lists its problem responses as application/problem+json with the Problem component, and 429 sends Retry-After', () => {
    const built = document();
    const rename = built.paths['/api/v1/tools/commands/rename-gauge']?.post;

    expect(Object.keys(rename?.responses ?? {})).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
      '412',
      '429',
    ]);
    expect(rename?.responses?.['409']).toEqual({ $ref: '#/components/responses/Conflict' });
    expect(built.components.responses.Conflict).toEqual({
      description: 'Conflict',
      content: {
        'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
      },
    });
    expect(built.components.responses.TooManyRequests?.headers).toEqual({
      'Retry-After': {
        description: expect.any(String),
        schema: { type: 'integer', minimum: 0 },
      },
    });
    expect(built.components.schemas.Problem?.required).toEqual([
      'type',
      'title',
      'status',
      'detail',
      'instance',
      'code',
      'errors',
      'correlationId',
    ]);
  });

  it('ADR0073-W4 every operation requires the bearer scheme with its permission as the scope', () => {
    const built = document();

    expect(built.components.securitySchemes).toEqual({
      bearer: expect.objectContaining({ type: 'http', scheme: 'bearer' }),
    });
    expect(built.paths['/api/v1/tools/gauges']?.get?.security).toEqual([
      { bearer: ['tools.gauge:read'] },
    ]);
    expect(built.paths['/api/v1/tools/commands/rename-gauge']?.post?.security).toEqual([
      { bearer: ['tools.gauge:update'] },
    ]);
  });

  it('ADR0064 a component id that two modules convert to different schemas throws naming both modules', () => {
    const other = z.object({ id: z.uuid() }).meta({ id: 'ToolsGauge' });

    expect(() => document([tools, toRestRoutes([stockOperations(other)])])).toThrow(
      'Component ToolsGauge converts to different schemas in modules stock and tools',
    );
  });

  it('ADR0064 a component that two modules share with one shape is listed once', () => {
    const built = document([tools, toRestRoutes([stockOperations(gauge)])]);

    expect(built.tags).toEqual([{ name: 'stock' }, { name: 'tools' }]);
    expect(built.paths['/api/v1/stock/bins/{id}']?.get?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { properties: { gauge: { $ref: '#/components/schemas/ToolsGauge' } } },
        },
      },
    });
  });
});
