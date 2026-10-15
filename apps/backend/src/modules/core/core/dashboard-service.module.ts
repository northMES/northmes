// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { SaveDashboardTabCommand } from './commands/save-dashboard-tab.handler.ts';
import { DashboardService } from './dashboard.service.ts';

/**
 * Provides core's DashboardService and registers the dashboard command it sends, so boot checks
 * its permission (ADR 0012).
 */
@Module({
  providers: [DashboardService, SaveDashboardTabCommand],
  exports: [DashboardService],
})
export class DashboardServiceModule {}
