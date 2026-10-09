// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUnblockUserDocument as CoreUnblockUser,
  type CoreUnblockUserMutation,
  type CoreUnblockUserMutationVariables,
} from './unblock-user.graphql.gen.ts';

// Unblocks a user of the company; the answer's blocked updates the user in the cache. pnpm gen
// writes its typed document to unblock-user.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreUnblockUser($input: CoreUnblockUserInput!) {
      coreUnblockUser(input: $input) {
        id
        blocked
      }
    }
  `;
}
