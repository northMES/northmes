// SPDX-License-Identifier: AGPL-3.0-or-later
import { moduleName } from './permission-names.ts';

/** The key of core's Company admin role in every company (core's permissions.ts). */
const companyAdminKey = 'core-company-admin';

/** What the role kind reads of a role. */
interface RoleOfKind {
  readonly key: string;
  readonly origin: 'CUSTOM' | 'MODULE';
  readonly moduleId?: string | null;
}

/**
 * Whether the role is core's Company admin, which always holds every installed permission and
 * which New role does not start from while question 34 of design core-304 is open.
 */
export function isCompanyAdmin(role: RoleOfKind): boolean {
  return role.origin === 'MODULE' && role.key === companyAdminKey;
}

/** The kind of a role as the role picker says it: "Custom role" or "Planning, default role". */
export function roleKind(role: Pick<RoleOfKind, 'moduleId'>): string {
  return role.moduleId == null ? 'Custom role' : `${moduleName(role.moduleId)}, default role`;
}
