// SPDX-License-Identifier: MIT
import {
  defineCommandContract,
  defineListDeclaration,
  defineListQueryContract,
  defineOperations,
  defineQueryContract,
  isOutsideText,
  outsideText,
} from '@northmes/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const GAUGE_ID = '01920000-0000-7000-8000-000000000001';

/** A gauge as the operations of the fixture module answer it. */
const gauge = z.object({ id: z.uuid(), code: outsideText(), size: z.int() });

const getGauge = defineQueryContract({
  name: 'tools.getGauge',
  input: z.object({ id: z.uuid() }),
  output: gauge,
  permission: 'tools.gauge:read',
});

const createGauge = defineCommandContract({
  name: 'tools.createGauge',
  target: 'new',
  fields: z.object({ code: z.string(), size: z.int() }),
  permission: 'tools.gauge:create',
});

const gaugeList = defineListDeclaration({
  name: 'Gauge',
  node: gauge,
  sortFields: {
    code: { column: 'code', type: 'text' },
    updatedAt: { column: 'updated_at', type: 'timestamptz' },
  },
  defaultOrderBy: ['code'],
  filters: { code: z.string(), unused: z.boolean() },
  search: ['code'],
  archivable: true,
});

const findGauges = defineListQueryContract({
  name: 'tools.findGauges',
  list: gaugeList,
  permission: 'tools.gauge:read',
});

/** A tool binding with the fields every tool needs, under `name`. */
function readTool(name: string) {
  return {
    name,
    title: 'Get a gauge',
    description: 'One gauge by id.',
    annotations: { readOnlyHint: true, destructiveHint: false },
    effect: 'read',
  } as const;
}

describe('defineQueryContract', () => {
  it('ADR0073-W3 a query contract without an output schema throws', () => {
    expect(() =>
      defineQueryContract({
        name: 'tools.getGauge',
        input: z.object({ id: z.uuid() }),
        permission: 'tools.gauge:read',
      } as unknown as Parameters<typeof defineQueryContract>[0]),
    ).toThrow('Query tools.getGauge has no output schema');
  });

  it('ADR0073-W3 a query contract keeps its name, input, output and permission', () => {
    expect(getGauge).toMatchObject({
      kind: 'query',
      name: 'tools.getGauge',
      permission: 'tools.gauge:read',
    });
    expect(getGauge.input.parse({ id: GAUGE_ID })).toEqual({ id: GAUGE_ID });
    expect(getGauge.output.parse({ id: GAUGE_ID, code: 'G-1', size: 4, extra: 1 })).toEqual({
      id: GAUGE_ID,
      code: 'G-1',
      size: 4,
    });
  });
});

describe('outsideText', () => {
  it('ADR0073-W3 marks a string schema as outside text, also behind nullable', () => {
    const name = outsideText(z.string().max(200));

    expect(isOutsideText(name)).toBe(true);
    expect(isOutsideText(gauge.shape.code)).toBe(true);
    expect(isOutsideText(z.string())).toBe(false);
    expect(name.parse('Bolt')).toBe('Bolt');
    expect(name.safeParse('x'.repeat(201)).success).toBe(false);
  });
});

describe('defineListQueryContract', () => {
  it('ADR0073-W3 derives first, after, orderBy, the filter fields, search and includeArchived from the list declaration', () => {
    const input = {
      first: 10,
      after: 'cursor',
      orderBy: ['-updatedAt', 'code'],
      code: 'G-1',
      unused: true,
      search: 'bolt',
      includeArchived: true,
    };

    expect(findGauges).toMatchObject({ kind: 'query', name: 'tools.findGauges', list: gaugeList });
    expect(findGauges.input.parse(input)).toEqual(input);
    expect(findGauges.input.parse({})).toEqual({});
    expect(findGauges.input.safeParse({ first: 0 }).success).toBe(false);
    expect(findGauges.input.safeParse({ first: 101 }).success).toBe(false);
    expect(findGauges.input.safeParse({ orderBy: ['size'] }).success).toBe(false);
    expect(findGauges.input.safeParse({ orderBy: ['code', 'code', 'code', 'code'] }).success).toBe(
      false,
    );
  });

  it('ADR0073-W3 answers nodes and pageInfo, the connection without edges', () => {
    const page = {
      nodes: [{ id: GAUGE_ID, code: 'G-1', size: 4 }],
      pageInfo: { hasNextPage: true, endCursor: 'cursor' },
    };

    expect(findGauges.output.parse(page)).toEqual(page);
    expect(
      findGauges.output.safeParse({ ...page, pageInfo: { hasNextPage: false, endCursor: null } })
        .success,
    ).toBe(true);
  });

  it('ADR0073-W3 a list without archivable takes no includeArchived', () => {
    const list = defineListDeclaration({ ...gaugeList, archivable: false });
    const contract = defineListQueryContract({
      name: 'tools.findGauges',
      list,
      permission: 'tools.gauge:read',
    });

    expect(contract.input.parse({ includeArchived: true })).toEqual({});
  });
});

describe('defineOperations', () => {
  it('ADR0073-W3 lists each operation with its contract, its output and the surfaces it reaches', () => {
    const operations = defineOperations({
      module: 'tools',
      resource: 'gauges',
      scope: 'companyOrPlant',
      operations: {
        find: {
          contract: findGauges,
          rest: { method: 'GET', path: 'gauges', status: 200, maxPageSize: 100 },
          tool: false,
        },
        get: {
          contract: getGauge,
          rest: { method: 'GET', path: 'gauges/{id}', status: 200 },
          tool: readTool('tools_get_gauge'),
          webmcp: true,
        },
        create: {
          contract: createGauge,
          output: gauge,
          rest: { method: 'POST', path: 'commands/create-gauge', status: 201 },
          tool: false,
        },
      },
    });

    expect(operations).toMatchObject({ module: 'tools', resource: 'gauges' });
    expect(operations.operations.get.output).toBe(gauge);
    expect(operations.operations.create.output).toBe(gauge);
    expect(operations.operations.find.output).toBe(findGauges.output);
    expect(operations.operations.get.webmcp).toBe(true);
    expect(operations.operations.create.webmcp).toBe(false);
  });

  it('ADR0073-W3 an operation whose tool name lacks its module prefix throws naming the operation', () => {
    expect(() =>
      defineOperations({
        module: 'tools',
        resource: 'gauges',
        scope: 'plant',
        operations: {
          get: { contract: getGauge, rest: false, tool: readTool('get_gauge') },
        },
      }),
    ).toThrow('Operation tools.gauges.get: tool name get_gauge does not start with tools_');
  });

  it('ADR0073-W3 a REST path outside the module segment throws', () => {
    for (const path of ['/api/v1/planning/orders', '../planning/orders', 'gauges//x', '']) {
      expect(() =>
        defineOperations({
          module: 'tools',
          resource: 'gauges',
          scope: 'plant',
          operations: {
            get: { contract: getGauge, rest: { method: 'GET', path, status: 200 }, tool: false },
          },
        }),
      ).toThrow(`Operation tools.gauges.get: REST path ${JSON.stringify(path)} is not under`);
    }
  });

  it('ADR0073-W3 a contract of another module throws naming the operation', () => {
    expect(() =>
      defineOperations({
        module: 'stock',
        resource: 'gauges',
        scope: 'plant',
        operations: { get: { contract: getGauge, rest: false, tool: false } },
      }),
    ).toThrow('Operation stock.gauges.get: contract tools.getGauge is not of module stock');
  });

  it('ADR0073-W3 a command operation without an output schema throws', () => {
    expect(() =>
      defineOperations({
        module: 'tools',
        resource: 'gauges',
        scope: 'plant',
        operations: {
          create: { contract: createGauge, rest: false, tool: false },
        } as unknown as Parameters<typeof defineOperations>[0]['operations'],
      }),
    ).toThrow('Operation tools.gauges.create: command tools.createGauge needs output');
  });

  it('ADR0073-W3 a WebMCP tool must be a read tool', () => {
    expect(() =>
      defineOperations({
        module: 'tools',
        resource: 'gauges',
        scope: 'plant',
        operations: { get: { contract: getGauge, rest: false, tool: false, webmcp: true } },
      }),
    ).toThrow('Operation tools.gauges.get: webmcp needs a tool');
    expect(() =>
      defineOperations({
        module: 'tools',
        resource: 'gauges',
        scope: 'plant',
        operations: {
          create: {
            contract: createGauge,
            output: gauge,
            rest: false,
            tool: { ...readTool('tools_create_gauge'), effect: 'proposal' },
            webmcp: true,
          },
        },
      }),
    ).toThrow('Operation tools.gauges.create: WebMCP registers read tools only');
  });

  it('ADR0073-W3 maxPageSize belongs to a list and stays within the list kit limit of 100', () => {
    expect(() =>
      defineOperations({
        module: 'tools',
        resource: 'gauges',
        scope: 'plant',
        operations: {
          get: {
            contract: getGauge,
            rest: { method: 'GET', path: 'gauges/{id}', status: 200, maxPageSize: 10 },
            tool: false,
          },
        },
      }),
    ).toThrow('Operation tools.gauges.get: maxPageSize needs a list query');
    expect(() =>
      defineOperations({
        module: 'tools',
        resource: 'gauges',
        scope: 'plant',
        operations: {
          find: {
            contract: findGauges,
            rest: { method: 'GET', path: 'gauges', status: 200, maxPageSize: 500 },
            tool: false,
          },
        },
      }),
    ).toThrow('Operation tools.gauges.find: maxPageSize 500 is not between 1 and 100');
  });
});
