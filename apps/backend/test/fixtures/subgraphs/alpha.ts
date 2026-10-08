// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module alpha: owns the entity Thing and resolves references to it.
import { Inject, Injectable, Module } from '@nestjs/common';
import {
  Args,
  Context,
  Directive,
  Field,
  ID,
  ObjectType,
  Parent,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import { defineModule } from '@northmes/sdk';
import { type EntityReference, loaderFor, type SubgraphContext } from '@northmes/sdk/graphql';
import { GraphQLError } from 'graphql';

@ObjectType('Thing', { registerIn: () => AlphaModule })
@Directive('@key(fields: "id")')
export class Thing {
  @Field(() => ID) id!: string;
  @Field(() => String) name!: string;
}

@Injectable()
export class AlphaThings {
  readonly #rows = new Map<string, Thing>([
    ['t-1', { id: 't-1', name: 'Spindle' }],
    ['t-2', { id: 't-2', name: 'Gear wheel' }],
  ]);

  byId(id: string): Thing | undefined {
    return this.#rows.get(id);
  }

  async byIds(ids: readonly string[]): Promise<(Thing | GraphQLError)[]> {
    return ids.map(
      (id) =>
        this.#rows.get(id) ??
        new GraphQLError(`Thing ${id} was not found`, { extensions: { code: 'NOT_FOUND' } }),
    );
  }
}

@Resolver(() => Thing)
export class ThingResolver {
  constructor(@Inject(AlphaThings) private readonly things: AlphaThings) {}

  @Query(() => Thing, { nullable: true })
  alphaThing(@Args('id', { type: () => ID }) id: string): Thing | undefined {
    return this.things.byId(id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: EntityReference,
    @Context() context: SubgraphContext,
  ): Promise<Thing> {
    return loaderFor(context, 'alpha.thing', (ids: readonly string[]) =>
      this.things.byIds(ids),
    ).load(reference.id);
  }
}

@Module({ providers: [AlphaThings, ThingResolver] })
export class AlphaModule {}

export const alpha = defineModule({
  id: 'alpha',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  server: async () => ({ default: AlphaModule }),
});
