// SPDX-License-Identifier: AGPL-3.0-or-later
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { describe, expect, it } from 'vitest';
import { rootFieldProblems } from '../../src/graphql/root-fields.ts';
import { CoreModule } from '../../src/modules/core/core.module.ts';
import { PlanningModule } from '../../src/modules/planning/planning.module.ts';

@Resolver()
class ShopFloorResolver {
  @Query(() => String)
  ping(): string {
    return 'pong';
  }

  @Query(() => String, { name: 'shopFloorStatus' })
  status(): string {
    return 'running';
  }

  @Mutation(() => Boolean)
  shopFloorStart(): boolean {
    return true;
  }

  @Subscription(() => String)
  async *shopFloorticks(): AsyncGenerator<string> {
    yield 'tick';
  }
}

@Module({ providers: [ShopFloorResolver] })
class ShopFloorModule {}

@Resolver()
class StationResolver {
  @Query(() => String)
  stations(): string {
    return 'station-1';
  }
}

@Module({ providers: [StationResolver] })
class StationModule {}

/** A server entry whose root fields come from a Nest module it imports. */
@Module({ imports: [StationModule] })
class ShopFloorEntryModule {}

describe('the root field prefix rule', () => {
  it('E02-S03 every root field of core and planning starts with its module prefix', () => {
    const problems = rootFieldProblems([
      { id: 'core', module: CoreModule },
      { id: 'planning', module: PlanningModule },
    ]);

    expect(problems).toEqual([]);
  });

  it('E02-S03 a root field without its module prefix and an upper-case letter is a problem naming the field and the module', () => {
    const problems = rootFieldProblems([{ id: 'shop-floor', module: ShopFloorModule }]);

    expect(problems).toEqual([
      '[NORTHMES_ROOT_FIELD_PREFIX] Query.ping of module shop-floor must start with "shopFloor" and an upper-case letter',
      '[NORTHMES_ROOT_FIELD_PREFIX] Subscription.shopFloorticks of module shop-floor must start with "shopFloor" and an upper-case letter',
    ]);
  });

  it('E02-S03 a root field in a Nest module that the server entry imports follows the same rule', () => {
    const problems = rootFieldProblems([{ id: 'shop-floor', module: ShopFloorEntryModule }]);

    expect(problems).toEqual([
      '[NORTHMES_ROOT_FIELD_PREFIX] Query.stations of module shop-floor must start with "shopFloor" and an upper-case letter',
    ]);
  });
});
