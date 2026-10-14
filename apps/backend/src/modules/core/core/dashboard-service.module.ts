// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service.ts';

/** Provides core's DashboardService. */
@Module({ providers: [DashboardService], exports: [DashboardService] })
export class DashboardServiceModule {}
