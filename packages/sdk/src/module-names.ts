// SPDX-License-Identifier: MIT
export interface ModuleNames {
  readonly id: string;
  /** GraphQL subgraph name, root field prefix, permission and command prefix. */
  readonly gql: string;
  /** Postgres schema and role suffix. */
  readonly sql: string;
  /** Postgres role that owns the module's schema: `nm_mod_<sql>`. */
  readonly ownerRole: string;
  /** Module Federation remote name (no hyphens allowed). */
  readonly remote: string;
}

/** kebab-case: starts with a letter, then lower-case segments joined by single hyphens. */
export const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function moduleNames(id: string): ModuleNames {
  if (!MODULE_ID.test(id)) {
    throw new Error(`Invalid module id "${id}": use kebab-case [a-z][a-z0-9]*(-[a-z0-9]+)*`);
  }
  const gql = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const sql = id.replaceAll('-', '_');
  return { id, gql, sql, ownerRole: `nm_mod_${sql}`, remote: gql };
}
