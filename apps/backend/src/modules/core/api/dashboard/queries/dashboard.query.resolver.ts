// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { DashboardService } from '../../../core/dashboard.service.ts';
import { DashboardTab, toDashboardTab } from '../types/dashboard-tab.type.ts';

/** core's queries on the dashboard (ADR 0078). */
@Resolver(() => DashboardTab)
export class DashboardQueryResolver {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  /**
   * The dashboard's tabs at the request's plant: the company's, then the plant's, then the
   * signed-in user's own, each in its order. It needs no permission beyond opening the plant.
   */
  @Query(() => [DashboardTab])
  async coreDashboardTabs(): Promise<DashboardTab[]> {
    return (await this.dashboard.tabs()).map(toDashboardTab);
  }
}
