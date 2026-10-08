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

  it('E02-S05 a . or .. param value throws, because URL parsing would drop it or climb out', () => {
    expect(new URL('/plant-a/planning/orders/..', 'http://localhost').pathname).toBe(
      '/plant-a/planning/',
    );
    for (const orderId of ['.', '..']) {
      expect(() => links.orders.order({ plant: 'plant-a', orderId }), orderId).toThrow(
        `Link /$plant/planning/orders/$orderId has the value ${JSON.stringify(orderId)} for orderId, which is not a path segment`,
      );
    }
  });

  it('E02-S05 an entry named like a function property, such as name or call, throws', () => {
    for (const name of ['name', 'call']) {
      expect(() => defineModuleLinks('planning', { [name]: { path: 'x' } }), name).toThrow(
        `Link entry ${name} under /$plant/planning has the name of a function property`,
      );
    }
  });

  it('E02-S05 a builder returns its route pattern as to, with the params and search it was given', () => {
    expect(links.orders({ plant: 'plant-a' }, { q: '1001' })).toEqual({
      to: '/$plant/planning/orders',
      params: { plant: 'plant-a' },
      search: { q: '1001' },
      href: '/plant-a/planning/orders?q=1001',
    });
  });

  it('E02-S05 the href encodes each search key and value and leaves out empty values', () => {
    const link = links.orders({ plant: 'plant-a' }, { q: 'a&b c#d', 'x=y': '1', sort: '' });

    expect(link.href).toBe('/plant-a/planning/orders?q=a%26b%20c%23d&x%3Dy=1');
    expect(new URL(link.href, 'http://localhost').searchParams.get('q')).toBe('a&b c#d');
  });
});
