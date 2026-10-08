// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ProductionOrderService } from './production-order.service.ts';

/**
 * Planning's public service API: plain providers and no resolvers (ADR 0003). Other modules import
 * it through planning's api/index.ts.
 */
@Module({ providers: [ProductionOrderService], exports: [ProductionOrderService] })
export class PlanningApiModule {}
