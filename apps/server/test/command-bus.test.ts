// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineCommandContract } from '@northmes/contracts';
import { type Command, CommandValidator } from '@northmes/sdk/commands';
import type { ScopedDatabase } from '@northmes/sdk/data';
import type { Transaction } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CommandBusImpl } from '../src/commands/command-bus.ts';

const ORDER_ID = '01920000-0000-7000-8000-000000000001';

/**
 * A ScopedDatabase without Postgres. Each transaction is a fresh object, which the fake records
 * with how it ended: committed when fn resolves, rolled back when it rejects.
 */
class FakeScopedDatabase implements ScopedDatabase<unknown> {
  readonly transactions: { tx: Transaction<unknown>; outcome?: 'committed' | 'rolled back' }[] =
    [];

  async transaction<Result>(fn: (tx: Transaction<unknown>) => Promise<Result>): Promise<Result> {
    const entry: (typeof this.transactions)[number] = { tx: {} as Transaction<unknown> };
    this.transactions.push(entry);
    try {
      const result = await fn(entry.tx);
      entry.outcome = 'committed';
      return result;
    } catch (error) {
      entry.outcome = 'rolled back';
      throw error;
    }
  }
}

/** The owner's contract of the release command, as the host has it. */
const releaseProductionOrder = defineCommandContract({
  name: 'planning.releaseProductionOrder',
  target: 'existing',
  fields: z.object({}),
  validatable: true,
  payload: z.object({ quantity: z.object({ value: z.number(), unit: z.string() }) }),
});

describe('CommandBusImpl', () => {
  it('E02-S04 a payload with quantity as an object is rejected with core.validator_contract_mismatch and the handler spy is not called', async () => {
    // The copy of planning's contract that a plugin bundled before quantity became measured.
    const bundledContract = defineCommandContract({
      name: 'planning.releaseProductionOrder',
      target: 'existing',
      fields: z.object({}),
      validatable: true,
      payload: z.object({ quantity: z.number() }),
    });
    const check = vi.fn(async () => ({ verdict: 'pass' }) as const);
    const handle = vi.fn(async () => ({ released: true }));
    const command: Command<{ id: string }, { released: boolean }> = {
      contract: releaseProductionOrder,
      buildPayload: async () => ({ quantity: { value: 1500, unit: 'pcs' } }),
      handle,
    };
    const bus = new CommandBusImpl(new FakeScopedDatabase(), {
      modules: ['core', 'planning', 'release-limits'],
      validators: [
        {
          module: 'release-limits',
          validator: CommandValidator(bundledContract, { name: 'quantity-limit', check }).validator,
        },
      ],
    });

    const run = bus.run(command, { id: ORDER_ID });

    await expect(run).rejects.toMatchObject({ code: 'core.validator_contract_mismatch' });
    expect(check).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });
});
