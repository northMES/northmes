// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module stock, whose commands the host refuses at boot (ADR 0012): the contract of
// stock.countBin names no permission, as a plugin in plain JavaScript could ship it, and
// stock.moveBin checks a permission that stock does not declare.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { type CommandContract, defineCommandContract } from '@northmes/contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { z } from 'zod';
import type { InRepoModule } from '../../../src/modules.ts';

@ObjectType('Bin', { registerIn: () => StockModule })
export class Bin {
  @Field(() => ID) id!: string;
}

/** The module's own reads, which give the schema a Query root. */
@Resolver(() => Bin)
export class BinResolver {
  @Query(() => [Bin])
  stockBins(): Bin[] {
    return [];
  }
}

const countBinContract = defineCommandContract({
  name: 'stock.countBin',
  target: 'none',
  fields: z.object({ bin: z.string() }),
  permission: 'stock.bin:count',
});

/** stock.countBin's contract without its permission. */
const { permission: _dropped, ...countBin } = countBinContract;

export const CountBin = defineCommand(countBin as unknown as CommandContract, {
  returns: () => Bin,
  async handle() {
    return { id: 'bin' };
  },
});

const moveBin = defineCommandContract({
  name: 'stock.moveBin',
  target: 'none',
  fields: z.object({ bin: z.string() }),
  permission: 'stock.bin:move',
});

export const MoveBin = defineCommand(moveBin, {
  returns: () => Bin,
  async handle() {
    return { id: 'bin' };
  },
});

@Module({ providers: [BinResolver, CountBin, MoveBin] })
export class StockModule {}

export const stock: InRepoModule = {
  id: 'stock',
  module: StockModule,
  permissions: { 'stock.bin': ['count'] },
};
