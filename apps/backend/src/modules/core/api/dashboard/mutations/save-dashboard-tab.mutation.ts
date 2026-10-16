// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { saveDashboardTab } from '@northmes/core-contracts';
import { commandInputArg } from '@northmes/sdk/commands';
import { DashboardService } from '../../../core/dashboard.service.ts';
import { DashboardTab, toDashboardTab } from '../types/dashboard-tab.type.ts';

/**
 * The mutation coreSaveDashboardTab, whose input type the SDK builds from the contract of
 * core.saveDashboardTab. It calls DashboardService.save, which sends the command through the
 * command bus, as every surface does (ADR 0073).
 */
@Resolver(() => DashboardTab)
export class SaveDashboardTabMutation {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Mutation(() => DashboardTab, { description: saveDashboardTab.description })
  async coreSaveDashboardTab(
    @Args('input', commandInputArg(saveDashboardTab)) input: unknown,
  ): Promise<DashboardTab> {
    return toDashboardTab(await this.dashboard.save(input));
  }
}
