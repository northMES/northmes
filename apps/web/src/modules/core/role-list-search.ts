// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

/**
 * The view of the roles list that lives in the URL (design core-304, RO1 and NO11): the search in
 * q, Defined by in definedBy (custom for the company's own roles, or a module id), and the sort on
 * Role, by name ascending unless sort says -name. Defaults stay out.
 */
export interface RoleListSearch {
  readonly q?: string;
  readonly definedBy?: string;
  readonly sort?: '-name';
}

const searchKeys = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().min(1).max(100))
    .optional()
    .catch(undefined),
  // custom, or a module id by the SDK's rule (MODULE_ID in packages/sdk/src/module-names.ts, which
  // the SDK does not export): kebab-case, such as quality-control.
  definedBy: z
    .string()
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
    .optional()
    .catch(undefined),
  sort: z.literal('-name').optional().catch(undefined),
});

/** The view that a URL's search describes, for the route's validateSearch; a bad key falls back. */
export function roleListSearch(raw: Record<string, unknown>): RoleListSearch {
  const { q, definedBy, sort } = searchKeys.parse(raw);
  return {
    ...(q !== undefined && { q }),
    ...(definedBy !== undefined && { definedBy }),
    ...(sort !== undefined && { sort }),
  };
}

/** What a role of the list reads to be searched, filtered and sorted. */
interface ListedRole {
  readonly name: string;
  readonly origin: 'CUSTOM' | 'MODULE';
  readonly moduleId?: string | null;
}

/** The Defined by value of a role: custom for the company's own roles, else its module's id. */
export function definedByOf(role: ListedRole): string {
  return role.moduleId == null ? 'custom' : role.moduleId;
}

/**
 * The roles the view shows, in its order: those whose name holds the search, ignoring case, and
 * that the Defined by filter keeps, by name in the sort's direction.
 */
export function rolesOfView<TRole extends ListedRole>(
  roles: readonly TRole[],
  view: RoleListSearch,
): TRole[] {
  const text = view.q?.toLocaleLowerCase();
  const shown = roles.filter(
    (role) =>
      (text === undefined || role.name.toLocaleLowerCase().includes(text)) &&
      (view.definedBy === undefined || definedByOf(role) === view.definedBy),
  );
  const direction = view.sort === '-name' ? -1 : 1;
  return shown.sort((a, b) => direction * a.name.localeCompare(b.name));
}
