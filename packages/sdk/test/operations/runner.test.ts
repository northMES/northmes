// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import {
  defineCommandContract,
  defineListDeclaration,
  defineListQueryContract,
  defineOperations,
  defineQueryContract,
  outsideText,
} from '@northmes/contracts';
import { DomainError } from '@northmes/sdk/errors';
import {
  noteCreated,
  type OperationPorts,
  type OperationResult,
  runOperation,
  type Surface,
} from '@northmes/sdk/operations';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const GAUGE_ID = '01920000-0000-7000-8000-000000000001';

/** A timestamp as JSON carries it, which a service hands out as a Date. */
const timestamp = z.codec(z.iso.datetime(), z.date(), {
  decode: (text) => new Date(text),
  encode: (date) => date.toISOString(),
});

const gauge = z.object({
  id: z.uuid(),
  code: outsideText(),
  note: outsideText().nullable(),
  size: z.int(),
  updatedAt: timestamp,
});

const getGauge = defineQueryContract({
  name: 'tools.getGauge',
  input: z.object({ id: z.uuid() }),
  output: gauge,
  permission: 'tools.gauge:read',
});

const findGauges = defineListQueryContract({
  name: 'tools.findGauges',
  list: defineListDeclaration({
    name: 'Gauge',
    node: gauge,
    sortFields: { code: { column: 'code', type: 'text' } },
    defaultOrderBy: ['code'],
    search: ['code'],
  }),
  permission: 'tools.gauge:read',
});

const createGauge = defineCommandContract({
  name: 'tools.createGauge',
  target: 'new',
  fields: z.object({ code: z.string().min(1) }),
  permission: 'tools.gauge:create',
});

const gaugeOperations = defineOperations({
  module: 'tools',
  resource: 'gauges',
  scope: 'companyOrPlant',
  operations: {
    find: {
      contract: findGauges,
      rest: { method: 'GET', path: 'gauges', status: 200, maxPageSize: 100 },
      tool: {
        name: 'tools_find_gauges',
        title: 'Find gauges',
        description: 'Gauges by code.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        effect: 'read',
      },
      webmcp: true,
    },
    get: {
      contract: getGauge,
      rest: { method: 'GET', path: 'gauges/{id}', status: 200 },
      tool: {
        name: 'tools_get_gauge',
        title: 'Get a gauge',
        description: 'One gauge by id.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        effect: 'read',
      },
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

/** A gauge as a service hands it out, with a key the output schema does not name. */
function storedGauge(overrides: Record<string, unknown> = {}) {
  return {
    id: GAUGE_ID,
    code: 'G-1',
    note: null,
    size: 4,
    updatedAt: new Date('2026-10-09T08:00:00.000Z'),
    scope_id: 'internal',
    ...overrides,
  };
}

/** Ports that allow every call and record what the runner asked of them. */
function ports(overrides: Partial<OperationPorts> = {}) {
  const calls = { authorize: [] as string[], readOnly: 0, redact: 0 };
  const value: OperationPorts = {
    authorize: (permission) => {
      calls.authorize.push(permission);
    },
    readOnly: async (fn) => {
      calls.readOnly += 1;
      return fn();
    },
    redact: (output) => {
      calls.redact += 1;
      return output;
    },
    ...overrides,
  };
  return { ports: value, calls };
}

/** Runs one operation of the gauge declaration with this handler. */
function run(
  key: keyof typeof gaugeOperations.operations,
  handle: (input: unknown) => Promise<unknown>,
  { surface = 'api', input = {}, with: given = ports().ports } = {} as {
    surface?: Surface;
    input?: unknown;
    with?: OperationPorts;
  },
): Promise<OperationResult> {
  return runOperation(
    { declaration: gaugeOperations, key, handle },
    { surface, input, correlationId: 'corr-1' },
    given,
  );
}

describe('runOperation', () => {
  it('ADR0073-W3 a query handler that returns an extra key sends a result without it', async () => {
    const result = await run('get', async () => storedGauge(), { input: { id: GAUGE_ID } });

    expect(result).toEqual({
      ok: true,
      status: 200,
      value: {
        id: GAUGE_ID,
        code: 'G-1',
        note: null,
        size: 4,
        updatedAt: '2026-10-09T08:00:00.000Z',
      },
    });
  });

  it('ADR0073-W3 an outsideText field is wrapped as untrusted and capped at 500 characters on the webmcp surface and returned plain on api', async () => {
    const long = 'x'.repeat(600);
    const handle = async () => storedGauge({ code: long, note: 'Ask Eva' });

    const onWebMcp = await run('get', handle, { surface: 'webmcp', input: { id: GAUGE_ID } });
    const onApi = await run('get', handle, { surface: 'api', input: { id: GAUGE_ID } });

    expect(onWebMcp).toMatchObject({
      ok: true,
      value: {
        code: { untrusted: true, text: 'x'.repeat(500) },
        note: { untrusted: true, text: 'Ask Eva' },
        size: 4,
      },
    });
    expect(onApi).toMatchObject({ ok: true, value: { code: long, note: 'Ask Eva' } });
  });

  it('ADR0073-W3 a tool call wraps at most 50 outside text values and empties the rest', async () => {
    const nodes = Array.from({ length: 26 }, (_, index) =>
      storedGauge({ code: `G-${index}`, note: `note ${index}` }),
    );
    const handle = async () => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });

    const result = await run('find', handle, { surface: 'webmcp', input: {} });

    if (!result.ok) throw new Error(result.error.message);
    const values = (result.value as { nodes: { code: unknown; note: unknown }[] }).nodes.flatMap(
      ({ code, note }) => [code, note],
    );
    expect(values.slice(0, 50).every((value) => (value as { text: string }).text !== '')).toBe(
      true,
    );
    expect(values.slice(50)).toEqual([
      { untrusted: true, text: '' },
      { untrusted: true, text: '' },
    ]);
  });

  it('ADR0073-W3 the personal-field redactor runs on every tool output', async () => {
    const redact = vi.fn((output: unknown) => ({ ...(output as object), size: 0 }));
    const { ports: given } = ports({ redact });

    const onWebMcp = await run('get', async () => storedGauge(), {
      surface: 'webmcp',
      input: { id: GAUGE_ID },
      with: given,
    });
    const onApi = await run('get', async () => storedGauge(), {
      surface: 'api',
      input: { id: GAUGE_ID },
      with: given,
    });

    expect(redact).toHaveBeenCalledTimes(1);
    expect(onWebMcp).toMatchObject({ ok: true, value: { size: 0 } });
    expect(onApi).toMatchObject({ ok: true, value: { size: 4 } });
  });

  it('ADR0073-W3 an unknown error maps to core.internal with the correlation id', async () => {
    const report = vi.fn();
    const { ports: given } = ports({ report });

    const result = await run(
      'get',
      async () => {
        throw new Error('connection reset at 10.0.0.4');
      },
      { input: { id: GAUGE_ID }, with: given },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        status: 500,
        code: 'core.internal',
        message: 'Unexpected error.',
        correlationId: 'corr-1',
      },
    });
    expect(report).toHaveBeenCalledWith(expect.any(Error), 'corr-1');
  });

  it('ADR0073-W3 a DomainError keeps its code, status, details and field errors', async () => {
    const result = await run(
      'create',
      async () => {
        throw new DomainError({
          code: 'core.code_taken',
          status: HttpStatus.CONFLICT,
          message: 'The code is already taken.',
          fieldErrors: [{ path: ['code'], message: 'The code is already taken.', code: 'x' }],
        });
      },
      { input: { id: GAUGE_ID, code: 'G-1' } },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        status: 409,
        code: 'core.code_taken',
        message: 'The code is already taken.',
        fieldErrors: [{ path: ['code'], message: 'The code is already taken.', code: 'x' }],
        correlationId: 'corr-1',
      },
    });
  });

  it("ADR0073-W3 Nest's NotFoundException maps to 404 core.not_found with its message", async () => {
    const result = await run(
      'get',
      async () => {
        throw new NotFoundException(`Gauge ${GAUGE_ID} was not found`);
      },
      { input: { id: GAUGE_ID } },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        status: 404,
        code: 'core.not_found',
        message: `Gauge ${GAUGE_ID} was not found`,
        correlationId: 'corr-1',
      },
    });
  });

  it('ADR0073-W3 an input that fails the contract is 400 core.invalid_input with field errors, and the handler does not run', async () => {
    const handle = vi.fn(async () => storedGauge());

    const result = await run('create', handle, { input: { id: 'g-1', code: '' } });

    expect(handle).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 400,
        code: 'core.invalid_input',
        fieldErrors: [
          { path: ['code'], code: 'too_small' },
          { path: ['id'], code: 'invalid_format' },
        ],
      },
    });
  });

  it('ADR0073-W3 the permission gate runs before the handler and its refusal is the answer', async () => {
    const handle = vi.fn(async () => storedGauge());
    const { ports: given } = ports({
      authorize: (permission) => {
        throw new DomainError({
          code: 'core.forbidden',
          status: HttpStatus.FORBIDDEN,
          message: `You need ${permission} at plant p`,
        });
      },
    });

    const result = await run('get', handle, { input: { id: GAUGE_ID }, with: given });

    expect(handle).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 403,
        code: 'core.forbidden',
        message: 'You need tools.gauge:read at plant p',
      },
    });
  });

  it('ADR0073-W3 a query runs read only and a command does not', async () => {
    const { ports: given, calls } = ports();

    await run('get', async () => storedGauge(), { input: { id: GAUGE_ID }, with: given });
    expect(calls).toMatchObject({ readOnly: 1, authorize: ['tools.gauge:read'] });

    await run('create', async () => storedGauge(), {
      input: { id: GAUGE_ID, code: 'G-1' },
      with: given,
    });
    expect(calls).toMatchObject({
      readOnly: 1,
      authorize: ['tools.gauge:read', 'tools.gauge:create'],
    });
  });

  it('ADR0073-W3 an operation with status 201 answers 201 when its handler noted a new row, and 200 for a row that existed', async () => {
    const input = { id: GAUGE_ID, code: 'G-1' };

    const created = await run(
      'create',
      async () => {
        noteCreated();
        return storedGauge();
      },
      { input },
    );
    const existed = await run('create', async () => storedGauge(), { input });

    expect(created).toMatchObject({ ok: true, status: 201 });
    expect(existed).toMatchObject({ ok: true, status: 200 });
  });

  it('ADR0073-W3 a list call above the surface page size is 400 core.list.bad_argument: 100 on api and 25 on a tool', async () => {
    const handle = vi.fn(async () => ({
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    }));

    const onApi = await run('find', handle, { surface: 'api', input: { first: 100 } });
    const onTool = await run('find', handle, { surface: 'webmcp', input: { first: 26 } });

    expect(onApi).toMatchObject({ ok: true });
    expect(onTool).toMatchObject({
      ok: false,
      error: {
        status: 400,
        code: 'core.list.bad_argument',
        message: 'first must be between 1 and 25',
      },
    });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('ADR0073-W3 an operation without a binding for the surface is refused', async () => {
    const result = await run('create', async () => storedGauge(), {
      surface: 'webmcp',
      input: { id: GAUGE_ID, code: 'G-1' },
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 404,
        code: 'core.not_found',
        message: 'tools.createGauge has no webmcp tool',
      },
    });
  });
});
