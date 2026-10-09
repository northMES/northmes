// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreViewerDocument as CoreViewer,
  type CoreViewerQuery,
  type CoreViewerQueryVariables,
} from './viewer.graphql.gen.ts';

// What the signed-in user holds at the plant and at its company, which every access page reads to show only the actions the user can take. pnpm gen writes its typed document to viewer.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreViewer {
      coreViewer {
        userId
        plantPermissions
        companyPermissions
      }
    }
  `;
}
