// SPDX-License-Identifier: MIT
export interface ModuleNames {
  readonly id: string;
  /** GraphQL name: root field prefix, permission and command prefix. */
  readonly gql: string;
  /** Postgres schema and role suffix. */
  readonly sql: string;
  /** Postgres role that owns the module's schema: `nm_mod_<sql>`. */
  readonly ownerRole: string;
}

/** kebab-case: starts with a letter, then lower-case segments joined by single hyphens. */
export const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Postgres truncates identifiers longer than 63 bytes (NAMEDATALEN 64), so two long ids could
 * share an owner role. The owner role is the longest Postgres identifier derived from an id.
 */
const MAX_IDENTIFIER_BYTES = 63;
const OWNER_ROLE_PREFIX = 'nm_mod_';
/** The longest id whose owner role fits: 63 - 7 = 56 characters. */
const MAX_ID_LENGTH = MAX_IDENTIFIER_BYTES - OWNER_ROLE_PREFIX.length;

export function moduleNames(id: string): ModuleNames {
  if (!MODULE_ID.test(id)) {
    throw new Error(`Invalid module id "${id}": use kebab-case [a-z][a-z0-9]*(-[a-z0-9]+)*`);
  }
  const gql = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const sql = id.replaceAll('-', '_');
  const ownerRole = `${OWNER_ROLE_PREFIX}${sql}`;
  // MODULE_ID admits ASCII only, so the length in characters is the length in bytes.
  if (ownerRole.length > MAX_IDENTIFIER_BYTES) {
    throw new Error(
      `Invalid module id "${id}": its owner role ${ownerRole} is ${ownerRole.length} bytes, and Postgres identifiers hold at most ${MAX_IDENTIFIER_BYTES} bytes; use an id of at most ${MAX_ID_LENGTH} characters`,
    );
  }
  return { id, gql, sql, ownerRole };
}
