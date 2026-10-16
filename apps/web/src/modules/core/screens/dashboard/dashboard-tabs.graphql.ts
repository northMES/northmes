// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreDashboardTabsQuery } from './dashboard-tabs.graphql.gen.ts';

export {
  CoreDashboardTabsDocument as CoreDashboardTabs,
  type CoreDashboardTabsQuery,
  type CoreDashboardTabsQueryVariables,
} from './dashboard-tabs.graphql.gen.ts';

/** A tab of the dashboard with the widgets of its layout. */
export type DashboardTab = CoreDashboardTabsQuery['coreDashboardTabs'][number];

/** A widget placed on a tab. */
export type DashboardWidget = DashboardTab['widgets'][number];

// The dashboard's tabs at the plant: the company's, then the plant's, then the user's own (ADR
// 0078). pnpm gen writes its typed document to dashboard-tabs.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreDashboardTabs {
      coreDashboardTabs {
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
