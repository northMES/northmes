// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { ScopedDatabase } from '@northmes/sdk/data';
import { defineList } from '@northmes/sdk/lists';
import { describe, expect, it, vi } from 'vitest';

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

describe('defineList', () => {
  it('E06-S02 an orderBy of more than three entries is refused with core.list.bad_argument before any query', async () => {
    const transaction = vi.fn();
    const db = { transaction } as unknown as ScopedDatabase<unknown>;

    const page = toolList.page(db, () => ({}) as never, {
      orderBy: [{ field: 'GROUP' }, { field: 'SIZE' }, { field: 'NAME' }, { field: 'CODE' }],
    });

    await expect(page).rejects.toMatchObject({
      code: 'core.list.bad_argument',
      kind: 'validation',
      message: 'orderBy takes at most 3 entries',
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
