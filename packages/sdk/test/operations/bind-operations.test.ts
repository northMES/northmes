// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { defineOperations, defineQueryContract } from '@northmes/contracts';
import { bindOperations } from '@northmes/sdk/operations';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const GAUGE_ID = '01920000-0000-7000-8000-000000000001';

const gauge = z.object({ id: z.uuid(), code: z.string() });

const gaugeOperations = defineOperations({
  module: 'tools',
  resource: 'gauges',
  scope: 'plant',
  operations: {
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
  },
});

/** The module's service, which every surface calls. */
@Injectable()
class GaugeService {
  byIdOrThrow(id: string) {
    return Promise.resolve({ id, code: 'G-1' });
  }
}

describe('bindOperations', () => {
  it('ADR0073-W3 binds each operation to a handler that reaches the module service through the context', async () => {
    const GaugeOperations = bindOperations(gaugeOperations, {
      get: (input, context) => context.get(GaugeService).byIdOrThrow(input.id),
    });

    @Module({ providers: [GaugeService, GaugeOperations] })
    class ToolsModule {}

    const moduleRef = await Test.createTestingModule({ imports: [ToolsModule] }).compile();
    const bound = moduleRef.get(GaugeOperations);

    expect(GaugeOperations.declaration).toBe(gaugeOperations);
    expect(GaugeOperations.name).toBe('ToolsGaugesOperations');
    await expect(bound.handle('get', { id: GAUGE_ID })).resolves.toEqual({
      id: GAUGE_ID,
      code: 'G-1',
    });
    await moduleRef.close();
  });

  it('ADR0073-W3 a missing or an unknown handler throws naming the operation', () => {
    expect(() => bindOperations(gaugeOperations, {} as never)).toThrow(
      'Operation tools.gauges.get has no handler',
    );
    expect(() =>
      bindOperations(gaugeOperations, {
        get: async () => ({ id: GAUGE_ID, code: 'G-1' }),
        archive: async () => undefined,
      } as never),
    ).toThrow('Handler archive of tools.gauges is not one of its operations');
  });
});
