// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Ban, CircleCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { useCompanyVariables } from '../../use-places.ts';
import type { User } from '../../use-user.tsx';
import { CoreBlockUser } from './block-user.graphql.ts';
import { CoreUnblockUser } from './unblock-user.graphql.ts';

/** The id of the top bar button that the other one replaces, where focus goes after a confirm. */
const actionId = 'user-block-action';

/** The message of a refused block or unblock: the API's reason, or a hint at the connection. */
function failure(error: unknown, verb: 'block' | 'unblock'): Error {
  if (!CombinedGraphQLErrors.is(error)) {
    return new Error(`Could not ${verb} the user. Check the connection, then try again.`);
  }
  const reasons = error.errors.map(({ message }) =>
    /[.!?]$/.test(message) ? message : `${message}.`,
  );
  return new Error(`Could not ${verb} the user. ${reasons.join(' ')}`);
}

/**
 * Block user or Unblock user in the page actions (design core-304, US11 to US14): ConfirmDialog
 * with an optional reason, which has focus when it opens. After the confirm, focus goes to the
 * button that takes the place of the one that opened it, and the polite region says what changed.
 */
export function UserBlockAction({ user }: { readonly user: User }) {
  const [reason, setReason] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const [block] = useMutation(CoreBlockUser);
  const [unblock] = useMutation(CoreUnblockUser);
  const company = useCompanyVariables();
  const verb = user.blocked ? 'unblock' : 'block';
  const input = {
    id: user.id,
    ...company,
    ...(reason.trim() !== '' && { reason: reason.trim() }),
  };
  return (
    <ConfirmDialog
      trigger={
        <Button id={actionId} variant={user.blocked ? 'outline' : 'destructive'}>
          {user.blocked ? <CircleCheck aria-hidden /> : <Ban aria-hidden />}
          {user.blocked ? 'Unblock user' : 'Block user'}
        </Button>
      }
      title={user.blocked ? `Unblock ${user.name}?` : `Block ${user.name}?`}
      description={
        user.blocked
          ? `${user.name} can sign in again with their password.`
          : `${user.name} cannot sign in, and is signed out within a minute. Their roles stay.`
      }
      confirmLabel={user.blocked ? 'Unblock user' : 'Block user'}
      destructive={!user.blocked}
      initialFocus={field}
      onOpenChange={(open) => {
        if (open) setReason('');
      }}
      focusAfterConfirm={() => document.getElementById(actionId)}
      onConfirm={async () => {
        try {
          if (user.blocked) await unblock({ variables: { input } });
          else await block({ variables: { input } });
        } catch (error) {
          throw failure(error, verb);
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
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
}
