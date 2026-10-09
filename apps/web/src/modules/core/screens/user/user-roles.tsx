// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { Link } from '@tanstack/react-router';
import { Lock, Plus } from 'lucide-react';
import { useId } from 'react';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { RemoveRole } from '../../components/remove-role/index.ts';
import { permissionPhrase } from '../../no-access.tsx';
import { permissionLine } from '../../permission-names.ts';
import { type Places, useCompanyId } from '../../use-places.ts';
import type { User, UserAssignment } from '../../use-user.tsx';
import type { Viewer } from '../../use-viewer.ts';

interface UserRolesProps {
  readonly user: User;
  readonly viewer: Viewer;
  readonly places: Places;
  /** The API refused the roles, because the reader may not read roles (NO5). */
  readonly rolesForbidden: boolean;
}

/** The place of an assignment as the Where column says it: "Acme AB, all plants" or "Plant A". */
function whereOf({ scope }: UserAssignment, places: Places): string {
  return scope.kind === 'COMPANY'
    ? `${places.company?.name ?? scope.name}, all plants`
    : scope.name;
}

/**
 * Whether the reader may remove the assignment, as the API checks it (ADR 0010): the assignment
 * permission at its place, and every permission of its role there. A role the reader may not read
 * leaves the check to the API.
 */
function canRemove(assignment: UserAssignment, viewer: Viewer): boolean {
  const holds = assignment.scope.kind === 'COMPANY' ? viewer.canAtCompany : viewer.can;
  if (!holds('core.roleAssignment:manage')) return false;
  return assignment.role?.permissions.every(holds) ?? true;
}

/**
 * The user's other assignments that keep a permission where the assignment applies: a role at the
 * company grants at each of its plants, so only the user's other roles at the company keep its
 * permissions at every plant. A role at a plant is kept by the user's other roles at that plant or
 * at the company.
 */
function keepersOf(assignment: UserAssignment, user: User): UserAssignment[] {
  const atCompany = assignment.scope.kind === 'COMPANY';
  return user.roleAssignments
    .filter(({ id }) => id !== assignment.id)
    .filter(
      ({ scope }) => scope.kind === 'COMPANY' || (!atCompany && scope.id === assignment.scope.id),
    );
}

/** The permissions the user loses with the assignment: those no keeper grants. */
function lostWith(assignment: UserAssignment, user: User): string[] {
  const kept = new Set(keepersOf(assignment, user).flatMap(({ role }) => role?.permissions ?? []));
  return (assignment.role?.permissions ?? []).filter((key) => !kept.has(key));
}

/** "a", "a, and b" or "a, b, and c": permission lines in running text, which may hold an "and". */
function linesOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

/**
 * What each keeper still lets the user do of the removed role's permissions (AS7): "Viewer at Acme
 * AB still lets Sara Nyberg read production orders and the planning board, and read job orders."
 */
function keptSentences(assignment: UserAssignment, user: User): string[] {
  const removed = assignment.role?.permissions ?? [];
  return keepersOf(assignment, user).flatMap(({ role, scope }) => {
    const kept = removed.filter((key) => role?.permissions.includes(key));
    if (role == null || kept.length === 0) return [];
    const lines = kept.map((key) => {
      const line = permissionLine(key);
      return `${line.charAt(0).toLowerCase()}${line.slice(1)}`;
    });
    return [`${role.name} at ${scope.name} still lets ${user.name} ${linesOf(lines)}.`];
  });
}

/** The id of a role link in the table, which takes focus after the row above it was removed. */
function roleLinkId(assignment: UserAssignment): string {
  return `user-role-${assignment.id}`;
}

/** The id of Add role, which takes focus after the last row was removed. */
const addRoleId = 'user-add-role';

/**
 * The Roles card of the Access tab in company settings (design core-304, AS1, AS11, AS21 and NO5,
 * ADR 0066): the user's roles at the company and at each of its plants, the company's first, each
 * with Remove for a reader who may remove it, or the line that names who can. Add role leads to
 * the Add role page. A reader without core.role:read sees No access in each Role cell, and Remove
 * is named by the place only.
 */
export function UserRoles({ user, viewer, places, rolesForbidden }: UserRolesProps) {
  const companyId = useCompanyId() ?? '';
  const headingId = useId();
  const companyName = places.company?.name ?? 'the company';
  const canAdd =
    viewer.can('core.roleAssignment:manage') && viewer.can('core.role:read') && !rolesForbidden;
  const assignments = user.roleAssignments;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-base font-semibold">
            Roles
          </h2>
          <p className="text-sm text-muted-foreground">
            {user.name}'s roles at {companyName} and its plants.
          </p>
        </div>
        {canAdd && (
          <Link
            id={addRoleId}
            to={coreLinks.settings.users.user.addRole({ companyId, userId: user.id }).href}
            className={buttonVariants({ variant: 'outline' })}
          >
            <Plus aria-hidden />
            Add role
          </Link>
        )}
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm">
          {user.name} holds no role at {companyName} or its plants.
        </p>
      ) : (
        <Table>
          <TableCaption className="sr-only">Roles of {user.name}</TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Role</TableHead>
              <TableHead scope="col">Where</TableHead>
              <TableHead scope="col">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment, index) => {
              const next = assignments[index + 1];
              return (
                <TableRow key={assignment.id}>
                  <TableCell>
                    {assignment.role === null ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Lock aria-hidden className="size-3.5" />
                        No access
                        <span className="sr-only">
                          . Roles need {permissionPhrase('core.role:read')} at {companyName}.
                        </span>
                      </span>
                    ) : (
                      <Link
                        id={roleLinkId(assignment)}
                        to={
                          coreLinks.settings.roles.role({ companyId, roleId: assignment.role.id })
                            .href
                        }
                        className="text-link underline underline-offset-2 hover:no-underline"
                      >
                        {assignment.role.name}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>{whereOf(assignment, places)}</TableCell>
                  <TableCell className="text-right">
                    {canRemove(assignment, viewer) ? (
                      <RemoveRole
                        person={user}
                        assignment={assignment}
                        lost={lostWith(assignment, user)}
                        kept={keptSentences(assignment, user)}
                        focusAfter={() =>
                          (next === undefined ? null : document.getElementById(roleLinkId(next))) ??
                          document.getElementById(addRoleId) ??
                          document.querySelector<HTMLElement>('h1')
                        }
                      />
                    ) : assignment.scope.kind === 'COMPANY' ? (
                      <span className="text-sm text-muted-foreground">
                        A company admin of {companyName} can remove it.
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
