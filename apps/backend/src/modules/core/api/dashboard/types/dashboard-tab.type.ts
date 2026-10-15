// SPDX-License-Identifier: AGPL-3.0-or-later
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

registerEnumType(DashboardTabScope, { name: 'DashboardTabScope' });

/** A tab of the dashboard, with the widgets of its layout (ADR 0078, design shell-454). */
@ObjectType('DashboardTab')
export class DashboardTab {
  @Field(() => ID) id!: string;
  @Field(() => String) name!: string;
  @Field(() => DashboardTabScope) scope!: DashboardTabScope;
  /** Grows by one with every change to the tab; Done sends it as expectedVersion. */
  @Field(() => Int) version!: number;
  /**
   * True when the user may change the tab's layout: an own tab, or a shared tab where the user
   * holds core.dashboardTab:manage. The page shows Edit layout for it (design shell-454, A4).
   */
  @Field(() => Boolean) canEdit!: boolean;
  @Field(() => [DashboardWidget]) widgets!: DashboardWidget[];
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
