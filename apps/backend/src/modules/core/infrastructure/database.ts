// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Generated, GeneratedAlways } from 'kysely';

/** core.article, as its migration creates it. */
export interface ArticleTable {
  id: Generated<string>;
  scope_id: string;
  version: Generated<number>;
  code: string;
  name: string;
  /** lower(code), which the unique index of the code per scope holds. */
  code_key: GeneratedAlways<string>;
  /** When the article was archived, or null while it is active (ADR 0006). */
  archived_at: Date | null;
}

/** core.scope: one node of a company's scope tree (ADR 0007). */
export interface ScopeTable {
  id: Generated<string>;
  company_id: string;
  parent_id: string | null;
  kind: 'company' | 'plant';
  /** An int8range, as Postgres writes it, such as [4294967296,8589934592). */
  span: string;
}

/** core.permission: the permission catalog that northmes migrate writes (ADR 0010). */
export interface PermissionTable {
  key: string;
  module_id: string;
  installed: Generated<boolean>;
}

/** core.role: a company's role and the permission keys it holds (ADR 0010). */
export interface RoleTable {
  id: Generated<string>;
  company_id: string;
  key: string;
  name: string;
  permissions: Generated<string[]>;
  origin: 'module' | 'custom';
  module_id: string | null;
}

/** core.role_assignment: a user's role at a scope node (ADR 0010). */
export interface RoleAssignmentTable {
  id: Generated<string>;
  user_id: string;
  /** The company of both the scope node and the role. */
  company_id: string;
  scope_id: string;
  role_id: string;
}

/**
 * The Kysely table types of the core module, by schema-qualified name. They are written by hand
 * until generated types arrive (ADR 0006), so they change with every core migration.
 */
export interface CoreDatabase {
  'core.article': ArticleTable;
  'core.scope': ScopeTable;
  'core.permission': PermissionTable;
  'core.role': RoleTable;
  'core.role_assignment': RoleAssignmentTable;
}
