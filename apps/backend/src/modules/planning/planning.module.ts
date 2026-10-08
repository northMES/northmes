// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { CoreApiModule } from '../core/api/index.ts';
import { PlanningApiModule } from './api/planning-api.module.ts';
import { ReleaseProductionOrder } from './commands/release-production-order.ts';
import { ProductionOrderResolver } from './production-order.resolver.ts';

/**
 * The Nest module of planning's server entry: its resolvers and its commands, on top of its own API
 * module and core's (ADR 0003, ADR 0012).
 */
@Module({
  imports: [PlanningApiModule, CoreApiModule],
  providers: [ProductionOrderResolver, ReleaseProductionOrder],
})
export class PlanningModule {}
