// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { missingPermissionsOf, permissionList } from '../../access-refusal.ts';
import { permissionLine } from '../../permission-names.ts';
import { removeHolder } from '../../role-cache.ts';
import { CoreRemoveRoleAssignment } from './remove-role-assignment.graphql.ts';

/** The person who holds the role. */
export interface RemovePerson {
  readonly id: string;
  readonly name: string;
}

/** The assignment Remove takes away: its role, null when the reader may not read roles, and place. */
export interface RemoveAssignment {
  readonly id: string;
  readonly scope: { readonly name: string };
  readonly role: { readonly id: string; readonly name: string } | null;
}

export interface RemoveRoleProps {
  readonly person: RemovePerson;
  readonly assignment: RemoveAssignment;
  /**
   * The permissions the person loses there with it, which the dialog lists, or undefined when the
   * page does not know the person's other roles, and the dialog names none.
   */
  readonly lost?: readonly string[];
  /** The button's accessible name; "Remove Shift lead at Plant A" unless the page needs more. */
  readonly label?: string;
  /** Where focus goes after the removal: the next row's link, else the page's add action (NO24). */
  readonly focusAfter: () => HTMLElement | null;
}

/**
 * What the Remove dialog says the person loses. A reader who may not read the role does not know
 * its permissions, and a page without the person's other roles does not know what they keep, so
 * the dialog names none and claims nothing about what the person keeps (NO5).
 */
function removalDescription(
  person: RemovePerson,
  assignment: RemoveAssignment,
  lost: readonly string[] | undefined,
) {
  const place = assignment.scope.name;
  if (assignment.role === null || lost === undefined) {
    return `From the next action, ${person.name} loses the permissions of this role at ${place} that no other role grants.`;
  }
  return lost.length === 0
    ? `${person.name} keeps every permission through other roles.`
    : `From the next action, ${person.name} loses these permissions at ${place}:`;
}

/** The message of a refused removal: the grant rule's, or the API's own, or the connection. */
function removalFailure(error: unknown, assignment: RemoveAssignment): Error {
  const missing = missingPermissionsOf(error);
  if (missing !== undefined) {
    return new Error(
      `You cannot remove ${assignment.role?.name ?? 'this role'} at ${assignment.scope.name}. It includes permissions you do not hold there: ${permissionList(missing)}.`,
    );
  }
  return new Error(
    `Could not remove the role. ${error instanceof Error ? error.message : 'Check the connection, then try again.'}`,
  );
}

/**
 * Remove on a role of a person (design core-304, AS7 and NO24), on a user's Access tab and on
 * People in plant settings: an alert dialog that names what the person loses, with an optional
 * reason that has focus. Escape or Cancel go back to Remove. The removed assignment leaves the
 * person's roles, the role's holders and the people of the plant in the cache.
 */
export function RemoveRole({ person, assignment, lost, label, focusAfter }: RemoveRoleProps) {
  const [reason, setReason] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const [remove] = useMutation(CoreRemoveRoleAssignment, {
    update(cache) {
      cache.modify({
        id: cache.identify({ __typename: 'User', id: person.id }),
        fields: {
          roleAssignments: (refs: readonly { __ref: string }[], { readField }) =>
            refs.filter((ref) => readField('id', ref) !== assignment.id),
          // What the person can do is computed from the roles, so it is read again.
          effectivePermissions: (_value, { DELETE }) => DELETE,
        },
      });
      cache.modify({
        fields: {
          corePlantRoleAssignments: (refs: readonly { __ref: string }[], { readField }) =>
            refs.filter((ref) => readField('id', ref) !== assignment.id),
        },
      });
      removeHolder(cache, assignment.role?.id, assignment.id);
    },
  });
  const role = assignment.role?.name;
  const place = assignment.scope.name;
  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="outline"
          aria-label={
            label ?? (role === undefined ? `Remove role at ${place}` : `Remove ${role} at ${place}`)
          }
        >
          Remove
        </Button>
      }
      title={
        role === undefined
          ? `Remove a role at ${place} from ${person.name}?`
          : `Remove ${role} at ${place} from ${person.name}?`
      }
      description={removalDescription(person, assignment, lost)}
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
          `${role ?? 'The role'} at ${place} removed from ${person.name}. It applies from ${person.name}'s next action.`,
        );
      }}
    >
      {lost !== undefined && lost.length > 0 && (
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
