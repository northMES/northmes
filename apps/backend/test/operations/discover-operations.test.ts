// SPDX-License-Identifier: AGPL-3.0-or-later
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { defineOperations, defineQueryContract } from '@northmes/contracts';
import { bindOperations } from '@northmes/sdk/operations';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BootError } from '../../src/boot/boot-error.ts';
import { discoverOperations } from '../../src/operations/discover-operations.ts';

const bin = z.object({ id: z.uuid(), code: z.string() });

/** The operations of stock's bins, whose get checks `permission`. */
function binOperations(permission: string) {
  return defineOperations({
    module: 'stock',
    resource: 'bins',
    scope: 'plant',
    operations: {
      get: {
        contract: defineQueryContract({
          name: 'stock.getBin',
          input: z.object({ id: z.uuid() }),
          output: bin,
          permission,
        }),
        rest: { method: 'GET', path: 'bins/{id}', status: 200 },
        tool: false,
      },
    },
  });
}

const BinOperations = bindOperations(binOperations('stock.bin:read'), {
  get: async ({ id }) => ({ id, code: 'B-1' }),
});

@Module({ providers: [BinOperations] })
class StockModule {}

const stock = { id: 'stock', module: StockModule, permissions: { 'stock.bin': ['read'] } };

describe('discoverOperations', () => {
  it('ADR0073-W3 finds the bound operations among the providers of each module, by contract name', () => {
    const found = discoverOperations([stock]);

    expect([...found.keys()]).toEqual(['stock.getBin']);
    expect(found.get('stock.getBin')).toMatchObject({
      module: 'stock',
      key: 'get',
      provider: BinOperations,
    });
  });

  it("ADR0073-W3 another module's operations, an operation bound twice and a query permission the module does not declare stop boot", () => {
    const Unguarded = bindOperations(binOperations('stock.bin:peek'), {
      get: async ({ id }) => ({ id, code: 'B-1' }),
    });
    @Module({ providers: [BinOperations] })
    class PlanningModule {}
    @Module({ providers: [Unguarded] })
    class StockAgainModule {}
    const check = () =>
      discoverOperations([
        stock,
        { id: 'planning', module: PlanningModule },
        { id: 'stock', module: StockAgainModule, permissions: { 'stock.bin': ['read'] } },
      ]);

    expect(check).toThrow(BootError);
    expect(check).toThrow(
      expect.objectContaining({
        problems: [
          'Module planning lists the operations of stock.bins; a module binds only its own operations (ADR 0073)',
          'Operation stock.getBin is bound by StockBinsOperations of module stock and by StockBinsOperations of module stock',
          'Operation stock.getBin of module stock checks permission stock.bin:peek, which module stock does not declare',
        ],
      }),
    );
  });
});
