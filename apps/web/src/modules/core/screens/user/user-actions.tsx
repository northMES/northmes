// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Ban, CircleCheck, KeyRound } from 'lucide-react';
import { type ReactElement, useRef, useState } from 'react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { useCompanyVariables } from '../../use-places.ts';
import { CoreBlockUser } from './block-user.graphql.ts';
import { CoreResetPassword } from './reset-password.graphql.ts';
import { TemporaryPasswordDialog } from './temporary-password-dialog.tsx';
import { CoreUnblockUser } from './unblock-user.graphql.ts';

/** What the actions read of a user: their name, whether they are blocked, and their roles. */
export interface ActionUser {
  readonly id: string;
  readonly name: string;
  readonly blocked: boolean;
  readonly roleAssignments: readonly {
    readonly scope: { readonly name: string };
    readonly role: { readonly name: string } | null;
  }[];
}

/** The id of the top bar's Block user or Unblock user, where focus goes after a confirm. */
const blockActionId = 'user-block-action';

/** The id of the top bar's Reset password, where focus goes after Done. */
const resetActionId = 'user-reset-action';

/** The hint under every reason of these dialogs (design core-304, US11 to US16). */
const reasonHint = "Shown in the user's history. Do not enter personal data. Up to 500 characters.";

/** The longest reason the commands take. */
const reasonMaxLength = 500;

/** The message of a refused action: the API's reason, or a hint at the connection. */
function failure(error: unknown, action: string): Error {
  if (!CombinedGraphQLErrors.is(error)) {
    return new Error(`Could not ${action}. Check the connection, then try again.`);
  }
  const reasons = error.errors.map(({ message }) =>
    /[.!?]$/.test(message) ? message : `${message}.`,
  );
  return new Error(`Could not ${action}. ${reasons.join(' ')}`);
}

/** "A, B and C", the way the copy joins a list. */
function joinAnd(items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** The line of Unblock user that names the roles that stayed (design core-304, US13). */
function rolesThatStayed(user: ActionUser): string {
  if (user.roleAssignments.length === 0) return `${user.name} holds no role.`;
  const roles = user.roleAssignments.map(
    ({ role, scope }) => `${role?.name ?? 'A role'} at ${scope.name}`,
  );
  return `The roles stayed while the user was blocked: ${joinAnd(roles)}.`;
}

/** The input of a command on the user, with the reason when one is typed. */
function inputOf(user: ActionUser, company: { companyId?: string }, reason: string) {
  return { id: user.id, ...company, ...(reason.trim() !== '' && { reason: reason.trim() }) };
}

export interface UserDialogProps {
  readonly user: ActionUser;
  /** The button that opens the dialog; without it, open and onOpenChange control it. */
  readonly trigger?: ReactElement;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Where focus goes once the action is done; the trigger, or the page's own, without it. */
  readonly focusAfter?: () => HTMLElement | null;
}

/**
 * Block user or Unblock user as a ConfirmDialog (design core-304, US11 to US14): what happens and
 * that the roles stay, the optional reason with its hint, which has focus, and the confirm button,
 * which only for a block has the destructive look. After the confirm the polite region says what
 * changed.
 */
export function BlockUserDialog({
  user,
  trigger,
  open,
  onOpenChange,
  focusAfter,
}: UserDialogProps) {
  const [reason, setReason] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const [block] = useMutation(CoreBlockUser);
  const [unblock] = useMutation(CoreUnblockUser);
  const company = useCompanyVariables();
  const input = inputOf(user, company, reason);
  return (
    <ConfirmDialog
      trigger={trigger}
      open={open}
      title={user.blocked ? `Unblock ${user.name}?` : `Block ${user.name}?`}
      description={
        user.blocked
          ? `${user.name} can sign in again with the current password.`
          : `${user.name} is signed out within a minute and cannot sign in until unblocked.`
      }
      details={
        user.blocked
          ? rolesThatStayed(user)
          : 'The roles stay, so unblocking gives the same access back.'
      }
      confirmLabel={user.blocked ? 'Unblock user' : 'Block user'}
      destructive={!user.blocked}
      initialFocus={field}
      onOpenChange={(next) => {
        if (next) setReason('');
        onOpenChange?.(next);
      }}
      focusAfterConfirm={focusAfter}
      onConfirm={async () => {
        try {
          if (user.blocked) await unblock({ variables: { input } });
          else await block({ variables: { input } });
        } catch (error) {
          throw failure(error, user.blocked ? 'unblock the user' : 'block the user');
        }
        announce(
          user.blocked
            ? `${user.name} is unblocked and can sign in again.`
            : `${user.name} is blocked and signed out within a minute.`,
        );
      }}
    >
      <TextareaField
        ref={field}
        label="Reason"
        optional
        hint={reasonHint}
        maxLength={reasonMaxLength}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
}

/**
 * Reset password as a ConfirmDialog (design core-304, US15 to US18): what happens, the optional
 * reason with its placeholder and hint, which has focus, and Reset password. Confirming opens the
 * Temporary password dialog of the reset, with focus on Copy password; Done closes it, the password
 * is gone, and focus goes where focusAfter says. Nothing is announced: the dialog is read on open.
 */
export function ResetPasswordDialog({
  user,
  trigger,
  open,
  onOpenChange,
  focusAfter,
}: UserDialogProps) {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState<string | undefined>(undefined);
  const field = useRef<HTMLTextAreaElement>(null);
  const copy = useRef<HTMLButtonElement>(null);
  const [reset] = useMutation(CoreResetPassword);
  const company = useCompanyVariables();
  return (
    <>
      <ConfirmDialog
        trigger={trigger}
        open={open}
        title={`Reset the password of ${user.name}?`}
        description="NorthMES replaces the password with a temporary one and shows it to you once."
        details={`${user.name} must choose a new password at the next sign-in, before anything else.`}
        confirmLabel="Reset password"
        initialFocus={field}
        onOpenChange={(next) => {
          if (next) setReason('');
          onOpenChange?.(next);
        }}
        focusAfterConfirm={() => copy.current}
        onConfirm={async () => {
          try {
            const { data } = await reset({
              variables: { input: inputOf(user, company, reason) },
            });
            setPassword(data?.coreResetPassword.temporaryPassword);
          } catch (error) {
            throw failure(error, 'reset the password');
          }
        }}
      >
        <TextareaField
          ref={field}
          label="Reason"
          optional
          placeholder="Why you reset the password"
          hint={reasonHint}
          maxLength={reasonMaxLength}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </ConfirmDialog>
      {password !== undefined && (
        <TemporaryPasswordDialog
          name={user.name}
          password={password}
          variant="reset"
          open
          copyRef={copy}
          finalFocus={focusAfter}
          onClose={() => setPassword(undefined)}
        />
      )}
    </>
  );
}

export interface UserActionsProps {
  readonly user: ActionUser;
  /** The reader holds core.user:resetPassword where the user belongs. */
  readonly canReset: boolean;
  /** The reader holds core.user:block where the user belongs. */
  readonly canBlock: boolean;
}

/**
 * The page actions of a user (design core-304, AS11 and US11 to US18), outline buttons in this
 * order: Reset password, for an active user and a reader who may reset passwords, then Block user
 * or Unblock user for a reader who may block users. After a block or an unblock, focus goes to the
 * button that takes the place of the one that opened it; after a reset, Done returns focus to
 * Reset password.
 */
export function UserActions({ user, canReset, canBlock }: UserActionsProps) {
  return (
    <>
      {canReset && !user.blocked && (
        <ResetPasswordDialog
          user={user}
          trigger={
            <Button id={resetActionId} variant="outline">
              <KeyRound aria-hidden />
              Reset password
            </Button>
          }
          focusAfter={() => document.getElementById(resetActionId)}
        />
      )}
      {canBlock && (
        <BlockUserDialog
          user={user}
          trigger={
            <Button id={blockActionId} variant="outline">
              {user.blocked ? <CircleCheck aria-hidden /> : <Ban aria-hidden />}
              {user.blocked ? 'Unblock user' : 'Block user'}
            </Button>
          }
          focusAfter={() => document.getElementById(blockActionId)}
        />
      )}
    </>
  );
}
