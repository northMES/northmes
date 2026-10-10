// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUsersDocument as CoreUsers,
  type CoreUsersQuery,
  type CoreUsersQueryVariables,
} from './users.graphql.gen.ts';

// The users of the plant's company whose name or username holds the search, by name, the first 20:
// the Person picker of People's Add role, which searches as the user types. pnpm gen writes its
// typed document to users.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreUsers($search: String) {
      coreUsers(first: 20, search: $search) {
        edges {
          node {
            id
            name
            username
            blocked
          }
        }
      }
    }
  `;
}
