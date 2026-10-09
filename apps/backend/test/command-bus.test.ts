// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { defineCommandContract } from '@northmes/contracts';
import { type Command, CommandValidator, type TargetRow } from '@northmes/sdk/commands';
import type { ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import type { Transaction } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CommandBusImpl } from '../src/commands/command-bus.ts';
import { accessOf } from '../src/modules/core/core/access/access.ts';
import { type Principal, runAs } from '../src/principal.ts';
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

// One company with plants A and B.
const COMPANY = '019a0000-0000-7000-8000-000000000c01';
const PLANT_A = '019a0000-0000-7000-8000-000000000a01';
const PLANT_B = '019a0000-0000-7000-8000-000000000b01';

/**
 * A principal at plant A whose role assignments grant, at each scope of the company's tree, the
 * permissions that `granted` names for it.
 */
function principalHolding(granted: Readonly<Record<string, readonly string[]>>): Principal {
  const access = accessOf([
    { id: COMPANY, parentId: null, permissions: granted[COMPANY] ?? [] },
    { id: PLANT_A, parentId: COMPANY, permissions: granted[PLANT_A] ?? [] },
    { id: PLANT_B, parentId: COMPANY, permissions: granted[PLANT_B] ?? [] },
  ]);
  return { userId: '019a0000-0000-7000-8000-0000000000e1', plantId: PLANT_A, ...access };
}

/** A planner who releases production orders and dispatch jobs at plant A. */
const releaser = principalHolding({
  [PLANT_A]: ['planning.productionOrder:release', 'dispatch.job:release'],
});

/** Runs fn as the releaser. */
function asReleaser<Result>(fn: () => Promise<Result>): Promise<Result> {
  return runAs(releaser, fn);
}

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
  permission: 'planning.productionOrder:release',
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
      permission: 'planning.productionOrder:release',
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

    const run = asReleaser(() => bus.run(command, { id: ORDER_ID }));

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

    const result = await asReleaser(() => bus.run(command, { id: ORDER_ID }));

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

    const run = asReleaser(() => bus.run(command, { id: ORDER_ID }));

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

    const run = asReleaser(() => bus.run(releaseJobWith(handle), { id: JOB_ID }));

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

    void asReleaser(() => bus.run(releaseJobWith(handle), { id: JOB_ID })).then(
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

    const run = asReleaser(() => bus.run(command, { id: ORDER_ID }));

    await expect(run).rejects.toMatchObject({
      message: 'Unexpected error.',
      cause: expect.any(TypeError),
    });
    expect(handle).not.toHaveBeenCalled();
  });
});

/** The input of a release of the order ORDER_ID, made on version 1. */
const releaseInput = { id: ORDER_ID, expectedVersion: 1 };

/** The release command on an order at `scopeId` with `version`, whose spies record what ran. */
function releaseOfOrderAt(scopeId: string, version = 1) {
  const buildPayload = vi.fn(async () => ({ quantity: { value: 1500, unit: 'pcs' } }));
  const handle = vi.fn(async () => ({ released: true }));
  const command: Command<typeof releaseInput, { released: boolean }, TargetRow> = {
    contract: releaseProductionOrder,
    target: {
      entity: 'Production order',
      load: async (id) => ({ id, version, scope_id: scopeId }),
    },
    buildPayload,
    handle,
  };
  return { command, buildPayload, handle };
}

/** A bus whose one validator of the release passes, and the spy of that validator's check. */
function busWithPassingValidator(database: FakeScopedDatabase) {
  const check = vi.fn(async () => ({ verdict: 'pass' }) as const);
  const bus = new CommandBusImpl(database, {
    modules: ['core', 'planning', 'release-limits'],
    validators: [
      {
        module: 'release-limits',
        validator: CommandValidator(releaseProductionOrder, { name: 'quantity-limit', check })
          .validator,
      },
    ],
  });
  return { bus, check };
}

/** Creates an article under the client's id at the request's plant. */
const createArticle = defineCommandContract({
  name: 'core.createArticle',
  target: 'new',
  fields: z.object({ code: z.string() }),
  permission: 'core.article:create',
});

/** What the bus refuses a command with when the principal lacks its permission (ADR 0012). */
const forbidden = { code: 'core.forbidden', status: HttpStatus.FORBIDDEN };

/** The code and status of what `run` rejected with, which must be a DomainError. */
async function refusalOf(run: Promise<unknown>) {
  const error = await run.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(DomainError);
  return { code: (error as DomainError).code, status: (error as DomainError).getStatus() };
}

describe('the permission step of CommandBusImpl', () => {
  it("E05-S06 a principal who holds the command's permission at the company runs it on a row at a plant below", async () => {
    const database = new FakeScopedDatabase();
    const { bus, check } = busWithPassingValidator(database);
    const { command, handle } = releaseOfOrderAt(PLANT_A);
    const companyPlanner = principalHolding({ [COMPANY]: ['planning.productionOrder:release'] });

    const result = await runAs(companyPlanner, () => bus.run(command, releaseInput));

    expect(result).toEqual({ released: true });
    expect(check).toHaveBeenCalledOnce();
    expect(handle).toHaveBeenCalledOnce();
    expect(database.transactions).toEqual([{ tx: { transaction: 1 }, outcome: 'committed' }]);
  });

  it("E05-S06 a principal without the command's permission at the row's scope gets FORBIDDEN core.forbidden, and neither the validators nor the handler run", async () => {
    const database = new FakeScopedDatabase();
    const { bus, check } = busWithPassingValidator(database);
    const { command, buildPayload, handle } = releaseOfOrderAt(PLANT_A);
    // A role with a write permission writes at plant A, but it does not grant the release.
    const articleEditor = principalHolding({
      [PLANT_A]: ['planning.productionOrder:read', 'core.article:update'],
    });

    const run = runAs(articleEditor, () => bus.run(command, releaseInput));

    expect(await refusalOf(run)).toEqual(forbidden);
    expect(buildPayload).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
    expect(database.transactions).toEqual([{ tx: { transaction: 1 }, outcome: 'rolled back' }]);
  });

  it("E05-S06 a principal who holds the command's permission at a sibling plant gets FORBIDDEN on a row at the other plant", async () => {
    const database = new FakeScopedDatabase();
    const { bus, check } = busWithPassingValidator(database);
    const { command, handle } = releaseOfOrderAt(PLANT_A);
    const plantBPlanner = principalHolding({
      [PLANT_A]: ['planning.productionOrder:read'],
      [PLANT_B]: ['planning.productionOrder:release'],
    });

    const run = runAs(plantBPlanner, () => bus.run(command, releaseInput));

    expect(await refusalOf(run)).toEqual(forbidden);
    expect(check).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it('E05-S06 the permission is checked before the version, so a stale expectedVersion without the permission gets FORBIDDEN', async () => {
    const { bus } = busWithPassingValidator(new FakeScopedDatabase());
    const { command } = releaseOfOrderAt(PLANT_A, 2);
    const viewer = principalHolding({ [PLANT_A]: ['planning.productionOrder:read'] });

    const run = runAs(viewer, () => bus.run(command, releaseInput));

    expect(await refusalOf(run)).toEqual(forbidden);
  });

  it('E05-S06 a create is checked at the plant the request names', async () => {
    const handle = vi.fn(async ({ id }: { id: string }) => ({ id }));
    const command: Command<{ id: string; code: string }, { id: string }> = {
      contract: createArticle,
      handle,
    };
    const bus = new CommandBusImpl(new FakeScopedDatabase(), { modules: ['core'], validators: [] });
    const input = { id: ORDER_ID, code: 'BR-140' };
    // Both principals send their requests at plant A.
    const plantACreator = principalHolding({ [PLANT_A]: ['core.article:create'] });
    const plantBCreator = principalHolding({ [PLANT_B]: ['core.article:create'] });

    const atPlantA = await runAs(plantACreator, () => bus.run(command, input));
    const atPlantB = runAs(plantBCreator, () => bus.run(command, input));

    expect(atPlantA).toEqual({ id: ORDER_ID });
    expect(await refusalOf(atPlantB)).toEqual(forbidden);
    expect(handle).toHaveBeenCalledOnce();
  });

  it('E05-S06 a create from a request that names no plant gets FORBIDDEN', async () => {
    const handle = vi.fn(async ({ id }: { id: string }) => ({ id }));
    const bus = new CommandBusImpl(new FakeScopedDatabase(), { modules: ['core'], validators: [] });
    const creator = {
      ...principalHolding({ [COMPANY]: ['core.article:create'] }),
      plantId: undefined,
    };

    const run = runAs(creator, () =>
      bus.run({ contract: createArticle, handle }, { id: ORDER_ID, code: 'BR-140' }),
    );

    expect(await refusalOf(run)).toEqual(forbidden);
    expect(handle).not.toHaveBeenCalled();
  });

  it('E05-S06 a command run without a principal gets FORBIDDEN, and its handler does not run', async () => {
    const database = new FakeScopedDatabase();
    const { bus, check } = busWithPassingValidator(database);
    const { command, handle } = releaseOfOrderAt(PLANT_A);

    const run = bus.run(command, releaseInput);

    expect(await refusalOf(run)).toEqual(forbidden);
    expect(check).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });
});
