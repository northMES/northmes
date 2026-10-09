// SPDX-License-Identifier: AGPL-3.0-or-later
import { permissionLine } from '../../permission-names.ts';

/** A role a person holds at a place, as the Remove dialog reads it. */
export interface HeldAssignment {
  readonly id: string;
  readonly scope: { readonly id: string; readonly kind: string; readonly name: string };
  readonly role: { readonly name: string; readonly permissions: readonly string[] } | null;
}

/** What the person loses with a removed role, and what the person's other roles keep (AS7). */
export interface RoleLoss {
  readonly lost: readonly string[];
  readonly kept: readonly string[];
}

/**
 * The person's other assignments that keep a permission where the assignment applies: a role at
 * the company grants at each of its plants, so only the person's other roles at the company keep
 * its permissions at every plant. A role at a plant is kept by the person's other roles at that
 * plant or at the company.
 */
function keepersOf(
  assignment: HeldAssignment,
  assignments: readonly HeldAssignment[],
): HeldAssignment[] {
  const atCompany = assignment.scope.kind === 'COMPANY';
  return assignments
    .filter(({ id }) => id !== assignment.id)
    .filter(
      ({ scope }) => scope.kind === 'COMPANY' || (!atCompany && scope.id === assignment.scope.id),
    );
}

/** "a", "a, and b" or "a, b, and c": permission lines in running text, which may hold an "and". */
function linesOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

/**
 * What removing the assignment takes from the person (design core-304, AS7): the permissions no
 * other role of theirs grants there, and one sentence per role that keeps some, such as "Viewer at
 * Acme AB still lets Sara Nyberg read production orders and the planning board, and read job
 * orders."
 */
export function roleLoss(
  assignment: HeldAssignment,
  assignments: readonly HeldAssignment[],
  personName: string,
): RoleLoss {
  const removed = assignment.role?.permissions ?? [];
  const keepers = keepersOf(assignment, assignments);
  const keptKeys = new Set(keepers.flatMap(({ role }) => role?.permissions ?? []));
  const kept = keepers.flatMap(({ role, scope }) => {
    const keys = removed.filter((key) => role?.permissions.includes(key));
    if (role == null || keys.length === 0) return [];
    const lines = keys.map((key) => {
      const line = permissionLine(key);
      return `${line.charAt(0).toLowerCase()}${line.slice(1)}`;
    });
    return [`${role.name} at ${scope.name} still lets ${personName} ${linesOf(lines)}.`];
  });
  return { lost: removed.filter((key) => !keptKeys.has(key)), kept };
}
