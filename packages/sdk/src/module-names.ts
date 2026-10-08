// SPDX-License-Identifier: MIT
export interface ModuleNames {
  readonly id: string;
  readonly gql: string;
  readonly sql: string;
  readonly ownerRole: string;
}

export function moduleNames(id: string): ModuleNames {
  const gql = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const sql = id.replaceAll('-', '_');
  return { id, gql, sql, ownerRole: `nm_mod_${sql}` };
}
