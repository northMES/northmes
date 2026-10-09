// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Generated, GeneratedAlways } from 'kysely';

/** core.article, as its migrations shape it: an article of a company (ADR 0073). */
export interface ArticleTable {
  id: Generated<string>;
  /** The company's node, where every article of the company sits. */
  scope_id: string;
  version: Generated<number>;
  code: string;
  name: string;
  /** lower(code), which the unique index of the code within the company holds. */
  code_key: GeneratedAlways<string>;
  /** The article's company, the same as scope_id. */
  company_id: string;
  /** The company's span, an int8range as Postgres writes it (ADR 0009). */
  scope_span: string;
  /** Assigned to every plant of the company, those created later included. */
  all_plants: Generated<boolean>;
  /** The one plant the article is assigned to, or the company otherwise: where it is changed. */
  edit_scope_id: string;
  /** When the article was archived, or null while it is active (ADR 0006). */
  archived_at: Date | null;
  /** When the article last changed, its creation included; an update trigger moves it on. */
  updated_at: Generated<Date>;
}

/** core.article_plant: a plant an article is assigned to (ADR 0073). */
export interface ArticlePlantTable {
  article_id: string;
  plant_id: string;
  /** The article's scope_id, the company. */
  scope_id: string;
  /** The article's edit_scope_id. */
  edit_scope_id: string;
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

/** core.company: a company, the Better Auth organization at a company node (ADR 0007). */
export interface CompanyTable {
  /** The id of the company's node in core.scope. */
  id: string;
  organization_id: string;
  name: string;
  kind: Generated<'company'>;
}

/** core.plant: a plant at a plant node, with the slug that names it in URLs (ADR 0007). */
export interface PlantTable {
  /** The id of the plant's node in core.scope. */
  id: string;
  company_id: string;
  slug: string;
  name: string;
  kind: Generated<'plant'>;
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
  /** Grows by one with every change to the role. */
  version: Generated<number>;
}

/** core.default_role: a module's default role, which northmes migrate writes (ADR 0010). */
export interface DefaultRoleTable {
  key: string;
  module_id: string;
  name: string;
  permissions: string[];
  installed: Generated<boolean>;
}

/** core.user_directory: the columns of auth.user that nm_app reads (ADR 0010). */
export interface UserDirectoryView {
  id: string;
  name: string;
  /** '' for a user without a username. */
  username: string;
  banned: boolean;
}

/** core.company_user: the users of a company, its organization's members and its role holders. */
export interface CompanyUserView {
  company_id: string;
  user_id: string;
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
  'core.article_plant': ArticlePlantTable;
  'core.scope': ScopeTable;
  'core.company': CompanyTable;
  'core.plant': PlantTable;
  'core.permission': PermissionTable;
  'core.role': RoleTable;
  'core.role_assignment': RoleAssignmentTable;
  'core.default_role': DefaultRoleTable;
  'core.user_directory': UserDirectoryView;
  'core.company_user': CompanyUserView;
}
