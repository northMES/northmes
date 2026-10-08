// SPDX-License-Identifier: MIT
export interface ModuleNames {
  readonly id: string;
  readonly gql: string;
  readonly sql: string;
}

export function moduleNames(id: string): ModuleNames {
  const gql = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  return { id, gql, sql: id.replaceAll('-', '_') };
}
