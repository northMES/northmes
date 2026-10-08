// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ProductionOrderService } from './production-order.service.ts';

/**
 * Planning's public service API: plain providers and no resolvers, so a module that imports it adds
 * nothing to its own subgraph (ADR 0003). Other in-repo modules import it through
 * @northmes/module-planning/api.
 */
@Module({ providers: [ProductionOrderService], exports: [ProductionOrderService] })
export class PlanningApiModule {}
