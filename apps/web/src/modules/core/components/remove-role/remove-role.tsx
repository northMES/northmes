// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { missingPermissionsOf, permissionCount, permissionList } from '../../access-refusal.ts';
import { permissionPhrase } from '../../no-access.tsx';
import { permissionLine } from '../../permission-names.ts';
import { removeHolder } from '../../role-cache.ts';
import { usePlaces } from '../../use-places.ts';
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
  /**
   * What the person's other roles still let them do of the role's permissions, one sentence per
   * role, such as "Viewer at Acme AB still lets Sara Nyberg read job orders." (AS7); none when the
   * page does not know the person's other roles.
   */
  readonly kept?: readonly string[];
  /** The button's accessible name; "Remove Shift lead at Plant A" unless the page needs more. */
  readonly label?: string;
  /** Where focus goes after the removal: the next row's link, else the page's add action (NO24). */
  readonly focusAfter: () => HTMLElement | null;
  /** Called when the dialog opens, so the page can read what the person loses (People). */
  readonly onOpen?: () => void;
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

/**
 * The message of a refused removal (design core-304, AS7; WCAG 3.3.1 and 3.3.3), by its code: the
 * assignment permission or the grant rule at the place, or the last Company admin, each with who
 * can act. The server's own text never shows.
 */
function removalFailure(
  error: unknown,
  person: RemovePerson,
  assignment: RemoveAssignment,
  companyName: string,
): Error {
  const role = assignment.role?.name ?? 'this role';
  const place = assignment.scope.name;
  const cannot = `You cannot remove ${role} at ${place}.`;
  const askAdmin = `Ask a company admin of ${companyName} to remove it.`;
  const missing = missingPermissionsOf(error);
  if (missing !== undefined) {
    return new Error(
      `${cannot} It includes ${permissionCount(missing.length)} you do not hold at ${place}: ${permissionList(missing)}. ${askAdmin}`,
    );
  }
  if (hasErrorCode(error, 'core.last_admin')) {
    return new Error(
      `You cannot remove ${role} at ${place} from ${person.name}, the last ${role} of ${companyName}. Give ${role} at ${place} to another person first.`,
    );
  }
  if (hasErrorCode(error, 'core.forbidden')) {
    return new Error(
      `${cannot} Removing a role at ${place} needs ${permissionPhrase('core.roleAssignment:manage')} there. ${askAdmin}`,
    );
  }
  return new Error('Could not remove the role. Check the connection, then try again.');
}

/**
 * Remove on a role of a person (design core-304, AS7 and NO24), on a user's Access tab and on
 * People in plant settings: an alert dialog that names what the person loses and what the person's
 * other roles still let them do, with an optional reason that has focus. Escape or Cancel go back to Remove. The removed assignment leaves the
 * person's roles, the role's holders and the people of the plant in the cache.
 */
export function RemoveRole({
  person,
  assignment,
  lost,
  kept = [],
  label,
  focusAfter,
  onOpen,
}: RemoveRoleProps) {
  const places = usePlaces();
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
        if (!open) return;
        setReason('');
        onOpen?.();
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
          throw removalFailure(error, person, assignment, places.company?.name ?? 'the company');
        }
        announce(
          `${role ?? 'The role'} at ${place} removed from ${person.name}. It applies from ${person.name}'s next action.`,
        );
      }}
    >
      {lost !== undefined && lost.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {lost.map((key) => (
            <li key={key}>{permissionLine(key)}</li>
          ))}
        </ul>
      )}
      {kept.map((sentence) => (
        <p key={sentence} className="text-sm text-muted-foreground">
          {sentence}
        </p>
      ))}
      <TextareaField
        ref={field}
        label="Reason"
        optional
        placeholder="Why you remove this role"
        hint="Shown in the user's history. Do not enter personal data. Up to 500 characters."
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
}
