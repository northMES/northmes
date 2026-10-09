// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import type { CoreCompaniesQuery } from './companies.graphql.gen.ts';

export {
  CoreCompaniesDocument as CoreCompanies,
  type CoreCompaniesQuery,
  type CoreCompaniesQueryVariables,
} from './companies.graphql.gen.ts';

/** A company where the user holds a role, with the plants of it that the user may open. */
export type ShellCompany = CoreCompaniesQuery['coreCompanies'][number];

/** A plant the user may open. */
export type ShellPlant = ShellCompany['plants'][number];

// The user's companies and plants, which the plant switcher, the plant crumb and the page for a
// plant the user cannot open show. The shell sends it without x-northmes-plant: the answer is the
// same at every plant. pnpm gen writes its typed document to companies.graphql.gen.ts; this block
// never runs.
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
