// SPDX-License-Identifier: MIT
// Fixture module production-start: owns ProductionOrder.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';

@ObjectType('ProductionOrder', { registerIn: () => ProductionStartModule })
export class ProductionOrder {
  @Field(() => ID) id!: string;
  @Field(() => String) number!: string;
}

@Resolver(() => ProductionOrder)
export class ProductionOrderResolver {
  @Query(() => [ProductionOrder])
  productionStartOrders(): ProductionOrder[] {
    return [{ id: 'po-1', number: '7001' }];
  }
}

@Module({ providers: [ProductionOrderResolver] })
export class ProductionStartModule {}
