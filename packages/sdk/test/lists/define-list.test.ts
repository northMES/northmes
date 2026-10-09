// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { HttpStatus, Module } from '@nestjs/common';
import { Args, Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import type { ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import { defineList, type ListArgs } from '@northmes/sdk/lists';
import { type GraphQLArgument, getNullableType } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import { buildSchema } from '../fixtures/graphql/schema.ts';

@ObjectType('Tool')
class Tool {
  @Field(() => ID) id!: string;
}

const toolList = defineList({
  name: 'Tool',
  node: () => Tool,
  sortFields: {
    CODE: { column: 'code', type: 'text' },
    NAME: { column: 'name', type: 'text' },
    GROUP: { column: 'group_code', type: 'text' },
    SIZE: { column: 'size', type: 'integer' },
  },
  defaultOrderBy: [{ field: 'CODE' }],
  search: ['code'],
});

@ObjectType('Gauge')
class Gauge {
  @Field(() => ID) id!: string;
}

/** A list whose rows are archived through archived_at. */
const gaugeList = defineList({
  name: 'Gauge',
  node: () => Gauge,
  sortFields: { CODE: { column: 'code', type: 'text' } },
  defaultOrderBy: [{ field: 'CODE' }],
  search: ['code'],
  archivable: true,
});

/** The root fields tools and gauges, which only take their list's arguments. */
@Resolver()
class ListsResolver {
  @Query(() => toolList.Connection)
  tools(@Args({ type: () => toolList.Args }) _args: ListArgs<'CODE'>): never {
    throw new Error('the test reads only the schema');
  }

  @Query(() => gaugeList.Connection)
  gauges(@Args({ type: () => gaugeList.Args }) _args: ListArgs<'CODE'>): never {
    throw new Error('the test reads only the schema');
  }
}

@Module({
  providers: [ListsResolver, toolList.ConnectionResolver, gaugeList.ConnectionResolver],
})
class ListsModule {}

/** The arguments of each root field of the lists' schema, by field name. */
async function rootFieldArgs(): Promise<Record<string, readonly GraphQLArgument[]>> {
  const { schema, moduleRef } = await buildSchema([ListsModule]);
  await moduleRef.close();
  const fields = schema.getQueryType()?.getFields() ?? {};
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.args]));
}

describe('defineList', () => {
  it('E06-S06 an archivable list takes includeArchived, a Boolean that is false by default, and any other list does not', async () => {
    const args = await rootFieldArgs();

    const includeArchived = args.gauges?.find(({ name }) => name === 'includeArchived');
    expect(String(getNullableType(includeArchived?.type))).toBe('Boolean');
    expect(includeArchived?.defaultValue).toBe(false);
    expect(args.tools?.map(({ name }) => name)).not.toContain('includeArchived');
  });

  it('E06-S02 an orderBy of more than three entries is refused with core.list.bad_argument before any query', async () => {
    const transaction = vi.fn();
    const db = { transaction } as unknown as ScopedDatabase<unknown>;

    const page = toolList.page(db, () => ({}) as never, {
      orderBy: [{ field: 'GROUP' }, { field: 'SIZE' }, { field: 'NAME' }, { field: 'CODE' }],
    });

    const error = await page.catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: 'core.list.bad_argument',
      message: 'orderBy takes at most 3 entries',
    });
    expect((error as DomainError).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(transaction).not.toHaveBeenCalled();
  });
});
