// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { DashboardServiceModule } from '../../core/dashboard-service.module.ts';
import { DashboardQueryResolver } from './queries/dashboard.query.resolver.ts';

/** core's surfaces for the dashboard: its GraphQL query (ADR 0078). */
@Module({
  imports: [DashboardServiceModule],
  providers: [DashboardQueryResolver],
})
export class DashboardModule {}
