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
  it('E02-S04 a contract with target existing has an input of id plus its fields', () => {
    const contract = defineCommandContract({
      name: 'planning.releaseProductionOrder',
      target: 'existing',
      fields: releaseFields,
    });

    expect(contract.input.parse({ id: ORDER_ID, note: '', quantity: 120 })).toEqual({
      id: ORDER_ID,
      note: '',
      quantity: 120,
    });
    expect(contract.input.safeParse({ note: '', quantity: 120 }).success).toBe(false);
    expect(contract.input.safeParse({ id: 'po-1', note: '', quantity: 120 }).success).toBe(false);
    expect(
      contract.input
        .safeParse({ id: ORDER_ID, note: '', quantity: 900 })
        .error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([{ path: ['note'], message: 'A release above 500 needs a note' }]);
  });

  it('E02-S04 a contract with target none has an input of only its fields', () => {
    const contract = defineCommandContract({
      name: 'planning.recalculateSchedule',
      target: 'none',
      fields: z.object({ horizonDays: z.number() }),
    });

    expect(contract.input.parse({ id: ORDER_ID, horizonDays: 14 })).toEqual({ horizonDays: 14 });
  });
});
