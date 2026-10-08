// SPDX-License-Identifier: MIT
import { defineModuleLinks } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';

const links = defineModuleLinks('planning', {
  orders: { path: 'orders', children: { order: { path: '$orderId' } } },
});

describe('defineModuleLinks', () => {
  it('E02-S05 order({ plant: plant-a, orderId: a/b }).href is /plant-a/planning/orders/a%2Fb', () => {
    expect(links.orders.order({ plant: 'plant-a', orderId: 'a/b' }).href).toBe(
      '/plant-a/planning/orders/a%2Fb',
    );
  });

  it('E02-S05 an empty orderId throws', () => {
    expect(() => links.orders.order({ plant: 'plant-a', orderId: '' })).toThrow(
      'Link /$plant/planning/orders/$orderId has an empty value for orderId',
    );
  });
});
