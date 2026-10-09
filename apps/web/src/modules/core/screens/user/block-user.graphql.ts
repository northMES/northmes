// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreBlockUserDocument as CoreBlockUser,
  type CoreBlockUserMutation,
  type CoreBlockUserMutationVariables,
} from './block-user.graphql.gen.ts';

// Blocks a user of the company; the answer's blocked updates the user in the cache. pnpm gen
// writes its typed document to block-user.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreBlockUser($input: CoreBlockUserInput!) {
      coreBlockUser(input: $input) {
        id
        blocked
      }
    }
  `;
}
