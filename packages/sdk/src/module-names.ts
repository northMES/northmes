// SPDX-License-Identifier: MIT
export interface ModuleNames {
  readonly id: string;
  readonly gql: string;
  readonly sql: string;
  readonly ownerRole: string;
  readonly remote: string;
}

export const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function moduleNames(id: string): ModuleNames {
  if (!MODULE_ID.test(id)) {
    throw new Error(`Invalid module id "${id}": use kebab-case [a-z][a-z0-9]*(-[a-z0-9]+)*`);
  }
  const gql = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const sql = id.replaceAll('-', '_');
  return { id, gql, sql, ownerRole: `nm_mod_${sql}`, remote: gql };
}
