// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreUsersDocument as CoreUsers,
  type CoreUsersQuery,
  type CoreUsersQueryVariables,
} from './users.graphql.gen.ts';

// One page of the company's users, by name unless orderBy says otherwise and narrowed by a role, a
// place and status, each with their roles at the company and its plants: in company settings with
// companyId, or at the plant without it, with their roles at the plant and the company (ADR 0091).
// A role the reader may not read comes as null. pnpm gen writes its typed document to
// users.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreUsers(
      $companyId: ID
      $first: Int
      $after: String
      $last: Int
      $before: String
      $search: String
      $orderBy: [UserOrderBy!]
      $roleId: ID
      $placeId: ID
      $blocked: Boolean
    ) {
      coreUsers(
        companyId: $companyId
        first: $first
        after: $after
        last: $last
        before: $before
        search: $search
        orderBy: $orderBy
        roleId: $roleId
        placeId: $placeId
        blocked: $blocked
      ) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
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
              }
            }
          }
        }
      }
    }
  `;
}
