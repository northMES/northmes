// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ProductionOrderService } from './production-order.service.ts';

/**
 * Provides planning's ProductionOrderService: plain providers and no resolvers. planning's
 * production order surface imports it, and other modules import it through planning's
 * public-api.ts (ADR 0003).
 */
@Module({ providers: [ProductionOrderService], exports: [ProductionOrderService] })
export class ProductionOrderServiceModule {}
