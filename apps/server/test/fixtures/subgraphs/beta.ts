// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module beta: owns Crate, whose thing field references alpha's Thing by key.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { defineModule } from '@northmes/sdk';
import { graphqlKit } from '@northmes/sdk/graphql';

const gql = graphqlKit(() => BetaModule);

/** Alpha's Thing, referenced by name and key only. */
export const ThingRef = gql.entityRef('Thing');

@ObjectType('Crate', { registerIn: () => BetaModule })
export class Crate {
  @Field(() => ID) id!: string;
  @Field(() => String) label!: string;
  thingId!: string;
}

@Resolver(() => Crate)
export class CrateResolver {
  @Query(() => [Crate])
  betaCrates(): Crate[] {
    return [
      { id: 'c-1', label: 'Crate one', thingId: 't-1' },
      { id: 'c-2', label: 'Crate two', thingId: 't-2' },
    ];
  }

  @ResolveField(() => ThingRef, { nullable: true })
  thing(@Parent() crate: Crate): { __typename: 'Thing'; id: string } {
    return { __typename: 'Thing', id: crate.thingId };
  }
}

@Module({ providers: [CrateResolver] })
export class BetaModule {}

export const beta = defineModule({
  id: 'beta',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['alpha'],
  server: async () => ({ default: BetaModule }),
});
