// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module alpha: owns Thing, and hands out its things through its API module, AlphaApiModule.
import { Inject, Injectable, Module } from '@nestjs/common';
import { Args, Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { InRepoModule } from '../../../src/modules.ts';

@ObjectType('Thing')
export class Thing {
  @Field(() => ID) id!: string;
  @Field(() => String) name!: string;
}

/** Alpha's thing store, which its API exports. It records every batch it serves. */
@Injectable()
export class AlphaThings {
  readonly batches: string[][] = [];
  readonly #rows = new Map<string, Thing>([
    ['t-1', { id: 't-1', name: 'Spindle' }],
    ['t-2', { id: 't-2', name: 'Gear wheel' }],
  ]);

  byId(id: string): Thing | undefined {
    return this.#rows.get(id);
  }

  async byIds(ids: readonly string[]): Promise<(Thing | GraphQLError)[]> {
    this.batches.push([...ids]);
    return ids.map(
      (id) =>
        this.#rows.get(id) ??
        new GraphQLError(`Thing ${id} was not found`, { extensions: { code: 'NOT_FOUND' } }),
    );
  }
}

/** Alpha's public API: plain providers and no resolvers. */
@Module({ providers: [AlphaThings], exports: [AlphaThings] })
export class AlphaApiModule {}

@Resolver(() => Thing)
export class ThingResolver {
  constructor(@Inject(AlphaThings) private readonly things: AlphaThings) {}

  @Query(() => Thing, { nullable: true })
  alphaThing(@Args('id', { type: () => ID }) id: string): Thing | undefined {
    return this.things.byId(id);
  }
}

@Module({ imports: [AlphaApiModule], providers: [ThingResolver] })
export class AlphaModule {}

export const alpha: InRepoModule = {
  id: 'alpha',
  module: AlphaModule,
};
