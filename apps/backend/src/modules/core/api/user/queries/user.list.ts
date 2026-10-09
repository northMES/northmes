// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineList } from '@northmes/sdk/lists';
import { User } from '../types/user.type.ts';

/** The list of a company's users: coreUsers, by name unless orderBy says otherwise (ADR 0016). */
export const userList = defineList({
  name: 'User',
  node: () => User,
  sortFields: {
    NAME: { column: 'name', type: 'text' },
    USERNAME: { column: 'username', type: 'text' },
  },
  defaultOrderBy: [{ field: 'NAME' }],
  search: ['name', 'username'],
});

/** The arguments of coreUsers. */
export type UserListArgs = Parameters<typeof userList.page>[2];
