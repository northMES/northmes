// SPDX-License-Identifier: MIT
// Fixture module planning: lists production orders and releases one through a command, for which
// it writes no resolver.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { defineCommandContract } from '@northmes/contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { z } from 'zod';

/** The contract, as the module's MIT contracts package would declare it. */
export const releaseProductionOrder = defineCommandContract({
  name: 'planning.releaseProductionOrder',
  target: 'existing',
  fields: z.object({ note: z.string().trim(), quantity: z.number() }),
});

@ObjectType('ProductionOrder')
export class ProductionOrder {
  @Field(() => ID) id!: string;
  @Field(() => String) status!: string;
}

/** A schema needs a Query root, which the module's own reads give it. */
@Resolver(() => ProductionOrder)
export class ProductionOrderResolver {
  @Query(() => [ProductionOrder])
  planningProductionOrders(): ProductionOrder[] {
    return [];
  }
}

export const ReleaseProductionOrder = defineCommand(releaseProductionOrder, {
  returns: () => ProductionOrder,
  // The fixture reads no table: every order it is asked for exists at version 1.
  target: { entity: 'Production order', load: async (id) => ({ id, version: 1 }) },
  async handle({ id }) {
    return { id, status: 'released' };
  },
});

@Module({ providers: [ProductionOrderResolver, ReleaseProductionOrder] })
export class PlanningModule {}
