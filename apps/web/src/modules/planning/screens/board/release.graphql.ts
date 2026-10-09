// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  PlanningReleaseProductionOrderDocument as PlanningReleaseProductionOrder,
  type PlanningReleaseProductionOrderMutation,
  type PlanningReleaseProductionOrderMutationVariables,
} from './release.graphql.gen.ts';

// Releases a planned production order through the command planning.releaseProductionOrder (ADR
// 0012). The answer carries the order's id, so the normalized cache merges its new status and
// version into the order the board's query holds. pnpm gen writes its typed document to
// release.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation PlanningReleaseProductionOrder($input: PlanningReleaseProductionOrderInput!) {
      planningReleaseProductionOrder(input: $input) {
        id
        status
        version
      }
    }
  `;
}
