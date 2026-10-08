// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module zeta: adds the non-null field zetaWeight to alpha's Thing, which
// NORTHMES_CONTRIBUTED_FIELD_NULLABLE refuses.
import { Module } from '@nestjs/common';
import { Int, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { defineModule } from '@northmes/sdk';
import { type EntityReference, graphqlKit } from '@northmes/sdk/graphql';

const gql = graphqlKit(() => ZetaModule);

/** Alpha's Thing, referenced by name and key only. */
export const ThingRef = gql.entityRef('Thing');

@Resolver(() => ThingRef)
export class ZetaThingResolver {
  @ResolveField(() => Int)
  zetaWeight(@Parent() thing: EntityReference): number {
    return thing.id.length;
  }
}

@Resolver()
export class ZetaResolver {
  @Query(() => Int)
  zetaThingCount(): number {
    return 0;
  }
}

@Module({ providers: [ZetaThingResolver, ZetaResolver] })
export class ZetaModule {}

export const zeta = defineModule({
  id: 'zeta',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['alpha'],
  server: async () => ({ default: ZetaModule }),
});
