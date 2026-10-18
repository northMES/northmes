// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import 'reflect-metadata';
import {
  type CanActivate,
  HttpStatus,
  type INestApplication,
  Injectable,
  Module,
  type Type,
  UseGuards,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  defineCommandContract,
  defineListDeclaration,
  defineListQueryContract,
  defineOperations,
  defineQueryContract,
} from '@northmes/contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { OperationResult } from '@northmes/sdk/operations';
import {
  API_CONTROLLER_METADATA,
  PROBLEM_TYPE_BASE,
  type PublicOperationCall,
  PublicOperationRunner,
  publicApiOperationsOf,
  toRestRoutes,
} from '@northmes/sdk/rest';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

const GAUGE_ID = '01920000-0000-7000-8000-000000000001';

const gauge = z.object({ id: z.uuid(), code: z.string(), size: z.int() });

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
          sortFields: {
            code: { column: 'code', type: 'text' },
            size: { column: 'size', type: 'integer' },
          },
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
        target: 'new',
        fields: z.object({ code: z.string().min(1) }),
        permission: 'tools.gauge:create',
      }),
      output: gauge,
      rest: { method: 'POST', path: 'commands/create-gauge', status: 201 },
      tool: false,
    },
    calibrate: {
      contract: defineCommandContract({
        name: 'tools.calibrateGauge',
        target: 'existing',
        fields: z.object({}),
        permission: 'tools.gauge:calibrate',
      }),
      output: gauge,
      rest: false,
      tool: false,
    },
  },
});

/** A runner that records every call and answers what the test sets. */
class FakeRunner extends PublicOperationRunner {
  readonly calls: PublicOperationCall[] = [];
  answer: OperationResult = { ok: true, status: 200, value: {} };

  async run(call: PublicOperationCall): Promise<OperationResult> {
    this.calls.push(call);
    return this.answer;
  }
}

const opened: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

/** An app that serves `controller` with `runner` as its PublicOperationRunner, and its URL. */
async function serve(controller: Type, runner: FakeRunner): Promise<string> {
  @Module({
    controllers: [controller],
    providers: [{ provide: PublicOperationRunner, useValue: runner }],
  })
  class RoutesModule {}

  const app = await NestFactory.create(RoutesModule, { logger: false });
  opened.push(app);
  await app.listen(0, '127.0.0.1');
  return app.getUrl();
}

describe('toRestRoutes', () => {
  it('ADR0073-W4 a list query is served at GET /api/v1/<module>/<path> and hands the runner its query parameters as input, typed by the contract', async () => {
    const runner = new FakeRunner();
    runner.answer = {
      ok: true,
      status: 200,
      value: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    };
    const url = await serve(toRestRoutes([gaugeOperations]), runner);

    const response = await fetch(
      `${url}/api/v1/tools/gauges?first=2&after=abc&orderBy=-size,code&calibrated=true&search=G-&includeArchived=false`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    expect(runner.calls).toMatchObject([
      {
        operation: 'tools.findGauges',
        input: {
          first: 2,
          after: 'abc',
          orderBy: ['-size', 'code'],
          calibrated: true,
          search: 'G-',
          includeArchived: false,
        },
      },
    ]);
  });

  it('ADR0073-W4 a read takes {id} from the path, and the plant query parameter goes to the runner and not into the input', async () => {
    const runner = new FakeRunner();
    const url = await serve(toRestRoutes([gaugeOperations]), runner);

    const response = await fetch(`${url}/api/v1/tools/gauges/${GAUGE_ID}?plant=hel`, {
      headers: { authorization: 'Bearer nms_int_1' },
    });

    expect(response.status).toBe(200);
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]).toMatchObject({
      operation: 'tools.getGauge',
      method: 'GET',
      input: { id: GAUGE_ID },
      plant: 'hel',
    });
    expect(runner.calls[0]?.input).not.toHaveProperty('plant');
    expect(runner.calls[0]?.headers.get('authorization')).toBe('Bearer nms_int_1');
  });

  it('ADR0073-W4 a command is served at POST /api/v1/<module>/commands/<command-kebab> with the body as input and answers with the status the runner names', async () => {
    const runner = new FakeRunner();
    runner.answer = { ok: true, status: 201, value: { id: GAUGE_ID, code: 'G-1', size: 4 } };
    const url = await serve(toRestRoutes([gaugeOperations]), runner);

    const response = await fetch(`${url}/api/v1/tools/commands/create-gauge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: GAUGE_ID, code: 'G-1' }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    expect(await response.json()).toEqual({ id: GAUGE_ID, code: 'G-1', size: 4 });
    expect(runner.calls).toMatchObject([
      {
        operation: 'tools.createGauge',
        method: 'POST',
        input: { id: GAUGE_ID, code: 'G-1' },
        plant: undefined,
      },
    ]);
  });

  it('ADR0073-W4 an operation without a REST binding is not served', async () => {
    const url = await serve(toRestRoutes([gaugeOperations]), new FakeRunner());

    const response = await fetch(`${url}/api/v1/tools/commands/calibrate-gauge`, {
      method: 'POST',
    });

    expect(response.status).toBe(404);
  });

  it('ADR0073-W4 an error answers application/problem+json with its status, code, message, field errors and the correlation id, and a type built from PROBLEM_TYPE_BASE', async () => {
    const runner = new FakeRunner();
    runner.answer = {
      ok: false,
      error: {
        status: 400,
        code: 'core.invalid_input',
        message: 'Invalid input for tools.createGauge',
        fieldErrors: [{ path: ['code'], message: 'Too small', code: 'too_small' }],
        correlationId: 'corr-1',
      },
    };
    const url = await serve(toRestRoutes([gaugeOperations]), runner);

    const response = await fetch(`${url}/api/v1/tools/commands/create-gauge?plant=hel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '' }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toEqual({
      type: `${PROBLEM_TYPE_BASE}core.invalid_input`,
      title: 'Invalid input',
      status: 400,
      detail: 'Invalid input for tools.createGauge',
      instance: '/api/v1/tools/commands/create-gauge',
      code: 'core.invalid_input',
      errors: [{ path: ['code'], message: 'Too small', code: 'too_small' }],
      correlationId: 'corr-1',
    });
  });

  it('ADR0073-W4 a problem without field errors has an empty errors list and keeps the details', async () => {
    const runner = new FakeRunner();
    runner.answer = {
      ok: false,
      error: {
        status: 403,
        code: 'core.forbidden',
        message: 'You need tools.gauge:read at plant p1',
        details: { permission: 'tools.gauge:read' },
        correlationId: 'corr-2',
      },
    };
    const url = await serve(toRestRoutes([gaugeOperations]), runner);

    const response = await fetch(`${url}/api/v1/tools/gauges`);

    expect(await response.json()).toMatchObject({
      title: 'Not permitted',
      status: 403,
      code: 'core.forbidden',
      errors: [],
      details: { permission: 'tools.gauge:read' },
    });
  });

  it('ADR0073-W4 a 429 problem sends its details.retryAfterSeconds as Retry-After, and another problem sends none', async () => {
    const runner = new FakeRunner();
    runner.answer = {
      ok: false,
      error: {
        status: 429,
        code: 'core.request.rate_limited',
        message: 'Too many requests. Try again in 42 seconds.',
        details: { retryAfterSeconds: 42 },
        correlationId: 'corr-3',
      },
    };
    const url = await serve(toRestRoutes([gaugeOperations]), runner);

    const limited = await fetch(`${url}/api/v1/tools/commands/create-gauge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    runner.answer = {
      ok: false,
      error: { status: 403, code: 'core.forbidden', message: 'No', correlationId: 'corr-4' },
    };
    const refused = await fetch(`${url}/api/v1/tools/gauges`);

    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('42');
    expect(limited.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect(await limited.json()).toMatchObject({
      title: 'Too many requests',
      code: 'core.request.rate_limited',
      details: { retryAfterSeconds: 42 },
    });
    expect(refused.headers.get('retry-after')).toBeNull();
  });

  it('ADR0073-W4 a runner that throws answers 500 core.internal with a correlation id and without its message', async () => {
    const runner = new FakeRunner();
    runner.run = async () => {
      throw new Error('relation core.gauge does not exist');
    };
    const url = await serve(toRestRoutes([gaugeOperations]), runner);

    const response = await fetch(`${url}/api/v1/tools/gauges`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      type: `${PROBLEM_TYPE_BASE}core.internal`,
      status: 500,
      code: 'core.internal',
      detail: 'Unexpected error.',
    });
    expect(body.correlationId).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain('core.gauge');
  });

  it('ADR0073-W4 an exception from a guard on a public route answers as a problem', async () => {
    @Injectable()
    class RefuseAll implements CanActivate {
      canActivate(): boolean {
        throw new DomainError({
          status: HttpStatus.UNAUTHORIZED,
          code: 'core.unauthenticated',
          message: 'Send a credential of the public API',
        });
      }
    }
    const runner = new FakeRunner();
    const controller = toRestRoutes([gaugeOperations]);
    UseGuards(RefuseAll)(controller);
    const url = await serve(controller, runner);

    const response = await fetch(`${url}/api/v1/tools/gauges`);

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toMatchObject({
      status: 401,
      code: 'core.unauthenticated',
      detail: 'Send a credential of the public API',
      instance: '/api/v1/tools/gauges',
    });
    expect(runner.calls).toEqual([]);
  });

  it('ADR0073-W4 the routes are a public ApiController of the module, and each operation id is the GraphQL field name', () => {
    const controller = toRestRoutes([gaugeOperations]);

    expect(Reflect.getMetadata(API_CONTROLLER_METADATA, controller)).toEqual({
      module: 'tools',
      family: 'public',
    });
    expect(publicApiOperationsOf(controller)).toMatchObject([
      {
        operationId: 'toolsGauges',
        operation: 'tools.findGauges',
        permission: 'tools.gauge:read',
        method: 'GET',
        path: '/api/v1/tools/gauges',
        status: 200,
      },
      {
        operationId: 'toolsGauge',
        operation: 'tools.getGauge',
        permission: 'tools.gauge:read',
        method: 'GET',
        path: '/api/v1/tools/gauges/{id}',
        status: 200,
      },
      {
        operationId: 'toolsCreateGauge',
        operation: 'tools.createGauge',
        permission: 'tools.gauge:create',
        method: 'POST',
        path: '/api/v1/tools/commands/create-gauge',
        status: 201,
      },
    ]);
  });

  it('ADR0073-W4 each route records its tag, its input and output schemas and the problem statuses it answers, for the OpenAPI document', () => {
    const { find, get, create } = gaugeOperations.operations;

    const [list, read, write] = publicApiOperationsOf(toRestRoutes([gaugeOperations]));

    expect(list).toMatchObject({
      tag: 'tools',
      input: find.contract.input,
      output: find.output,
      problems: [400, 401, 403, 429],
    });
    expect(read).toMatchObject({
      tag: 'tools',
      input: get.contract.input,
      output: get.output,
      problems: [400, 401, 403, 404, 429],
    });
    expect(write).toMatchObject({
      tag: 'tools',
      input: create.contract.input,
      output: create.output,
      problems: [400, 401, 403, 409, 429],
    });
    expect(write).not.toHaveProperty('description');
  });

  it('ADR0073-W4 a command on an existing row also answers 404 and 412, one without a target 412, and each carries its contract description', () => {
    const commands = defineOperations({
      module: 'tools',
      resource: 'gauges',
      scope: 'companyOrPlant',
      operations: {
        calibrate: {
          contract: defineCommandContract({
            name: 'tools.calibrateGauge',
            description: 'Records a calibration of the gauge.',
            target: 'existing',
            fields: z.object({}),
            permission: 'tools.gauge:calibrate',
          }),
          output: gauge,
          rest: { method: 'POST', path: 'commands/calibrate-gauge', status: 200 },
          tool: false,
        },
        upsert: {
          contract: defineCommandContract({
            name: 'tools.upsertGauge',
            target: 'none',
            fields: z.object({ code: z.string() }),
            permission: 'tools.gauge:create',
          }),
          output: gauge,
          rest: { method: 'POST', path: 'commands/upsert-gauge', status: 201 },
          tool: false,
        },
      },
    });

    const [calibrate, upsert] = publicApiOperationsOf(toRestRoutes([commands]));

    expect(calibrate).toMatchObject({
      description: 'Records a calibration of the gauge.',
      problems: [400, 401, 403, 404, 409, 412, 429],
    });
    expect(upsert).toMatchObject({ problems: [400, 401, 403, 409, 412, 429] });
  });

  it('ADR0073-W4 declarations of two modules, and a plant-scoped operation, throw naming the operation', () => {
    const other = defineOperations({ ...gaugeOperations, module: 'stock', operations: {} });
    const atPlant = defineOperations({ ...gaugeOperations, scope: 'plant' });

    expect(() => toRestRoutes([gaugeOperations, other])).toThrow(
      'stock.gauges is not of module tools',
    );
    expect(() => toRestRoutes([atPlant])).toThrow('tools.gauges.find runs at a plant');
  });
});
