// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';
import type { releaseProductionOrder } from '@northmes/planning-contracts';
import type { z } from 'zod';

// Hand-written types of the release mutation, until GraphQL codegen writes them. The input type
// comes from the command's contract, the source the SDK builds the mutation's input from (ADR 0017).

/** The released order: its id, so the cache finds the board's row, with its new status and version. */
export interface ReleasedOrder {
  readonly __typename: 'ProductionOrder';
  readonly id: string;
  readonly status: string;
  readonly version: number;
}

/**
 * Releases a planned production order through the command planning.releaseProductionOrder (ADR
 * 0012). The normalized cache merges the answer into the order the board's query holds.
 */
export const PlanningReleaseProductionOrder: TypedDocumentNode<
  { readonly planningReleaseProductionOrder: ReleasedOrder },
  { readonly input: z.input<typeof releaseProductionOrder.input> }
> = gql`
  mutation PlanningReleaseProductionOrder($input: PlanningReleaseProductionOrderInput!) {
    planningReleaseProductionOrder(input: $input) {
      id
      status
      version
    }
  }
`;
