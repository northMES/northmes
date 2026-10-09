// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module beta: owns Crate, whose thing field reads alpha's Thing through alpha's API, and a
// subscription that announces one crate at the plant its argument names.
import { Inject, Module } from '@nestjs/common';
import {
  Args,
  Context,
  Field,
  ID,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import type { InRepoModule } from '../../../src/modules.ts';
import { AlphaApiModule, AlphaThings, Thing } from './alpha.ts';

@ObjectType('Crate')
export class Crate {
  @Field(() => ID) id!: string;
  @Field(() => String) label!: string;
  thingId!: string;
}

/** The event of betaCrateArrived: a crate arrived at a plant. */
@ObjectType('CrateArrival')
export class CrateArrival {
  @Field(() => ID) plantId!: string;
  @Field(() => Crate) crate!: Crate;
}

@Resolver(() => Crate)
export class CrateResolver {
  constructor(@Inject(AlphaThings) private readonly things: AlphaThings) {}

  @Query(() => [Crate])
  betaCrates(): Crate[] {
    return [
      { id: 'c-1', label: 'Crate one', thingId: 't-1' },
      { id: 'c-2', label: 'Crate two', thingId: 't-2' },
    ];
  }

  /** Alpha's thing in the crate, which the request's alpha.thing loader reads in one batch. */
  @ResolveField(() => Thing, { nullable: true })
  thing(@Parent() crate: Crate, @Context() context: RequestContext): Promise<Thing> {
    return loaderFor(context, 'alpha.thing', (ids: readonly string[]) =>
      this.things.byIds(ids),
    ).load(crate.thingId);
  }

  /** Delivers one event, the arrival of crate one at the plant the argument names, and ends. */
  @Subscription(() => CrateArrival, { resolve: (event: CrateArrival) => event })
  async *betaCrateArrived(
    @Args('plantId', { type: () => ID }) plantId: string,
  ): AsyncGenerator<CrateArrival> {
    yield { plantId, crate: { id: 'c-1', label: 'Crate one', thingId: 't-1' } };
  }
}

@Module({ imports: [AlphaApiModule], providers: [CrateResolver] })
export class BetaModule {}

export const beta: InRepoModule = {
  id: 'beta',
  dependsOn: ['alpha'],
  module: BetaModule,
};
