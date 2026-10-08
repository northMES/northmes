// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture modules delta and epsilon: each defines the value type Dimensions. Both mark it
// @shareable, so composition accepts it and only NORTHMES_TYPE_OWNERSHIP refuses it.
import { Module } from '@nestjs/common';
import { Directive, Field, Int, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { defineModule } from '@northmes/sdk';

@ObjectType('Dimensions', { registerIn: () => DeltaModule })
@Directive('@shareable')
export class DeltaDimensions {
  @Field(() => Int) width!: number;
}

@Resolver()
export class DeltaResolver {
  @Query(() => DeltaDimensions)
  deltaDimensions(): DeltaDimensions {
    return { width: 40 };
  }
}

@Module({ providers: [DeltaResolver] })
export class DeltaModule {}

export const delta = defineModule({
  id: 'delta',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  server: async () => ({ default: DeltaModule }),
});

@ObjectType('Dimensions', { registerIn: () => EpsilonModule })
@Directive('@shareable')
export class EpsilonDimensions {
  @Field(() => Int) width!: number;
}

@Resolver()
export class EpsilonResolver {
  @Query(() => EpsilonDimensions)
  epsilonDimensions(): EpsilonDimensions {
    return { width: 60 };
  }
}

@Module({ providers: [EpsilonResolver] })
export class EpsilonModule {}

export const epsilon = defineModule({
  id: 'epsilon',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  server: async () => ({ default: EpsilonModule }),
});
