// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';

// Hand-written types of the board's operations, until GraphQL codegen writes them.

/** One production order on the board, with the article that the core subgraph resolves. */
export interface BoardOrder {
  readonly __typename: 'ProductionOrder';
  readonly id: string;
  readonly number: string;
  /** Decimal text with six decimals. */
  readonly quantity: string;
  readonly status: string;
  /** Null when core holds no article for the order's article id. */
  readonly article: {
    readonly __typename: 'Article';
    readonly id: string;
    readonly name: string;
  } | null;
}

/** The production orders of the plant that the Apollo client's x-northmes-plant header names. */
export const PlanningBoard: TypedDocumentNode<
  { readonly planningProductionOrders: readonly BoardOrder[] },
  Record<string, never>
> = gql`
  query PlanningBoard {
    planningProductionOrders {
      id
      number
      quantity
      status
      article {
        id
        name
      }
    }
  }
`;
