// SPDX-License-Identifier: MIT
import { defineModuleLinks } from '@northmes/contracts';
import { describe, expectTypeOf, it } from 'vitest';

const links = defineModuleLinks('planning', {
  orders: { path: 'orders', children: { order: { path: '$orderId' } } },
});

describe('defineModuleLinks', () => {
  it('E02-S05 a missing orderId, an extra argument and an unknown entry fail typecheck', () => {
    expectTypeOf(links.orders.order).parameter(0).toEqualTypeOf<{
      readonly plant: string;
      readonly orderId: string;
    }>();
    expectTypeOf(
      links.orders.order({ plant: 'plant-a', orderId: '1' }).to,
    ).toEqualTypeOf<'/$plant/planning/orders/$orderId'>();

    // @ts-expect-error orderId is missing
    links.orders.order({ plant: 'plant-a' });
    // @ts-expect-error lineId is not a param of the pattern
    links.orders.order({ plant: 'plant-a', orderId: '1', lineId: '2' });
    // @ts-expect-error a builder takes params and search, nothing more
    links.orders.order({ plant: 'plant-a', orderId: '1' }, {}, {});
    // @ts-expect-error the manifest has no lines entry
    links.orders.lines({ plant: 'plant-a' });
  });

  it('E04-S02 a settings section builder takes a company id and no plant', () => {
    const core = defineModuleLinks(
      'core',
      { articles: { path: 'articles' } },
      { settings: { users: { path: 'users' } } },
    );

    expectTypeOf(core.settings.users).parameter(0).toEqualTypeOf<{
      readonly companyId: string;
    }>();
    // @ts-expect-error a settings page takes no plant
    core.settings.users({ plant: 'plant-a' });
    // @ts-expect-error a manifest without a settings section has none
    links.settings;
  });
});
