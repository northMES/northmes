// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors, type ErrorLike } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { BoardOrder } from './board.graphql.ts';
import { PlanningReleaseProductionOrder } from './release.graphql.ts';

/**
 * What a failed release shows: each GraphQL error's message with the errorCode of its DomainError,
 * such as core.command_rejected with the validator's message for a veto, or the message alone of an
 * error that carries no errorCode or never reached the server.
 */
function failureText(error: ErrorLike): string {
  if (!CombinedGraphQLErrors.is(error)) return error.message;
  return error.errors
    .map(({ message, extensions }) =>
      typeof extensions?.errorCode === 'string' ? `${message} (${extensions.errorCode})` : message,
    )
    .join(' ');
}

/**
 * Release on the row of a planned order, with the order's version as the expected version. The
 * button is in its loading state while the release runs, so a double click sends one release. The
 * normalized cache merges the answer into the order, so the row shows Released without another run
 * of the board's query; a failed release leaves the order as it was and shows the failure under
 * the button. An order that is not planned gets no button.
 */
export function ReleaseOrderButton({ order }: { readonly order: BoardOrder }) {
  const [release, { error, loading }] = useMutation(PlanningReleaseProductionOrder);
  if (order.status !== 'planned') return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="outline"
        aria-label={`Release order ${order.number}`}
        loading={loading}
        onClick={() =>
          release({ variables: { input: { id: order.id, expectedVersion: order.version } } })
        }
      >
        Release
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {failureText(error)}
        </p>
      )}
    </div>
  );
}
