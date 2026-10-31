// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineCoreLinks, defineModuleLinks } from '@northmes/contracts';
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

  it('#876 a settings section builder takes the plant', () => {
    const quality = defineModuleLinks(
      'quality',
      { inspections: { path: 'inspections' } },
      { settings: { plans: { path: 'plans' } } },
    );

    expectTypeOf(quality.settings.plans).parameter(0).toEqualTypeOf<{
      readonly plant: string;
    }>();
    // @ts-expect-error a settings page takes no company id
    quality.settings.plans({ companyId: 'c' });
    // @ts-expect-error a manifest without a settings section has none
    links.settings;
  });

  it("#876 defineCoreLinks' patterns have no module segment, and its settings builders take the plant", () => {
    const core = defineCoreLinks(
      { articles: { path: 'articles', children: { article: { path: '$articleId' } } } },
      { settings: { users: { path: 'users' } } },
    );

    expectTypeOf(
      core.articles.article({ plant: 'plant-a', articleId: '1' }).to,
    ).toEqualTypeOf<'/$plant/articles/$articleId'>();
    expectTypeOf(
      core.settings.users({ plant: 'plant-a' }).to,
    ).toEqualTypeOf<'/$plant/settings/users'>();
    // @ts-expect-error a settings page takes no company id
    core.settings.users({ companyId: 'c' });
  });

  it("ADR0078 an entry with an empty path builds its parent's own pattern", () => {
    const core = defineCoreLinks({ dashboard: { path: '' } });

    expectTypeOf(core.dashboard({ plant: 'plant-a' }).to).toEqualTypeOf<'/$plant'>();
  });
});
