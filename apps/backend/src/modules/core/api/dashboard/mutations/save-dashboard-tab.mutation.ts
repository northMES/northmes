// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { saveDashboardTab } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { DashboardService } from '../../../core/dashboard.service.ts';
import { DashboardTab, toDashboardTab } from '../types/dashboard-tab.type.ts';

/** The input type of the mutation, registered when the module loads. */
const SaveDashboardTabInput = commandInput(saveDashboardTab);

/**
 * The mutation coreSaveDashboardTab, whose input type the SDK builds from the contract of
 * core.saveDashboardTab. It calls DashboardService.save, which sends the command through the
 * command bus, as every surface does (ADR 0073).
 */
@Resolver(() => DashboardTab)
export class SaveDashboardTabMutation {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  /** Saves one edit session of a tab's layout, from Edit layout to Done. */
  @Mutation(() => DashboardTab)
  async coreSaveDashboardTab(
    @Args('input', { type: () => SaveDashboardTabInput }) input: unknown,
  ): Promise<DashboardTab> {
    return toDashboardTab(await this.dashboard.save(input));
  }
}
