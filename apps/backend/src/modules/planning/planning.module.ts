// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { PlanningApiModule } from './api/planning-api.module.ts';
import { ReleaseProductionOrder } from './commands/release-production-order.ts';
import { ProductionOrderResolver } from './production-order.resolver.ts';

/**
 * The Nest module of planning's subgraph: its resolvers and its commands, on top of its own API
 * module (ADR 0003, ADR 0012).
 */
@Module({
  imports: [PlanningApiModule],
  providers: [ProductionOrderResolver, ReleaseProductionOrder],
})
export class PlanningModule {}
