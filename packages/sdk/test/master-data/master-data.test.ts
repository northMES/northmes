// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import 'reflect-metadata';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { defineMasterData } from '@northmes/contracts';
import { defineList } from '@northmes/sdk/lists';
import {
  type MasterDataAccess,
  masterDataApi,
  masterDataService,
} from '@northmes/sdk/master-data';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/** A register of the fixture module tools at plant scope, whose list filters by isOpen. */
const clamps = defineMasterData({
  module: 'tools',
  entity: 'Clamp',
  resource: 'clamps',
  label: 'clamp',
  permission: 'tools.clamp',
  scopes: ['plant'],
  fields: z.object({ isOpen: z.boolean().optional() }),
  output: { isOpen: z.boolean() },
  filters: { isOpen: z.boolean() },
});

@ObjectType('Clamp')
class Clamp {
  @Field(() => ID) id!: string;
}

const clampList = defineList(clamps.list, { node: () => Clamp });

/** An access port the factories only hold; these tests read nothing. */
const access = {} as MasterDataAccess<{ companyId: string; plantId: string | undefined }>;

const options = {
  table: 'tools.clamp',
  list: clampList,
  access,
  columns: { isOpen: 'is_open' },
  write: { create: () => ({}), update: () => ({}) },
};

describe('the master-data kit', () => {
  it('#965 a register whose list declares filter fields and that gives no filter hook throws', () => {
    expect(() => masterDataService(clamps, options)).toThrow(
      'Register tools.Clamp: its list declares filter fields, so it needs a filter',
    );
  });

  it('#965 the api of a register whose list declares filter fields and that gives no args throws', () => {
    const kit = masterDataService(clamps, { ...options, filter: (query) => query });

    expect(() => masterDataApi(kit, { type: () => Clamp, list: clampList })).toThrow(
      'Register tools.Clamp: its list declares filter fields, so its list field needs args',
    );
  });
});
