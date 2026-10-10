// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUsersDocument as CoreUsers,
  type CoreUsersQuery,
  type CoreUsersQueryVariables,
} from './users.graphql.gen.ts';

// The users of the plant's company by name, the people Add role of People offers: the first 100,
// the most one page holds. pnpm gen writes its typed document to users.graphql.gen.ts; this block
// never runs.
if (false) {
  gql`
    query CoreUsers {
      coreUsers(first: 100) {
        edges {
          node {
            id
            name
            username
          }
        }
      }
    }
  `;
}
