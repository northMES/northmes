// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors, type ErrorLike } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
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
 * One order of the board stub. A planned order has a Release button, disabled while its release is
 * in flight, so a double click sends one release. The normalized cache merges a release's answer
 * into this order, so the row shows the new status and version without another run of the board's
 * query; a failed release leaves the order as it was and shows the failure.
 */
export function OrderRow({ order }: { readonly order: BoardOrder }) {
  const [release, { error, loading }] = useMutation(PlanningReleaseProductionOrder);
  return (
    <tr data-testid={`order-${order.number}`}>
      <td>{order.number}</td>
      <td data-testid={`article-${order.number}`}>{order.article?.name}</td>
      <td>{order.quantity}</td>
      <td data-testid={`status-${order.number}`}>{order.status}</td>
      <td data-testid={`version-${order.number}`}>{order.version}</td>
      <td>
        {order.status === 'planned' && (
          <button
            type="button"
            aria-label={`Release order ${order.number}`}
            disabled={loading}
            onClick={() =>
              release({ variables: { input: { id: order.id, expectedVersion: order.version } } })
            }
          >
            Release
          </button>
        )}
        {error && <p role="alert">{failureText(error)}</p>}
      </td>
    </tr>
  );
}
