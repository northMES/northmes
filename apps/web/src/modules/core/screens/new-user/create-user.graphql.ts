// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreCreateUserDocument as CoreCreateUser,
  type CoreCreateUserMutation,
  type CoreCreateUserMutationVariables,
} from './create-user.graphql.gen.ts';

// Creates a user of the company and returns the user with the temporary password, which the
// user's page shows once. pnpm gen writes its typed document to create-user.graphql.gen.ts; this
// block never runs.
if (false) {
  gql`
    mutation CoreCreateUser($input: CoreCreateUserInput!) {
      coreCreateUser(input: $input) {
        temporaryPassword
        user {
          id
          name
          username
          blocked
          roleAssignments {
            id
            scope {
              id
              kind
              name
            }
            role {
              id
              name
              permissions
            }
            # The roles list counts the assignment among the role's holders by its user.
            user {
              id
            }
          }
        }
      }
    }
  `;
}
