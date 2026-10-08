// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const ORDER_ID = '01920000-0000-7000-8000-000000000001';

/** Fields with a refinement across two of them, which the derived input must keep. */
const releaseFields = z
  .object({ note: z.string(), quantity: z.number() })
  .refine((fields) => fields.quantity <= 500 || fields.note !== '', {
    path: ['note'],
    message: 'A release above 500 needs a note',
  });

describe('defineCommandContract', () => {
  it('E05-S01 a contract with target existing has an input of id, expectedVersion and its fields', () => {
    const contract = defineCommandContract({
      name: 'planning.releaseProductionOrder',
      target: 'existing',
      fields: releaseFields,
    });
    const input = { id: ORDER_ID, expectedVersion: 3, note: '', quantity: 120 };

    expect(contract.input.parse(input)).toEqual(input);
    expect(contract.input.safeParse({ ...input, id: undefined }).success).toBe(false);
    expect(contract.input.safeParse({ ...input, id: 'po-1' }).success).toBe(false);
    expect(contract.input.safeParse({ ...input, expectedVersion: undefined }).success).toBe(false);
    expect(contract.input.safeParse({ ...input, expectedVersion: 0 }).success).toBe(false);
    expect(contract.input.safeParse({ ...input, expectedVersion: 1.5 }).success).toBe(false);
    expect(contract.input.safeParse({ ...input, expectedVersion: 2 ** 31 }).success).toBe(false);
    expect(
      contract.input
        .safeParse({ ...input, quantity: 900 })
        .error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([{ path: ['note'], message: 'A release above 500 needs a note' }]);
  });

  it('E02-S04 a contract with target new has an input of the new id plus its fields', () => {
    const contract = defineCommandContract({
      name: 'planning.createProductionOrder',
      target: 'new',
      fields: z.object({ number: z.string() }),
    });

    expect(contract.input.parse({ id: ORDER_ID, number: '4711' })).toEqual({
      id: ORDER_ID,
      number: '4711',
    });
    expect(contract.input.safeParse({ number: '4711' }).success).toBe(false);
  });

  it('E02-S04 a contract with target none has an input of only its fields', () => {
    const contract = defineCommandContract({
      name: 'planning.recalculateSchedule',
      target: 'none',
      fields: z.object({ horizonDays: z.number() }),
    });

    expect(contract.input.parse({ id: ORDER_ID, horizonDays: 14 })).toEqual({ horizonDays: 14 });
  });

  it('E02-S04 a validatable contract without the schema of its validator payload is refused', () => {
    const options = {
      name: 'planning.releaseProductionOrder',
      target: 'existing',
      fields: z.object({}),
      validatable: true,
    } as const;

    // @ts-expect-error A validatable contract declares its validator payload schema (ADR 0037).
    expect(() => defineCommandContract(options)).toThrow(
      'Command planning.releaseProductionOrder is validatable, so its contract needs a payload schema',
    );
  });
});
