// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { defineCommandContract } from '@northmes/contracts';
import { type Command, CommandValidator } from '@northmes/sdk/commands';
import type { ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import type { Transaction } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CommandBusImpl } from '../src/commands/command-bus.ts';
import { releaseJob } from './fixtures/commands/dispatch.ts';
import {
  BROKEN_CHECK_ERROR,
  BrokenCheck,
  SLOW_CHECK_ANSWERS_AFTER_MS,
  SLOW_CHECK_LIMIT_MS,
  SlowCheck,
} from './fixtures/commands/failing-validators.ts';

const ORDER_ID = '01920000-0000-7000-8000-000000000001';
const JOB_ID = '01920000-0000-7000-8000-0000000000a1';

/** The fixture command dispatch.releaseJob, with `handle` as its handler. */
function releaseJobWith(
  handle: Command<{ id: string }, { id: string; status: string }>['handle'],
): Command<{ id: string }, { id: string; status: string }> {
  return {
    contract: releaseJob,
    buildPayload: async ({ id }) => ({ jobId: id, quantity: 1500 }),
    handle,
  };
}

/** A transaction of the fake, and how it ended once it has. */
interface FakeTransaction {
  readonly tx: Transaction<unknown>;
  outcome?: 'committed' | 'rolled back';
}

/**
 * A ScopedDatabase without Postgres. Each transaction is a fresh object, which the fake records
 * with how it ended: committed when fn resolves, rolled back when it rejects.
 */
class FakeScopedDatabase implements ScopedDatabase<unknown> {
  readonly transactions: FakeTransaction[] = [];

  /** The transaction that has not ended yet, if any. */
  get open(): Transaction<unknown> | undefined {
    return this.transactions.find(({ outcome }) => !outcome)?.tx;
  }

  async transaction<Result>(fn: (tx: Transaction<unknown>) => Promise<Result>): Promise<Result> {
    // A number tells the transactions apart when a test compares them.
    const tx = { transaction: this.transactions.length + 1 } as unknown as Transaction<unknown>;
    const entry: FakeTransaction = { tx };
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('E02-S04 validators run in catalog order and then by name, and handle gets the transaction they ran in', async () => {
    const database = new FakeScopedDatabase();
    // What ran, in order, with the transaction it got or that was open while it ran.
    const steps: [string, Transaction<unknown> | undefined][] = [];
    const validatorOf = (module: string, name: string) => ({
      module,
      validator: CommandValidator(releaseProductionOrder, {
        name,
        check: async () => {
          steps.push([`${module}/${name}`, database.open]);
          return { verdict: 'pass' };
        },
      }).validator,
    });
    const command: Command<{ id: string }, { released: boolean }> = {
      contract: releaseProductionOrder,
      buildPayload: async (_input, { tx }) => {
        steps.push(['buildPayload', tx]);
        return { quantity: { value: 1500, unit: 'pcs' } };
      },
      handle: async (_input, { tx }) => {
        steps.push(['handle', tx]);
        return { released: true };
      },
    };
    // audit-rules depends on release-limits, so the catalog boots it later, though its id sorts
    // first.
    const bus = new CommandBusImpl(database, {
      modules: ['core', 'planning', 'release-limits', 'audit-rules'],
      validators: [
        validatorOf('audit-rules', 'order-number'),
        validatorOf('release-limits', 'quantity-limit'),
        validatorOf('release-limits', 'article-blocked'),
      ],
    });

    const result = await bus.run(command, { id: ORDER_ID });

    expect(result).toEqual({ released: true });
    expect(database.transactions).toEqual([{ tx: { transaction: 1 }, outcome: 'committed' }]);
    const tx = database.transactions[0]?.tx;
    expect(steps).toEqual([
      ['buildPayload', tx],
      ['release-limits/article-blocked', tx],
      ['release-limits/quantity-limit', tx],
      ['audit-rules/order-number', tx],
      ['handle', tx],
    ]);
  });

  it('E02-S04 a veto rejects the command with core.command_rejected naming the vetoing module, rolls back, and the handler does not run', async () => {
    const database = new FakeScopedDatabase();
    const handle = vi.fn(async () => ({ released: true }));
    const command: Command<{ id: string }, { released: boolean }> = {
      contract: releaseProductionOrder,
      buildPayload: async () => ({ quantity: { value: 1500, unit: 'pcs' } }),
      handle,
    };
    const quantityLimit = CommandValidator(releaseProductionOrder, {
      name: 'quantity-limit',
      check: async ({ quantity }) => ({
        verdict: 'veto',
        message: `${quantity.value} ${quantity.unit} is above the release limit of 1000 pcs`,
      }),
    });
    const bus = new CommandBusImpl(database, {
      modules: ['core', 'planning', 'release-limits'],
      validators: [{ module: 'release-limits', validator: quantityLimit.validator }],
    });

    const run = bus.run(command, { id: ORDER_ID });

    const error = await run.catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: 'core.command_rejected',
      message: '1500 pcs is above the release limit of 1000 pcs',
      details: { rejectedBy: 'release-limits' },
    });
    expect((error as DomainError).getStatus()).toBe(HttpStatus.PRECONDITION_FAILED);
    expect(handle).not.toHaveBeenCalled();
    expect(database.transactions).toEqual([{ tx: { transaction: 1 }, outcome: 'rolled back' }]);
  });

  it('E02-S04 a throwing validator returns Unexpected error. and the handler does not run', async () => {
    const database = new FakeScopedDatabase();
    const handle = vi.fn(async ({ id }: { id: string }) => ({ id, status: 'released' }));
    const bus = new CommandBusImpl(database, {
      modules: ['core', 'dispatch', 'broken-rules'],
      validators: [{ module: 'broken-rules', validator: BrokenCheck.validator }],
    });

    const run = bus.run(releaseJobWith(handle), { id: JOB_ID });

    // The validator's own error stays on the server, as the cause.
    await expect(run).rejects.toMatchObject({
      message: 'Unexpected error.',
      cause: { message: BROKEN_CHECK_ERROR },
    });
    expect(handle).not.toHaveBeenCalled();
    expect(database.transactions).toEqual([{ tx: { transaction: 1 }, outcome: 'rolled back' }]);
  });

  it('E02-S04 a validator slower than its limit rejects the command and the handler does not run', async () => {
    vi.useFakeTimers();
    const database = new FakeScopedDatabase();
    const handle = vi.fn(async ({ id }: { id: string }) => ({ id, status: 'released' }));
    const bus = new CommandBusImpl(database, {
      modules: ['core', 'dispatch', 'slow-rules'],
      validators: [{ module: 'slow-rules', validator: SlowCheck.validator }],
    });
    let outcome: { result: unknown } | { error: unknown } | undefined;

    void bus.run(releaseJobWith(handle), { id: JOB_ID }).then(
      (result) => {
        outcome = { result };
      },
      (error: unknown) => {
        outcome = { error };
      },
    );
    await vi.advanceTimersByTimeAsync(SLOW_CHECK_LIMIT_MS);

    expect(outcome).toMatchObject({
      error: {
        message: 'Unexpected error.',
        cause: {
          message: `Validator slow-check of module slow-rules did not answer within ${SLOW_CHECK_LIMIT_MS} ms`,
        },
      },
    });
    expect(database.transactions).toEqual([{ tx: { transaction: 1 }, outcome: 'rolled back' }]);
    // The pass that SlowCheck answers after its limit changes nothing.
    await vi.advanceTimersByTimeAsync(SLOW_CHECK_ANSWERS_AFTER_MS);
    expect(handle).not.toHaveBeenCalled();
  });

  it('E02-S04 a validator that changes its payload throws, because the payload is frozen', async () => {
    const handle = vi.fn(async () => ({ released: true }));
    const command: Command<{ id: string }, { released: boolean }> = {
      contract: releaseProductionOrder,
      buildPayload: async () => ({ quantity: { value: 1500, unit: 'pcs' } }),
      handle,
    };
    const lowerQuantity = CommandValidator(releaseProductionOrder, {
      name: 'lower-quantity',
      check: async (payload) => {
        payload.quantity.value = 1000;
        return { verdict: 'pass' };
      },
    });
    const bus = new CommandBusImpl(new FakeScopedDatabase(), {
      modules: ['core', 'planning', 'release-limits'],
      validators: [{ module: 'release-limits', validator: lowerQuantity.validator }],
    });

    const run = bus.run(command, { id: ORDER_ID });

    await expect(run).rejects.toMatchObject({
      message: 'Unexpected error.',
      cause: expect.any(TypeError),
    });
    expect(handle).not.toHaveBeenCalled();
  });
});
