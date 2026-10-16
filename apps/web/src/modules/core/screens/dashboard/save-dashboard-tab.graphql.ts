// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreSaveDashboardTabDocument as CoreSaveDashboardTab,
  type CoreSaveDashboardTabMutation,
  type CoreSaveDashboardTabMutationVariables,
} from './save-dashboard-tab.graphql.gen.ts';

// Saves one edit session of a tab, its layout as JSON with the version the session started from
// (ADR 0078). The answer's tab replaces the cached one. pnpm gen writes its typed document to
// save-dashboard-tab.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreSaveDashboardTab($input: CoreSaveDashboardTabInput!) {
      coreSaveDashboardTab(input: $input) {
        id
        name
        scope
        version
        canEdit
        widgets {
          id
          type
          contribution
          size
          x
          y
          title
        }
      }
    }
  `;
}
