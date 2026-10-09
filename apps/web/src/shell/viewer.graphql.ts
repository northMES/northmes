// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreViewerDocument as CoreViewer,
  type CoreViewerQuery,
  type CoreViewerQueryVariables,
} from './viewer.graphql.gen.ts';

// What the signed-in user holds at the plant in the URL and at its company, from which the shell
// shows the entries that need a permission, in the sidebar, in the settings navigations and behind
// the Settings button. The plant's client sends it; company settings send it without a plant and
// with the company's id. pnpm gen writes its typed document to viewer.graphql.gen.ts; this block
// never runs.
if (false) {
  gql`
    query CoreViewer($companyId: ID) {
      coreViewer(companyId: $companyId) {
        userId
        plantPermissions
        companyPermissions
      }
    }
  `;
}
