// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreCompaniesDocument as CoreCompanies,
  type CoreCompaniesQuery,
  type CoreCompaniesQueryVariables,
} from './companies.graphql.gen.ts';

// The user's companies and plants, from which the access pages take the ids and names of the plant
// in the URL and of its company, the two places where roles are given. pnpm gen writes its typed
// document to companies.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreCompanies {
      coreCompanies {
        id
        name
        plants {
          id
          slug
          name
        }
      }
    }
  `;
}
