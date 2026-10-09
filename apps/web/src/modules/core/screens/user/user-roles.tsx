// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { Lock, Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { missingPermissionsOf, permissionList } from '../../access-refusal.ts';
import { permissionPhrase } from '../../no-access.tsx';
import { permissionLine } from '../../permission-names.ts';
import type { Places } from '../../use-places.ts';
import type { User, UserAssignment } from '../../use-user.tsx';
import type { Viewer } from '../../use-viewer.ts';
import { CoreRemoveRoleAssignment } from './remove-role-assignment.graphql.ts';

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

/** The place in running text: "Acme AB" or "Plant A". */
function placeOf({ scope }: UserAssignment): string {
  return scope.name;
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

/** The permissions the user loses with the assignment: those no other role of theirs grants. */
function lostWith(assignment: UserAssignment, user: User): string[] {
  const kept = new Set(
    user.roleAssignments
      .filter(({ id }) => id !== assignment.id)
      .flatMap(({ role }) => role?.permissions ?? []),
  );
  return (assignment.role?.permissions ?? []).filter((key) => !kept.has(key));
}

/** The message of a refused removal: the grant rule's, or the API's own, or the connection. */
function removalFailure(error: unknown, assignment: UserAssignment): Error {
  const missing = missingPermissionsOf(error);
  if (missing !== undefined) {
    return new Error(
      `You cannot remove ${assignment.role?.name ?? 'this role'} at ${placeOf(assignment)}. It includes permissions you do not hold there: ${permissionList(missing)}.`,
    );
  }
  return new Error(
    `Could not remove the role. ${error instanceof Error ? error.message : 'Check the connection, then try again.'}`,
  );
}

interface RemoveRoleProps {
  readonly user: User;
  readonly assignment: UserAssignment;
  /** Where focus goes after the removal: the next row's role, else Add role (NO24, proposed). */
  readonly focusAfter: () => HTMLElement | null;
}

/**
 * Remove on a role of the user (design core-304, AS7 and NO24): an alert dialog that names what
 * the user loses, with an optional reason that has focus. Escape or Cancel go back to Remove.
 */
function RemoveRole({ user, assignment, focusAfter }: RemoveRoleProps) {
  const [reason, setReason] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const [remove] = useMutation(CoreRemoveRoleAssignment, {
    update(cache) {
      cache.modify({
        id: cache.identify({ __typename: 'User', id: user.id }),
        fields: {
          roleAssignments: (refs: readonly { __ref: string }[], { readField }) =>
            refs.filter((ref) => readField('id', ref) !== assignment.id),
          // What the user can do is computed from the roles, so it is read again.
          effectivePermissions: (_value, { DELETE }) => DELETE,
        },
      });
    },
  });
  const role = assignment.role?.name;
  const place = placeOf(assignment);
  const lost = lostWith(assignment, user);
  const label = role === undefined ? `Remove role at ${place}` : `Remove ${role} at ${place}`;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" aria-label={label}>
          Remove
        </Button>
      }
      title={
        role === undefined
          ? `Remove a role at ${place} from ${user.name}?`
          : `Remove ${role} at ${place} from ${user.name}?`
      }
      description={
        lost.length === 0
          ? `${user.name} keeps every permission through other roles.`
          : `From the next action, ${user.name} loses these permissions at ${place}:`
      }
      confirmLabel="Remove role"
      destructive
      initialFocus={field}
      onOpenChange={(open) => {
        if (open) setReason('');
      }}
      focusAfterConfirm={focusAfter}
      onConfirm={async () => {
        try {
          await remove({
            variables: {
              input: {
                id: assignment.id,
                ...(reason.trim() !== '' && { reason: reason.trim() }),
              },
            },
          });
        } catch (error) {
          throw removalFailure(error, assignment);
        }
        announce(
          `${role ?? 'The role'} at ${place} removed from ${user.name}. It applies from ${user.name}'s next action.`,
        );
      }}
    >
      {lost.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {lost.map((key) => (
            <li key={key}>
              {permissionLine(key)} <span className="font-mono text-xs">({key})</span>
            </li>
          ))}
        </ul>
      )}
      <TextareaField
        ref={field}
        label="Reason"
        optional
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
}

/** The id of a role link in the table, which takes focus after the row above it was removed. */
function roleLinkId(assignment: UserAssignment): string {
  return `user-role-${assignment.id}`;
}

/** The id of Add role, which takes focus after the last row was removed. */
const addRoleId = 'user-add-role';

/**
 * The Roles card of the Access tab (design core-304, AS1, AS11, AS21 and NO5): the user's roles at
 * the company and at the plant, the company's first, each with Remove for a reader who may remove
 * it, or the line that names who can. Add role leads to the Add role page. A reader without
 * core.role:read sees No access in each Role cell, and Remove is named by the place only.
 */
export function UserRoles({ user, viewer, places, rolesForbidden }: UserRolesProps) {
  const { plant } = useShell();
  const headingId = useId();
  const plantName = places.plant?.name ?? plant;
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
            {user.name}'s roles that apply at {plantName}.
          </p>
        </div>
        {canAdd && (
          <Link
            id={addRoleId}
            to={coreLinks.users.user.addRole({ plant, userId: user.id }).href}
            className={buttonVariants({ variant: 'outline' })}
          >
            <Plus aria-hidden />
            Add role
          </Link>
        )}
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm">
          {user.name} holds no role at {plantName} or at {companyName}.
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
                          . Roles need {permissionPhrase('core.role:read')} at {plantName}.
                        </span>
                      </span>
                    ) : (
                      <Link
                        id={roleLinkId(assignment)}
                        to={coreLinks.roles.role({ plant, roleId: assignment.role.id }).href}
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
                        user={user}
                        assignment={assignment}
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
