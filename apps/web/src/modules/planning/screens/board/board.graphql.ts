// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import type { PlanningBoardQuery } from './board.graphql.gen.ts';

export {
  PlanningBoardDocument as PlanningBoard,
  type PlanningBoardQuery,
  type PlanningBoardQueryVariables,
} from './board.graphql.gen.ts';

/** One production order on the board, with the article that the core module resolves. */
export type BoardOrder = PlanningBoardQuery['planningProductionOrders'][number];

// The production orders of the plant that the Apollo client's x-northmes-plant header names. An
// order's article is null when core has none at the request's scopes, so the reader cannot see it.
// pnpm gen writes its typed document to board.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query PlanningBoard {
      planningProductionOrders {
        id
        number
        quantity
        status
        version
        article {
          id
          code
          name
        }
      }
    }
  `;
}
