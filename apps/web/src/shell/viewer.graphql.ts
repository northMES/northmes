// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreViewerDocument as CoreViewer,
  type CoreViewerQuery,
  type CoreViewerQueryVariables,
} from './viewer.graphql.gen.ts';

// What the signed-in user holds at the plant in the URL, from which the sidebar shows the entries
// that need a permission, such as Administration's. The plant's client sends it. pnpm gen writes
// its typed document to viewer.graphql.gen.ts; this block never runs.
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
