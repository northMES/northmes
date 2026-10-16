// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { DashboardTabRecord } from '../../../core/dashboard.service.ts';
import { DashboardWidget, toDashboardWidget } from './dashboard-widget.type.ts';

/** Who sees a dashboard tab (ADR 0078). */
export enum DashboardTabScope {
  /** Everyone at the company, at each of its plants. */
  COMPANY = 'company',
  /** Everyone at the plant. */
  PLANT = 'plant',
  /** The signed-in user alone, at each plant of the company. */
  OWN = 'own',
}

registerEnumType(DashboardTabScope, {
  name: 'DashboardTabScope',
  description: 'Who sees a dashboard tab.',
  valuesMap: {
    COMPANY: { description: 'Everyone at the company, at each of its plants.' },
    PLANT: { description: 'Everyone at the plant.' },
    OWN: { description: 'The signed-in user alone, at each plant of the company.' },
  },
});

/** A tab of the dashboard, with the widgets of its layout (ADR 0078, design shell-454). */
@ObjectType('DashboardTab', {
  description: 'A tab of the dashboard, with the widgets of its layout.',
})
export class DashboardTab {
  @Field(() => ID, { description: "The tab's id." }) id!: string;
  @Field(() => String, { description: "The tab's name." }) name!: string;
  @Field(() => DashboardTabScope, { description: 'Who sees the tab.' }) scope!: DashboardTabScope;
  @Field(() => Int, {
    description:
      'Grows by one with every change to the tab; coreSaveDashboardTab sends it as expectedVersion.',
  })
  version!: number;
  /** The page shows Edit layout for a tab with canEdit (design shell-454, A4). */
  @Field(() => Boolean, {
    description:
      "True when the user may change the tab's layout: an own tab, or a shared tab where the user holds core.dashboardTab:manage.",
  })
  canEdit!: boolean;
  @Field(() => [DashboardWidget], { description: "The widgets of the tab's layout." })
  widgets!: DashboardWidget[];
}

/** A tab as the service hands it out, as the DashboardTab type answers it. */
export function toDashboardTab(tab: DashboardTabRecord): DashboardTab {
  return {
    id: tab.id,
    name: tab.name,
    scope: tab.scope as DashboardTabScope,
    version: tab.version,
    canEdit: tab.canEdit,
    widgets: tab.widgets.map(toDashboardWidget),
  };
}
