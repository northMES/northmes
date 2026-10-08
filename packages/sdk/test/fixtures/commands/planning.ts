// SPDX-License-Identifier: MIT
// Fixture module planning: releases a production order through a command and writes no resolver.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { defineCommandContract } from '@northmes/contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { z } from 'zod';

/** The contract, as the module's MIT contracts package would declare it. */
export const releaseProductionOrder = defineCommandContract({
  name: 'planning.releaseProductionOrder',
  target: 'existing',
  fields: z.object({ note: z.string().trim(), quantity: z.number() }),
});

@ObjectType('ProductionOrder', { registerIn: () => PlanningModule })
export class ProductionOrder {
  @Field(() => ID) id!: string;
  @Field(() => String) status!: string;
}

export const ReleaseProductionOrder = defineCommand(releaseProductionOrder, {
  returns: () => ProductionOrder,
  async handle({ id }) {
    return { id, status: 'released' };
  },
});

@Module({ providers: [ReleaseProductionOrder] })
export class PlanningModule {}
